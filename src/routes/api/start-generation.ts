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

          // 🔧 Previously only caught a hard network exception (DNS
          // failure, connection refused) and otherwise assumed success —
          // silently. If the fetch reached Netlify but the background
          // function immediately errored, crashed on cold start, or got
          // rejected for any reason short of a thrown exception, this
          // code never noticed: it returned generationId to the client
          // as if everything were fine, leaving the row stuck at
          // 'pending' forever (never 'done', never 'failed') since
          // nothing ever got the chance to write a terminal status or
          // trigger a refund. The client's own 60s UI timeout then fires
          // with no idea the credit was never actually put to work.
          //
          // Now: explicitly check response.ok. A non-2xx means the
          // handoff itself failed — mark the row 'failed', refund the
          // credit right here (synchronously, before responding), and
          // tell the client immediately instead of making it wait out a
          // dead 60s timer for a job that was never going to run.
          const base = process.env.URL ?? new URL(request.url).origin;
          try {
            const bgRes = await fetch(
              `${base}/.netlify/functions/generate-room-background`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ generationId, userId: user.id, ...body }),
              },
            );
            if (!bgRes.ok) {
              throw new Error(
                `generate-room-background responded ${bgRes.status}`,
              );
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error("Failed to invoke generate-room-background:", msg);

            await admin
              .from("generations")
              .update({ status: "failed", error: `Could not start generation: ${msg}` })
              .eq("id", generationId);

            const refund = await admin.rpc("refund_credit", { _user_id: user.id });
            if (refund.error) {
              console.error(
                `Failed to refund credit for user ${user.id}:`,
                refund.error.message,
              );
            }

            return Response.json(
              { error: "Could not start generation — please try again." },
              { status: 502 },
            );
          }

          return Response.json({ generationId });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});