import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Coins, GalleryHorizontal, Wand2, LogOut, PlusCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useAuthGate } from "@/components/auth-gate";
import { apiFetch } from "@/lib/apiFetch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logoMark from "@/assets/trimmy-PlacdAI-logo-official.png";

// "gated: true" links pop the signup dialog for guests instead of
// navigating. "Redesign" stays open since the dashboard itself is
// visible to guests now.
const NAV_LINKS = [
  { to: "/dashboard", label: "Redesign", gated: false },
  { to: "/gallery", label: "Gallery", gated: true, reason: "Sign up free to save and revisit your redesigns in your gallery." },
  { to: "/buy-credits", label: "Pricing", gated: true, reason: "Sign up free to see pricing and get your first design on us." },
] as const;

export function AppNav() {
  const { user, signOut, isDevBypass } = useAuth();
  const { requireAuth } = useAuthGate();
  const navigate = useNavigate();
  const [credits, setCredits] = useState<number | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Gated links render as <button>, not <Link>, so router's activeProps
  // can't reach them — figure out "current section" by hand instead.
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const navLinkClass = (active: boolean) =>
    `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
      active ? "bg-black/[0.04] text-[#111] font-semibold" : "text-[#666] hover:bg-black/5 hover:text-[#111]"
    }`;

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

  const goGated = (to: (typeof NAV_LINKS)[number]["to"], reason?: string) =>
    requireAuth(() => navigate({ to }), { reason });

  const creditDisplay = isDevBypass ? "∞" : credits === null ? "…" : credits;
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const fullName = user?.user_metadata?.full_name || user?.email || "User";
  const userInitials = fullName.charAt(0).toUpperCase();

  return (
    <header className="flex h-[52px] shrink-0 items-center border-b border-black/[0.07] bg-white px-5">
      {/* Brand */}
      <Link to="/dashboard" className="mr-8 flex shrink-0 items-center gap-2">
        <img src={logoMark} alt="" className="h-[26px] w-[26px]" />
        {/* Same treatment as the login page wordmark: Manrope, "Placd"
            near-black + "AI" sage green. Keep these two hex values in
            sync with PlacdaiLogo in login.tsx if the palette changes. */}
        <span
          className="text-[15px] font-bold tracking-tight"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          <span style={{ color: "#1E1E1E" }}>Placd</span>
          <span style={{ color: "#7C9080" }}>AI</span>
        </span>
      </Link>

      {/* Nav links */}
      <nav className="flex flex-1 items-center gap-0.5">
        {NAV_LINKS.map((link) => {
          const active = isActive(link.to);
          return link.gated ? (
            <button
              key={link.to}
              type="button"
              onClick={() => goGated(link.to, link.reason)}
              className={navLinkClass(active)}
            >
              {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#CEBBA8]" />}
              {link.label}
            </button>
          ) : (
            <Link key={link.to} to={link.to} className={navLinkClass(active)}>
              {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#CEBBA8]" />}
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Right: credits + avatar */}
      <div className="flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          onClick={() => goGated("/buy-credits", "Sign up free to see pricing and get your first design on us.")}
          className="flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1.5 text-xs font-semibold text-[#333] transition-colors hover:bg-black/10"
        >
          <Coins className="h-3 w-3 text-[#555]" />
          <span>{creditDisplay} credits</span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-[30px] w-[30px] items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 transition-opacity hover:opacity-90"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-white">{userInitials}</span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-2">
            <div className="truncate px-2 py-1.5 text-xs font-semibold text-foreground">
              {fullName}
            </div>
            <div className="truncate px-2 pb-1.5 text-xs text-muted-foreground">
              {user?.email}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => goGated("/buy-credits", "Sign up free to see pricing and get your first design on us.")}
              className="flex cursor-pointer items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" /> Buy Credits
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/dashboard" className="flex cursor-pointer items-center gap-2">
                <Wand2 className="h-4 w-4" /> Redesign
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => goGated("/gallery", "Sign up free to save and revisit your redesigns in your gallery.")}
              className="flex cursor-pointer items-center gap-2"
            >
              <GalleryHorizontal className="h-4 w-4" /> Gallery
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="flex cursor-pointer items-center gap-2 text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}