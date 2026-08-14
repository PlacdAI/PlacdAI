// ─────────────────────────────────────────────────────────────
// Image + JSON model calls — SERVER SIDE ONLY
//
// 🔧🔧🔧  VSCODE SWAP POINT — READ THIS  🔧🔧🔧
// ─────────────────────────────────────────────────────────────
// This app can generate images two different ways:
//
//   USE_LOVABLE_GATEWAY = true   → Lovable AI Gateway
//                                   Uses LOVABLE_API_KEY (auto-provisioned
//                                   inside Lovable — you don't set anything).
//                                   ✅ Use this while building in Lovable.
//
//   USE_LOVABLE_GATEWAY = false  → Direct Google Gemini API
//                                   Uses GEMINI_API_KEY from your .env file.
//                                   ✅ Use this after you export to VSCode.
//
// 👉 AFTER EXPORTING TO VSCODE:
//    1. Change the line below to `false`
//    2. Make sure GEMINI_API_KEY is filled in inside .env
//    3. Done — no other file needs to change.
//
// Note: the product-picker JSON call (geminiJson, below) ALWAYS uses your
// direct GEMINI_API_KEY — it's cheap and simpler to keep on one path.
// So GEMINI_API_KEY should be set in Lovable too (already is via secrets).
// ─────────────────────────────────────────────────────────────
const USE_LOVABLE_GATEWAY = false;

// Endpoints
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/images/generations";

// Which Gemini image model the gateway should route to.
//
// 🔧 MODEL CHOICE — using gemini-3.1-flash-image ("Nano Banana 2"), NOT
// the "-lite" variant. Google's own docs say the lite tier "is not
// optimized for multiple reference inputs or advanced multi-turn
// sequential editing" — which is exactly what this app does (room +
// product reference images, chained sequential edits in swap-product.ts).
// Non-lite 3.1 is still cheaper/faster than the old 2.5 model, just
// without that specific limitation.
// Options: google/gemini-2.5-flash-image, google/gemini-3-pro-image,
//          google/gemini-3.1-flash-image, google/gemini-3.1-flash-lite-image
const GATEWAY_IMAGE_MODEL = "google/gemini-3.1-flash-image";

function geminiKey() {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("Missing GEMINI_API_KEY. Add it to .env.");
  return k;
}
function lovableKey() {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("Missing LOVABLE_API_KEY (should be auto-provisioned in Lovable).");
  return k;
}

