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

// 🔧 swap-product now records EVERY verified box a product occupies, not
// just one — `placedBoxes` (plural). This is what makes final
// classification deterministic instead of guessed: these boxes came from
// swap-product's own post-edit verification, so "is this detected item
// inside a placedBoxes region" is ground truth, not a heuristic.
// `placedBox` (singular) is kept for backward compatibility with any
// already-stored product_swaps rows written before this change, and is
// read as a one-item fallback when `placedBoxes` isn't present.
function productPlacedBoxes(p: Product): DetectedItem["bbox"][] {
  const boxes = (p as unknown as { placedBoxes?: DetectedItem["bbox"][] | null }).placedBoxes;
  if (boxes && boxes.length > 0) return boxes;
  const single = (p as unknown as { placedBox?: DetectedItem["bbox"] | null }).placedBox;
  return single ? [single] : [];
}

function centerOf(b: DetectedItem["bbox"]) {
  return { x: b.xPct + b.wPct / 2, y: b.yPct + b.hPct / 2 };
}

// 🔧 Distance between two bbox centers, as a percentage of image diagonal.
function centersClose(
  a: DetectedItem["bbox"],
  b: DetectedItem["bbox"],
  thresholdPct = 12,
): boolean {
  const ca = centerOf(a);
  const cb = centerOf(b);
  const dist = Math.sqrt((ca.x - cb.x) ** 2 + (ca.y - cb.y) ** 2);
  return dist < thresholdPct;
}

// Intersection-over-union — the real overlap between two boxes, not just
// how close their centers are. Used for ground-truth matching against
// placedBoxes, where we want "this detected box IS that verified box"
// rather than "this is somewhere near it."
export function iou(a: DetectedItem["bbox"], b: DetectedItem["bbox"]): number {
  const ax1 = a.xPct, ay1 = a.yPct, ax2 = a.xPct + a.wPct, ay2 = a.yPct + a.hPct;
  const bx1 = b.xPct, by1 = b.yPct, bx2 = b.xPct + b.wPct, by2 = b.yPct + b.hPct;
  const ix1 = Math.max(ax1, bx1), iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2), iy2 = Math.min(ay2, by2);
  const iw = Math.max(0, ix2 - ix1), ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const areaA = a.wPct * a.hPct, areaB = b.wPct * b.hPct;
  const union = areaA + areaB - inter;
  return union > 0 ? inter / union : 0;
}

// 🔧 Generic descriptor words — style, era, material, color, finish —
// that show up across unrelated product names and item labels. These must
// NEVER count as a category match on their own (this is what let e.g. a
// detected "wall sconce" false-match a product named "... Framed Wall
// Art" purely on the shared word "wall"). Only used in the PRE-VERIFICATION
// heuristic paths below (finding what to replace, confirming a fresh
// placement) — never for final ground-truth classification.
const GENERIC_WORDS = new Set([
  "wall", "modern", "mid", "century", "framed", "boho", "rattan", "wood",
  "wooden", "small", "large", "round", "square", "black", "white", "brown",
  "tan", "beige", "grey", "gray", "gold", "silver", "vintage", "rustic",
  "classic", "style", "piece", "set", "decor", "accent",
]);

// Known furniture/decor category vocabulary, grouped so genuinely related
// terms count as the same category (e.g. "chest" ~ "dresser") without
// falling back to "any shared word counts."
const CATEGORY_GROUPS: string[][] = [
  ["dresser", "chest", "drawer", "drawers", "cabinet", "credenza", "sideboard"],
  ["sofa", "couch", "sectional", "loveseat"],
  ["lamp", "light", "lighting", "sconce"],
  ["rug", "carpet"],
  ["art", "painting", "print", "artwork"],
  ["mirror"],
  ["table", "desk", "console"],
  ["chair", "stool", "seat", "seating"],
  ["shelf", "shelving", "bookshelf", "bookcase"],
  ["plant", "planter", "vase"],
  ["bed", "headboard"],
  ["clock"],
  ["pillow", "cushion", "throw"],
];

export function categoryGroupsOverlap(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  return CATEGORY_GROUPS.some(
    (group) => group.some((w) => a.includes(w)) && group.some((w) => b.includes(w)),
  );
}

function meaningfulWordOverlap(label: string, name: string): boolean {
  return label
    .split(/\s+/)
    .some((w) => w.length > 3 && !GENERIC_WORDS.has(w) && name.includes(w));
}

/**
 * PRE-VERIFICATION heuristic only — used by swap-product to (a) guess
 * which existing item to replace before any edit has happened, and (b)
 * confirm a just-made edit landed. Never used for final real/AI-generated
 * classification once a product has a verified placedBoxes — see
 * matchDetectedItem below, which checks ground truth first.
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

  const realCategoryMatch =
    categoryGroupsOverlap(category, cat) || categoryGroupsOverlap(category, name);
  const wordFallbackMatch = !cat && meaningfulWordOverlap(label, name);

  if (!realCategoryMatch && !wordFallbackMatch) return false;
  if (nearBox && !centersClose(item.bbox, nearBox)) return false;
  return true;
}

// 🔧 Multi-piece products (wall-art triptychs, paired sconces/lamps) get
// sold as one row but land as several separate detected panels. Exported
// so swap-product-background can capture every sibling panel's box at
// verification time — the moment we actually have all the evidence —
// instead of trying to reconstruct it later from one remembered box.
export function isMultiPieceProduct(product: Product): boolean {
  const text = `${product.name} ${
    (product as unknown as { description?: string }).description ?? ""
  }`.toLowerCase();
  return /\b(\d+[\s-]?(piece|pc|panel)|set of \d+|triptych|pair of)\b/.test(text);
}

export function sameRow(a: DetectedItem["bbox"], b: DetectedItem["bbox"], thresholdPct = 10): boolean {
  const ay = a.yPct + a.hPct / 2;
  const by = b.yPct + b.hPct / 2;
  return Math.abs(ay - by) < thresholdPct;
}

const GROUND_TRUTH_IOU = 0.15;
const GROUND_TRUTH_CENTER_PCT = 8;

/**
 * Find which (if any) of a list of products a detected item corresponds
 * to. Two tiers:
 *
 * 1. GROUND TRUTH: if the product has verified placedBoxes (swap-product
 *    confirmed exactly where it landed, including every sibling panel for
 *    multi-piece sets), match by real position overlap ONLY — no
 *    category/label guessing involved, so it can't produce the false
 *    positives (unrelated item sharing a style word) or false negatives
 *    (sibling panel too far from a single remembered box) seen before.
 * 2. HEURISTIC FALLBACK: only for products where verification never
 *    produced a box (e.g. the edit succeeded but detectFurniture failed
 *    to confirm it) — best-effort category+position guess, same as
 *    before. This is the one remaining source of error, and it's a
 *    verification-step gap, not a matching-logic gap.
 */
export function matchDetectedItem(item: DetectedItem, products: Product[]): Product | null {
  for (const p of products) {
    const boxes = productPlacedBoxes(p);
    if (boxes.length > 0) {
      const groundTruthMatch = boxes.some(
        (b) => iou(item.bbox, b) > GROUND_TRUTH_IOU || centersClose(item.bbox, b, GROUND_TRUTH_CENTER_PCT),
      );
      if (groundTruthMatch) return p;
    }
  }
  // Fallback only for products with no verified box at all.
  for (const p of products) {
    if (productPlacedBoxes(p).length > 0) continue; // already checked above
    if (itemMatchesProduct(item, p)) return p;
  }
  return null;
}