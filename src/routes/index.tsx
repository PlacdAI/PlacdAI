import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  ArrowRight,
  Check,
  ShoppingBag,
  Sparkles,
  Upload,
  Wand2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import heroImage from "@/assets/hero-before-after.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PlacdAI — Redesign Any Room With AI in Seconds" },
      {
        name: "description",
        content:
          "Upload a photo of your room and let AI redesign it in any style — then shop the real furniture in one click. Free to try.",
      },
      { property: "og:title", content: "PlacdAI — Redesign Any Room With AI" },
      {
        property: "og:description",
        content:
          "AI interior design that furnishes your room with real, shoppable products.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const STYLE_TAGS = [
  "Modern",
  "Mid-Century",
  "Scandinavian",
  "Bohemian",
  "Industrial",
  "Minimalist",
  "Coastal",
  "Farmhouse",
];

function Landing() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // If already logged in, skip the marketing page.
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Top nav ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            PlacdAI
          </Link>
          <nav className="flex items-center gap-1 sm:gap-3">
            <a
              href="#how"
              className="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              How it works
            </a>
            <a
              href="#styles"
              className="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              Styles
            </a>
            <Link
              to="/login"
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Log in
            </Link>
            <Button asChild size="sm">
              <Link to="/login">
                Get started
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, hsl(var(--primary) / 0.18), transparent 70%)",
          }}
        />
        <div className="mx-auto max-w-6xl px-4 pt-14 pb-10 text-center sm:px-6 sm:pt-20 sm:pb-16">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            AI-powered interior design
          </div>

          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            Redesign any room with AI —{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              then shop the look.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Upload a photo of your room, pick a style, and watch PlacdAI
            reimagine it with real furniture you can buy in one click.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/login">
                Redesign my room
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <a href="#how">See how it works</a>
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            3 free redesigns · No credit card required
          </p>

          {/* Hero image */}
          <div className="mx-auto mt-10 max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/10 sm:mt-14">
            <img
              src={heroImage}
              alt="Before and after AI room redesign"
              width={1600}
              height={1000}
              className="h-auto w-full"
            />
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section id="how" className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              From empty room to dream space in 3 steps
            </h2>
            <p className="mt-3 text-muted-foreground">
              No designer, no measuring, no guesswork.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                icon: Upload,
                title: "Upload your room",
                desc: "Snap a photo of your empty or existing room — any angle works.",
              },
              {
                icon: Wand2,
                title: "Pick a style",
                desc: "Choose from Modern, Boho, Scandinavian, and dozens more.",
              },
              {
                icon: ShoppingBag,
                title: "Shop the look",
                desc: "Every piece in your new room links to a real product you can buy.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Styles ───────────────────────────────────────── */}
      <section id="styles" className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              A style for every space
            </h2>
            <p className="mt-3 text-muted-foreground">
              Explore dozens of interior styles, all rendered in seconds.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-2 sm:gap-3">
            {STYLE_TAGS.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why PlacdAI ──────────────────────────────────── */}
      <section className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Every item is real. Every item is shoppable.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Other AI room generators create beautiful pictures you can't
                actually recreate. PlacdAI matches every sofa, lamp, and rug in
                your redesign to a real product from our catalog.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Instant, photorealistic redesigns",
                  "Real furniture with real prices",
                  "Before-and-after slider to compare",
                  "Save and download your favorites",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Button asChild size="lg">
                  <Link to="/login">
                    Start free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Under 30 seconds</p>
                  <p className="text-sm text-muted-foreground">
                    From upload to fully redesigned room.
                  </p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <Stat value="500k+" label="Rooms redesigned" />
                <Stat value="40+" label="Design styles" />
                <Stat value="10k+" label="Shoppable products" />
                <Stat value="4.9★" label="Average rating" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Your dream room is one photo away.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Try PlacdAI free. 3 redesigns on us — no credit card needed.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link to="/login">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>© {new Date().getFullYear()} PlacdAI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-foreground">
              Log in
            </Link>
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
