// Shared between the frontend (hotspot click → "which real product is this?")
// and the server (swap-product's post-edit "did this product actually land?"
// verification). Keeping ONE rule set means the two checks can't quietly
// disagree with each other. No server-only imports here — safe to import
// from client components too.
import type { Product } from "./types";

export type DetectedItem = {
  label: string;
  category: string;
  bbox: { xPct: number; yPct: number; wPct: number; hPct: number };
};

// Products fetched via pick-products/swap-product already carry `category`
// from Supabase (see COLS in supabase.server.ts) even though the frontend
// Product type doesn't declare it — read it defensively.
function productCategory(p: Product): string {
  return ((p as unknown as { category?: string }).category ?? "").toLowerCase();
}

// 🔧 swap-product.ts now returns `placedBox` on each product it places —
// the real, post-edit bbox of the item that satisfied verification. Read
// it defensively (same pattern as productCategory) since the frontend
// Product type doesn't declare it either. Undefined until a swap has
// actually run for this product (e.g. right after pick-products, before
// any placement) — callers treat that as "no known location," same as
// before this existed.
function productPlacedBox(p: Product): DetectedItem["bbox"] | undefined {
  return (
    (p as unknown as { placedBox?: DetectedItem["bbox"] | null }).placedBox ?? undefined
  );
}

// 🔧 Distance between two bbox centers, as a percentage of image diagonal.
// Used to disambiguate two same-category items (e.g. two dressers in one
// room) — category/label matching alone can't tell them apart, but "is
// this near where we expected it" can.
function centersClose(
  a: DetectedItem["bbox"],
  b: DetectedItem["bbox"],
  thresholdPct = 20,
): boolean {
  const ax = a.xPct + a.wPct / 2;
  const ay = a.yPct + a.hPct / 2;
  const bx = b.xPct + b.wPct / 2;
  const by = b.yPct + b.hPct / 2;
  const dist = Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
  return dist < thresholdPct;
}

/**
 * Loosely match a detected item to a specific real product by label/category
 * word overlap. This is a heuristic, not precise re-identification — good
 * enough to tell "this is one of our real catalog items" from "this is an
 * AI-invented filler item," which is all either caller needs.
 *
 * 🔧 Optional `nearBox` — when provided, ALSO requires the detected item's
 * center to be close to `nearBox`'s center. Without this, two same-category
 * products (e.g. two dressers) can't be told apart: category matching alone
 * would say "yes, a dresser exists in this photo" for BOTH products even
 * when only one of them is actually the item that's there — and the same
 * confusion happens with ANY other same-category item in the room (a
 * console, a bookshelf — anything sharing e.g. "storage"), which is what
 * was causing AI-generated pieces to get mislabeled with the "real
 * product" hotspot icon on the frontend. Positional proximity is the
 * cheapest available signal to disambiguate that, given we don't do real
 * visual re-identification.
 */
export function itemMatchesProduct(
  item: DetectedItem,
  product: Product,
  nearBox?: DetectedItem["bbox"],
): boolean {
  const label = item.label.toLowerCase();
  const category = item.category.toLowerCase();
  const name = product.name.toLowerCase();
  const cat = productCategory(product);
  const categoryMatches =
    (!!cat && (cat.includes(category) || category.includes(cat))) ||
    name.includes(category) ||
    category.split(/\s+/).some((w) => w.length > 2 && name.includes(w)) ||
    label.split(/\s+/).some((w) => w.length > 3 && name.includes(w));

  if (!categoryMatches) return false;
  if (nearBox && !centersClose(item.bbox, nearBox)) return false;
  return true;
}

/**
 * Find which (if any) of a list of products a detected item corresponds to.
 *
 * 🔧 Now passes each product's own `placedBox` (its real, post-edit
 * placement location — see productPlacedBox above) as the positional
 * check, instead of category matching alone. Before this, ANY detected
 * item sharing a placed product's category — not just the actual placed
 * item — would match, which is why unrelated AI-generated furniture (a
 * console, a bookshelf) was showing up with the "real product" hotspot
 * icon whenever a placed product happened to share its category. Products
 * with no placedBox yet (nothing placed for them so far) fall back to
 * category-only matching, same as before.
 */
export function matchDetectedItem(item: DetectedItem, products: Product[]): Product | null {
  return products.find((p) => itemMatchesProduct(item, p, productPlacedBox(p))) ?? null;
}