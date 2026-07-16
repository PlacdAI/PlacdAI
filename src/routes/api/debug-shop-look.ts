// DEBUG endpoint: mirrors /api/pick-products but returns the raw picked IDs,
// dedupe stats, and fetched image URLs. Handy for validating the pipeline
// without running a full generation. POST { roomImage?, style }.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  fetchCatalogForPrompt,
  fetchFallbackProducts,
  fetchProductsByIds,
} from "@/lib/supabase.server";
import { dataUrlToInline, geminiJson } from "@/lib/gemini.server";

const Input = z.object({
  roomImage: z.string().optional(),
  style: z.string(),
});

export const Route = createFileRoute("/api/debug-shop-look")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const started = Date.now();
        try {
          const { roomImage, style } = Input.parse(await request.json());
          const catalog = await fetchCatalogForPrompt(style, 40);

          let rawPickedIds: string[] = [];
          if (roomImage && catalog.length > 0) {
            const inline = dataUrlToInline(roomImage);
            const result = await geminiJson<{ productIds: string[] }>({
              systemInstruction:
                "You are an interior designer. Pick exactly 3 product IDs from the catalog.",
              parts: [
                { inlineData: inline },
                {
                  text: `Style: ${style}\n\nCatalog (JSON):\n${JSON.stringify(catalog)}\n\nReturn exactly 3 product IDs.`,
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
            rawPickedIds = result.productIds;
          }

          const uniqueIds = Array.from(new Set(rawPickedIds));
          let products = await fetchProductsByIds(uniqueIds);
          const byId = new Map(products.map((p) => [p.id, p]));
          products = Array.from(byId.values());
          const fillerAdded: string[] = [];
          if (products.length < 3) {
            const filler = await fetchFallbackProducts(style, 12);
            for (const p of filler) {
              if (!byId.has(p.id) && products.length < 3) {
                byId.set(p.id, p);
                products.push(p);
                fillerAdded.push(p.id);
              }
            }
          }
          products = products.slice(0, 3);

          return Response.json({
            ok: true,
            style,
            elapsedMs: Date.now() - started,
            catalogSize: catalog.length,
            rawPickedIds,
            duplicateCount: rawPickedIds.length - uniqueIds.length,
            uniqueIds,
            fetchedIds: products.map((p) => p.id),
            fillerAdded,
            finalProducts: products.map((p) => ({
              id: p.id,
              name: p.name,
              brand: p.brand,
              category: p.category,
              style: p.style,
              imageUrl: p.imageUrl,
              productUrl: p.productUrl,
            })),
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json(
            { ok: false, error: msg, elapsedMs: Date.now() - started },
            { status: 500 },
          );
        }
      },
    },
  },
});
