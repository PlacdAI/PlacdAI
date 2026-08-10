import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAdminClient, getUserFromRequest } from "@/lib/authServer";

const Input = z.object({
  id: z.string(),
  storage_path: z.string(),
});

export const Route = createFileRoute("/api/delete-generation")({
  server: {
    handlers: {
      DELETE: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

        try {
          const { id, storage_path } = Input.parse(await request.json());
          const admin = getAdminClient();

          // Ownership check — required because the admin client bypasses RLS.
          // storage_path is namespaced `${user.id}/...` (see save-generation.ts),
          // so this also guards against a forged path for someone else's file.
          const { data: row, error: findError } = await admin
            .from("gallery")
            .select("id, user_id, storage_path")
            .eq("id", id)
            .maybeSingle();

          if (findError) {
            return Response.json({ error: findError.message }, { status: 500 });
          }
          if (!row || row.user_id !== user.id || row.storage_path !== storage_path) {
            return Response.json({ error: "not_found" }, { status: 404 });
          }

          // 1. Remove the file via the real Storage API (bucket is "gallery",
          // matching save-generation.ts and the migration — not "rooms").
          const { error: storageError } = await admin.storage
            .from("gallery")
            .remove([storage_path]);
          if (storageError) {
            console.error("Storage deletion error:", storageError.message);
            // Log but continue — still remove the DB row so the gallery
            // doesn't show a broken/orphaned entry to the user.
          }

          // 2. Remove the metadata row.
          const { error: dbError } = await admin.from("gallery").delete().eq("id", id);
          if (dbError) {
            return Response.json({ error: dbError.message }, { status: 500 });
          }

          return Response.json({ success: true });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});