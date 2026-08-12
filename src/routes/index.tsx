import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import logoImg from "@/assets/1785916564-trimmy-testingplacdLOGO-removebg-preview.png";
import roomHeroEmpty from "@/assets/room-hero-empty.png";
import roomHero from "@/assets/room-hero.jpg";
import MyroomDecorated from "@/assets/MyroomDecorated.png";
import MyroomEmpty from "@/assets/MyroomEmpty.png";
import MyroomSettingUp from "@/assets/MyRoomSettingUp.png";


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
        content: "AI interior design that furnishes your room with real, shoppable products.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

/**
 * Palette note (updated to match the latest Figma design): sand-dominant,
 * with sage kept only as a rare editorial accent (2 spots total — the
 * "reimagined" word in the hero and "shoppable" in the differentiators
 * section). Everything that used to be sage-primary now uses sand.
 * For reuse elsewhere, consider adding these as named CSS vars in
 * src/index.css:
 *   --charcoal: #1C1C1C;
 *   --sand: #CEBBA8;        (primary accent)
 *   --sand-light: #DCD3C9;  (fills, subtle backgrounds)
 *   --sand-dark: #B8A08A;   (hover / depth)
 *   --sage: #8BA888;        (rare accent only — do not use as primary)
 *   --cream: #F5F0EB;       --offwhite: #FAF8F5;
 *   --line: #E8E0D8;        --muted: #A09080;
 * and a font import for Fraunces:
 *   @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300..900;1,300..900&display=swap');
 * Until then this file uses literal Tailwind arbitrary-value classes so it
 * works standalone.
 */

const FRAUNCES = "font-['Fraunces',_Georgia,_serif]";

const IMG = {
  before: roomHeroEmpty,
  after: roomHero,
  step1: MyroomEmpty,
  step2: MyroomSettingUp,
  step3: MyroomDecorated,
  minimalist: "https://images.unsplash.com/photo-1621362660850-a2554b580b41?w=1000&h=800&fit=crop&auto=format",
  coastal: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1000&h=800&fit=crop&auto=format",
  industrial: "https://images.unsplash.com/photo-1776090188651-a1ec2cf2bdb0?w=1000&h=800&fit=crop&auto=format",
  midcentury: "https://images.unsplash.com/photo-1617103996702-96ff29b1c467?w=1000&h=800&fit=crop&auto=format",
  homeoffice: "https://images.unsplash.com/photo-1766330977451-de1b64b5e641?w=900&h=700&fit=crop&auto=format",
};

// ─── Page ──────────────────────────────────────────────────────────

function Landing() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  return (
    <div className="bg-[#FAF8F5]">
      <Nav />
      <Hero />
      <Marquee />
      <HowItWorks />
      <WhatsUnique />
      <Gallery />
      <Pricing />
      <FooterCTA />
    </div>
  );
}

// ─── Shared bits ───────────────────────────────────────────────────

function Eyebrow({ children, light }: { children: ReactNode; light?: boolean }) {
  return (
    <div
      className={`mb-5 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 ${
        light ? "border-white/30 bg-white/10" : "border-[#CEBBA8]/30 bg-[#CEBBA8]/10"
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${light ? "bg-[#DCD3C9]" : "bg-[#CEBBA8]"}`} />
      <span
        className={`text-[11px] font-semibold uppercase tracking-[0.09em] ${
          light ? "text-[#DCD3C9]" : "text-[#B8A08A]"
        }`}
      >
        {children}
      </span>
    </div>
  );
}

