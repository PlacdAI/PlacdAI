// Replaces generate-room.ts as the endpoint the frontend calls directly.
// This one does almost nothing itself — it creates the pending row and
// fires the Background Function, then returns immediately. It stays a
// normal synchronous TanStack route (not "-background") specifically
// because it's fast: no Gemini call happens on this path, so the 10s
// Netlify ceiling was never the problem here.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAdminClient, getUserFromRequest } from "@/lib/authServer";

const Input = z.object({
  roomImage: z.string(),
  style: z.string(),
  roomType: z.string().optional(),
  palette: z.string().optional(),
  paletteColors: z.array(z.string()).optional(),
  prompt: z.string().max(300).optional(),
});

export const Route = createFileRoute("/api/start-generation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

        try {
          const body = Input.parse(await request.json());
          const admin = getAdminClient();

          const ins = await admin
            .from("generations")
            .insert({ user_id: user.id, status: "pending" })
            .select("id")
            .single();
          if (ins.error || !ins.data) {
            return Response.json(
              { error: ins.error?.message ?? "Could not start generation" },
              { status: 500 },
            );
          }
          const generationId = ins.data.id as string;

          // Fire-and-forget on purpose: the "-background" suffix in the URL
          // is what makes Netlify return 202 immediately and let the
          // function keep running — but that's a property of the *target*
          // endpoint, not of how we call it. If we awaited this fetch here,
          // this route would just inherit the same 10s ceiling we're trying
          // to escape. process.env.URL is Netlify's own env var for the
          // deployed site origin; falls back to the request's own origin
          // for local dev where that var isn't set.
          const base = process.env.URL ?? new URL(request.url).origin;
          fetch(`${base}/.netlify/functions/generate-room-background`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ generationId, userId: user.id, ...body }),
          }).catch((e) => {
            console.error("Failed to invoke generate-room-background:", e);
          });

          return Response.json({ generationId });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});