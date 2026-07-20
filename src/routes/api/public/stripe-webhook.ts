// Stripe webhook — grants credits after a successful Checkout.
// Configure Stripe → Webhooks with endpoint:
//   https://<your-domain>/api/public/stripe-webhook
// Listen for: checkout.session.completed
import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { getAdminClient } from "@/lib/authServer";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_SECRET_KEY;
        const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret || !whSecret)
          return new Response("stripe_not_configured", { status: 500 });

        const stripe = new Stripe(secret);
        const sig = request.headers.get("stripe-signature") || "";
        const raw = await request.text();
        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(raw, sig, whSecret);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(`bad_signature: ${msg}`, { status: 400 });
        }

        if (event.type === "checkout.session.completed") {
          const s = event.data.object as Stripe.Checkout.Session;
          const userId = s.metadata?.user_id || s.client_reference_id;
          const credits = Number(s.metadata?.credits || 0);
          if (userId && credits > 0) {
            const admin = getAdminClient();
            // Idempotency guard: skip if session id already recorded.
            const existing = await admin
              .from("stripe_payments")
              .select("id")
              .eq("id", s.id)
              .maybeSingle();
            if (!existing.data) {
              await admin.rpc("grant_credits", {
                _user_id: userId,
                _amount: credits,
              });
              await admin.from("stripe_payments").insert({
                id: s.id,
                user_id: userId,
                price_id: s.metadata?.pack ?? "",
                credits_granted: credits,
                amount_total: s.amount_total ?? 0,
                currency: s.currency ?? "usd",
              });
            }
          }
        }
        return new Response("ok");
      },
    },
  },
});
