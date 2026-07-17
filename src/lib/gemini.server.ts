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
const USE_LOVABLE_GATEWAY = true;

// Endpoints
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/images/generations";

// Which Gemini image model the gateway should route to.
// Options: google/gemini-2.5-flash-image, google/gemini-3-pro-image,
//          google/gemini-3.1-flash-image, google/gemini-3.1-flash-lite-image
const GATEWAY_IMAGE_MODEL = "google/gemini-2.5-flash-image";

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

export interface InlinePart {
  inlineData: { mimeType: string; data: string };
}
export interface TextPart {
  text: string;
}
export type Part = InlinePart | TextPart;

// ─────────────────────────────────────────────────────────────
// JSON generation (product picker). ALWAYS direct Gemini.
// ─────────────────────────────────────────────────────────────
export async function geminiJson<T>(opts: {
  model?: string;
  parts: Part[];
  schema: unknown;
  systemInstruction?: string;
}): Promise<T> {
  const model = opts.model ?? "gemini-flash-latest";
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
// Returns a Response whose body is SSE. The client parser in
// src/lib/streamImage.ts understands BOTH gateway and direct shapes.
// ─────────────────────────────────────────────────────────────
export async function geminiImageStream(opts: {
  parts: Part[];
  model?: string;
}): Promise<Response> {
  if (USE_LOVABLE_GATEWAY) {
    // 🔧 GATEWAY PATH (Lovable) — remove/ignore this branch when exporting
    // if you'd rather delete the toggle entirely.
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
  const model = opts.model ?? "gemini-2.5-flash-image";
  const body = {
    contents: [{ role: "user", parts: opts.parts }],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
  };
  return fetch(
    `${GEMINI_BASE}/models/${model}:streamGenerateContent?alt=sse&key=${geminiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

// ─────────────────────────────────────────────────────────────
// Non-streaming image edit (used by /api/swap-product)
// Returns a data URL string. Same on both backends.
// ─────────────────────────────────────────────────────────────
export async function geminiImageEdit(opts: {
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
  const model = opts.model ?? "gemini-2.5-flash-image";
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
