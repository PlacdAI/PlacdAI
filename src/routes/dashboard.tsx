import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import { Check, ChevronLeft, ChevronRight, ExternalLink, Eye, EyeOff, ListChecks, Plus, RotateCw, ScanSearch, Search, Upload, Wand2, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useAuthGate } from "@/components/auth-gate";
import { useCreditsGate } from "@/components/credits-gate";
import { apiFetch } from "@/lib/apiFetch";
import { supabase } from "@/lib/supabaseClient";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { STYLES, type Product } from "@/lib/types";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import heroImage from "@/assets/room-hero.jpg";
import logoMark from "@/assets/trimmy-PlacdAI-logo-official.png";
import { type DetectedItem, matchDetectedItem } from "@/lib/furnitureMatching";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const ROOM_TYPES = ["Living Room", "Bedroom", "Dining Room"] as const;
const PALETTES = [
  { name: "Neutral", colors: ["#E8E4DF", "#C4BAB0", "#8C7B70", "#4A3F38"] },
  { name: "Nordic", colors: ["#EEF2F5", "#B8C4CC", "#6A8494", "#2C3E4A"] },
  { name: "Earth", colors: ["#F2E9DF", "#D4A882", "#9C6B3C", "#4A2E18"] },
  { name: "Sage", colors: ["#EDF2EE", "#BACED0", "#6A9B8A", "#2A4A3E"] },
  { name: "Blush", colors: ["#FAF0EE", "#EBBCB0", "#C97862", "#7A3828"] },
  { name: "Slate", colors: ["#F0F1F4", "#C0C6D4", "#6874A0", "#252D52"] },
  { name: "Custom", colors: ["#8d8d8d"] },
] as const;

const CARD_IMAGES = {
  "Living Room": "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=500&q=80",
  Bedroom: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=500&q=80",
  "Dining Room": "https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=500&q=80",
  Scandinavian: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=500&q=80",
  Minimalist: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=500&q=80",
  "Mid-Century Modern": "https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=500&q=80",
  Industrial: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=500&q=80",
  Bohemian: "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=500&q=80",
  Japandi: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=500&q=80",
} as const;

// ─────────────────────────────────────────────────────────────
// "Find items in this photo" — on-demand furniture detection
// ─────────────────────────────────────────────────────────────
// DetectedItem + matchDetectedItem live in a shared lib so the
// swap-product verification step on the server uses the exact same
// matching rule as this hotspot-click check — see furnitureMatching.ts.


/** Crop a percentage-based region out of a data URL image, client-side. */
function cropImageRegion(
  imageDataUrl: string,
  bbox: DetectedItem["bbox"],
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const sx = (bbox.xPct / 100) * img.naturalWidth;
      const sy = (bbox.yPct / 100) * img.naturalHeight;
      const sw = Math.max(1, (bbox.wPct / 100) * img.naturalWidth);
      const sh = Math.max(1, (bbox.hPct / 100) * img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Crop failed"));
      }, "image/png");
    };
    img.onerror = () => reject(new Error("Couldn't load image for cropping"));
    img.src = imageDataUrl;
  });
}

// 🔧 Stable key for a detected item, used to cache its cropped thumbnail
// (see detectedThumbnails state in Dashboard, below). Deterministic from
// the item's own data — no index needed — so it survives the list being
// filtered (AI-generated pieces vs. buyable) without losing its thumbnail.
function detectedItemKey(item: DetectedItem): string {
  return `${item.label}|${item.bbox.xPct}|${item.bbox.yPct}|${item.bbox.wPct}|${item.bbox.hPct}`;
}

/**
 * Tracks the rendered rect (in px, relative to the container) of an image
 * shown with `object-fit: contain` inside a container of arbitrary size.
 * The dashboard canvas now fills whatever viewport space is left after the
 * nav + sidebar, rather than a container locked to the photo's own aspect
 * ratio — so hotspot percentages need to be resolved against this rect
 * instead of the container's full bounds.
 */
function useContainRect(
  containerRef: React.RefObject<HTMLElement | null>,
  ratio: number | null,
) {
  const [rect, setRect] = useState({ left: 0, top: 0, width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !ratio) return;

    const compute = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (!cw || !ch) return;
      const containerRatio = cw / ch;
      const width = containerRatio > ratio ? ch * ratio : cw;
      const height = containerRatio > ratio ? ch : cw / ratio;
      setRect({ left: (cw - width) / 2, top: (ch - height) / 2, width, height });
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, ratio]);

  return rect;
}

