import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  dataUrlToInline,
  fetchImageAsInline,
  geminiImageEdit,
} from "@/lib/gemini.server";

const Input = z.object({
  currentRoomImage: z.string(),
  productImageUrl: z.string(),
  productName: z.string(),
  productCategory: z.string(),
});

export const Route = createFileRoute("/api/swap-product")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = Input.parse(await request.json());
          const room = dataUrlToInline(body.currentRoomImage);
          const product = await fetchImageAsInline(body.productImageUrl);
          const image = await geminiImageEdit({
            parts: [
              { inlineData: room },
              { inlineData: product },
              {
                text: `The first image is a room. The second image is a real product: "${body.productName}" (category: ${body.productCategory}). Replace the ${body.productCategory} in the room with this exact product. Preserve the product's true shape, texture, materials, and colors from the reference image. Match the room's lighting, perspective, and scale. Photorealistic result.`,
              },
            ],
          });
          return Response.json({ image });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
