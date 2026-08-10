// ─────────────────────────────────────────────────────────────
// /login — Google-only authentication + Dev Bypass
//
// Uses the browser Supabase client (src/lib/supabaseClient.ts).
// After successful auth the user is redirected to `/dashboard`.
// ─────────────────────────────────────────────────────────────
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { Loader2, Sparkles, Clock, Images, Upload, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import { supabase } from "@/lib/supabaseClient";
import { DEV_BYPASS_KEY, useAuth } from "@/lib/auth";
import signInImage from "@/assets/signinimagedesigned.jpg";
import placdaiLogo from "@/assets/trimmy-PlacdAI-logo-official.png";
import placdaiLogoDarkSurface from "@/assets/trimmy-PlacdAI-darkSurface-logo.png";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — PlacdAI" },
      {
        name: "description",
        content: "Sign in with Google to redesign your room with AI. Get 1 free generation.",
      },
    ],
  }),
  component: LoginPage,
});

// How-it-works steps over the sign-in photo — real capability, not a
// launch-day testimonial you don't have yet. `activeStep` below cycles
// through these to give the panel a little life.
const STEPS = [
  {
    icon: Upload,
    title: "Upload a photo",
    description: "Any room, any angle, straight from your phone.",
  },
  {
    icon: Wand2,
    title: "Pick a style",
    description: "Scandi, Japandi, Midcentury, and more.",
  },
  {
    icon: Sparkles,
    title: "See it redesigned",
    description: "A new version of your room in under 30 seconds.",
  },
];

const FEATURES = [
  {
    icon: Sparkles,
    text: "1 free AI room design on sign-up",
  },
  {
    icon: Clock,
    text: "Designs generated in under 30 seconds",
  },
  {
    icon: Images,
    text: "Gallery saves your creations for 72 hours",
  },
];

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [busy, setBusy] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  // Already signed in? Go to dashboard.
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  // Cycle the highlighted step every 2.5s.
  useEffect(() => {
    const id = setInterval(() => {
      setActiveStep((s) => (s + 1) % STEPS.length);
    }, 2500);
    return () => clearInterval(id);
  }, []);

  const handleGoogleLogin = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
      setBusy(false);
    }
  };

  const skipLogin = () => {
    window.localStorage.setItem(DEV_BYPASS_KEY, "1");
    toast.success("Dev bypass enabled.");
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* ── Left: photo + how-it-works ──────────────────────── */}
        <div className="relative hidden overflow-hidden lg:block">
          <img
            src={signInImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

          <div
            className="absolute left-8 top-8"
            style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.35))" }}
          >
            <PlacdaiLogo variant="dark" iconSize={35} />
          </div>

          <div className="absolute inset-x-8 bottom-8 text-white">
            <div className="space-y-4">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                const isActive = i === activeStep;
                return (
                  <div
                    key={step.title}
                    className={`flex items-start gap-3 transition-opacity duration-500 ${
                      isActive ? "opacity-100" : "opacity-45"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-500 ${
                        isActive
                          ? "border-white bg-white text-neutral-900"
                          : "border-white/40 bg-transparent text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="pt-0.5">
                      <div className="text-sm font-semibold">{step.title}</div>
                      <div className="text-xs text-white/70">{step.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right: sign-in ──────────────────────────────────── */}
        <div className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <PlacdaiLogo variant="light" iconSize={40} />
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to continue designing your space with AI.
            </p>

            <Button
              type="button"
              variant="outline"
              className="mt-8 h-12 w-full justify-center gap-3 text-base font-medium shadow-sm transition-all hover:bg-muted/50"
              onClick={handleGoogleLogin}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <GoogleIcon className="h-5 w-5" />
                  Continue with Google
                </>
              )}
            </Button>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Only Google sign-in supported
            </p>

            <div className="mt-6 space-y-3">
              {FEATURES.map(({ icon: Icon, text }) => (
                <div
                  key={text}
                  className="flex items-center gap-3 rounded-lg bg-muted/60 px-4 py-3 text-sm text-foreground"
                >
                  <Icon className="h-4 w-4 shrink-0 text-primary" />
                  {text}
                </div>
              ))}
            </div>

            <p className="mt-8 text-center text-xs text-muted-foreground">
              By signing in, you agree to our{" "}
              <a href="/terms" className="underline underline-offset-2 hover:text-foreground">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                Privacy Policy
              </a>
              . We never post or share without your permission.
            </p>

            {/* ── DEV BYPASS ─────────────────────────────────────
                Remove this block (and DEV_BYPASS_KEY in src/lib/auth.tsx)
                before shipping to production. */}
            <div className="mt-6 border-t border-border pt-4 text-center">
              <button
                type="button"
                onClick={skipLogin}
                className="text-xs text-muted-foreground/60 hover:text-foreground"
              >
                Skip Login (Dev Only)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Brand mark, from your actual assets — the light version for white/light
// surfaces, the dark-surface version (opaque sage tile) for use over the
// photo. To resize the icon yourself: change the `iconSize` prop passed
// at each call site below (search "PlacdaiLogo" — one in the left photo
// panel, one above "Welcome back"). The light variant also renders the
// two-tone "Placd"/"AI" wordmark with the hairline divider from your
// logo file; the dark-surface variant stays a single white "PlacdAI"
// so it doesn't fight the divider against a busy photo background.
function PlacdaiLogo({
  variant = "light",
  iconSize = 28,
  className = "",
}: {
  variant?: "light" | "dark";
  iconSize?: number;
  className?: string;
}) {
  const isDark = variant === "dark";
  return (
    <Link
      to="/"
      className={`inline-flex items-center ${isDark ? "gap-3" : "gap-4"} ${className}`}
      aria-label="PlacdAI home"
    >
      <img
        src={isDark ? placdaiLogoDarkSurface : placdaiLogo}
        alt=""
        width={iconSize}
        height={iconSize}
        className="shrink-0"
        style={{ width: iconSize, height: iconSize }}
      />
      {isDark ? (
        <span
          className="text-2xl font-medium tracking-tight text-white"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          PlacdAI
        </span>
      ) : (
        <>
          <span
            className="w-px shrink-0 bg-foreground/15"
            style={{ height: Math.round(iconSize * 0.9) }}
          />
          <span
            className="text-2xl font-medium tracking-tight"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <span style={{ color: "#1E1E1E" }}>Placd</span>
            <span style={{ color: "#7C9080" }}>AI</span>
          </span>
        </>
      )}
    </Link>
  );
}

function GoogleIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}