// Netlify Background Function — the filename MUST end in "-background" for
// Netlify to treat it specially: it returns a 202 to the caller instantly
// and lets this handler keep running for up to 15 minutes server-side,
// instead of the 10s ceiling that kills a normal synchronous function
// (and was breaking generate-room's ~20s Gemini call in production).
//
// This lives outside src/routes/api on purpose — TanStack Start's file
// routes compile into the *synchronous* Netlify function, so a route
// defined there is still subject to the 10s limit no matter what it does
// internally. Background Functions are a separate Netlify primitive with
// their own deploy path (netlify/functions/*-background.ts), which is why
// this can't just be "generate-room.ts changed to await longer."
//
// Not SSE/streaming — the progressive blur→sharp reveal is dropped for
// this first version (per the UX decision already made). This calls the
// same underlying Gemini prompt as the old generate-room.ts, but via the
// non-streaming geminiImageEdit (already used by swap-product.ts) since
// nothing is listening on an open connection to stream to.
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { dataUrlToInline, geminiImageEdit } from "../../src/lib/gemini.server";

interface Payload {
  generationId: string;
  userId: string;
  roomImage: string;
  style: string;
  roomType?: string;
  palette?: string;
  paletteColors?: string[];
  prompt?: string;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "" };

  let payload: Payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "bad json" };
  }

  const { generationId, userId, roomImage, style, roomType, palette, paletteColors, prompt } =
    payload;
  if (!generationId || !userId || !roomImage || !style) {
    return { statusCode: 400, body: "missing required fields" };
  }

  // Service-role client — same as authServer.ts's getAdminClient(), but
  // this file lives outside src/ so it can't import that helper directly
  // (Netlify bundles netlify/functions independently); duplicating the
  // two-line client construction here is simpler than restructuring
  // imports across the Netlify/TanStack boundary.
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {
    const inline = dataUrlToInline(roomImage);

    const paletteLine =
      paletteColors && paletteColors.length > 0
        ? `Color palette: use these exact colors across furniture, textiles, walls accents, and decor — ${paletteColors.join(", ")}${
            palette ? ` (the "${palette}" palette)` : ""
          }. Every major furniture piece and soft furnishing should visibly draw from this palette.`
        : `Color palette: ${palette ?? "neutral"}.`;

    const userLine =
      prompt && prompt.trim()
        ? `\n\nAdditional instructions from the user — follow these closely, they take priority over the general style direction above (but never override the STRICT RULES below): ${prompt.trim()}`
        : "";

    // Same prompt text as the original generate-room.ts — unchanged so the
    // actual design output doesn't shift as a side effect of this rebuild.
    const resultDataUrl = await geminiImageEdit({
      parts: [
        { inlineData: inline },
        {
          text: `The attached image is a real photo of a room. You are an image editor, not an image generator.

CRITICAL EDITING INSTRUCTIONS:
Do NOT generate a new room or reinterpret the space. Your job is to redecorate the EXISTING space shown in the attached photo, editing that exact photo in place. This can include removing or replacing existing furniture and decor with new ${style} pieces — you are not limited to filling empty space.

Design direction: furnish it as a ${roomType ?? "living room"} in a ${style} style. ${paletteLine}${userLine}

STRICT RULES:
1. Preserve the room's exact walls, windows, flooring, ceiling, ceiling height, ceiling fixtures, and camera angle/perspective 100% as they appear in the input photo. Do not shift, crop, re-frame, or rebuild any part of the room's structure.
2. Do not change the room's proportions or invent architectural features that aren't in the source photo.
3. You may remove, replace, or add furniture and decor anywhere in the room to satisfy the style, palette, and user instructions above — just never touch the structural elements from rule 1.
4. Keep the room's lighting direction and shadows consistent with the original photo; you may shift color temperature and tone as needed to match the requested palette.
5. Photorealistic, high detail, seamlessly composited into the original photo.`,
        },
      ],
    });

    // Upload to the "generations" working bucket rather than writing the
    // base64 blob into the row — same reasoning as save-generation.ts's
    // gallery upload: keeps the DB row (and the Realtime payload the
    // frontend receives) small instead of pushing a multi-MB image
    // through a postgres_changes event.
    const m = resultDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!m) throw new Error("Gemini returned an unexpected image format");
    const mime = m[1];
    const ext = mime.split("/")[1].replace("+xml", "");
    const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    const path = `${generationId}.${ext}`;

    const up = await supabase.storage
      .from("generations")
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (up.error) throw new Error(up.error.message);

    const { data: pub } = supabase.storage.from("generations").getPublicUrl(path);

    await supabase
      .from("generations")
      .update({ status: "done", result_url: pub.publicUrl })
      .eq("id", generationId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`generate-room-background failed for ${generationId}:`, msg);
    await supabase
      .from("generations")
      .update({ status: "failed", error: msg })
      .eq("id", generationId);

    // The credit was already deducted by /api/consume-credit before this
    // job was even created (dashboard.tsx calls it up-front, same as
    // before this rebuild) — so a failure here means the user paid for a
    // generation they never got. refund_credit mirrors consume_credit
    // exactly (same public.profiles.credits column), just adding instead
    // of subtracting. Best-effort: if the refund RPC itself fails, don't
    // let that mask the original error or crash the function — log it so
    // it's at least visible, but the 'failed' status above has already
    // been written either way.
    const refund = await supabase.rpc("refund_credit", { _user_id: userId });
    if (refund.error) {
      console.error(`Failed to refund credit for user ${userId}:`, refund.error.message);
    }
  }

  return { statusCode: 200, body: "" };
};