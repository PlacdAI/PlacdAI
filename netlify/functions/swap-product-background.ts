// Netlify Background Function — mirrors generate-room-background.ts.
// Filename must end in "-background" so Netlify gives it up to 15 minutes
// instead of the ~26-30s ceiling that was killing swap-product.ts's
// synchronous route (up to 3 sequential Gemini calls + verification
// passes easily exceeds that). All the actual swap logic below is copied
// verbatim from the old swap-product.ts route handler — only the
// entry/exit points changed (payload in, product_swaps row out, instead
// of a request/Response pair).
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import {
  dataUrlToInline,
  ensureDataUrl,
  fetchImageAsInline,
  geminiImageEdit,
} from "../../src/lib/gemini.server";
import { fetchProductsByIds } from "../../src/lib/supabase.server";
import { detectFurniture } from "../../src/lib/furnitureDetection.server";
import { itemMatchesProduct, type DetectedItem } from "../../src/lib/furnitureMatching";
import type { Product } from "../../src/lib/types";

interface Payload {
  swapId: string;
  userId: string;
  currentRoomImage: string;
  productIds: string[];
  isRetry?: boolean;
}

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

  let verified = false;
  let placedBox: DetectedItem["bbox"] | null = null;
  try {
    const items = await detectFurniture(edited);
    const match = items.find((item) => itemMatchesProduct(item, p, expectedBox ?? undefined));
    verified = !!match;
    placedBox = match?.bbox ?? null;
  } catch {
    verified = false;
  }

  return { image: edited, verified, placedBox };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "" };

  let payload: Payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "bad json" };
  }

  const {
    swapId,
    userId,
    currentRoomImage: rawRoomImage,
    productIds,
    isRetry = false,
  } = payload;
  if (!swapId || !userId || !rawRoomImage || !productIds?.length) {
    return { statusCode: 400, body: "missing required fields" };
  }

  // Same duplicated-client reasoning as generate-room-background.ts: this
  // file lives outside src/, so it can't import authServer.ts's
  // getAdminClient() — Netlify bundles netlify/functions independently.
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {
    // Same normalization swap-product.ts already had — currentRoomImage
    // may be a Supabase Storage public URL (from generate-room-background)
    // rather than a data URL.
    const currentRoomImage = await ensureDataUrl(rawRoomImage);

    const products = await fetchProductsByIds(productIds);
    if (products.length === 0) throw new Error("No products found");

    let initialItems: DetectedItem[] = [];
    try {
      initialItems = await detectFurniture(currentRoomImage);
    } catch {
      // No grounding available — swap prompts fall back to category-only
      // matching, same as before.
    }
    const remainingItems: DetectedItem[] = [...initialItems];

    let currentImage = currentRoomImage;
    const verifiedProducts: (Product & {
      verified: boolean;
      placedBox: DetectedItem["bbox"] | null;
    })[] = [];

    for (const p of products) {
      const baseImage = currentImage;
      const matchIdx = remainingItems.findIndex((item) => itemMatchesProduct(item, p));
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
      verifiedProducts.push({ ...p, verified, placedBox });
    }

    // Upload the final composited image to the same "generations" working
    // bucket generate-room-background already uses — keeps the row (and
    // the Realtime payload) small, same reasoning as that file. "swap-"
    // prefix keeps paths from colliding with room-render uploads.
    const m = currentImage.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!m) throw new Error("Swap produced an unexpected image format");
    const mime = m[1];
    const ext = mime.split("/")[1].replace("+xml", "");
    const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    const path = `swap-${swapId}.${ext}`;

    const up = await supabase.storage
      .from("generations")
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (up.error) throw new Error(up.error.message);

    const { data: pub } = supabase.storage.from("generations").getPublicUrl(path);

    await supabase
      .from("product_swaps")
      .update({ status: "done", result_url: pub.publicUrl, products: verifiedProducts })
      .eq("id", swapId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`swap-product-background failed for ${swapId}:`, msg);
    await supabase
      .from("product_swaps")
      .update({ status: "failed", error: msg })
      .eq("id", swapId);

    // Only retryProduct() consumes a credit before calling this path — the
    // main generate() swap rides on the up-front generation credit and
    // never charges separately (see dashboard.tsx). So only refund on a
    // retry failure, same refund-on-failure reasoning as
    // generate-room-background.ts, just scoped to when a charge actually
    // happened.
    if (isRetry) {
      const refund = await supabase.rpc("refund_credit", { _user_id: userId });
      if (refund.error) {
        console.error(`Failed to refund credit for user ${userId}:`, refund.error.message);
      }
    }
  }

  return { statusCode: 200, body: "" };
};