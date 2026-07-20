import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";
import { AppNav } from "@/components/AppNav";

type Item = {
  id: string;
  public_url: string;
  storage_path: string;
  style: string | null;
  created_at: string;
  expires_at: string;
};

export const Route = createFileRoute("/gallery")({
  head: () => ({ meta: [{ title: "Your gallery — PlacdAI" }] }),
  component: Gallery,
});

function useCountdown(expires: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  const diff = new Date(expires).getTime() - now;
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 1) return `Expires in ${h}h`;
  return `Expires in ${m}m`;
}

function Card({ item }: { item: Item }) {
  const label = useCountdown(item.expires_at);
  const download = async () => {
    const r = await fetch(item.public_url);
    const b = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = `placdai-${item.id}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <img
        src={item.public_url}
        alt={item.style ?? "Generated room"}
        className="h-56 w-full object-cover"
      />
      <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
        {label}
      </span>
      <button
        onClick={download}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg hover:bg-primary/90"
      >
        <Download className="h-3 w-3" /> Download
      </button>
      {item.style && (
        <div className="px-3 py-2 text-xs text-muted-foreground">{item.style}</div>
      )}
    </div>
  );
}

function Gallery() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    apiFetch("/api/list-generations")
      .then((r) => r.json())
      .then((j) => setItems(j.items ?? []))
      .catch(() => setItems([]));
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <AppNav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-bold">Your gallery</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Saved rooms are kept for 72 hours (max 20). Download to keep them.
        </p>
        {items === null ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="mt-16 text-center text-sm text-muted-foreground">
            No generations yet — head back home and create one.
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((i) => (
              <Card key={i.id} item={i} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
