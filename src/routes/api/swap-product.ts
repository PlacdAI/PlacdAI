import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  dataUrlToInline,
  fetchImageAsInline,
  geminiImageEdit,
} from "@/lib/gemini.server";
import { fetchProductsByIds } from "@/lib/supabase.server";
import { detectFurniture } from "@/lib/furnitureDetection.server";
import { itemMatchesProduct, type DetectedItem } from "@/lib/furnitureMatching";
import type { Product } from "@/lib/types";

const Input = z.object({
  currentRoomImage: z.string(),
  productIds: z.array(z.string()).max(3),
  // Set by the frontend's single-item "Retry" button (see PlacedProductRow /
  // retryProduct in dashboard.tsx). Only changes the prompt wording — the
  // main generate() run never auto-retries anymore, so a second paid edit
  // only ever happens when a user explicitly asks for one.
  isRetry: z.boolean().optional().default(false),
});

function boundsText(item: DetectedItem): string {
  const x0 = Math.round(item.bbox.xPct);
  const y0 = Math.round(item.bbox.yPct);
  const x1 = Math.round(item.bbox.xPct + item.bbox.wPct);
  const y1 = Math.round(item.bbox.yPct + item.bbox.hPct);
  return `roughly ${x0}–${x1}% from the left edge and ${y0}–${y1}% from the top edge of the image`;
}

