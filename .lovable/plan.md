# PlacdAI Build Plan

## 1. Secrets & Config

- Store securely via the secrets tool (server-side env vars, never in the repo):
  - `EXTERNAL_SUPABASE_URL`, `EXTERNAL_SUPABASE_ANON_KEY`, `EXTERNAL_SUPABASE_SERVICE_KEY`, `GEMINI_API_KEY`.
  - Also expose the anon key + URL to the client as `VITE_EXTERNAL_SUPABASE_URL` / `VITE_EXTERNAL_SUPABASE_ANON_KEY`.
- `src/lib/supabaseClient.ts` (browser) — reads `import.meta.env.VITE_EXTERNAL_SUPABASE_*`. **No hardcoded fallback** for secrets (see note below); throws a clear error if missing so VS Code users know to fill `.env`.
- `src/lib/supabase.server.ts` — service-role client for server functions (never imported by client code).
- `.env.example` at repo root documenting all four variable names with placeholder values. README section explains the VS Code flow: `cp .env.example .env` → paste values → `bun dev`.

> Note on hardcoded fallback: I'm not baking the anon key or any secret string into `supabaseClient.ts`. Even the anon key in a repo becomes a scraping target and pins the app to one Supabase project. `.env.example` + a friendly missing-env error message gives you the same "clone and go" experience without the risk. **Please rotate the pasted service key + Gemini key in their dashboards after we're wired up.**

## 2. Data Layer

Table: `products` (columns confirmed: `id, name, brand, price, category, style, imageUrl, productUrl, description`).

- Typed row interface in `src/lib/types.ts` matching the camelCase columns.
- Server helper `fetchCatalogForPrompt()` returns a compact JSON array (id, name, brand, category, style, description) — trimmed to keep the Gemini prompt small; filtered by the user-selected style.
- Server helper `fetchProductsByIds(ids: string[])` returns full rows for the sidebar and for the swap step (needs `imageUrl`).

## 3. Frontend UI (Tailwind + shadcn)

Single page at `src/routes/index.tsx`:

- **Hero** — "PlacdAI: Shop the AI Look" headline, subtitle, gradient background.
- **Interaction panel**
  - Drag/drop image uploader (react-dropzone-free implementation), preview thumbnail, stored as base64 data URL in local state.
  - Style `<Select>` — Mid-Century Modern, Minimalist, Scandinavian, Industrial, Bohemian, Japandi.
  - "Generate Design" button (disabled until image + style chosen).
- **Main canvas** — large 16:9 frame. While streaming, shows progressive image with `blur-2xl → blur-0` transition (per ai-image-generation-tanstack pattern). Shows a shimmering skeleton before first frame arrives.
- **Shop-the-Look sidebar** — right column on desktop, stacks below on mobile. 3 product cards (`imageUrl`, `name`, `brand`, `price` via `Intl.NumberFormat('en-US', { style:'currency', currency:'USD' })`, "View product" button → `productUrl` in new tab). Skeleton cards during Step 1.
- Toaster via `sonner` for all error paths.
- Head metadata: title "PlacdAI — Shop the AI Look", real description, og tags.
- Replace the placeholder `src/routes/index.tsx`.

## 4. Gemini Pipeline (3 server endpoints)

Helper `src/lib/gemini.ts` — thin wrapper around `fetch` to `generativelanguage.googleapis.com` (Gemini API direct, since we're using your personal key, not Lovable AI Gateway). Exports:

- `geminiJson(prompt, images?, schema)` → structured JSON via `responseSchema`.
- `geminiImageStream(parts)` → returns upstream `ReadableStream` for SSE passthrough.
- `geminiImageEdit(parts)` → non-streaming edit returning final image bytes.

Models: `gemini-2.5-flash` for the JSON pick step; `gemini-2.5-flash-image` (Nano Banana) for generation + edits.

### Step 1 — `POST /api/pick-products` (server route)

Input: `{ roomImage: dataUrl, style: string }`.

- Fetches ~40 style-filtered catalog rows.
- Sends room image + catalog JSON to Gemini with a strict `responseSchema` requiring `{ productIds: string[3], rationale: string }`.
- Returns picked full product rows (via `fetchProductsByIds`).

### Step 2 — `POST /api/generate-room` (server route, streaming)

Input: `{ roomImage: dataUrl, style: string }`.

- Calls Gemini image gen with `stream:true`; passes upstream body straight through with `Content-Type: text/event-stream` (per ai-image-generation-tanstack — no wrapping).
- Client uses the `streamImage` helper pattern: progressive blur → sharp as base64 frames arrive; final frame stored for Step 3 input.

### Step 3 — `POST /api/swap-product` (server route)

Input: `{ currentRoomImage: dataUrl, productImageUrl: string, productName, productCategory }`.

- Fetches product image, sends both images to Gemini image-edit with prompt: "Replace the [category] in this room with this exact product — preserve its shape, texture, colors, and proportions. Match room lighting and perspective."
- Returns `{ image: dataUrl }`.
- Client calls this **3 times sequentially**, feeding each response back as `currentRoomImage` for the next call, updating the canvas after each swap.

## 5. Error Handling

- Every server route wrapped in try/catch → returns `{ error: string }` with proper status.
- Client wraps each pipeline step in try/catch → `toast.error(...)` with human message, keeps last good canvas state, re-enables the Generate button.
- If Step 1 returns fewer than 3 products, pad with top-rated style matches from DB fallback query.
- If Step 2 stream aborts, show last received frame + toast.
- If a Step 3 swap fails, keep prior room state and continue to next product (don't abort whole pipeline).
- Root `errorComponent` + `notFoundComponent` already in `__root.tsx`.

## Technical Details

**File tree added:**

```
.env.example
src/lib/supabaseClient.ts        # browser, anon key
src/lib/supabase.server.ts       # service role
src/lib/gemini.ts                # Gemini wrapper (client-safe types only; fetch lives in .server helpers)
src/lib/gemini.server.ts         # actual fetch calls, reads process.env.GEMINI_API_KEY
src/lib/types.ts                 # Product type, pipeline types
src/lib/streamImage.ts           # SSE parser + partial-frame handler
src/routes/index.tsx             # rewritten (replaces placeholder)
src/routes/api/pick-products.ts
src/routes/api/generate-room.ts  # streaming passthrough
src/routes/api/swap-product.ts
src/components/RoomUploader.tsx
src/components/StyleSelect.tsx
src/components/RoomCanvas.tsx
src/components/ProductSidebar.tsx
src/components/ProductCard.tsx
```

**Runtime notes:** Gemini streaming uses a raw server route (not `createServerFn`) because RPC can't stream. Non-streaming steps could be `createServerFn` but staying with server routes keeps all three endpoints uniform and easy to port to any Node backend from VS Code.

**What you need to do after I build:** rotate the leaked service key + Gemini key in their dashboards and paste the new values into the secure secret forms I'll open. That's the whole post-build setup.  
  
[ ] **Upgrade the image generation model** from legacy `gemini-2.5-flash-image` to `gemini-3.1-flash-image` (Nano Banana 2) for faster generation and superior spatial accuracy.