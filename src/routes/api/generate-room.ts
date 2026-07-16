// STEP 2 of the pipeline: stream a redesigned version of the uploaded room
// from Gemini. Response is Server-Sent Events (SSE) parsed by src/lib/streamImage.ts.
import { createFileRoute } from "@tanstack/react-router";
import { dataUrlToInline, geminiImageStream } from "@/lib/gemini.server";

export const Route = createFileRoute("/api/generate-room")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { roomImage, style } = (await request.json()) as {
            roomImage: string;
            style: string;
          };
          const inline = dataUrlToInline(roomImage);
          const upstream = await geminiImageStream({
            parts: [
              { inlineData: inline },
              {
                text: `Redesign this room in ${style} style. Keep the same walls, windows, floor, and camera angle. Add tasteful, cohesive ${style} furniture and decor. Photorealistic, natural lighting, high detail.`,
              },
            ],
          });
          if (!upstream.ok || !upstream.body) {
            return new Response(await upstream.text(), { status: upstream.status });
          }
          return new Response(upstream.body, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
            },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
