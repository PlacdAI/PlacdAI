// ─────────────────────────────────────────────────────────────
// Supabase — BROWSER CLIENT (auth + client-side reads)
//
// Uses publishable (anon) credentials — safe to ship in the browser bundle.
// Row-Level Security still applies. Never import server-only files here.
//
// VSCODE EXPORT:
//   The values below are read from VITE_EXTERNAL_SUPABASE_* first, and fall
//   back to the hardcoded publishable defaults so the app also works in the
//   Lovable sandbox (which does not allow VITE_-prefixed secrets). To point
//   at a different project locally, set these in your `.env`:
//     VITE_EXTERNAL_SUPABASE_URL=...
//     VITE_EXTERNAL_SUPABASE_ANON_KEY=...
// ─────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";

const FALLBACK_URL = "https://kszfnagsroglrvxphuif.supabase.co";
const FALLBACK_ANON = "sb_publishable_le73HMU48IksJ-0ZggUq7g_OisGIr4G";

const url =
  (import.meta.env.VITE_EXTERNAL_SUPABASE_URL as string | undefined) ||
  FALLBACK_URL;
const anon =
  (import.meta.env.VITE_EXTERNAL_SUPABASE_ANON_KEY as string | undefined) ||
  FALLBACK_ANON;

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
