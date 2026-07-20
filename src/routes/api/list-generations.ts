// Returns the caller's saved gallery rows (newest first).
import { createFileRoute } from "@tanstack/react-router";
import { getAdminClient, getUserFromRequest } from "@/lib/authServer";

export const Route = createFileRoute("/api/list-generations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
        const admin = getAdminClient();
        const { data, error } = await admin
          .from("gallery")
          .select("id, public_url, storage_path, style, created_at, expires_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ items: data ?? [] });
      },
    },
  },
});
