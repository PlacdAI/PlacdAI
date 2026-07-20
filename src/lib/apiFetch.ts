// Fetch helper that attaches the current Supabase access token as
// Authorization: Bearer <jwt> so server routes can identify the user.
import { supabase } from "./supabaseClient";

export async function apiFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  return fetch(input, { ...init, headers });
}
