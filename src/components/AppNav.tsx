import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Coins, GalleryHorizontal, LogOut, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";

export function AppNav() {
  const { user, signOut, isDevBypass } = useAuth();
  const navigate = useNavigate();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!user || isDevBypass) return;
    let cancelled = false;
    const load = () =>
      apiFetch("/api/me")
        .then((r) => r.json())
        .then((j) => !cancelled && setCredits(j.credits ?? 0))
        .catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [user, isDevBypass]);

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <Link to="/dashboard" className="flex shrink-0 items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> PlacdAI
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/gallery"
            className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground sm:px-3"
          >
            <span className="inline-flex items-center gap-1.5">
              <GalleryHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Gallery</span>
            </span>
          </Link>
          <Link
            to="/buy-credits"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-accent sm:px-3"
            title="Buy more credits"
          >
            <Coins className="h-3.5 w-3.5 text-primary" />
            <span>
              {isDevBypass ? "∞" : credits === null ? "…" : credits}
            </span>
            <span className="hidden sm:inline">Credits</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="px-2 sm:px-3">
            <LogOut className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        </nav>
      </div>
    </header>
  );
}
