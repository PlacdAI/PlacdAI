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
              "You are an interior designer. Given a photo of a room and a catalog of furniture, decide which items — if any — would genuinely improve the room in the requested style. Only include a product if it clearly fills a real gap: an empty surface that needs a lamp, a bare wall that needs art, missing seating, etc. Do not pad your selection to reach any particular number. It is completely fine to pick just 1 or 2 items if that's all the room actually needs. Never pick more than 3. Return only the IDs of items you're confident belong in this room.",
            parts: [
              { inlineData: inline },
              {
                text: `Style: ${style}\n\nCatalog (JSON):\n${JSON.stringify(catalog)}\n\nReturn between 1 and 3 product IDs from this catalog — only the ones that genuinely fit.`,
              },
            ],
            schema: {
              type: "object",
              properties: {
                productIds: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 1,
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
          // Only backfill if the model's picks resolved to nothing usable —
          // we still want at least 1 shoppable item, but we no longer pad
          // up to 3 just to hit a count.
          if (products.length === 0) {
            const filler = await fetchFallbackProducts(style, 1);
            products = filler.slice(0, 1);
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