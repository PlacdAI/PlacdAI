// STEP 1 of the pipeline: send the uploaded room + trimmed catalog to Gemini,
// get back 3 product IDs, return the full product rows for the sidebar.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  fetchCatalogForPrompt,
  fetchFallbackProducts,
  fetchProductsByIds,
} from "@/lib/supabase.server";
import { dataUrlToInline, geminiJson } from "@/lib/gemini.server";

const Input = z.object({ roomImage: z.string(), style: z.string() });

export const Route = createFileRoute("/api/pick-products")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { roomImage, style } = Input.parse(await request.json());
          const catalog = await fetchCatalogForPrompt(style, 40);
          if (catalog.length === 0) {
            return Response.json({ products: [] });
          }

          const inline = dataUrlToInline(roomImage);
          const result = await geminiJson<{ productIds: string[] }>({
            systemInstruction:
              "You are an interior designer. Given a photo of an empty/sparse room and a catalog of furniture, pick exactly 3 products from the catalog that fit the room's dimensions, layout, and the requested style. Return only their IDs.",
            parts: [
              { inlineData: inline },
              {
                text: `Style: ${style}\n\nCatalog (JSON):\n${JSON.stringify(catalog)}\n\nReturn exactly 3 product IDs from this catalog.`,
              },
            ],
            schema: {
              type: "object",
              properties: {
                productIds: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 3,
                  maxItems: 3,
                },
              },
              required: ["productIds"],
            },
          });

          // Dedupe IDs returned by the model (it sometimes repeats one).
          const uniqueIds = Array.from(new Set(result.productIds));
          let products = await fetchProductsByIds(uniqueIds);
          // Dedupe again defensively by id.
          const byId = new Map(products.map((p) => [p.id, p]));
          products = Array.from(byId.values());
          if (products.length < 3) {
            const filler = await fetchFallbackProducts(style, 12);
            for (const p of filler) {
              if (!byId.has(p.id) && products.length < 3) {
                byId.set(p.id, p);
                products.push(p);
              }
            }
          }
          products = products.slice(0, 3);
          return Response.json({ products });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
