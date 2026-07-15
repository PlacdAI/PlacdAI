/**
 * Streams an image from a Lovable AI Gateway SSE passthrough endpoint.
 * The gateway normalizes provider responses to OpenAI-style events:
 *   - image_generation.partial_image  (progressive preview frames)
 *   - image_generation.completed      (final image)
 *   - error                            (terminal failure)
 * Fires `onFrame(dataUrl, isFinal)` as image bytes arrive.
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
  let sawCompleted = false;
  let streamError: string | undefined;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      let eventName: string | undefined;
      const dataLines: string[] = [];
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event: ")) eventName = line.slice(7).trim();
        else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
      }
      const dataStr = dataLines.join("");
      if (!dataStr || dataStr === "[DONE]") continue;

      let payload:
        | {
            type?: string;
            b64_json?: string;
            error?: { message?: string };
          }
        | undefined;
      try {
        payload = JSON.parse(dataStr);
      } catch {
        continue;
      }
      if (!payload) continue;

      const type = eventName ?? payload.type;
      if (type === "error" || payload.type === "error") {
        streamError = payload.error?.message ?? "Image generation failed";
        continue;
      }
      if (
        type !== "image_generation.partial_image" &&
        type !== "image_generation.completed"
      ) {
        continue;
      }
      if (!payload.b64_json) continue;
      const isFinal = type === "image_generation.completed";
      lastDataUrl = `data:image/png;base64,${payload.b64_json}`;
      onFrame(lastDataUrl, isFinal);
      if (isFinal) sawCompleted = true;
    }
  }
  if (streamError) throw new Error(streamError);
  if (!sawCompleted && lastDataUrl) onFrame(lastDataUrl, true);
  return lastDataUrl;
}
