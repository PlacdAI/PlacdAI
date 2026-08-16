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
import { dataUrlToInline, ensureDataUrl, geminiImageEdit } from "../../src/lib/gemini.server";
import { isSmallTransitionalSpace } from "../../src/lib/spaceClassification.server";

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
    // 🔧 roomImage is now a Storage public URL (start-generation.ts
    // uploads the photo there to dodge Netlify's ~6MB body limit) instead
    // of a raw base64 data URL — ensureDataUrl fetches it and converts to
    // a data URL if it isn't already one, same helper swap-product-
    // background.ts already uses for the same reason. Resolved once here
    // so both the classification call below and the main edit call reuse
    // the same data URL instead of fetching the Storage image twice.
    const roomDataUrl = await ensureDataUrl(roomImage);
    const inline = dataUrlToInline(roomDataUrl);

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

    // 🔧 Small-space detection, two layers:
    // 1. Keyword check on the user's own prompt text (cheap, no API call)
    //    — kept as a fast-path since it's free when it hits.
    // 2. Photo-based classification (isSmallTransitionalSpace) — added
    //    after keyword-only detection proved unreliable: a user typed
    //    "decorate this area" (no size word at all) on a stair landing
    //    and still got a full-size dresser. This looks at the actual
    //    photo instead of hoping the right adjective shows up in the
    //    prompt. Only called when the keyword check didn't already
    //    trigger, so the extra (cheap, lite-model) API cost is only paid
    //    when actually needed — most full-room generations skip it
    //    entirely once the keyword or photo signal says "not small."
    const smallSpaceKeywords =
      /\b(small|tiny|narrow|tight|compact|nook|corner|landing|portion|niche|alcove|hallway|entryway|stairwell|stair\s*case|transitional)\b/i;
    const isSmallSpaceByKeyword = !!prompt && smallSpaceKeywords.test(prompt);
    const isSmallSpace =
      isSmallSpaceByKeyword || (await isSmallTransitionalSpace(roomDataUrl));

    const smallSpaceBlock = isSmallSpace
      ? `

SPACE-SIZE OVERRIDE (this is a small or transitional area, not a full room):
Based on the photo itself and/or the user's own description, this space is small or transitional — e.g. a stair landing, hallway corner, entryway nook, or narrow alcove. Treat this as a hard constraint, not a suggestion: this space almost certainly cannot fit large case-goods furniture (dressers, cabinets, credenzas, bookshelves, large seating).
Examples of what NOT to do here:
- WRONG: adding a multi-drawer dresser or chest into a stair landing or narrow hallway corner.
- WRONG: adding a large armchair or sofa into a tight transitional nook.
Examples of what TO do instead:
- RIGHT: a single vase with florals, a small potted plant, one or two framed art pieces on the wall, a slim wall sconce or small table lamp, a small round accent table, or a mirror.
- RIGHT: if genuinely nothing realistically fits the visible footprint, add only a single small decor accent, or leave it minimally styled rather than adding furniture.
Do not add anything larger than a small accent table in this space, regardless of the style direction above.`
      : "";

    // Same prompt text as the original generate-room.ts — unchanged so the
    // actual design output doesn't shift as a side effect of this rebuild.
    const resultDataUrl = await geminiImageEdit({
      parts: [
        { inlineData: inline },
        {
          text: `The attached image is a real photo of a room. You are an image editor, not an image generator.

CRITICAL EDITING INSTRUCTIONS:
Do NOT generate a new room or reinterpret the space. Your job is to redecorate the EXISTING space shown in the attached photo, editing that exact photo in place. This can include removing or replacing existing furniture and decor with new ${style} pieces where appropriate — but only add something if it realistically belongs in this specific space (see rule 5 on scale below). Leaving a small or awkward area sparser, or decorated with only small accents, is better than forcing in furniture that doesn't fit.

Design direction: furnish it as a ${roomType ?? "living room"} in a ${style} style. ${paletteLine}${userLine}${smallSpaceBlock}

STRICT RULES:
1. Preserve the room's exact walls, windows, flooring, ceiling, ceiling height, ceiling fixtures, and camera angle/perspective 100% as they appear in the input photo. Do not shift, crop, re-frame, or rebuild any part of the room's structure.
2. Do not change the room's proportions or invent architectural features that aren't in the source photo.
3. You may remove, replace, or add furniture and decor anywhere in the room to satisfy the style, palette, and user instructions above — just never touch the structural elements from rule 1.
4. Keep the room's lighting direction and shadows consistent with the original photo; you may shift color temperature and tone as needed to match the requested palette.
5. SCALE TO THE ACTUAL SPACE: judge the real available floor and wall footprint from the photo before choosing what to add — a narrow landing, stair nook, hallway corner, or otherwise tight/transitional area has no room for large case-goods (dressers, cabinets, credenzas, large seating). For spaces like that, furnish only with pieces that realistically fit the footprint: a small accent table, a vase, a plant, wall art, a mirror, a sconce, a slim console at most. Reserve larger furniture for spaces that are clearly a full room with real open floor area. When in doubt about whether something fits, choose the smaller, more plausible option.
6. AVOID REPEATING THE SAME SIGNATURE PIECE: don't default to the same "obvious" item for a given style every time (e.g. always reaching for a rattan-front chest of drawers for "mid-century modern"). Vary your choices across the style's real range — seating, tables, lighting, textiles, art, plants, mirrors, storage — and pick whichever of those genuinely suits the specific space in this photo, not just the most stereotypical item for the style.
7. REALISTIC PROPORTIONS: since you are inventing the exact dimensions of anything you add (there is no specific real product being referenced here), stick to proportions that match what that type of item actually looks like in real life. Framed wall art in particular is typically square to moderately landscape/portrait — not an unusually narrow, elongated sliver — unless the user specifically asked for a slim/narrow piece. The same applies to any other added item: keep its width-to-height ratio within the normal real-world range for that object type.
8. Photorealistic, high detail, seamlessly composited into the original photo.`,
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