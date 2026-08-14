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
            .insert({ user_id: user.id, status: "pending", is_retry: body.isRetry })
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
          // 🔧 Same gap as start-generation.ts had: previously only caught
          // a hard network exception and otherwise assumed the background
          // function actually started, leaving the row stuck at 'pending'
          // forever if the invocation itself failed non-exceptionally.
          const base = process.env.URL ?? new URL(request.url).origin;
          try {
            const bgRes = await fetch(
              `${base}/.netlify/functions/swap-product-background`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ swapId, userId: user.id, ...body }),
              },
            );
            if (!bgRes.ok) {
              throw new Error(`swap-product-background responded ${bgRes.status}`);
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error("Failed to invoke swap-product-background:", msg);

            await admin
              .from("product_swaps")
              .update({ status: "failed", error: `Could not start placement: ${msg}` })
              .eq("id", swapId);

            // Only retryProduct() consumes a credit before calling this
            // path — the main generate() swap rides on the up-front
            // generation credit and never charges separately (see
            // dashboard.tsx). Only refund here when this was a retry, same
            // scoping as swap-product-background.ts's own failure path.
            if (body.isRetry) {
              const refund = await admin.rpc("refund_credit", { _user_id: user.id });
              if (refund.error) {
                console.error(
                  `Failed to refund credit for user ${user.id}:`,
                  refund.error.message,
                );
              }
            }

            return Response.json(
              { error: "Could not start product placement — please try again." },
              { status: 502 },
            );
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