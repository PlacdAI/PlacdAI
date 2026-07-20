// Atomically decrement one credit for the caller before starting a generation.
import { createFileRoute } from "@tanstack/react-router";
import { getAdminClient, getUserFromRequest } from "@/lib/authServer";

export const Route = createFileRoute("/api/consume-credit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
        const admin = getAdminClient();
        const { data, error } = await admin.rpc("consume_credit", {
          _user_id: user.id,
        });
        if (error) return Response.json({ error: error.message }, { status: 500 });
        if (typeof data === "number" && data < 0) {
          return Response.json({ error: "no_credits", remaining: 0 }, { status: 402 });
        }
        return Response.json({ remaining: data });
      },
    },
  },
});
