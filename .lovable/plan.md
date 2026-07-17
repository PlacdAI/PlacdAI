## Goal

Use **Lovable AI Gateway** for image generation/editing while you're building in Lovable (no key setup needed — `LOVABLE_API_KEY` is auto-provisioned). Leave big, obvious `// SWAP FOR VSCODE` comment blocks so when you export, you flip one constant and it goes back to your direct Gemini key.

The JSON pick-products call stays on direct Gemini either way (it's cheap and already works).

## What changes

### 1. `src/lib/gemini.server.ts` — add a gateway path alongside the direct one

Add a `USE_LOVABLE_GATEWAY` toggle at the top:

```ts
// ─────────────────────────────────────────────────────────────
// 🔧 VSCODE SWAP — flip this to false after export
// ─────────────────────────────────────────────────────────────
// true  → uses Lovable AI Gateway (LOVABLE_API_KEY, auto-provisioned in Lovable)
// false → uses your direct Google Gemini key (GEMINI_API_KEY in .env)
//
// In VSCode: set to `false` so it reads your GEMINI_API_KEY from .env.
// The JSON picker (geminiJson) always uses the direct Gemini key regardless.
const USE_LOVABLE_GATEWAY = true;
```

Rewrite `geminiImageStream` and `geminiImageEdit` so each has two branches:

- **Gateway branch** (`USE_LOVABLE_GATEWAY === true`): POST to `https://ai.gateway.lovable.dev/v1/images/generations` with header `Authorization: Bearer ${LOVABLE_API_KEY}`, model `google/gemini-2.5-flash-image`, body shape `{ messages: [{ role: "user", content: [...] }], modalities: ["image","text"], stream: true }`. Content array carries text + `image_url` parts (data URLs) for the room and product references.
- **Direct branch** (`USE_LOVABLE_GATEWAY === false`): unchanged — the existing Google `generativelanguage.googleapis.com` call using `GEMINI_API_KEY`.

Response payloads differ:
- Gateway streaming returns SSE with `image_generation.partial_image` / `image_generation.completed` events carrying `b64_json`.
- Direct Gemini streaming returns SSE with `candidates[].content.parts[].inlineData`.

So `src/lib/streamImage.ts` needs to parse **both** shapes. Add branch inside the existing loop: if the parsed event has `type === "image_generation.partial_image"` or `"completed"`, read `b64_json`; else fall back to the existing `candidates` parser. This keeps one client parser that works with either backend — no route changes needed.

For `geminiImageEdit` (non-streaming, used by swap-product):
- Gateway: same endpoint without `stream: true`, read `data[0].b64_json`.
- Direct: unchanged.

Both branches return the same `data:image/png;base64,...` string, so callers (`swap-product.ts`, `generate-room.ts`) need zero changes.

### 2. `.env.example` — document both keys

Add a section explaining:

```
# ── Image generation backend ─────────────────────────────────
# In Lovable: LOVABLE_API_KEY is auto-provisioned, nothing to do.
# In VSCode:  set USE_LOVABLE_GATEWAY = false in src/lib/gemini.server.ts
#             and make sure GEMINI_API_KEY below is filled in.
# GEMINI_API_KEY is also always used for the product-picker JSON call.
```

Keep `GEMINI_API_KEY` as-is (still required for the picker).

### 3. `README.md` — one-paragraph "Moving to VSCode" note

Add under the existing "Run locally in VSCode" section:

> **One-line switch after export:** open `src/lib/gemini.server.ts`, change `USE_LOVABLE_GATEWAY = true` to `false`. That's it — the app now uses your own `GEMINI_API_KEY` for everything.

### 4. Provision `LOVABLE_API_KEY`

Call the ai_gateway create tool to make sure the key exists in this project (no-op if already there).

## What does NOT change

- `src/routes/api/generate-room.ts`, `swap-product.ts`, `pick-products.ts` — untouched (same helper signatures).
- `src/lib/supabase.server.ts`, product pipeline, UI — untouched.
- Product-picker JSON (`geminiJson`) — stays on direct Gemini key, since it's a cheap text call and the gateway's chat endpoint would need a different body shape. One less thing to swap.

## Result

- **In Lovable now:** image gen works via `LOVABLE_API_KEY` (already provisioned), you don't need to configure anything.
- **In VSCode after export:** flip one boolean, fill in `GEMINI_API_KEY`, done.
- Big comment banners at every swap point so it's impossible to miss.