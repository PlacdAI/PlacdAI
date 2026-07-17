# PlacdAI — Shop the AI Look

Upload a photo of a room, pick a style, and PlacdAI generates a redesigned
version plus 3 real products from your Supabase catalog that match the look.

---

## Run locally in VSCode

Prerequisites: [Bun](https://bun.sh) (or Node 20+ with `npm`).

```bash
git clone <your-repo-url> placdai
cd placdai
bun install
cp .env.example .env
# → open .env and fill in the 4 keys (see .env.example for links)
bun dev
```

Open http://localhost:8080.

### The 4 keys you need

| Variable | Where to get it |
|---|---|
| `EXTERNAL_SUPABASE_URL` | Supabase → Project Settings → API → "Project URL" |
| `EXTERNAL_SUPABASE_ANON_KEY` | same page → "anon / public" key |
| `EXTERNAL_SUPABASE_SERVICE_KEY` | same page → "service_role" key (server-only!) |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey |

You also duplicate the URL + anon key into `VITE_EXTERNAL_SUPABASE_*` so the
browser bundle can read them. `.env.example` shows the exact layout.

### ⚠️ One-line switch after exporting from Lovable

While the project runs inside Lovable, image generation goes through the
**Lovable AI Gateway** (no key setup needed). After you export to VSCode:

1. Open `src/lib/gemini.server.ts`
2. Change `const USE_LOVABLE_GATEWAY = true;` to `false`
3. Make sure `GEMINI_API_KEY` is filled in your `.env`

That's it — the app now uses your own Gemini key for everything.

---

## The `products` table

The AI reads from a single Supabase table called `products` with these columns:

| column | type | notes |
|---|---|---|
| `id` | text / uuid | primary key |
| `name` | text | |
| `brand` | text | |
| `price` | numeric | USD |
| `category` | text | e.g. `sofa`, `lamp`, `rug` |
| `style` | text | short tag: `midcentury`, `minimalist`, `scandi`, `industrial`, `boho`, `japandi`, `modern` |
| `imageUrl` | text | high-res product image (used by the swap step) |
| `productUrl` | text | link to buy |
| `description` | text | 1–2 sentences, fed to the AI |

### Adding more furniture

**Just insert more rows into the same `products` table** — no code changes
needed. The AI filters by `style`, so more rows = more variety.

**Do NOT create a second table** like `products_2`. The code queries one
table (`TABLE = "products"` in `src/lib/supabase.server.ts`). If you truly
need a second table, you'd have to UNION every query — see the comment
block in `src/lib/supabase.server.ts` for the hook.

### Adding a new style

1. Add the label to `STYLES` in `src/lib/types.ts`.
2. Add matching DB keywords to `STYLE_KEYWORDS` in `src/lib/supabase.server.ts`.

---

## How the pipeline works

Three endpoints under `src/routes/api/`:

1. **`/api/pick-products`** — Sends the room photo + a trimmed catalog to
   Gemini, gets back 3 product IDs, returns the full rows.
2. **`/api/generate-room`** — Streams a redesigned room image from Gemini
   (progressive blur → sharp).
3. **`/api/swap-product`** — For each of the 3 picks, edits the generated
   room to insert the exact product image from Supabase.

Plus `/api/debug-shop-look` for troubleshooting the picker.

---

## Tech

TanStack Start · React 19 · Vite 7 · Tailwind v4 · shadcn/ui · Supabase · Google Gemini
