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

export async function fetchCatalogForPrompt(style: string, limit = 40) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id,name,brand,category,style,description")
    .ilike("style", `%${style}%`)
    .limit(limit);
  if (error) throw new Error(`Supabase catalog fetch failed: ${error.message}`);
  return data ?? [];
}

export async function fetchProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const supabase = getClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLS)
    .in("id", ids);
  if (error) throw new Error(`Supabase products fetch failed: ${error.message}`);
  // Preserve input ordering
  const map = new Map((data ?? []).map((p) => [p.id, p as Product]));
  return ids.map((id) => map.get(id)).filter(Boolean) as Product[];
}

export async function fetchFallbackProducts(style: string, limit = 3): Promise<Product[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLS)
    .ilike("style", `%${style}%`)
    .limit(limit);
  if (error) throw new Error(`Supabase fallback fetch failed: ${error.message}`);
  return (data ?? []) as Product[];
}