function buildSwapPrompt(p: Product, isRetry: boolean, locationHint: string | null): string {
  return `The first image is a styled room. The second image is one real product from our catalog: "${p.name}" (${p.category || "furniture item"}).${p.description ? `\nProduct description: ${p.description}` : ""}

CRITICAL EDITING INSTRUCTIONS:
You are an image editor. Do NOT generate a new room. Your ONLY job is to REPLACE the existing generic ${p.category || "furniture item"} in the room with the exact product shown in the second image.
${
  locationHint
    ? `\nLOCATION HINT: The existing item you're replacing is located at ${locationHint}. Use this to identify the correct item directly instead of guessing which object in the room it is.\n`
    : ""
}
STRICT RULES:
1. Preserve the room's exact background, walls, windows, floor, and layout 100%.
2. Replace only ONE existing furniture item — the one that best matches this product's category${locationHint ? " and the location hint above" : ""}. Do not add a duplicate or introduce a second item.
3. Use the exact shape, texture, and color from the product reference image — do not invent a different design.
4. SIZE: match the real-world footprint of the item you're replacing — do not shrink or enlarge it. If the product's name or description includes a measurement (e.g. width in inches), use that as a real-world size reference and scale it correctly relative to nearby objects already in the room (seating height, floor width, doorway height) rather than guessing.
5. Place it naturally with correct scale, perspective, and contact shadows matching the room's existing lighting — it must sit properly in the scene, not float, overlap unrelated elements, or appear miniaturized/oversized.
6. Do not move, resize, or alter any other furniture already in the room.${
    isRetry
      ? `

A previous attempt at this exact edit did NOT clearly place the product — it may have been skipped, hidden behind another object, rendered too small, or replaced with a generic look-alike instead of the actual reference. This time, make sure the product from the second image is fully visible, unobstructed, and clearly recognizable as that exact item in the final image.`
      : ""
  }`;
}

/** Edit `baseImage` to place product `p`, then confirm it actually landed. */
async function placeAndVerify(
  baseImage: string,
  p: Product,
  isRetry: boolean,
  locationHint: string | null,
  expectedBox: DetectedItem["bbox"] | null,
): Promise<{ image: string; verified: boolean; placedBox: DetectedItem["bbox"] | null }> {
  const roomInline = dataUrlToInline(baseImage);
  const productInline = await fetchImageAsInline(p.imageUrl);

  const edited = await geminiImageEdit({
    parts: [
      { inlineData: roomInline },
      { inlineData: productInline },
      { text: buildSwapPrompt(p, isRetry, locationHint) },
    ],
  });

  // Reuse the exact same detection pass + matching rule the frontend's
  // hotspot click uses — one source of truth for "is this real product
  // actually visible," not a second differently-worded verifier.
  //
  // 🔧 Pass expectedBox (the original item's location, if we had one) so
  // that with two same-category products in one room (e.g. two dressers),
  // verification checks "is there a matching item near where THIS product
  // was placed," not just "does a matching item exist anywhere in the
  // photo." Without this, product A's verification could pass off product
  // B's dresser as itself, since category matching alone can't tell them
  // apart.
  //
  // 🔧 Also capture WHICH item satisfied the match and keep its real
  // post-edit bbox as `placedBox`. This gets returned to the frontend so
  // ITS matching (matchDetectedItem, used for hotspot icons) can also be
  // positionally aware instead of pure category matching — without this,
  // any other same-category item in the room (a console, a bookshelf —
  // anything sharing e.g. "storage") gets mislabeled with the "real
  // product" hotspot icon just because the category string matches.
  let verified = false;
  let placedBox: DetectedItem["bbox"] | null = null;
  try {
    const items = await detectFurniture(edited);
    const match = items.find((item) => itemMatchesProduct(item, p, expectedBox ?? undefined));
    verified = !!match;
    placedBox = match?.bbox ?? null;
  } catch {
    // Verification is a confidence signal, not a gate — if the detection
    // call itself fails (rate limit, transient error), don't block the
    // reveal or throw the whole swap away over it. Just leave unverified.
    verified = false;
  }

  return { image: edited, verified, placedBox };
}

export const Route = createFileRoute("/api/swap-product")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { currentRoomImage, productIds, isRetry } = Input.parse(
            await request.json(),
          );
          const products = await fetchProductsByIds(productIds);
          if (products.length === 0) {
            return Response.json({ error: "No products found" }, { status: 404 });
          }

          // ONE detection pass on the room as it looks right now, before any
          // of these edits — used purely to ground each swap prompt with a
          // rough "the item you want is over here" location instead of
          // making the model guess which blob in the photo is the right
          // one. Grounded instructions fail less often, which means fewer
          // retries are needed in the first place. This is a single cheap
          // text/JSON call shared across all items in this request, not a
          // per-item cost.
          let initialItems: DetectedItem[] = [];
          try {
            initialItems = await detectFurniture(currentRoomImage);
          } catch {
            // No grounding available — swap prompts just fall back to
            // category-only matching, same as before this change.
          }

          // 🔧 FIX — this pool is mutated (claimed items removed) as we go,
          // instead of matching every product against the same static
          // `initialItems` snapshot. Without this, two products in the same
          // category (e.g. two dressers) both matched the SAME originally-
          // detected item and got the SAME location hint. The second swap
          // would then land on top of the first swap's freshly-placed
          // product instead of a generic placeholder — silently overwriting
          // it — while the first product's `verified: true` stayed stale
          // from the moment before it got overwritten. Claiming an item
          // once it's used means the next same-category product either
          // matches a *different* detected item or falls back to no hint
          // (honest: let the model find its own spot) instead of colliding
          // with a product that's already been placed.
          const remainingItems: DetectedItem[] = [...initialItems];

          // Swap products ONE AT A TIME, chaining each edit into the next
          // as input for the following one.
          //
          // Why: asking the model to replace several different placeholder
          // items in a single multi-image edit is unreliable — it has to
          // disambiguate which of N references maps to which placeholder,
          // and tends to misplace, mis-scale, or "float" items without
          // proper perspective/shadow grounding as a result.
          //
          // Sequential single-item edits give the model exactly one
          // unambiguous target per call, which is dramatically more
          // reliable — at the cost of a few extra round trips to Gemini.
          //
          // Each edit is followed by a verification pass (does a fresh
          // detection call actually find this product in the result?), but
          // NO automatic retry — a failed/unconfirmed placement ships as
          // verified: false and the frontend labels it honestly ("Best-
          // effort") with a manual retry button, instead of us
          // automatically paying for a second edit on every miss whether
          // or not anyone actually cares. `isRetry` is only ever true when
          // that button was clicked, and only ever applies to the single
          // product in that request.
          let currentImage = currentRoomImage;
          const verifiedProducts: (Product & {
            verified: boolean;
            placedBox: DetectedItem["bbox"] | null;
          })[] = [];

          for (const p of products) {
            const baseImage = currentImage;
            const matchIdx = remainingItems.findIndex((item) =>
              itemMatchesProduct(item, p),
            );
            const matched = matchIdx >= 0 ? remainingItems[matchIdx] : null;
            if (matchIdx >= 0) remainingItems.splice(matchIdx, 1); // claim it
            const locationHint = matched ? boundsText(matched) : null;

            const { image, verified, placedBox } = await placeAndVerify(
              baseImage,
              p,
              isRetry,
              locationHint,
              matched?.bbox ?? null,
            );

            currentImage = image;
            // 🔧 placedBox (nullable) travels with each product so the
            // frontend can do the same positional check server-side
            // verification now does, instead of pure category matching.
            verifiedProducts.push({ ...p, verified, placedBox });
          }

          return Response.json({ image: currentImage, products: verifiedProducts });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});