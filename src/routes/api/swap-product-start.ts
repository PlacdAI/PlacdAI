// Replaces swap-product.ts as the endpoint the frontend calls directly.
// Same shape as start-generation.ts: does almost nothing itself — creates
// the pending row and fires the Background Function, then returns
// immediately. Stays a normal synchronous TanStack route (not
// "-background") because this path itself is fast; the up-to-3x
// sequential Gemini calls happen in swap-product-background.ts instead,
// which is what was hitting Netlify's ~26-30s synchronous gateway ceiling.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAdminClient, getUserFromRequest } from "@/lib/authServer";

const Input = z.object({
  currentRoomImage: z.string(),
  productIds: z.array(z.string()).max(3),
  isRetry: z.boolean().optional().default(false),
});

export const Route = createFileRoute("/api/swap-product-start")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

        try {
          const body = Input.parse(await request.json());
          const admin = getAdminClient();

          const ins = await admin
            .from("product_swaps")
            .insert({ user_id: user.id, status: "pending" })
            .select("id")
            .single();
          if (ins.error || !ins.data) {
            return Response.json(
              { error: ins.error?.message ?? "Could not start product placement" },
              { status: 500 },
            );
          }
          const swapId = ins.data.id as string;

          // Same reasoning as start-generation.ts's fix: await the
          // hand-off fetch so it can't get frozen mid-send when this
          // handler returns. Only waits for Netlify's ~ms 202 accept, not
          // for the actual swap to finish.
          const base = process.env.URL ?? new URL(request.url).origin;
          try {
            await fetch(`${base}/.netlify/functions/swap-product-background`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ swapId, userId: user.id, ...body }),
            });
          } catch (e) {
            console.error("Failed to invoke swap-product-background:", e);
          }

          return Response.json({ swapId });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});