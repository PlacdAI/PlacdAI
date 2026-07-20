// Returns { credits } for the signed-in user.
import { createFileRoute } from "@tanstack/react-router";
import { getAdminClient, getUserFromRequest } from "@/lib/authServer";

export const Route = createFileRoute("/api/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
        const admin = getAdminClient();
        const { data, error } = await admin
          .from("profiles")
          .select("credits")
          .eq("id", user.id)
          .maybeSingle();
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ credits: data?.credits ?? 0 });
      },
    },
  },
});
