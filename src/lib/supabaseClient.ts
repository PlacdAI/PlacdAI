// ─────────────────────────────────────────────────────────────
// Supabase — BROWSER CLIENT (auth + client-side reads)
//
// Uses the VITE_-prefixed env vars so they're safe to bundle to the browser.
// Row-Level Security still applies. Never import server-only files here.
// ─────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_EXTERNAL_SUPABASE_URL as string;
const anon = import.meta.env.VITE_EXTERNAL_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  // eslint-disable-next-line no-console
  console.warn(
    "[supabaseClient] Missing VITE_EXTERNAL_SUPABASE_URL / VITE_EXTERNAL_SUPABASE_ANON_KEY — auth will not work.",
  );
}

export const supabase = createClient(url ?? "", anon ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
