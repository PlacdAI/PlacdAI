// On-demand furniture detection: given a generated room image, ask Gemini
// to identify only furniture/decor items (not walls/windows/architecture)
// with an approximate bounding box for each, so the frontend can render
// clickable hotspots. Deliberately NOT a generic object detector (YOLO/
// OWL-ViT etc.) — those have no concept of "sellable furniture" and end up
// flagging everything in the room. Scoping the category list in the prompt
// itself is what keeps this clean.
//
// The actual Gemini call lives in furnitureDetection.server.ts so
// swap-product.ts's placement-verification step can reuse it exactly —
// see that file for why.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/authServer";
import { detectFurniture } from "@/lib/furnitureDetection.server";
// 🔧 The image handed to this route can be a Supabase Storage public URL
// instead of a base64 data URL — same root cause as the fix already
// applied in swap-product.ts (see the comment above its ensureDataUrl()
// call). detectFurniture()/Gemini needs an actual data URL, so normalize
// once here before it's used, instead of assuming the caller already sent
// one.
import { ensureDataUrl } from "@/lib/gemini.server";

const Input = z.object({ image: z.string() });

export const Route = createFileRoute("/api/detect-furniture")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

        try {
          const { image: rawImage } = Input.parse(await request.json());
          const image = await ensureDataUrl(rawImage);
          const items = await detectFurniture(image);
          return Response.json({ items });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});