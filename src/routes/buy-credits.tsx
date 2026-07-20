import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";

const PACKS = [
  { id: "20", credits: 20, price: "$5", tag: "Starter" },
  { id: "60", credits: 60, price: "$12", tag: "Most popular" },
  { id: "120", credits: 120, price: "$20", tag: "Best value" },
] as const;

export const Route = createFileRoute("/buy-credits")({
  head: () => ({ meta: [{ title: "Buy credits — PlacdAI" }] }),
  component: BuyCredits,
});

function BuyCredits() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("status") === "success")
      toast.success("Payment successful — credits will appear in a few seconds.");
    if (q.get("status") === "cancel") toast.info("Checkout cancelled.");
  }, []);

  const buy = async (pack: string) => {
    setBusy(pack);
    try {
      const r = await apiFetch("/api/create-checkout", {
        method: "POST",
        body: JSON.stringify({ pack }),
      });
      const j = await r.json();
      if (j.url) window.location.href = j.url;
      else toast.error(j.error || "Checkout failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <Toaster richColors position="top-center" />
      <AppNav />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-bold">Buy credits</h1>
        <p className="mt-2 text-muted-foreground">
          Each generation uses 1 credit. Credits never expire.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {PACKS.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {p.tag}
              </div>
              <div className="mt-2 text-4xl font-bold">{p.credits}</div>
              <div className="text-sm text-muted-foreground">credits</div>
              <div className="mt-4 text-2xl font-semibold">{p.price}</div>
              <Button
                className="mt-4 w-full"
                onClick={() => buy(p.id)}
                disabled={busy !== null}
              >
                {busy === p.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Buy {p.credits} credits
              </Button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