function CheckDot({ tone = "sand" }: { tone?: "sand" | "muted" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
      <circle
        cx="7"
        cy="7"
        r="6.5"
        fill={tone === "sand" ? "#CEBBA820" : "transparent"}
        stroke={tone === "sand" ? "#CEBBA8" : "#9CA3AF"}
        strokeWidth="1.1"
      />
      <path d="M4.5 7L6 8.5L9.5 5" stroke={tone === "sand" ? "#CEBBA8" : "#9CA3AF"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Nav ───────────────────────────────────────────────────────────

// Smooth-scrolls to an in-page section instead of the browser's default
// instant jump, offsetting for the fixed 72px nav height so the section
// heading doesn't end up tucked underneath it. Shared by the navbar links
// and the "Watch Demo" / "View Gallery" anchor buttons further down.
const NAV_HEIGHT = 72;
function scrollToSection(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
  e.preventDefault();
  const el = document.querySelector(href);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - NAV_HEIGHT;
  window.scrollTo({ top, behavior: "smooth" });
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);
  // Close the mobile menu automatically if the viewport is resized past
  // the sm breakpoint (e.g. rotating a tablet), so it can't get stuck open.
  useEffect(() => {
    const fn = () => {
      if (window.innerWidth >= 640) setMobileOpen(false);
    };
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const navLinks: [string, string][] = [
    ["How it Works", "#how-it-works"],
    ["What's Different", "#unique"],
    ["Gallery", "#gallery"],
    ["Pricing", "#pricing"],
  ];

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        scrolled || mobileOpen ? "border-b border-[#E8E0D8] bg-[#FAF8F5]/90 backdrop-blur-xl" : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-6 sm:px-10">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
          <img src={logoImg} alt="" className="h-[34px] object-contain" />
          {/* Same treatment as AppNav.tsx / login.tsx: Manrope, "Placd"
              near-black + "AI" sage green. Keep these two hex values in
              sync if the palette changes. */}
          <span
            className="text-2xl font-medium tracking-tight"
            style={{ fontFamily: "'Manrope', sans-serif"}}
          >
            <span style={{ color: "#1E1E1E" }}>Placd</span>
            <span style={{ color: "#7C9080" }}>AI</span>
          </span>
        </Link>

        <div className="hidden items-center gap-10 sm:flex">
          {navLinks.map(([label, href]) => (
            <a
              key={label}
              href={href}
              onClick={(e) => scrollToSection(e, href)}
              className="text-[13.5px] font-medium text-[#6B5E52] transition-colors hover:text-[#1C1C1C]"
            >
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/login" className="hidden text-[13.5px] font-medium text-[#7A6B5E] transition-colors hover:text-[#1C1C1C] sm:inline">
            Log In
          </Link>
          <Button asChild className="rounded-full bg-[#1C1C1C] px-4 text-[12.5px] font-semibold text-white hover:-translate-y-px hover:bg-[#2d2d2d] sm:px-6 sm:text-[13px]">
            <Link to="/login">
              <span className="sm:hidden">Free Design →</span>
              <span className="hidden sm:inline">Get 1 Free Design →</span>
            </Link>
          </Button>

          {/* Hamburger — only reachable path to nav links / Log In below the sm breakpoint */}
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#1C1C1C] transition-colors hover:bg-[#E8E0D8]/60 sm:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              {mobileOpen ? (
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      <div
        className={`overflow-hidden border-t border-[#E8E0D8] bg-[#FAF8F5] transition-[max-height] duration-300 sm:hidden ${
          mobileOpen ? "max-h-80" : "max-h-0 border-t-0"
        }`}
      >
        <div className="flex flex-col gap-1 px-6 py-4">
          {navLinks.map(([label, href]) => (
            <a
              key={label}
              href={href}
              onClick={(e) => {
                scrollToSection(e, href);
                setMobileOpen(false);
              }}
              className="rounded-lg px-2 py-3 text-[15px] font-medium text-[#4A4039] transition-colors hover:bg-[#E8E0D8]/50"
            >
              {label}
            </a>
          ))}
          <Link
            to="/login"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg px-2 py-3 text-[15px] font-medium text-[#4A4039] transition-colors hover:bg-[#E8E0D8]/50"
          >
            Log In
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ─── Before / after slider ─────────────────────────────────────────

function BeforeAfterSlider() {
  const [pos, setPos] = useState(45);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const update = useCallback((cx: number) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos(Math.min(96, Math.max(4, ((cx - r.left) / r.width) * 100)));
  }, []);

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => dragging.current && update(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      className="relative aspect-video w-full select-none overflow-hidden rounded-[20px] bg-[#E8E0D8]"
      style={{ cursor: "ew-resize" }}
    >
      <img src={IMG.before} alt="Empty room before redesign" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={IMG.after} alt="Room after AI redesign" draggable={false} className="h-full w-full object-cover" />
      </div>

      <div className="absolute bottom-5 left-5 rounded-lg bg-white/90 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#A09080] backdrop-blur-md">
        Before
      </div>
      <div className="absolute bottom-5 right-5 rounded-lg bg-[#CEBBA8] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-white">
        After · Japandi
      </div>

      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)]"
        style={{ left: `${pos}%` }}
      >
        <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
          <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
            <path d="M1 6H17M5 2L1 6L5 10M13 2L17 6L13 10" stroke="#1C1C1C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#FAF8F5] px-6 pb-20 pt-32 sm:px-10">
      <div
        className="pointer-events-none absolute left-1/2 top-[10%] h-[640px] w-[1000px] -translate-x-1/2"
        style={{ background: "radial-gradient(ellipse at center, #DCD3C980 0%, transparent 68%)" }}
      />
      <div
        className="pointer-events-none absolute -right-[10%] bottom-[5%] h-[500px] w-[600px]"
        style={{ background: "radial-gradient(ellipse at center, #CEBBA818 0%, transparent 70%)" }}
      />

      <div className="relative mx-auto w-full max-w-6xl">
        <div className="mb-14 text-center">
          <Eyebrow>AI Interior Design · 1 Free Generation on Sign Up</Eyebrow>

          <h1 className={`mx-auto mb-7 text-[40px] font-normal leading-[1.02] tracking-[-0.03em] text-[#1C1C1C] sm:text-[80px] sm:leading-[0.95] lg:text-[112px] ${FRAUNCES}`}>
            <span className="block">Your room,</span>
            <span className="block italic text-[#8BA888]">reimagined</span>
            <span className="block">by AI.</span>
          </h1>

          <p className="mx-auto mb-4 max-w-xl text-[15px] leading-relaxed text-[#7A6B5E] sm:text-lg">
            Upload a room photo, choose your aesthetic, and get a photorealistic redesign with{" "}
            <strong className="text-[#1C1C1C]">real, buyable furniture</strong> — not just AI guesses.
          </p>

          <div className="mb-9 flex flex-wrap items-center justify-center gap-6">
            {["Up to 3 real buyable products per design", "Google Visual Search for everything else", "1 free generation — no card required"].map(
              (item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <CheckDot />
                  <span className="text-[13px] font-medium text-[#6B5E52]">{item}</span>
                </div>
              ),
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-[#1C1C1C] px-5 py-5 text-[13.5px] font-semibold text-white shadow-[0_4px_20px_rgba(28,28,28,0.3)] transition-all hover:-translate-y-0.5 hover:bg-[#2d2d2d] hover:shadow-[0_12px_32px_rgba(28,28,28,0.4)] sm:px-9 sm:py-6 sm:text-[15px]"
            >
              <Link to="/dashboard">Design Your Room — Free ↗</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-[#E8E0D8] px-5 py-5 text-[13.5px] font-medium text-[#1C1C1C] hover:border-[#CEBBA8] sm:px-7 sm:py-6 sm:text-[15px]">
              <a href="#how-it-works" onClick={(e) => scrollToSection(e, "#how-it-works")}>Watch Demo</a>
            </Button>
          </div>
        </div>

        <div className="relative mx-auto max-w-3xl">
          <BeforeAfterSlider />

          <div className="absolute -left-6 -top-5 z-10 hidden min-w-[160px] rounded-2xl border border-white/70 bg-white/90 p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.1)] backdrop-blur-lg md:block">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#A09080]">Generation time</p>
            <p className={`text-[26px] tracking-[-0.02em] text-[#1C1C1C] ${FRAUNCES}`}>
              28<span className="ml-0.5 text-sm text-[#A09080]">sec</span>
            </p>
          </div>

          <div className="absolute -right-5 -top-4 z-10 hidden rounded-2xl border border-white/70 bg-white/90 p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.1)] backdrop-blur-lg md:block">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#A09080]">Buyable products</p>
            <div className="flex items-center gap-1.5">
              {["#CEBBA8", "#DCD3C9", "#1C1C1C"].map((bg) => (
                <div key={bg} className="h-6 w-6 rounded-md border-2 border-white shadow-sm" style={{ background: bg }} />
              ))}
              <span className="ml-1 text-[13px] font-bold text-[#1C1C1C]">3 found</span>
            </div>
          </div>

          <div className="absolute -right-6 bottom-8 z-10 hidden rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.1)] backdrop-blur-lg lg:block">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="6.5" cy="6.5" r="4.5" stroke="#CEBBA8" strokeWidth="1.5" />
                <path d="M10.5 10.5L14 14" stroke="#CEBBA8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="text-xs font-semibold text-[#1C1C1C]">Click any item → Find similar</span>
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-xs tracking-wide text-[#C0B4A8]">Drag the divider · Real AI output · No filters applied</p>
      </div>
    </section>
  );
}

// ─── Marquee ───────────────────────────────────────────────────────

function Marquee() {
  const items = ["Japandi", "Minimalist", "Coastal", "Industrial", "Mid-Century", "Bohemian", "Scandinavian", "Art Deco", "Farmhouse", "Modern Luxury", "Wabi-Sabi", "Contemporary"];
  return (
    <div className="overflow-hidden bg-[#1C1C1C] py-[18px]">
      <style>{`
        @keyframes placdai-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .placdai-marquee-track { display: flex; width: max-content; animation: placdai-marquee 32s linear infinite; }
      `}</style>
      <div className="placdai-marquee-track">
        {[...items, ...items].map((item, i) => (
          <div key={i} className="flex shrink-0 items-center gap-8 pr-8">
            <span className={`whitespace-nowrap text-[15px] italic text-white/50 ${FRAUNCES}`}>{item}</span>
            <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-[#CEBBA8]" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── How it works ──────────────────────────────────────────────────

function HowItWorks() {
  const steps: { num: string; title: string; titleItalic?: string; desc: ReactNode; src: string; imageRight: boolean; aspect?: string; fit?: "cover" | "contain" }[] = [
    {
      num: "01",
      title: "Photograph your room.",
      desc: (
        <>
          Any photo works — empty walls, cluttered spaces, bad lighting. The AI reads depth, proportion, and natural light from{" "}
          <span className="text-[#93a695]">whatever you give it.</span>
        </>
      ),
      src: IMG.step1,
      imageRight: true,
    },
    {
      num: "02",
      title: "Set your",
      titleItalic: "direction.",
      desc: (
        <>
          Choose a style, a palette, and a room type — then describe your vision in plain language.{" "}
          <span className="text-[#93a695]">"Warm minimalist decor with natural rattan textures"</span> works perfectly.
        </>
      ),
      src: IMG.step2,
      imageRight: false,
      // This is a wide app-UI screenshot, not a photo — the default 4:3
      // object-cover box was cropping its edges off. Give it a wider box
      // and let it show in full instead of being cropped.
      aspect: "aspect-[16/10]",
      fit: "contain",
    },
    {
      num: "03",
      title: "Generate &",
      titleItalic: "explore.",
      desc: (
        <>
          A photorealistic redesign arrives in seconds. Real buyable furniture is tagged directly in the image. Click any other item to{" "}
          <span className="text-[#93a695]">find something similar</span> via Google Visual Search.
        </>
      ),
      src: IMG.step3,
      imageRight: true,
    },
  ];

  return (
    <section id="how-it-works" className="bg-[#FAF8F5] px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 border-b border-[#E8E0D8] pb-12">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[#A09080]">Process</p>
          <h2 className={`text-[36px] font-bold leading-[1.05] tracking-[-0.025em] text-[#1C1C1C] sm:text-[56px] ${FRAUNCES}`}>
            From photo to <em className="font-normal italic text-[#8BA888]">masterpiece</em> in three steps.
          </h2>
        </div>

        <div className="flex flex-col">
          {steps.map((step, i) => (
            <div key={step.num}>
              <div className="grid grid-cols-1 items-center gap-10 py-14 md:grid-cols-2 md:gap-16">
                <div className={step.imageRight ? "md:order-1" : "md:order-2"}>
                  <p className={`mb-4 text-[13px] text-[#A09080] ${FRAUNCES}`}>{step.num}</p>
                  <h3 className={`mb-5 text-[28px] font-bold leading-[1.1] tracking-[-0.02em] text-[#1C1C1C] sm:text-[40px] ${FRAUNCES}`}>
                    {step.title}
                    {step.titleItalic && <> <em className="font-normal italic text-[#CEBBA8]">{step.titleItalic}</em></>}
                  </h3>
                  <p className="max-w-sm text-[15.5px] leading-relaxed text-[#7A6B5E]">{step.desc}</p>
                </div>
                <div className={step.imageRight ? "md:order-2" : "md:order-1"}>
                  <div className={`${step.aspect ?? "aspect-[4/3]"} overflow-hidden rounded-2xl bg-[#E8E0D8]`}>
                    <img
                      src={step.src}
                      alt={`Step ${step.num}`}
                      className={`h-full w-full transition-transform duration-500 hover:scale-105 ${
                        step.fit === "contain" ? "object-contain" : "object-cover"
                      }`}
                    />
                  </div>
                </div>
              </div>
              {i < steps.length - 1 && <div className="h-px bg-[#E8E0D8]" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── What's different ───────────────────────────────────────────────

function UniqueCard({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition-all hover:border-[#CEBBA8]/35 hover:bg-white/[0.07]">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[11px] bg-[#CEBBA8]/[0.18]">{icon}</div>
      <h4 className="mb-2.5 text-[15px] font-semibold leading-tight tracking-[-0.01em] text-white">{title}</h4>
      <p className="text-[13.5px] leading-relaxed text-white/45">{desc}</p>
    </div>
  );
}

const UNIQUE_FEATURES: { icon: ReactNode; title: string; desc: string }[] = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="#CEBBA8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="3" y1="6" x2="21" y2="6" stroke="#CEBBA8" strokeWidth="1.6" />
        <path d="M16 10a4 4 0 01-8 0" stroke="#CEBBA8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Real products, not just renders",
    desc: "Every AI design includes 1–3 actual furniture pieces sourced from real retailers. You can buy them immediately — not someday, right now.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="8" stroke="#CEBBA8" strokeWidth="1.6" />
        <path d="M21 21l-4.35-4.35" stroke="#CEBBA8" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M8 11h6M11 8v6" stroke="#CEBBA8" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
    title: "Visual Search for everything else",
    desc: "Click any AI-generated item in your design and we instantly run a Google Visual Search — finding the closest real-world match you can actually purchase.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#CEBBA8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#CEBBA8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "No subscription, ever",
    desc: "Buy credits when you need them. $5 gets you 20 designs. No monthly commitment, no auto-renewals. Your first design is always free.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="4" stroke="#CEBBA8" strokeWidth="1.6" />
        <path d="M9 12l2 2 4-4" stroke="#CEBBA8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Photorealistic, not illustrated",
    desc: "PlacdAI generates designs that look like professional photos — not renderings or mood boards. What you see is what your room can actually look like.",
  },
];

const COMPARISON_ROWS: [string, boolean, boolean][] = [
  ["Real buyable products in result", true, false],
  ["Visual search for AI items", true, false],
  ["Pay-as-you-go pricing", true, false],
  ["Photorealistic output", true, true],
  ["No subscription required", true, false],
];

function WhatsUnique() {
  return (
    <section id="unique" className="relative overflow-hidden bg-[#1C1C1C] px-6 py-24 sm:px-10 sm:py-32">
      <div
        className="pointer-events-none absolute -top-[20%] right-[10%] h-[600px] w-[600px]"
        style={{ background: "radial-gradient(ellipse at center, #CEBBA814 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-[10%] left-[5%] h-[400px] w-[500px]"
        style={{ background: "radial-gradient(ellipse at center, #DCD3C90C 0%, transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="grid grid-cols-1 items-start gap-14 lg:grid-cols-[1fr_1.6fr] lg:gap-24">
          <div className="lg:sticky lg:top-28">
            <Eyebrow light>What makes us different</Eyebrow>
            <h2 className={`mb-6 text-[30px] font-normal leading-[1.1] tracking-[-0.025em] text-white sm:text-[48px] ${FRAUNCES}`}>
              AI design that's actually
              <br />
              <span className="italic text-[#8BA888]">shoppable.</span>
            </h2>
            <p className="max-w-xs text-[15px] leading-relaxed text-white/45">
              Other tools show you a beautiful room you can never recreate. PlacdAI bridges the gap between vision and reality.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {UNIQUE_FEATURES.map((f) => (
              <UniqueCard key={f.title} {...f} />
            ))}
          </div>
        </div>

        <div className="mt-20 border-t border-white/[0.07] pt-16">
          <p className="mb-7 text-center text-xs font-bold uppercase tracking-[0.1em] text-white/30">PlacdAI vs. other AI tools</p>
          <div className="grid grid-cols-[2fr_1fr_1fr] overflow-hidden rounded-2xl border border-white/[0.07]">
            <div className="border-b border-white/[0.07] bg-white/[0.04] px-3 py-4 sm:px-6">
              <span className="text-xs font-semibold tracking-wide text-white/30">FEATURE</span>
            </div>
            <div className="border-b border-l border-white/[0.07] bg-[#CEBBA8]/[0.1] px-2 py-4 text-center sm:px-6">
              <span className="text-[10px] font-bold tracking-wide text-[#CEBBA8] sm:text-xs">PLACDAI</span>
            </div>
            <div className="border-b border-l border-white/[0.07] bg-white/[0.04] px-2 py-4 text-center sm:px-6">
              <span className="text-[10px] font-semibold tracking-wide text-white/30 sm:text-xs">OTHERS</span>
            </div>

            {COMPARISON_ROWS.map(([label, us, them], i) => (
              <Fragment key={label}>
                <div className={`px-3 py-3.5 sm:px-6 ${i < COMPARISON_ROWS.length - 1 ? "border-b border-white/5" : ""} ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}>
                  <span className="text-[12.5px] leading-snug text-white/65 sm:text-sm">{label}</span>
                </div>
                <div
                  className={`border-l border-white/[0.07] px-2 py-3.5 text-center sm:px-6 ${i < COMPARISON_ROWS.length - 1 ? "border-b border-b-white/5" : ""} ${i % 2 === 0 ? "bg-[#CEBBA8]/[0.08]" : ""}`}
                >
                  {us ? <span className="text-base text-[#CEBBA8]">✓</span> : <span className="text-base text-white/20">–</span>}
                </div>
                <div
                  className={`border-l border-white/[0.07] px-2 py-3.5 text-center sm:px-6 ${i < COMPARISON_ROWS.length - 1 ? "border-b border-b-white/5" : ""} ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}
                >
                  {them ? <span className="text-base text-white/35">✓</span> : <span className="text-base text-white/20">–</span>}
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Gallery ───────────────────────────────────────────────────────

function GalleryTile({ src, label, sub, className }: { src: string; label: string; sub: string; className?: string }) {
  return (
    <div className={`group relative cursor-pointer overflow-hidden rounded-2xl bg-[#E8E0D8] ${className ?? ""}`}>
      <img src={src} alt={label} className="block h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#1C1C1C]/40 transition-all group-hover:to-[#1C1C1C]/65" />
      <div className="absolute inset-x-0 bottom-0 translate-y-[3px] p-5 transition-transform group-hover:translate-y-0">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.09em] text-white/60">{sub}</p>
        <p className="text-[17px] font-semibold tracking-[-0.01em] text-white">{label}</p>
      </div>
      <div className="absolute right-4 top-4 hidden rounded-lg border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md group-hover:block">
        View Style ↗
      </div>
    </div>
  );
}

function Gallery() {
  return (
    <section id="gallery" className="bg-[#F5F0EB] px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 flex flex-wrap items-end justify-between gap-5">
          <div>
            <Eyebrow>Style Gallery</Eyebrow>
            <h2 className={`text-[30px] font-normal leading-tight tracking-[-0.025em] text-[#1C1C1C] sm:text-[52px] ${FRAUNCES}`}>
              Any room.
              <br />
              <span className="italic text-[#CEBBA8]">Any aesthetic.</span>
            </h2>
          </div>
          <p className="max-w-[280px] text-right text-[14.5px] leading-relaxed text-[#A09080]">
            Every image is an actual AI-generated output — no staging, no Photoshop.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3 sm:[grid-template-rows:340px_340px]">
          <GalleryTile src={IMG.minimalist} label="Minimalist" sub="Clean surfaces, tonal palette" className="h-64 sm:row-span-2 sm:h-auto" />
          <GalleryTile src={IMG.coastal} label="Coastal" sub="Light woods, ocean tones" className="h-64 sm:h-auto" />
          <GalleryTile src={IMG.industrial} label="Industrial" sub="Exposed materials, dark tones" className="h-64 sm:h-auto" />
          <GalleryTile src={IMG.midcentury} label="Mid-Century" sub="Warm curves, retro palette" className="h-64 sm:h-auto" />
          <GalleryTile src={IMG.homeoffice} label="Modern Office" sub="Focused, productive spaces" className="h-64 sm:h-auto" />
        </div>

        <div className="mt-10 text-center">
          <Button variant="outline" className="rounded-full border-[#E8E0D8] px-8 py-6 text-sm font-semibold text-[#1C1C1C] hover:border-[#CEBBA8] hover:text-[#CEBBA8]">
            Browse All 20+ Styles →
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ───────────────────────────────────────────────────────

const PACKS = [
  {
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
    name: "Pro Pack",
    price: "$20",
    credits: 120,
    perCredit: "$0.17",
    features: ["120 AI room generations", "Real buyable product tags", "Google Visual Search", "High-res 4K exports", "Priority processing", "Commercial license"],
    cta: "Buy 120 Credits",
    hot: false,
    tag: "Most Credits",
  },
];

function Pricing() {
  return (
    <section id="pricing" className="bg-[#FAF8F5] px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-4xl">
        <div className="mb-14 text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className={`mb-4 text-[28px] font-normal leading-tight tracking-[-0.025em] text-[#1C1C1C] sm:text-[48px] ${FRAUNCES}`}>
            Pay as you go.
            <br />
            <span className="italic text-[#CEBBA8]">No subscriptions.</span>
          </h2>
          <p className="mx-auto mb-3.5 max-w-md text-[15.5px] text-[#A09080]">
            Credits never expire. Buy once, use whenever. Every new account gets <strong className="text-[#1C1C1C]">1 free generation</strong> — no card required.
          </p>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#CEBBA8]/30 bg-[#CEBBA8]/10 px-4.5 py-2">
            <CheckDot />
            <span className="text-[13px] font-semibold text-[#CEBBA8]">1 credit = 1 full room design with buyable products</span>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-3">
          {PACKS.map((pack) => (
            <div
              key={pack.name}
              className={`relative rounded-3xl ${
                pack.hot ? "scale-[1.025] border-2 border-[#1C1C1C] bg-[#1C1C1C] px-9 py-11 shadow-[0_20px_60px_rgba(28,28,28,0.22)]" : "border border-[#E8E0D8] bg-white px-8 py-10"
              }`}
            >
              {pack.tag && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#CEBBA8] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white">
                  {pack.tag}
                </div>
              )}

              <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#CEBBA8]">{pack.name}</p>

              <div className="mb-1 flex items-baseline gap-1.5">
                <span className={`text-[56px] leading-none tracking-[-0.03em] ${pack.hot ? "text-white" : "text-[#1C1C1C]"} ${FRAUNCES}`}>{pack.price}</span>
              </div>
              <p className={`mb-1 text-[13px] font-semibold ${pack.hot ? "text-[#DCD3C9]" : "text-[#B8A08A]"}`}>
                {pack.credits} credits · {pack.perCredit} each
              </p>
              <p className={`mb-7 text-xs ${pack.hot ? "text-white/35" : "text-[#A09080]"}`}>One-time purchase · Credits never expire</p>

              <div className={`mb-8 border-t pt-7 ${pack.hot ? "border-white/10" : "border-[#E8E0D8]"}`}>
                {pack.features.map((f) => (
                  <div key={f} className="mb-3 flex items-center gap-2.5">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                      <circle cx="8" cy="8" r="7" fill="#CEBBA820" stroke="#CEBBA8" strokeWidth="1.2" />
                      <path d="M5 8L7 10L11 6" stroke="#CEBBA8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className={`text-[13.5px] ${pack.hot ? "text-white/75" : "text-[#6B5E52]"}`}>{f}</span>
                  </div>
                ))}
              </div>

              <Button
                className={`w-full rounded-full py-6 text-sm font-bold ${
                  pack.hot ? "bg-[#CEBBA8] text-white hover:-translate-y-0.5 hover:opacity-90" : "border border-[#1C1C1C] bg-transparent text-[#1C1C1C] hover:-translate-y-0.5 hover:bg-transparent hover:opacity-90"
                }`}
              >
                {pack.cta}
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-[#E8E0D8] bg-white p-7 text-center">
          <p className="text-[14.5px] text-[#6B5E52]">
            🎁 <strong className="text-[#1C1C1C]">New to PlacdAI?</strong> Sign up and get your first room design completely free — no credit card needed. See what your
            space can look like before spending a cent.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Footer CTA ──────────────────────────────────────────────────────

function FooterCTA() {
  return (
    <section className="relative overflow-hidden bg-[#1C1C1C] px-6 py-28 sm:px-10">
      <div
        className="pointer-events-none absolute -top-[20%] left-[20%] h-[500px] w-[600px]"
        style={{ background: "radial-gradient(ellipse at center, #CEBBA818 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-[10%] right-[15%] h-[400px] w-[400px]"
        style={{ background: "radial-gradient(ellipse at center, #DCD3C910 0%, transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-2xl text-center">
        <Eyebrow light>Get Started Free</Eyebrow>
        <h2 className={`mb-6 text-[30px] font-normal leading-[1.08] tracking-[-0.025em] text-white sm:text-[64px] sm:leading-[0.97] ${FRAUNCES}`}>
          Ready to see your
          <br />
          <span className="italic text-[#CEBBA8]">room's potential?</span>
        </h2>
        <p className="mx-auto mb-12 max-w-[440px] text-base leading-relaxed text-white/45">
          Sign up and get your first design free. No card required. Real buyable furniture included in every result.
        </p>

        <div className="mb-14 flex flex-wrap justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="rounded-full bg-[#CEBBA8] px-6 py-5 text-[13.5px] font-bold text-white shadow-[0_4px_20px_rgba(206,187,168,0.4)] transition-all hover:-translate-y-1 hover:bg-[#CEBBA8] hover:shadow-[0_12px_40px_rgba(206,187,168,0.55)] sm:px-10 sm:py-6 sm:text-[15px]"
          >
            <Link to="/dashboard">
              Start for Free — No Card <ArrowRight className="ml-2 inline h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full border-white/15 bg-transparent px-8 py-6 text-[15px] font-medium text-white/55 hover:border-[#CEBBA8]/50 hover:bg-transparent hover:text-white/85">
            <a href="#gallery" onClick={(e) => scrollToSection(e, "#gallery")}>View Gallery</a>
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-6 border-t border-white/[0.07] pt-11">
          <img src={logoImg} alt="PlacdAI" className="h-[26px] object-contain opacity-45 brightness-0 invert" />
          <div className="flex gap-8">
            {["Privacy", "Terms", "Contact", "API"].map((l) => (
              <a key={l} href="#" className="text-[13px] text-white/30 transition-colors hover:text-white/65">
                {l}
              </a>
            ))}
          </div>
          <p className="text-xs text-white/20">© {new Date().getFullYear()} PlacdAI</p>
        </div>
      </div>
    </section>
  );
}