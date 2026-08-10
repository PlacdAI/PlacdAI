import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";

/**
 * Palette note: matches the sand/charcoal brand palette used on the
 * marketing Pricing section (src/routes/index.tsx) rather than the app's
 * default shadcn --primary theme, so the in-app checkout page feels like
 * the same product as the landing page. Rare sage accent is intentionally
 * NOT used here — sand is the only accent color on this page.
 */
const FRAUNCES = "font-['Fraunces',_Georgia,_serif]";

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <circle cx="8" cy="8" r="7" fill="#CEBBA820" stroke="#CEBBA8" strokeWidth="1.2" />
      <path d="M5 8L7 10L11 6" stroke="#CEBBA8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PACKS = [
  {
    id: "20",
    name: "Starter Pack",
    price: "$5",
    credits: 20,
    perCredit: "$0.25",
    features: ["20 AI room generations", "Real buyable product tags", "Google Visual Search", "Standard resolution"],
    cta: "Buy 20 Credits",
    hot: false,
    tag: null as string | null,
  },
  {
    id: "60",
    name: "Value Pack",
    price: "$12",
    credits: 60,
    perCredit: "$0.20",
    features: ["60 AI room generations", "Real buyable product tags", "Google Visual Search", "High-res 4K exports", "Priority processing"],
    cta: "Buy 60 Credits",
    hot: true,
    tag: "Best Value",
  },
  {
    id: "120",
    name: "Pro Pack",
    price: "$20",
    credits: 120,
    perCredit: "$0.17",
    features: ["120 AI room generations", "Real buyable product tags", "Google Visual Search", "High-res 4K exports", "Priority processing", "Commercial license"],
    cta: "Buy 120 Credits",
    hot: false,
    tag: "Most Credits",
  },
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
    <div className="min-h-screen bg-[#FAF8F5]">
      <Toaster richColors position="top-center" />
      <AppNav />
      <main className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <div className="mb-14 text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.09em] text-[#B8A08A]">Credits</p>
          <h1 className={`mb-4 text-[36px] font-normal tracking-[-0.025em] text-[#1C1C1C] sm:text-[44px] ${FRAUNCES}`}>
            Buy <span className="italic text-[#CEBBA8]">credits.</span>
          </h1>
          <p className="mx-auto max-w-md text-[15.5px] text-[#7A6B5E]">
            Each generation uses 1 credit. Credits never expire — buy once, use whenever.
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-3">
          {PACKS.map((pack) => (
            <div
              key={pack.id}
              className={`relative rounded-3xl ${
                pack.hot
                  ? "scale-[1.025] border-2 border-[#1C1C1C] bg-[#1C1C1C] px-9 py-11 shadow-[0_20px_60px_rgba(28,28,28,0.22)]"
                  : "border border-[#E8E0D8] bg-white px-8 py-10"
              }`}
            >
              {pack.tag && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#CEBBA8] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white">
                  {pack.tag}
                </div>
              )}

              <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#CEBBA8]">{pack.name}</p>

              <div className="mb-1 flex items-baseline gap-1.5">
                <span className={`text-[56px] leading-none tracking-[-0.03em] ${pack.hot ? "text-white" : "text-[#1C1C1C]"} ${FRAUNCES}`}>
                  {pack.price}
                </span>
              </div>
              <p className={`mb-1 text-[13px] font-semibold ${pack.hot ? "text-[#DCD3C9]" : "text-[#B8A08A]"}`}>
                {pack.credits} credits · {pack.perCredit} each
              </p>
              <p className={`mb-7 text-xs ${pack.hot ? "text-white/35" : "text-[#A09080]"}`}>
                One-time purchase · Credits never expire
              </p>

              <div className={`mb-8 border-t pt-7 ${pack.hot ? "border-white/10" : "border-[#E8E0D8]"}`}>
                {pack.features.map((f) => (
                  <div key={f} className="mb-3 flex items-center gap-2.5">
                    <CheckIcon />
                    <span className={`text-[13.5px] ${pack.hot ? "text-white/75" : "text-[#6B5E52]"}`}>{f}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => buy(pack.id)}
                disabled={busy !== null}
                className={`w-full rounded-full py-6 text-sm font-bold ${
                  pack.hot
                    ? "bg-[#CEBBA8] text-white hover:-translate-y-0.5 hover:bg-[#CEBBA8] hover:opacity-90"
                    : "border border-[#1C1C1C] bg-transparent text-[#1C1C1C] hover:-translate-y-0.5 hover:bg-transparent hover:opacity-90"
                }`}
              >
                {busy === pack.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {pack.cta}
              </Button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}