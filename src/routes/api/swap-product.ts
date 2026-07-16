// STEP 3 of the pipeline: called 3 times (once per picked product). Fetches
// the product's real image from Supabase and asks Gemini to swap it into
// the current room image. Each response is fed back in as the next input.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  dataUrlToInline,
  fetchImageAsInline,
  geminiImageEdit,
} from "@/lib/gemini.server";
import { fetchProductsByIds } from "@/lib/supabase.server";

const Input = z.object({
  currentRoomImage: z.string(),
  productId: z.string(),
});

export const Route = createFileRoute("/api/swap-product")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { currentRoomImage, productId } = Input.parse(
            await request.json(),
          );
          const [product] = await fetchProductsByIds([productId]);
          if (!product) {
            return Response.json(
              { error: `Product ${productId} not found` },
              { status: 404 },
            );
          }
          const room = dataUrlToInline(currentRoomImage);
          const productImg = await fetchImageAsInline(product.imageUrl);
          const image = await geminiImageEdit({
            parts: [
              { inlineData: room },
              { inlineData: productImg },
              {
                text: `The first image is a room. The second image is a real product from our catalog:
- Name: ${product.name}
- Brand: ${product.brand}
- Category: ${product.category}
- Style: ${product.style}
- Description: ${product.description}

Replace the existing ${product.category} in the room with this exact product. Preserve the product's true shape, proportions, texture, materials, and colors from the reference image — do not invent a different item. Match the room's lighting, perspective, shadows, and scale. Photorealistic, high-fidelity result.`,
              },
            ],
          });
          return Response.json({ image, product });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