// ─────────────────────────────────────────────────────────────
// Shared retry-with-backoff for transient Gemini errors (429 rate limit /
// quota, 500, 503 overloaded). Originally lived only inside
// geminiImageEdit — pulled out so geminiImageStream and geminiJson get
// the same protection, since they were throwing straight through on any
// non-200 with no retry at all. That gap is what surfaced as a hard 500
// on /api/generate-room during a currently-open Google-side bug where
// paid Tier 1 projects intermittently get misrouted as free-tier quota
// (confirmed on Google's own developer forum, affecting multiple
// Gemini/Veo models — not something a code fix on our end prevents, but
// retrying smooths over the intermittent failures instead of surfacing
// them as a crash every time).
//
// Matches the status code out of our own error messages (all of which
// are written as "<label> <status>: <body>", e.g. "Gemini generation
// 429: ..." or "Gemini edit 503: ...") rather than hardcoding each
// call site's exact wording, so this works unchanged regardless of which
// function or path (gateway vs. direct) threw it.
const RETRYABLE_STATUS = new Set([429, 500, 503]);
const MAX_RETRIES = 3;

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      const status = Number(/(\d{3}):/.exec(msg)?.[1]);
      const isRetryable = RETRYABLE_STATUS.has(status);
      if (!isRetryable || attempt === MAX_RETRIES) throw e;
      const delayMs = 500 * 2 ** attempt + Math.random() * 250;
      console.warn(
        `${label}: transient ${status} error, retrying in ${Math.round(delayMs)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

export interface InlinePart {
  inlineData: { mimeType: string; data: string };
}
export interface TextPart {
  text: string;
}
export type Part = InlinePart | TextPart;

// ─────────────────────────────────────────────────────────────
// JSON generation (product picker, furniture detection). ALWAYS direct
// Gemini — cheap text/JSON call, no image generation involved.
//
// 🔧 MODEL PIN — do NOT default this to "gemini-flash-latest". That's a
// Google *alias*, not a model — their docs say it "gets hot-swapped with
// every new release." That's exactly why AI Studio usage started showing
// billing under "Gemini 3.6 Flash" instead of the 2.5 Flash this app was
// built against: no code changed, Google just moved the alias's target
// out from under us. Pin an explicit, currently-supported model instead,
// so a future Google release can't silently change what this costs again.
// gemini-2.5-flash-lite is plenty for structured extraction tasks (JSON
// product picks, furniture bounding boxes) and is the cheapest current
// stable model — swap it out here explicitly if you ever need to upgrade,
// not by leaving it to an alias.
// ─────────────────────────────────────────────────────────────
export async function geminiJson<T>(opts: {
  model?: string;
  parts: Part[];
  schema: unknown;
  systemInstruction?: string;
}): Promise<T> {
  return withRetry("geminiJson", () => geminiJsonOnce(opts));
}

async function geminiJsonOnce<T>(opts: {
  model?: string;
  parts: Part[];
  schema: unknown;
  systemInstruction?: string;
}): Promise<T> {
  const model = opts.model ?? "gemini-3.1-flash-lite";
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: opts.parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: opts.schema,
    },
  };
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }

  const res = await fetch(
    `${GEMINI_BASE}/models/${model}:generateContent?key=${geminiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`Gemini JSON ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini returned no JSON text");
  return JSON.parse(text) as T;
}

// ─────────────────────────────────────────────────────────────
// Helpers to convert our Part[] into the two API shapes
// ─────────────────────────────────────────────────────────────
function partsToGatewayContent(parts: Part[]) {
  // OpenAI-compatible messages content array (image_url + text parts).
  return parts.map((p) => {
    if ("text" in p) return { type: "text", text: p.text };
    return {
      type: "image_url",
      image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` },
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Streaming image generation (used by /api/generate-room)
// ─────────────────────────────────────────────────────────────
export async function geminiImageStream(opts: {
  parts: Part[];
  model?: string;
}): Promise<Response> {
  return withRetry("geminiImageStream", () => geminiImageStreamOnce(opts));
}

async function geminiImageStreamOnce(opts: {
  parts: Part[];
  model?: string;
}): Promise<Response> {
  if (USE_LOVABLE_GATEWAY) {
    const body = {
      model: GATEWAY_IMAGE_MODEL,
      messages: [{ role: "user", content: partsToGatewayContent(opts.parts) }],
      modalities: ["image", "text"],
      stream: true,
    };
    return fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  // 🔧 DIRECT GEMINI PATH (VSCode) — uses GEMINI_API_KEY
  // gemini-2.5-flash-image uses generateContent for direct API calls
  const model = opts.model ?? "gemini-3.1-flash-image";
  const body = {
    contents: [{ role: "user", parts: opts.parts }],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
  };

  const res = await fetch(
    `${GEMINI_BASE}/models/${model}:generateContent?key=${geminiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) throw new Error(`Gemini generation ${res.status}: ${await res.text()}`);
  const json = await res.json();

  // Wrap the direct JSON response into an SSE stream format for streamImage.ts
  const sseData = `data: ${JSON.stringify(json)}\n\n`;
  return new Response(sseData, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

// ─────────────────────────────────────────────────────────────
// Non-streaming image edit (used by /api/swap-product)
// Returns a data URL string. Same on both backends.
// ─────────────────────────────────────────────────────────────
export async function geminiImageEdit(opts: {
  parts: Part[];
  model?: string;
}): Promise<string> {
  return withRetry("geminiImageEdit", () => geminiImageEditOnce(opts));
}

async function geminiImageEditOnce(opts: {
  parts: Part[];
  model?: string;
}): Promise<string> {
  if (USE_LOVABLE_GATEWAY) {
    // 🔧 GATEWAY PATH (Lovable)
    const body = {
      model: GATEWAY_IMAGE_MODEL,
      messages: [{ role: "user", content: partsToGatewayContent(opts.parts) }],
      modalities: ["image", "text"],
    };
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Gateway edit ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as {
      data?: { b64_json?: string }[];
    };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("Gateway edit returned no image");
    return `data:image/png;base64,${b64}`;
  }

  // 🔧 DIRECT GEMINI PATH (VSCode)
  const model = opts.model ?? "gemini-3.1-flash-image";
  const body = {
    contents: [{ role: "user", parts: opts.parts }],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
  };
  const res = await fetch(
    `${GEMINI_BASE}/models/${model}:generateContent?key=${geminiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`Gemini edit ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    candidates?: {
      content?: {
        parts?: { inlineData?: { mimeType?: string; data?: string } }[];
      };
    }[];
  };
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    if (p.inlineData?.data) {
      const mime = p.inlineData.mimeType ?? "image/png";
      return `data:${mime};base64,${p.inlineData.data}`;
    }
  }
  throw new Error("Gemini edit returned no image");
}

/** Fetch a remote image URL and return { mimeType, base64 }. */
export async function fetchImageAsInline(
  url: string,
): Promise<{ mimeType: string; data: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch ${res.status} for ${url}`);
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  const data = btoa(bin);
  return { mimeType, data };
}

/** Parse a data URL like "data:image/png;base64,..." into inline parts. */
export function dataUrlToInline(dataUrl: string): {
  mimeType: string;
  data: string;
} {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("Invalid data URL");
  return { mimeType: m[1], data: m[2] };
}

// ─────────────────────────────────────────────────────────────
// Added for the Background Function rebuild: generate-room's result is now
// a Supabase Storage public URL (kept small on purpose so Realtime payloads
// don't carry a multi-MB image), not always a base64 data URL like before.
// swap-product.ts and save-generation.ts both still work in data URLs
// internally (dataUrlToInline, the data-URL regex check) — this is the one
// place that bridges the two shapes, so neither route has to duplicate the
// fetch-and-convert logic itself.
/** If `image` is already a data URL, return it unchanged. Otherwise treat
 * it as a remote URL (e.g. a Supabase Storage public URL), fetch it, and
 * convert it into a data URL. */
export async function ensureDataUrl(image: string): Promise<string> {
  if (image.startsWith("data:")) return image;
  const { mimeType, data } = await fetchImageAsInline(image);
  return `data:${mimeType};base64,${data}`;
}