// ── Color math for the custom color picker (no external deps) ──
function hexToRgb(hex: string) {
  const clean = hex.replace("#", "").padEnd(6, "0").slice(0, 6);
  const n = parseInt(clean, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r: number, g: number, b: number) {
  const c = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function rgbToHsv(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
}
function hsvToRgb(h: number, s: number, v: number) {
  s /= 100; v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}
function hexToHsv(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsv(r, g, b);
}
function hsvToHex(h: number, s: number, v: number) {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

/** Draggable saturation/value square for a given hue. */
function SvPicker({ hue, sat, val, onChange }: { hue: number; sat: number; val: number; onChange: (s: number, v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const update = useCallback((clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
    onChange((x / rect.width) * 100, 100 - (y / rect.height) * 100);
  }, [onChange]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => dragging.current && update(e.clientX, e.clientY);
    const onUp = () => { dragging.current = false; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [update]);

  return (
    <div
      ref={ref}
      onPointerDown={(e) => { dragging.current = true; update(e.clientX, e.clientY); }}
      className="relative h-32 w-full cursor-crosshair rounded-lg"
      style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))` }}
    >
      <span
        className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
        style={{ left: `${sat}%`, top: `${100 - val}%`, background: hsvToHex(hue, sat, val) }}
      />
    </div>
  );
}

/** Draggable hue slider (0–360°). */
function HueSlider({ hue, onChange }: { hue: number; onChange: (h: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const update = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    onChange((x / rect.width) * 360);
  }, [onChange]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => dragging.current && update(e.clientX);
    const onUp = () => { dragging.current = false; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [update]);

  return (
    <div
      ref={ref}
      onPointerDown={(e) => { dragging.current = true; update(e.clientX); }}
      className="relative mt-3 h-3 w-full cursor-pointer rounded-full"
      style={{ background: "linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)" }}
    >
      <span
        className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white shadow"
        style={{ left: `${(hue / 360) * 100}%` }}
      />
    </div>
  );
}

/** Full custom-color picker: saved swatches row + SV box + hue slider + hex input. */
function CustomColorPicker({
  colors,
  activeIndex,
  onSelectIndex,
  onChangeColor,
  onAddColor,
}: {
  colors: string[];
  activeIndex: number;
  onSelectIndex: (index: number) => void;
  onChangeColor: (index: number, hex: string) => void;
  onAddColor: () => void;
}) {
  const hex = colors[activeIndex] ?? "#888888";
  const hsv = useMemo(() => hexToHsv(hex), [hex]);

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-start gap-2 overflow-x-auto pb-1">
        {colors.map((c, i) => (
          <button
            key={`${c}-${i}`}
            type="button"
            onClick={() => onSelectIndex(i)}
            className={`flex shrink-0 flex-col items-center gap-1.5 rounded-lg border p-2 transition ${
              i === activeIndex ? "border-foreground bg-foreground/5" : "border-transparent hover:bg-accent/40"
            }`}
          >
            <span className="h-8 w-8 rounded-full border border-black/10" style={{ backgroundColor: c }} />
            <span className={`text-[10px] ${i === activeIndex ? "font-medium text-foreground" : "text-muted-foreground"}`}>
              {c.toUpperCase()}
            </span>
          </button>
        ))}
        {colors.length < 4 && (
          <button
            type="button"
            onClick={onAddColor}
            className="flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground transition hover:border-foreground/50 hover:text-foreground"
          >
            <span className="text-base font-light leading-none">+</span>
          </button>
        )}
      </div>

      <div className="mt-3">
        <SvPicker
          hue={hsv.h}
          sat={hsv.s}
          val={hsv.v}
          onChange={(s, v) => onChangeColor(activeIndex, hsvToHex(hsv.h, s, v))}
        />
        <HueSlider hue={hsv.h} onChange={(h) => onChangeColor(activeIndex, hsvToHex(h, hsv.s, hsv.v))} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="h-8 w-8 shrink-0 rounded-md border border-black/10" style={{ backgroundColor: hex }} />
        <input
          value={hex}
          onChange={(e) => onChangeColor(activeIndex, e.target.value)}
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none"
        />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "PlacdAI — Shop the AI Look" },
      {
        name: "description",
        content:
          "Upload a photo of your room, pick a style, and PlacdAI redesigns it with real furniture you can shop instantly.",
      },
      { property: "og:title", content: "PlacdAI — Shop the AI Look" },
      {
        property: "og:description",
        content:
          "AI interior design that furnishes your room with real, shoppable products.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { user, isDevBypass } = useAuth();
  const { requireAuth } = useAuthGate();
  const { confirmSpend, showOutOfCredits } = useCreditsGate();

  // No login wall here anymore — logged-out visitors can look around the
  // whole dashboard freely. Gating happens at the point of actual use
  // (upload, generate) via requireAuth, which pops the signup dialog in
  // place instead of navigating anyone to /login.

  // Fixed-viewport shell: this route owns the whole screen, so lock body
  // scroll for as long as it's mounted (restored on unmount for other
  // routes that do scroll normally).
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const [roomImage, setRoomImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [visionPrompt, setVisionPrompt] = useState("");
  // 🔧 Hard cap on the vision prompt. 300 keeps users focused on intent
  // ("warm Japandi with natural linen") rather than long free-form text
  // that starts competing with the STRICT RULES section already baked
  // into generate-room's prompt — and keeps token cost/predictability in
  // check. Enforced both here (maxLength — the browser physically won't
  // accept more input past this) and should also be validated server-side
  // in generate-room.ts's Zod schema so a direct API call can't bypass it.
  const VISION_PROMPT_MAX = 300;
  const visionTextareaRef = useRef<HTMLTextAreaElement>(null);
  // 🔧 Max height before the textarea stops growing and scrolls
  // internally instead — keeps a very long (near the 300-char cap)
  // message from eating the whole canvas.
  const VISION_TEXTAREA_MAX_HEIGHT = 120;
  useEffect(() => {
    const el = visionTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, VISION_TEXTAREA_MAX_HEIGHT)}px`;
  }, [visionPrompt]);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRect = useContainRect(canvasContainerRef, aspectRatio);
  const [style, setStyle] = useState<string>("Mid-Century Modern");
  const [roomType, setRoomType] = useState<string>("Living Room");
  // "Custom" room type / style — same pattern as the existing Custom
  // palette below: selecting the tile reveals a text field, and the
  // typed value (not the literal word "Custom") is what actually gets
  // sent to the API. Covers anything not in the preset lists — a
  // reading nook, a garden corner, coastal, farmhouse, etc.
  const [customRoomType, setCustomRoomType] = useState("");
  const [customStyle, setCustomStyle] = useState("");
  const effectiveRoomType = roomType === "Custom" ? customRoomType.trim() || "Custom Space" : roomType;
  const effectiveStyle = style === "Custom" ? customStyle.trim() || "Custom Style" : style;
  const missingCustomInput = (roomType === "Custom" && !customRoomType.trim()) || (style === "Custom" && !customStyle.trim());
  const [palette, setPalette] = useState<(typeof PALETTES)[number]["name"]>("Neutral");
  const [customColors, setCustomColors] = useState<string[]>(["#888888"]);
  const [activeCustomColor, setActiveCustomColor] = useState(0);
  const [actionBarVisible, setActionBarVisible] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [canvasImage, setCanvasImage] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Manual, on-demand retry for a single "Best-effort" product — swap-product
  // no longer auto-retries every unconfirmed item (that was paying for a
  // second edit on every miss, whether or not anyone cared). This tracks
  // which single row is currently being retried so only that row shows a
  // spinner; everything else stays interactive.
  const [retryingProductId, setRetryingProductId] = useState<string | null>(null);

  // Sidebar tabs.
  const [activeTab, setActiveTab] = useState<"list" | "design">("list");

  // "Find items in this photo" — on-demand furniture detection.
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [hotspotsVisible, setHotspotsVisible] = useState(true);

  // 🔧 Thumbnails for the "AI-generated pieces" list — cropped client-side
  // from the already-generated room image using each item's own bbox, via
  // the same cropImageRegion helper the Google Lens search flow already
  // uses. No extra API calls, no added Gemini cost — just reusing pixels
  // we already have. Keyed by detectedItemKey so the cache survives the
  // list being filtered (AI-generated vs. buyable) without recomputing.
  const [detectedThumbnails, setDetectedThumbnails] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!canvasImage || detectedItems.length === 0) {
      setDetectedThumbnails({});
      return;
    }
    let cancelled = false;
    const objectUrls: string[] = [];

    Promise.all(
      detectedItems.map(async (item) => {
        try {
          const blob = await cropImageRegion(canvasImage, item.bbox);
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          return [detectedItemKey(item), url] as const;
        } catch {
          // One bad crop shouldn't block the rest of the list — that row
          // just falls back to the placeholder icon.
          return null;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setDetectedThumbnails(
        Object.fromEntries(entries.filter((e): e is readonly [string, string] => e !== null)),
      );
    });

    return () => {
      cancelled = true;
      // Revoke every object URL created by this run so we don't leak
      // memory across scans/regenerations.
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedItems, canvasImage]);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setRoomImage(dataUrl);
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          setAspectRatio(img.naturalWidth / img.naturalHeight);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, []);

  const generate = async () => {
    if (!roomImage) {
      toast.error("Upload a room photo first.");
      return;
    }
    // Consume 1 credit up-front (dev-bypass users skip billing).
    if (!isDevBypass) {
      try {
        const r = await apiFetch("/api/consume-credit", { method: "POST" });
        if (r.status === 402) {
          showOutOfCredits();
          return;
        }
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          toast.error(j.error || "Could not start generation.");
          return;
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
        return;
      }
    }
    setBusy(true);
    setCanvasImage(null);
    setIsFinal(false);
    setProducts([]);
    setLoadingProducts(true);
    setDetectedItems([]);
    setHasScanned(false);
    setStatusText("Picking products…");

    const pickPromise = fetch("/api/pick-products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomImage, style: effectiveStyle }),
    })
      .then(async (r) => {
        const j = (await r.json()) as { products?: Product[]; error?: string };
        if (j.error) throw new Error(j.error);
        return j.products ?? [];
      })
      .then((picked) => {
        setLoadingProducts(false);
        return picked;
      })
      .catch((e: Error) => {
        setLoadingProducts(false);
        toast.error(`Product pick failed: ${e.message}`);
        return [] as Product[];
      });

    setStatusText("Redesigning your room…");
    const activePaletteColors = palette === "Custom" ? customColors : PALETTES.find((p) => p.name === palette)?.colors ?? [];
    let finalRoom: string | null = null;
    try {
      const startRes = await apiFetch("/api/start-generation", {
        method: "POST",
        body: JSON.stringify({
          roomImage,
          style: effectiveStyle,
          roomType: effectiveRoomType,
          palette: palette === "Custom" ? `Custom (${customColors.join(", ")})` : palette,
          paletteColors: activePaletteColors,
          prompt: visionPrompt.trim() || undefined,
        }),
      });
      const { generationId, error } = (await startRes.json()) as {
        generationId?: string;
        error?: string;
      };
      if (error || !generationId) throw new Error(error || "Could not start generation");

      // /api/generate-room used to stream progressive blur→sharp frames via
      // streamImage's onChunk callback (the setCanvasImage call that used to
      // be here). That's dropped for now — Netlify's Background Function
      // can't hold a connection open to stream to, so this just waits for
      // one 'done' row instead. Can rebuild a progressive feel later via
      // multiple small Realtime UPDATEs if wanted.
      finalRoom = await new Promise<string>((resolve, reject) => {
        // 60s is a UI-side patience limit, not the Background Function's
        // real ceiling (Netlify allows up to 15 min there). If Gemini is
        // just slow, the row still flips to 'done' after we've stopped
        // listening — the user can hit Generate again rather than stare at
        // an indefinite spinner.
        const timeoutId = setTimeout(() => {
          channel.unsubscribe();
          reject(new Error("Generation is taking longer than expected — please try again."));
        }, 60_000);

        const channel = supabase
          .channel(`generation-${generationId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "generations",
              filter: `id=eq.${generationId}`,
            },
            (payload) => {
              const row = payload.new as { status: string; result_url?: string; error?: string };
              if (row.status === "done" && row.result_url) {
                clearTimeout(timeoutId);
                channel.unsubscribe();
                resolve(row.result_url);
              } else if (row.status === "failed") {
                clearTimeout(timeoutId);
                channel.unsubscribe();
                reject(new Error(row.error || "Generation failed"));
              }
            },
          )
          .subscribe();
      });

      setCanvasImage(finalRoom);
      setIsFinal(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Room generation failed: ${msg}`);
    }

    const aiPicked = await pickPromise;
    setProducts(aiPicked);
    // Tracked locally (not just via setProducts) because React state
    // updates don't apply within this same function call — the save
    // below needs the real final list, not a stale closure value.
    let finalProducts: Product[] = aiPicked;

    if (finalRoom && aiPicked.length > 0) {
      const batch = aiPicked.slice(0, 3);
      setStatusText(
        `Placing ${batch.length} product${batch.length > 1 ? "s" : ""}…`,
      );
      setIsFinal(false);
      try {
        const res = await fetch("/api/swap-product", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentRoomImage: finalRoom,
            productIds: batch.map((p) => p.id),
          }),
        });
        const j = (await res.json()) as {
          image?: string;
          products?: Product[];
          error?: string;
        };
        if (j.error) throw new Error(j.error);
        if (j.image) {
          finalRoom = j.image;
          setCanvasImage(j.image);
        }
        // The backend resolves productIds against Supabase and returns the
        // canonical records for whatever it actually placed in the image —
        // use those (not the raw AI picks) so the sidebar always matches
        // what's really shown, with correct price/imageUrl/productUrl.
        finalProducts = j.products && j.products.length > 0 ? j.products : batch;
        setProducts(finalProducts);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Couldn't place products: ${msg}`);
      }
      setIsFinal(true);
    }

    // Save the final image to the user's gallery (72h TTL, FIFO capped at 20).
    // finalRoom is the single source of truth for "what this generation
    // actually produced" — reassigned live above as each step (initial
    // render, then swap-product's edit) completes. Reading canvasImage/
    // isFinal state here instead was the bug: those are closure-captured
    // snapshots from before this call started, so on the 2nd+ generation
    // they still pointed at the *previous* result — every regenerate was
    // silently saving the one before it.
    const savedImage = finalRoom;
    if (savedImage && !isDevBypass) {
      try {
        await apiFetch("/api/save-generation", {
          method: "POST",
          body: JSON.stringify({ image: savedImage, style: effectiveStyle, products: finalProducts }),
        });
      } catch {
        /* non-fatal */
      }
    }

    setStatusText("");
    setBusy(false);
    if (finalRoom) toast.success("Your room is ready — shop the look!");
  };

  // Called from a single "Retry" button on a Best-effort product row — the
  // only place a second paid edit call happens now. swap-product itself
  // only tries once per item during the main generate() run.
  const retryProduct = async (product: Product) => {
    if (!canvasImage || retryingProductId) return;

    // Same up-front consume-credit pattern as generate() — retry is a
    // real second Gemini edit call, and was previously free to the user
    // even though it cost real API money every time.
    if (!isDevBypass) {
      try {
        const r = await apiFetch("/api/consume-credit", { method: "POST" });
        if (r.status === 402) {
          showOutOfCredits();
          return;
        }
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          toast.error(j.error || "Could not start retry.");
          return;
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
        return;
      }
    }

    setRetryingProductId(product.id);
    try {
      const res = await fetch("/api/swap-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentRoomImage: canvasImage,
          productIds: [product.id],
          isRetry: true,
        }),
      });
      const j = (await res.json()) as {
        image?: string;
        products?: Product[];
        error?: string;
      };
      if (j.error) throw new Error(j.error);
      if (j.image) setCanvasImage(j.image);
      const updated = j.products?.[0];
      if (updated) {
        setProducts((current) => current.map((p) => (p.id === updated.id ? updated : p)));
        toast[updated.verified ? "success" : "message"]?.(
          updated.verified ? "Confirmed in the photo now." : "Still couldn't confirm it — try again or shop it as-is.",
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Retry failed: ${msg}`);
    } finally {
      setRetryingProductId(null);
    }
  };

  const showSlider =
    !!(roomImage && canvasImage && isFinal) &&
    !(hotspotsVisible && detectedItems.length > 0);

  const findItemsInPhoto = async () => {
    if (!canvasImage) return;
    setDetecting(true);
    setHotspotsVisible(true);
    try {
      const res = await apiFetch("/api/detect-furniture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: canvasImage }),
      });
      const j = (await res.json()) as { items?: DetectedItem[]; error?: string };
      if (j.error) throw new Error(j.error);
      setDetectedItems(j.items ?? []);
      setHasScanned(true);
      if (!j.items || j.items.length === 0) {
        toast("No furniture items detected in this photo.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Couldn't scan photo: ${msg}`);
    } finally {
      setDetecting(false);
    }
  };

  const handleHotspotClick = async (item: DetectedItem) => {
    const match = matchDetectedItem(item, products);
    if (match) {
      window.open(match.productUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (!canvasImage || !user) {
      toast.error("Sign in to search for similar items.");
      return;
    }
    // Open as a small popup window (not a full tab) so it reads more like
    // an in-app preview. Opened synchronously, before the async crop/
    // upload, so browsers don't block it as an unrequested popup.
    //
    // Deliberately NOT using noopener/noreferrer here: those make
    // window.open() return a disconnected reference, so we couldn't
    // navigate it to the real URL once the upload finished (it stayed
    // stuck on about:blank). Safe to omit them since the destination is
    // our own fixed, trusted URL (lens.google.com) — not user content.
    const popupFeatures = "width=480,height=720,left=200,top=80";
    const win = window.open("", "_blank", popupFeatures);
    try {
      const blob = await cropImageRegion(canvasImage, item.bbox);
      const path = `${user.id}/crops/${Date.now()}-${crypto.randomUUID()}.png`;
      const { error: upErr } = await supabase.storage
        .from("gallery")
        .upload(path, blob, { contentType: "image/png", upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { data: pub } = supabase.storage.from("gallery").getPublicUrl(path);
      // Google Lens's direct entry point — gives the actual visual-match /
      // "shop similar" experience, unlike the classic searchbyimage page.
      const searchUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(pub.publicUrl)}`;
      if (win) win.location.href = searchUrl;
      else window.open(searchUrl, "_blank", popupFeatures);
    } catch (e) {
      win?.close();
      toast.error(e instanceof Error ? e.message : "Couldn't search for similar items.");
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <Toaster richColors position="top-center" />

      {/* ── Top nav ───────────────────────────────────────────
          Fixed height, never scrolls. Renders the PlacdAI logo,
          Redesign / Gallery / Pricing links, credits badge, avatar. */}
      <div className="shrink-0">
        <AppNav />
      </div>

      {/* ── Body: canvas + sidebar, fills the rest of the viewport ── */}
      <main className="flex min-h-0 flex-1">
        {/* ── Canvas pane ─────────────────────────────────────
            Full-bleed, edge-to-edge. No page scroll — this pane
            only ever grows to fill the space next to the sidebar. */}
        <div className="relative min-w-0 flex-1 bg-neutral-900">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />

          <div ref={canvasContainerRef} className="absolute inset-0 overflow-hidden">
            {showSlider ? (
              <div
                className="absolute"
                style={{ left: canvasRect.left, top: canvasRect.top, width: canvasRect.width, height: canvasRect.height }}
              >
                <BeforeAfterSlider before={roomImage!} after={canvasImage!} />
              </div>
            ) : canvasImage ? (
              <img
                src={canvasImage}
                alt="Generated room"
                className={`absolute object-contain transition-[filter] duration-700 ${isFinal ? "blur-0" : "blur-2xl"}`}
                style={{ left: canvasRect.left, top: canvasRect.top, width: canvasRect.width, height: canvasRect.height }}
              />
            ) : roomImage ? (
              <img
                src={roomImage}
                alt="Your room"
                className="absolute object-contain opacity-70"
                style={{ left: canvasRect.left, top: canvasRect.top, width: canvasRect.width, height: canvasRect.height }}
              />
            ) : busy ? (
              <div className="h-full w-full animate-pulse bg-gradient-to-br from-neutral-800 via-neutral-700 to-neutral-800" />
            ) : (
              <div className="relative h-full w-full">
                <img src={heroImage} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/1" />
              </div>
            )}

            {/* Clickable furniture hotspots — positioned against the
                letterboxed image rect (canvasRect), not raw container
                percentages, so they stay accurate at any viewport size. */}
            {!showSlider &&
              isFinal &&
              hotspotsVisible &&
              detectedItems.map((item, i) => {
                const isReal = !!matchDetectedItem(item, products);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleHotspotClick(item)}
                    title={isReal ? `Shop ${item.label}` : `Find items like this ${item.label}`}
                    style={{
                      left: canvasRect.left + (item.bbox.xPct / 100) * canvasRect.width,
                      top: canvasRect.top + (item.bbox.yPct / 100) * canvasRect.height,
                      width: (item.bbox.wPct / 100) * canvasRect.width,
                      height: (item.bbox.hPct / 100) * canvasRect.height,
                    }}
                    className={`group absolute rounded-md border-2 transition ${
                      isReal ? "border-primary/70 hover:bg-primary/10" : "border-white/80 hover:bg-white/10"
                    }`}
                  >
                    <span
                      className={`absolute -left-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shadow ${
                        isReal ? "bg-primary text-primary-foreground" : "bg-white text-foreground"
                      }`}
                    >
                      {isReal ? <ExternalLink className="h-3 w-3" /> : <Search className="h-3 w-3" />}
                    </span>
                  </button>
                );
              })}
          </div>

          {/* Floating status / view controls, top of canvas */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
            <div className="pointer-events-none flex items-center gap-2">
              {statusText && (
                <span className="pointer-events-auto animate-pulse rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur">
                  {statusText}
                </span>
              )}
              {showSlider && (
                <span className="pointer-events-auto rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur">
                  Before / After
                </span>
              )}
            </div>
            {isFinal && canvasImage && (
              <div className="pointer-events-auto">
                {detectedItems.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setHotspotsVisible((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-black/80"
                  >
                    <ScanSearch className="h-3.5 w-3.5" />
                    {hotspotsVisible ? "Hide items" : "Show items"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={findItemsInPhoto}
                    disabled={detecting || hasScanned}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-50"
                  >
                    <ScanSearch className="h-3.5 w-3.5" />
                    {detecting ? "Scanning…" : hasScanned ? "Scanned" : "Find items in this photo"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Floating upload + prompt + generate bar, bottom of canvas.
              Below sm the prompt needs its own full-width row — cramming
              it into one row alongside both buttons left it a few pixels
              wide and unusable for typing. The eye button lives in the
              same row as the pill (not a separate floating control) but
              keeps its own opacity so it's always reachable even while
              the rest of the bar is faded. */}
          <div className="absolute inset-x-4 bottom-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div
              className={`flex flex-1 flex-col gap-2 rounded-2xl border border-border/60 bg-background/95 p-2 shadow-lg backdrop-blur transition-opacity duration-200 sm:flex-row sm:items-end ${
                actionBarVisible ? "opacity-100" : "pointer-events-none opacity-[0.05]"
              }`}
            >
              {/* 🔧 Auto-growing textarea (was a single-line input) — height
                  is driven by the effect above, capped at
                  VISION_TEXTAREA_MAX_HEIGHT then scrolls internally.
                  maxLength hard-stops typing at VISION_PROMPT_MAX; the
                  counter only appears once the user is close to the cap,
                  so it's not visual noise for short prompts.
                  order-1/sm:order-3 puts it on its own full-width row
                  first below sm, and back between Upload and Generate
                  at sm+ (matching the original single-row layout). */}
              <div className="order-1 flex min-w-0 flex-col sm:order-3 sm:flex-1">
                <textarea
                  ref={visionTextareaRef}
                  value={visionPrompt}
                  onChange={(e) => setVisionPrompt(e.target.value.slice(0, VISION_PROMPT_MAX))}
                  maxLength={VISION_PROMPT_MAX}
                  rows={1}
                  placeholder="Describe your vision — 'warm Japandi with natural linen…'"
                  className="max-h-[120px] min-h-[40px] w-full resize-none bg-transparent px-2 py-2 text-sm leading-tight text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                {visionPrompt.length > VISION_PROMPT_MAX - 50 && (
                  <span
                    className={`self-end pr-2 text-[10px] ${
                      visionPrompt.length >= VISION_PROMPT_MAX
                        ? "text-red-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    {visionPrompt.length}/{VISION_PROMPT_MAX}
                  </span>
                )}
              </div>

              {/* Upload + Generate share a row below sm (order-2); at sm+
                  this wrapper "un-boxes" via sm:contents so each button
                  falls back into the single row above/below the textarea,
                  in the original order. */}
              <div className="order-2 flex items-center gap-2 sm:contents">
                <button
                  type="button"
                  onClick={() =>
                    requireAuth(() => fileRef.current?.click(), {
                      reason: "Sign up free to upload your room photo and get your first AI redesign.",
                    })
                  }
                  className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground transition hover:bg-accent sm:order-1"
                >
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">{roomImage ? "Change photo" : "Upload Photo"}</span>
                  <span className="sm:hidden">{roomImage ? "Change" : "Upload"}</span>
                </button>
                <div className="hidden h-6 w-px shrink-0 self-center bg-border sm:order-2 sm:block" />
                <Button
                  onClick={() =>
                    requireAuth(generate, { reason: "Sign up free to generate your AI redesign — your first one's on us." })
                  }
                  disabled={busy || !roomImage || missingCustomInput}
                  className="h-10 flex-1 shrink-0 sm:order-4 sm:flex-none"
                >
                  <Wand2 className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">{busy ? "Working…" : "Generate Design"}</span>
                  <span className="sm:hidden">{busy ? "Working…" : "Generate"}</span>
                </Button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActionBarVisible((v) => !v)}
              title={actionBarVisible ? "Hide toolbar" : "Show toolbar"}
              className="hidden h-10 w-10 shrink-0 items-center justify-center self-end rounded-full border border-border/60 bg-background/95 text-foreground shadow-lg backdrop-blur transition hover:bg-accent sm:flex sm:self-auto"
            >
              {actionBarVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* ── Sidebar ───────────────────────────────────────── */}
        {/* Below md, a fixed-width 440px panel sitting in this flex row
            would be wider than most phones — it'd either crush the canvas
            to nothing or force the whole page to scroll horizontally.
            So below md it's a fixed overlay drawer that slides in over the
            canvas (with a backdrop to dismiss it); at md+ it's back to the
            original in-flow width toggle. */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-x-0 bottom-0 top-[52px] z-20 bg-black/40 md:hidden"
          />
        )}
        <div className="relative flex h-full shrink-0">
          {/* 🔧 Position (not style) differs by state, and that's
              necessary rather than a repeat of the old two-button
              mismatch: when open, the aside has real width, so left-0
              -translate-x-1/2 sits on an internal border with room on
              both sides. When collapsed, the aside's width is 0 — that
              same boundary is now flush against the actual browser
              viewport edge, so straddling it clips half the button
              off-screen. Pulling in to a small right-inset instead keeps
              it fully visible while collapsed. Same fill, icon logic,
              shadow, and transition either way — only the anchor moves. */}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            className={`fixed top-[68px] z-30 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white text-foreground/70 shadow-md transition hover:text-foreground active:scale-90 md:absolute md:top-4 md:z-20 ${
              sidebarOpen ? "right-3 md:left-0 md:right-auto md:-translate-x-1/2" : "right-3"
            }`}
          >
            {sidebarOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          <aside
            className={`fixed bottom-0 right-0 top-[52px] z-20 flex h-auto w-[88vw] max-w-[440px] flex-col overflow-hidden border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-in-out md:relative md:inset-auto md:z-auto md:h-full md:w-[440px] md:translate-x-0 md:shadow-none md:transition-[width] ${
              sidebarOpen ? "translate-x-0" : "translate-x-full md:w-0"
            }`}
          >
          <div className="flex shrink-0 items-center border-b border-border">
            <div className="grid flex-1 grid-cols-2">
              <SidebarTab
                label="List"
                icon={<ListChecks className="h-4 w-4" />}
                active={activeTab === "list"}
                onClick={() => setActiveTab("list")}
              />
              <SidebarTab
                label="Design"
                icon={<Zap className="h-4 w-4" />}
                active={activeTab === "design"}
                onClick={() => setActiveTab("design")}
              />
            </div>
          </div>

          {activeTab === "list" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Your room list</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Shop placed products or find visual matches for AI pieces.</p>
                </div>
                <button
                  type="button"
                  onClick={findItemsInPhoto}
                  disabled={!canvasImage || detecting || hasScanned}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ScanSearch className="h-3.5 w-3.5" />
                  {detecting ? "Scanning" : hasScanned ? "Scanned" : "Scan"}
                </button>
              </div>

              {(loadingProducts || products.length > 0) && (
                <div className="shrink-0 border-b border-border p-3">
                  <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Buyable products {products.length > 0 && `(${products.length})`}
                  </p>
                  <div className="space-y-2">
                    {loadingProducts && products.length === 0
                      ? Array.from({ length: 2 }).map((_, i) => (
                          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
                        ))
                      : products.map((p, i) => (
                          <PlacedProductRow
                            key={p.id}
                            product={p}
                            index={i + 1}
                            onRetry={(p) =>
                              confirmSpend(() => retryProduct(p), {
                                reason: "Retrying this item will use 1 credit from your balance.",
                              })
                            }
                            retrying={retryingProductId === p.id}
                          />
                        ))}
                  </div>
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {detectedItems.filter((item) => !matchDetectedItem(item, products)).length > 0 ? (
                  <section>
                    <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">AI-generated pieces</p>
                    <div className="space-y-2">
                      {detectedItems
                        .filter((item) => !matchDetectedItem(item, products))
                        .map((item, i) => (
                          <DetectedItemRow
                            key={`${item.label}-${i}`}
                            item={item}
                            thumbnailUrl={detectedThumbnails[detectedItemKey(item)]}
                            onClick={handleHotspotClick}
                          />
                        ))}
                    </div>
                  </section>
                ) : products.length === 0 && !loadingProducts ? (
                  <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                    <ScanSearch className="mb-3 h-8 w-8 text-muted-foreground/35" />
                    <p className="text-sm font-medium text-foreground">No items listed yet</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Generate a room, then scan it to see products you can buy and AI pieces to search visually.</p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <img src={logoMark} alt="" className="h-4 w-4 object-contain opacity-50" /> AI Interior Design
                  </div>
                </div>

                <div>
                  <DesignSectionLabel>Room type</DesignSectionLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {ROOM_TYPES.map((type) => (
                      <ImageChoiceCard
                        key={type}
                        label={type}
                        image={CARD_IMAGES[type]}
                        selected={roomType === type}
                        onClick={() => setRoomType(type)}
                      />
                    ))}
                    <ImageChoiceCard label="Custom" selected={roomType === "Custom"} onClick={() => setRoomType("Custom")} />
                  </div>
                  {roomType === "Custom" && (
                    <input
                      type="text"
                      value={customRoomType}
                      onChange={(e) => setCustomRoomType(e.target.value.slice(0, 60))}
                      maxLength={60}
                      placeholder="e.g. 'reading nook', 'garden patio', 'home office'"
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-foreground/40 focus:outline-none"
                    />
                  )}
                </div>

                <div>
                  <DesignSectionLabel>Style</DesignSectionLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {STYLES.map((itemStyle) => (
                      <ImageChoiceCard
                        key={itemStyle}
                        label={itemStyle}
                        image={CARD_IMAGES[itemStyle]}
                        selected={style === itemStyle}
                        onClick={() => setStyle(itemStyle)}
                      />
                    ))}
                    <ImageChoiceCard label="Custom" selected={style === "Custom"} onClick={() => setStyle("Custom")} />
                  </div>
                  {style === "Custom" && (
                    <input
                      type="text"
                      value={customStyle}
                      onChange={(e) => setCustomStyle(e.target.value.slice(0, 60))}
                      maxLength={60}
                      placeholder="e.g. 'coastal', 'farmhouse', 'art deco'"
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-foreground/40 focus:outline-none"
                    />
                  )}
                </div>

                <div>
                  <DesignSectionLabel>Color palette</DesignSectionLabel>
                  <div className="flex flex-col gap-1.5">
                    {PALETTES.map((itemPalette) => {
                      const isSelected = palette === itemPalette.name;
                      const isCustom = itemPalette.name === "Custom";
                      const swatches = isCustom ? customColors : itemPalette.colors;
                      return (
                        <div key={itemPalette.name}>
                          <button
                            type="button"
                            onClick={() => setPalette(itemPalette.name)}
                            className={`flex w-full items-center gap-2.5 rounded-[10px] border px-2.5 py-2 text-left transition ${
                              isSelected
                                ? "border-foreground bg-foreground/[0.025]"
                                : "border-border hover:border-foreground/30"
                            }`}
                          >
                            <span className="flex shrink-0 gap-[3px]">
                              {swatches.slice(0, 4).map((color, index) => (
                                <span
                                  key={`${color}-${index}`}
                                  className="h-4 w-4 rounded border border-black/10"
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </span>
                            <span className={`text-[13px] ${isSelected ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                              {itemPalette.name}
                            </span>
                            {isSelected && <span className="ml-auto text-[13px] text-foreground">✓</span>}
                          </button>

                          {isCustom && isSelected && (
                            <div className="mt-2 pl-2.5 pr-0.5">
                              <CustomColorPicker
                                colors={customColors}
                                activeIndex={Math.min(activeCustomColor, customColors.length - 1)}
                                onSelectIndex={setActiveCustomColor}
                                onChangeColor={(index, hex) =>
                                  setCustomColors((colors) => colors.map((c, i) => (i === index ? hex : c)))
                                }
                                onAddColor={() =>
                                  setCustomColors((colors) => {
                                    const next = [...colors, "#888888"];
                                    setActiveCustomColor(next.length - 1);
                                    return next;
                                  })
                                }
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-border p-4">
                <p className="mb-2 text-center text-[11px] text-muted-foreground">
                  {effectiveStyle} · {effectiveRoomType} · {palette}
                </p>
                <Button
                  onClick={() =>
                    requireAuth(generate, { reason: "Sign up free to generate your AI redesign — your first one's on us." })
                  }
                  disabled={busy || !roomImage || missingCustomInput}
                  className="h-11 w-full"
                >
                  <Wand2 className="mr-2 h-4 w-4" />
                  {busy ? "Working…" : "Generate Design"}
                </Button>
              </div>
            </>
          )}
        </aside>
        </div>
      </main>
    </div>
  );
}

function SidebarTab({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 px-4 py-4 text-sm font-medium transition ${
        active
          ? "border-b-2 border-primary text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function DesignSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function ImageChoiceCard({
  label,
  image,
  selected,
  onClick,
}: {
  label: string;
  image?: string;
  selected: boolean;
  onClick: () => void;
}) {
  if (!image) {
    // Custom tile — no stock photo makes sense for an arbitrary
    // user-typed room/style, so this is a dashed "add" tile instead.
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-center transition ${
          selected ? "border-foreground bg-foreground/[0.04]" : "border-border hover:border-foreground/40"
        }`}
      >
        <Plus className={`h-4 w-4 ${selected ? "text-foreground" : "text-muted-foreground"}`} />
        <span className={`text-xs font-semibold ${selected ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative aspect-[4/3] w-full overflow-hidden rounded-xl border-2 text-left transition ${
        selected ? "border-foreground" : "border-transparent hover:border-foreground/30"
      }`}
    >
      <img src={image} alt="" className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]" />
      <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <span className="absolute bottom-1.5 left-2 right-2 truncate text-xs font-semibold text-white drop-shadow">{label}</span>
    </button>
  );
}

function DetectedItemRow({
  item,
  thumbnailUrl,
  onClick,
}: {
  item: DetectedItem;
  thumbnailUrl?: string;
  onClick: (item: DetectedItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="group flex w-full items-center gap-3 rounded-lg border border-border bg-background p-2 text-left transition hover:border-primary/40 hover:bg-accent/40"
    >
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={item.label} className="h-full w-full object-cover" />
        ) : (
          <Search className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">{item.label}</p>
        <p className="truncate text-[10px] text-muted-foreground">AI-generated {item.category || "furniture"}</p>
        <p className="mt-0.5 text-[10px] font-medium text-primary">Find similar on Google</p>
      </div>
      <Search className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition group-hover:text-foreground" />
    </button>
  );
}

function PlacedProductRow({
  product,
  index,
  onRetry,
  retrying,
}: {
  product: Product;
  index: number;
  onRetry: (product: Product) => void;
  retrying: boolean;
}) {
  // `verified` is only set once swap-product's post-edit detection pass has
  // actually run. Undefined (e.g. before any swap happened yet) renders no
  // badge at all — we only ever claim a confidence level we've checked for.
  const showBadge = product.verified !== undefined;

  return (
    <div className="group flex items-center gap-2 rounded-lg border border-border bg-background p-2 text-foreground transition hover:border-primary/40">
      <a href={product.productUrl} target="_blank" rel="noreferrer" className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-muted">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              "https://placehold.co/96x96?text=%20";
          }}
        />
        <span className="absolute left-0 top-0 flex h-4 w-4 items-center justify-center rounded-br-md bg-primary text-[10px] font-bold text-primary-foreground">
          {index}
        </span>
      </a>
      <a href={product.productUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{product.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">{product.brand}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <p className="text-xs font-semibold">
            {currency.format(Number(product.price) || 0)}
          </p>
          {showBadge && (
            <span
              title={
                product.verified
                  ? "Confirmed in the generated photo"
                  : "Placed, but we couldn't confirm it's clearly visible — it may be partially hidden or off"
              }
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-[1px] text-[9px] font-semibold ${
                product.verified
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-amber-500/10 text-amber-600"
              }`}
            >
              {product.verified ? (
                <>
                  <Check className="h-2.5 w-2.5" /> In photo
                </>
              ) : (
                "Best-effort"
              )}
            </span>
          )}
        </div>
      </a>
      {product.verified === false && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onRetry(product);
          }}
          disabled={retrying}
          title="Try placing this item again"
          className="flex shrink-0 items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-[10px] font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCw className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
          {retrying ? "Retrying…" : "Retry"}
        </button>
      )}
      <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground transition group-hover:text-foreground" />
    </div>
  );
}