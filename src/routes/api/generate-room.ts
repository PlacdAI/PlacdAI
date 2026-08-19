// STEP 2 of the pipeline: stream a redesigned version of the uploaded room
// from Gemini. Response is Server-Sent Events (SSE) parsed by src/lib/streamImage.ts.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { dataUrlToInline, geminiImageStream } from "@/lib/gemini.server";

// 🔧 Was previously an unvalidated `as {...}` cast — every other route in
// this app (pick-products.ts, swap-product.ts) validates input with Zod
// first, so this brings generate-room in line with that instead of being
// the one unchecked route. prompt.max(300) is the server-side half of the
// vision-prompt character cap added in dashboard.tsx — without this, the
// UI's maxLength is only a client-side courtesy; anyone calling this route
// directly (not through the UI) could send an arbitrarily long prompt.
const Input = z.object({
  roomImage: z.string(),
  style: z.string(),
  roomType: z.string().optional(),
  palette: z.string().optional(),
  paletteColors: z.array(z.string()).optional(),
  prompt: z.string().max(300).optional(),
});

export const Route = createFileRoute("/api/generate-room")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { roomImage, style, roomType, palette, paletteColors, prompt } = Input.parse(
            await request.json(),
          );
          const inline = dataUrlToInline(roomImage);

          const paletteLine =
            paletteColors && paletteColors.length > 0
              ? `Color palette: use these exact colors across furniture, textiles, walls accents, and decor — ${paletteColors.join(", ")}${
                  palette ? ` (the "${palette}" palette)` : ""
                }. Every major furniture piece and soft furnishing should visibly draw from this palette.`
              : `Color palette: ${palette ?? "neutral"}.`;

          const userLine =
            prompt && prompt.trim()
              ? `\n\nAdditional instructions from the user — these are a HARD CONSTRAINT, not a stylistic suggestion. If any part of this text excludes, forbids, or says not to include a specific item or category (e.g. "don't add a dresser"), you must never place that item anywhere in the output, even if it would otherwise be a natural fit for the requested style. These instructions override the general style direction above whenever the two conflict (but never override the STRICT RULES below): ${prompt.trim()}`
              : "";

          // Bookend technique: the same user constraint is restated at the
          // very start (below) and again as the last line of the prompt.
          // Models weight instructions at the start/end of a prompt more
          // heavily than ones buried mid-paragraph — stating it twice is
          // free (same API call, same token cost tier) and doesn't require
          // an extra verification pass to meaningfully improve compliance.
          const openingConstraint =
            prompt && prompt.trim()
              ? `IMPORTANT USER CONSTRAINT (read first — this governs everything below): ${prompt.trim()}\n\n`
              : "";
          const closingConstraint =
            prompt && prompt.trim()
              ? `\n\nFINAL REMINDER — before you generate, re-check the user's constraint one more time: ${prompt.trim()}. If anything you were about to include conflicts with this, leave it out.`
              : "";

          const upstream = await geminiImageStream({
            parts: [
              { inlineData: inline },
              {
                text: `${openingConstraint}The attached image is a real photo of a room. You are an image editor, not an image generator.

CRITICAL EDITING INSTRUCTIONS:
Do NOT generate a new room or reinterpret the space. Your job is to redecorate the EXISTING space shown in the attached photo, editing that exact photo in place. This can include removing or replacing existing furniture and decor with new ${style} pieces — you are not limited to filling empty space.

Design direction: furnish it as a ${roomType ?? "living room"} in a ${style} style. ${paletteLine}${userLine}

STRICT RULES:
1. Preserve the room's exact walls, windows, flooring, ceiling, ceiling height, ceiling fixtures, and camera angle/perspective 100% as they appear in the input photo. Do not shift, crop, re-frame, or rebuild any part of the room's structure.
2. Do not change the room's proportions or invent architectural features that aren't in the source photo.
3. You may remove, replace, or add furniture and decor anywhere in the room to satisfy the style, palette, and user instructions above — just never touch the structural elements from rule 1.
4. If the user's instructions exclude or forbid any specific item or category of furniture/decor, that exclusion is absolute: never include it in the output under any circumstance, even if it would otherwise be a strong fit for the requested style or would help fill an empty area.
5. Keep the room's lighting direction and shadows consistent with the original photo; you may shift color temperature and tone as needed to match the requested palette.
6. Photorealistic, high detail, seamlessly composited into the original photo.${closingConstraint}`,
              },
            ],
          });
          if (!upstream.ok || !upstream.body) {
            return new Response(await upstream.text(), { status: upstream.status });
          }
          return new Response(upstream.body, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
            },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});