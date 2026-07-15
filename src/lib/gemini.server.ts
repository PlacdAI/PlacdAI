// Direct calls to Google Generative Language API (uses user's personal Gemini key).
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function key() {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("Missing GEMINI_API_KEY. Set it in .env (see .env.example).");
  return k;
}

export interface InlinePart {
  inlineData: { mimeType: string; data: string };
}
export interface TextPart {
  text: string;
}
export type Part = InlinePart | TextPart;

/** Structured JSON generation. */
export async function geminiJson<T>(opts: {
  model?: string;
  parts: Part[];
  schema: unknown;
  systemInstruction?: string;
}): Promise<T> {
  const model = opts.model ?? "gemini-2.5-flash";
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
  const res = await fetch(`${BASE}/${model}:generateContent?key=${key()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini JSON ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini returned no JSON text");
  return JSON.parse(text) as T;
}

/** Streaming image generation — returns raw upstream SSE body for passthrough. */
export async function geminiImageStream(opts: {
  parts: Part[];
  model?: string;
}): Promise<Response> {
  const model = opts.model ?? "gemini-2.5-flash-image";
  const body = {
    contents: [{ role: "user", parts: opts.parts }],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
  };
  return fetch(`${BASE}/${model}:streamGenerateContent?alt=sse&key=${key()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Non-streaming image edit — returns first image part as data URL. */
export async function geminiImageEdit(opts: {
  parts: Part[];
  model?: string;
}): Promise<string> {
  const model = opts.model ?? "gemini-2.5-flash-image";
  const body = {
    contents: [{ role: "user", parts: opts.parts }],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
  };
  const res = await fetch(`${BASE}/${model}:generateContent?key=${key()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini edit ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    candidates?: {
      content?: {
        parts?: { inlineData?: { data: string; mimeType: string } }[];
      };
    }[];
  };
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p.inlineData)?.inlineData;
  if (!img) throw new Error("Gemini edit returned no image");
  return `data:${img.mimeType};base64,${img.data}`;
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
