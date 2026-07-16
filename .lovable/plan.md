## Answer to your question

**No, the AI won't automatically pick up a new `products_2` table.** The code is hardcoded to read from a single table (`TABLE = "products"` in `src/lib/supabase.server.ts`). If you add more tables, you have two options:

1. **Recommended: keep one `products` table** and just keep inserting rows into it. Add a `collection` or `source` column if you want to tag which dataset a row came from. The AI already filters by `style`, so more rows = more variety with zero code changes.
2. **Multiple tables**: requires code changes — every query (`fetchCatalogForPrompt`, `fetchProductsByIds`, `fetchFallbackProducts`) would need to `UNION` across tables, or you'd add a `TABLES = ["products", "products_2"]` array and loop. Messier, slower, and Supabase can't foreign-key or index across them cleanly.

I'll set up option 1 as the default and leave a clearly commented hook for option 2 if you ever want it.

## VSCode export readiness

Goal: you clone the repo, run 2 commands, paste keys into `.env`, and it runs.

### Changes

1. **`.env.example`** — rewrite with clear section headers and inline comments explaining:
   - Where to get each key (Supabase dashboard → Settings → API; Google AI Studio for Gemini)
   - Which are server-only vs client-visible (`VITE_` prefix)
   - Which are safe to commit vs must stay secret
   - Note that `EXTERNAL_SUPABASE_SERVICE_KEY` bypasses RLS — never ship to client

2. **`README.md`** — add a "Run locally in VSCode" section:
   ```
   1. bun install
   2. cp .env.example .env
   3. Fill in the 4 keys (links included)
   4. bun dev → http://localhost:8080
   ```
   Plus: how to add more furniture (just INSERT into `products` table), the schema of the `products` table, and a note on the Gemini free-tier limits.

3. **`src/lib/supabase.server.ts`** — add a top-of-file comment block explaining:
   - This file talks to Supabase server-side
   - How to swap the table name or add more tables (with a commented-out multi-table example)
   - Why service key vs anon key
   - The `STYLE_KEYWORDS` map — how to add a new style

4. **`src/lib/gemini.server.ts`** — add a comment block explaining:
   - Where `GEMINI_API_KEY` comes from (aistudio.google.com)
   - Which model does what (`gemini-flash-latest` = JSON picks, `gemini-2.5-flash-image` = room generation/edits)
   - How to swap models (single constant to change)

5. **`src/lib/supabaseClient.ts`** — add a comment explaining the `VITE_` prefix requirement and the friendly missing-env error.

6. **`src/routes/api/*.ts`** (the 4 API routes) — add a one-line header comment on each explaining what it does and what it calls, so you can navigate the pipeline.

7. **`.env.example` → `.env` note**: confirm `.env` is in `.gitignore` (it already is via the default Vite gitignore, but I'll double-check).

### Not changing

- No logic changes to the pipeline — it already works.
- No new dependencies.
- Not touching the deployed secrets — those stay in Lovable Cloud for the hosted preview.

### After you export

You'll need to paste these 4 values into `.env`:
- `EXTERNAL_SUPABASE_URL`
- `EXTERNAL_SUPABASE_ANON_KEY` (+ `VITE_` copy)
- `EXTERNAL_SUPABASE_SERVICE_KEY`
- `GEMINI_API_KEY`

The `.env.example` will tell you exactly where each one lives in each dashboard.
