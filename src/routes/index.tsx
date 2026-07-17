import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import { ExternalLink, LogOut, Sparkles, Upload, Wand2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STYLES, type Product, type Style } from "@/lib/types";
import { streamImage } from "@/lib/streamImage";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export const Route = createFileRoute("/")({
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
  const [roomImage, setRoomImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [style, setStyle] = useState<Style>("Mid-Century Modern");
  const [canvasImage, setCanvasImage] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
    setBusy(true);
    setCanvasImage(null);
    setIsFinal(false);
    setProducts([]);
    setLoadingProducts(true);
    setStatusText("Picking products…");

    const pickPromise = fetch("/api/pick-products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomImage, style }),
    })
      .then(async (r) => {
        const j = (await r.json()) as { products?: Product[]; error?: string };
        if (j.error) throw new Error(j.error);
        return j.products ?? [];
      })
      .then((picked) => {
        setProducts(picked);
        setLoadingProducts(false);
        return picked;
      })
      .catch((e: Error) => {
        setLoadingProducts(false);
        toast.error(`Product pick failed: ${e.message}`);
        return [] as Product[];
      });

    setStatusText("Redesigning your room…");
    let finalRoom: string | null = null;
    try {
      finalRoom = await streamImage(
        "/api/generate-room",
        { roomImage, style },
        (dataUrl, final) => {
          setCanvasImage(dataUrl);
          if (final) setIsFinal(true);
        },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Room generation failed: ${msg}`);
    }

    const picked = await pickPromise;

    if (finalRoom && picked.length > 0) {
      let current = finalRoom;
      for (let i = 0; i < picked.length; i++) {
        const p = picked[i];
        setStatusText(`Placing ${p.name} (${i + 1}/${picked.length})…`);
        setIsFinal(false);
        try {
          const res = await fetch("/api/swap-product", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              currentRoomImage: current,
              productId: p.id,
            }),
          });
          const j = (await res.json()) as { image?: string; error?: string };
          if (j.error) throw new Error(j.error);
          if (j.image) {
            current = j.image;
            setCanvasImage(current);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          toast.error(`Couldn't place ${p.name}: ${msg}`);
        }
      }
      setIsFinal(true);
    }

    setStatusText("");
    setBusy(false);
    if (finalRoom) toast.success("Your room is ready — shop the look!");
  };

  const showSlider = !!(roomImage && canvasImage && isFinal);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <Toaster richColors position="top-center" />

      <header className="mx-auto max-w-5xl px-6 pt-16 pb-10 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3" /> AI Interior Design
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
          PlacdAI —{" "}
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Shop the AI Look
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
          Upload your empty room, pick a style, and watch AI redesign it with
          real furniture you can buy right now.
        </p>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 pb-24">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">
                Room photo
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground transition hover:bg-accent"
              >
                <Upload className="h-4 w-4" />
                {roomImage ? "Change photo" : "Upload room photo"}
              </button>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">
                Style
              </label>
              <Select
                value={style}
                onValueChange={(v) => setStyle(v as Style)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={generate}
                disabled={busy || !roomImage}
                className="h-10 w-full sm:w-auto"
              >
                <Wand2 className="mr-2 h-4 w-4" />
                {busy ? "Working…" : "Generate Design"}
              </Button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              {showSlider ? "Before / After" : "AI Canvas"}
            </h2>
            {statusText && (
              <span className="animate-pulse text-xs text-muted-foreground">
                {statusText}
              </span>
            )}
          </div>
          <div
            className="relative w-full bg-muted"
            style={{ aspectRatio: aspectRatio ?? 16 / 9 }}
          >
            {showSlider ? (
              <BeforeAfterSlider before={roomImage!} after={canvasImage!} />
            ) : canvasImage ? (
              <img
                src={canvasImage}
                alt="Generated room"
                className={`h-full w-full object-contain transition-[filter] duration-700 ${
                  isFinal ? "blur-0" : "blur-2xl"
                }`}
              />
            ) : roomImage ? (
              <img
                src={roomImage}
                alt="Your room"
                className="h-full w-full object-contain opacity-70"
              />
            ) : busy ? (
              <div className="h-full w-full animate-pulse bg-gradient-to-br from-muted via-accent to-muted" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                Your redesigned room will appear here.
              </div>
            )}

            {/* Shop the look — overlaid inside the image */}
            {(loadingProducts || products.length > 0) && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 sm:p-4">
                <div className="pointer-events-auto rounded-xl border border-white/10 bg-black/55 p-2 backdrop-blur-md sm:p-3">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-white/90">
                      Shop the Look
                    </span>
                    <span className="text-[10px] text-white/60">
                      {products.length > 0 ? `${products.length} items` : "Loading…"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {loadingProducts && products.length === 0
                      ? Array.from({ length: 3 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-14 animate-pulse rounded-lg bg-white/10"
                          />
                        ))
                      : products.map((p, i) => (
                          <OverlayProductCard key={p.id} product={p} index={i + 1} />
                        ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function OverlayProductCard({
  product,
  index,
}: {
  product: Product;
  index: number;
}) {
  return (
    <a
      href={product.productUrl}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center gap-2 rounded-lg bg-white/95 p-2 text-foreground shadow-sm transition hover:bg-white"
    >
      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-muted">
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
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{product.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {product.brand}
        </p>
        <p className="text-xs font-semibold">
          {currency.format(Number(product.price) || 0)}
        </p>
      </div>
      <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground transition group-hover:text-foreground" />
    </a>
  );
}
