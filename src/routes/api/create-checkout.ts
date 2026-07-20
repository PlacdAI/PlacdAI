// Create a Stripe Checkout Session for a credit pack.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import Stripe from "stripe";
import { getUserFromRequest } from "@/lib/authServer";

const Body = z.object({ pack: z.enum(["20", "60", "120"]) });

const PRICE_ENV: Record<string, string> = {
  "20": "STRIPE_PRICE_20",
  "60": "STRIPE_PRICE_60",
  "120": "STRIPE_PRICE_120",
};

const CREDITS: Record<string, number> = { "20": 20, "60": 60, "120": 120 };

export const Route = createFileRoute("/api/create-checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
        try {
          const { pack } = Body.parse(await request.json());
          const priceId = process.env[PRICE_ENV[pack]];
          const secret = process.env.STRIPE_SECRET_KEY;
          if (!priceId || !secret)
            return Response.json({ error: "stripe_not_configured" }, { status: 500 });

          const stripe = new Stripe(secret);
          const origin = new URL(request.url).origin;
          const session = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${origin}/buy-credits?status=success`,
            cancel_url: `${origin}/buy-credits?status=cancel`,
            customer_email: user.email,
            client_reference_id: user.id,
            metadata: {
              user_id: user.id,
              credits: String(CREDITS[pack]),
              pack,
            },
          });
          return Response.json({ url: session.url });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
