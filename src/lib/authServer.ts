// Server-side helpers for verifying the caller's Supabase user + running
// privileged actions (credit debit, storage upload, gallery insert).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getAdminClient(): SupabaseClient {
  const url = process.env.EXTERNAL_SUPABASE_URL!;
  const key =
    process.env.EXTERNAL_SUPABASE_SERVICE_KEY ||
    process.env.EXTERNAL_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Extract & verify the caller's user from the Authorization: Bearer <jwt> header. */
export async function getUserFromRequest(
  request: Request,
): Promise<{ id: string; email?: string } | null> {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  const url = process.env.EXTERNAL_SUPABASE_URL!;
  const anon = process.env.EXTERNAL_SUPABASE_ANON_KEY!;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}
