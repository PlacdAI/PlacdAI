// Lovable AI Gateway calls (uses managed LOVABLE_API_KEY, no external Gemini key needed).
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

function key() {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("Missing LOVABLE_API_KEY. Enable Lovable AI in project settings.");
  return k;
}

export interface InlinePart {
  inlineData: { mimeType: string; data: string };
}
export interface TextPart {
  text: string;
}
export type Part = InlinePart | TextPart;

// Convert our internal Part[] into OpenAI-compatible chat content blocks.
function partsToContent(parts: Part[]) {
  return parts.map((p) => {
    if ("text" in p) return { type: "text", text: p.text };
    return {
      type: "image_url",
      image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` },
    };
  });
}

/** Structured JSON generation via Lovable AI Gateway (OpenAI-compatible chat completions). */
export async function geminiJson<T>(opts: {
  model?: string;
  parts: Part[];
  schema: unknown;
  systemInstruction?: string;
}): Promise<T> {
  const model = opts.model ?? "google/gemini-2.5-flash";
  const messages: Array<{ role: string; content: unknown }> = [];
  if (opts.systemInstruction) {
    messages.push({ role: "system", content: opts.systemInstruction });
  }
  messages.push({ role: "user", content: partsToContent(opts.parts) });

  const body = {
    model,
    messages,
    response_format: {
      type: "json_schema",
      json_schema: { name: "response", strict: true, schema: opts.schema },
    },
  };

  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key()}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Retry without strict schema (some models don't support json_schema — fall back to json_object).
    const fallback = await fetch(`${GATEWAY}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key()}`,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: "json_object" },
      }),
    });
    if (!fallback.ok) {
      throw new Error(`Gateway JSON ${fallback.status}: ${await fallback.text()}`);
    }
    const j = (await fallback.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = j.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("Gateway returned no JSON text");
    return JSON.parse(text) as T;
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Gateway returned no JSON text");
  return JSON.parse(text) as T;
}

/** Streaming image generation via Lovable AI Gateway — passes SSE body through. */
export async function geminiImageStream(opts: {
  parts: Part[];
  model?: string;
}): Promise<Response> {
  const model = opts.model ?? "google/gemini-3-pro-image";
  const body = {
    model,
    messages: [{ role: "user", content: partsToContent(opts.parts) }],
    modalities: ["image", "text"],
    stream: true,
  };
  return fetch(`${GATEWAY}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key()}`,
    },
    body: JSON.stringify(body),
  });
}

/** Non-streaming image edit via Lovable AI Gateway — returns image as data URL. */
export async function geminiImageEdit(opts: {
  parts: Part[];
  model?: string;
}): Promise<string> {
  const model = opts.model ?? "google/gemini-3-pro-image";
  const body = {
    model,
    messages: [{ role: "user", content: partsToContent(opts.parts) }],
    modalities: ["image", "text"],
  };
  const res = await fetch(`${GATEWAY}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key()}`,
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
