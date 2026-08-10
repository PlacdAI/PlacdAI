/**
 * Streams an image from a Gemini SSE passthrough endpoint.
 * Gemini streamGenerateContent emits events shaped like:
 *   data: {"candidates":[{"content":{"parts":[{"inlineData":{"mimeType":"image/png","data":"..."}}]}}]}
 * Each event that contains inlineData is treated as a progressive frame; the
 * last one is marked final. Fires `onFrame(dataUrl, isFinal)` as bytes arrive.
 */
export async function streamImage(
  url: string,
  body: unknown,
  onFrame: (dataUrl: string, isFinal: boolean) => void,
): Promise<string | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Stream failed ${res.status}: ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastDataUrl: string | null = null;
  const frames: string[] = [];

  const processChunk = (chunkStr: string) => {
    const dataLines: string[] = [];
    for (const line of chunkStr.split("\n")) {
      if (line.startsWith("data: ")) dataLines.push(line.slice(6));
      else if (line.startsWith("data:")) dataLines.push(line.slice(5));
    }
    const dataStr = dataLines.join("");
    if (!dataStr || dataStr === "[DONE]") return;

    let payload:
      | {
          candidates?: {
            content?: {
              parts?: {
                inlineData?: { mimeType?: string; data?: string };
              }[];
            };
          }[];
          type?: string;
          b64_json?: string;
          error?: { message?: string };
        }
      | undefined;
    try {
      payload = JSON.parse(dataStr);
    } catch {
      return;
    }
    if (!payload) return;
    if (payload.error) {
      throw new Error(payload.error.message ?? "Image generation failed");
    }

    // Gateway path: image_generation.partial_image / .completed
    if (payload.type && payload.b64_json) {
      const dataUrl = `data:image/png;base64,${payload.b64_json}`;
      frames.push(dataUrl);
      lastDataUrl = dataUrl;
      onFrame(dataUrl, payload.type === "image_generation.completed");
      return;
    }

    // Direct Gemini path: candidates[].content.parts[].inlineData
    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    for (const p of parts) {
      if (p.inlineData?.data) {
        const mime = p.inlineData.mimeType ?? "image/png";
        const dataUrl = `data:${mime};base64,${p.inlineData.data}`;
        frames.push(dataUrl);
        lastDataUrl = dataUrl;
        onFrame(dataUrl, false);
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      processChunk(chunk);
    }
  }

  // Process any residual data left in the buffer when the stream closes
  if (buffer.trim()) {
    processChunk(buffer);
  }

  if (lastDataUrl) onFrame(lastDataUrl, true);
  return lastDataUrl;
}