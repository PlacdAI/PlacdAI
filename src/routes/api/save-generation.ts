// Upload the final generated image to the 'gallery' storage bucket
// and insert a row into public.gallery. FIFO trigger evicts >20 per user.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAdminClient, getUserFromRequest } from "@/lib/authServer";

const Body = z.object({ image: z.string(), style: z.string().optional() });

export const Route = createFileRoute("/api/save-generation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getUserFromRequest(request);
        if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
        try {
          const { image, style } = Body.parse(await request.json());
          const m = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          if (!m) return Response.json({ error: "bad_image" }, { status: 400 });
          const mime = m[1];
          const ext = mime.split("/")[1].replace("+xml", "");
          const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
          const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

          const admin = getAdminClient();
          const up = await admin.storage
            .from("gallery")
            .upload(path, bytes, { contentType: mime, upsert: false });
          if (up.error) return Response.json({ error: up.error.message }, { status: 500 });

          const { data: pub } = admin.storage.from("gallery").getPublicUrl(path);
          const publicUrl = pub.publicUrl;

          const ins = await admin.from("gallery").insert({
            user_id: user.id,
            storage_path: path,
            public_url: publicUrl,
            style: style ?? null,
          }).select("id, expires_at").maybeSingle();
          if (ins.error) return Response.json({ error: ins.error.message }, { status: 500 });

          return Response.json({
            id: ins.data?.id,
            url: publicUrl,
            expires_at: ins.data?.expires_at,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
