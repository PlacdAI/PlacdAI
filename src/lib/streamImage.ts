/**
 * Streams an image from a Gemini SSE endpoint that passes through Google's
 * `alt=sse` responses. Fires `onFrame(dataUrl, isFinal)` as image bytes arrive.
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

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = chunk
        .split("\n")
        .filter((l) => l.startsWith("data: "))
        .map((l) => l.slice(6))
        .join("");
      if (!line || line === "[DONE]") continue;
      try {
        const parsed = JSON.parse(line) as {
          candidates?: {
            content?: {
              parts?: { inlineData?: { data: string; mimeType: string } }[];
            };
          }[];
        };
        const parts = parsed.candidates?.[0]?.content?.parts ?? [];
        for (const p of parts) {
          if (p.inlineData?.data) {
            lastDataUrl = `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`;
            onFrame(lastDataUrl, false);
          }
        }
      } catch {
        // ignore partial frames
      }
    }
  }
  if (lastDataUrl) onFrame(lastDataUrl, true);
  return lastDataUrl;
}
