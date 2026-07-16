// ─────────────────────────────────────────────────────────────
// Supabase — SERVER SIDE ONLY
//
// This file is imported by /api/* routes. It uses the service_role key
// (or falls back to anon), which bypasses Row-Level Security. NEVER import
// this file from browser code / components — use `src/lib/supabaseClient.ts`
// for the browser client instead.
//
// ── ADDING MORE FURNITURE ────────────────────────────────────
// Just INSERT more rows into the `products` table below. No code changes
// needed — the AI filters by `style` at query time.
//
// ── ADDING A SECOND TABLE (e.g. "products_2") ────────────────
// Not recommended, but if you must: change TABLE below into an array and
// UNION the results in each helper. Rough sketch:
//
//   const TABLES = ["products", "products_2"];
//   const results = await Promise.all(
//     TABLES.map(t => supabase.from(t).select(COLS).or(orFilter).limit(limit))
//   );
//   const data = results.flatMap(r => r.data ?? []);
//
// ── ADDING A NEW STYLE ───────────────────────────────────────
//   1. Add the label to STYLES in src/lib/types.ts
//   2. Add DB keywords to STYLE_KEYWORDS below
// ─────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import type { Product } from "./types";

function getClient() {
  const url = process.env.EXTERNAL_SUPABASE_URL;
  const key =
    process.env.EXTERNAL_SUPABASE_SERVICE_KEY ??
    process.env.EXTERNAL_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing EXTERNAL_SUPABASE_URL / EXTERNAL_SUPABASE_SERVICE_KEY. Set them in .env (see .env.example).",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

const TABLE = "products";
const COLS = "id,name,brand,price,category,style,imageUrl,productUrl,description";

// Map friendly UI style labels to keywords actually stored in the DB `style` column.
// DB currently uses short lowercase tags like: boho, midcentury, japandi, modern, scandi, industrial, minimalist.
const STYLE_KEYWORDS: Record<string, string[]> = {
  "Mid-Century Modern": ["midcentury", "mid-century", "modern"],
  Minimalist: ["minimalist", "minimal"],
  Scandinavian: ["scandi", "scandinavian", "nordic"],
  Industrial: ["industrial"],
  Bohemian: ["boho", "bohemian"],
  Japandi: ["japandi", "japanese"],
};

function keywordsFor(style: string): string[] {
  return STYLE_KEYWORDS[style] ?? [style.toLowerCase()];
}

async function queryByStyle<T>(
  select: string,
  style: string,
  limit: number,
): Promise<T[]> {
  const supabase = getClient();
  const kws = keywordsFor(style);
  // Build an OR of ilike filters across all mapped keywords.
  const orFilter = kws.map((k) => `style.ilike.%${k}%`).join(",");
  const { data, error } = await supabase
    .from(TABLE)
    .select(select)
    .or(orFilter)
    .limit(limit);
  if (error) throw new Error(`Supabase query failed: ${error.message}`);
  if (data && data.length > 0) return data as T[];

  // Fallback: if nothing matched, return any products so the AI still has a catalog.
  const { data: any, error: err2 } = await supabase
    .from(TABLE)
    .select(select)
    .limit(limit);
  if (err2) throw new Error(`Supabase fallback query failed: ${err2.message}`);
  return (any ?? []) as T[];
}

export async function fetchCatalogForPrompt(style: string, limit = 40) {
  return queryByStyle<{
    id: string;
    name: string;
    brand: string;
    category: string;
    style: string;
    description: string;
  }>("id,name,brand,category,style,description", style, limit);
}

export async function fetchProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const supabase = getClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLS)
    .in("id", ids);
  if (error) throw new Error(`Supabase products fetch failed: ${error.message}`);
  const map = new Map((data ?? []).map((p) => [p.id, p as Product]));
  return ids.map((id) => map.get(id)).filter(Boolean) as Product[];
}

export async function fetchFallbackProducts(
  style: string,
  limit = 3,
): Promise<Product[]> {
  return queryByStyle<Product>(COLS, style, limit);
}
