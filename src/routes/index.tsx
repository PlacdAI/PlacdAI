import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import { Sparkles, Upload, Wand2 } from "lucide-react";
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
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";

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
    reader.onload = () => setRoomImage(reader.result as string);
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

    // Step 1: pick products (parallel with generate step)
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

    // Step 2: stream redecorated room
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

    // Step 3: sequential product swaps
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
              productImageUrl: p.imageUrl,
              productName: p.name,
              productCategory: p.category,
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <Toaster richColors position="top-center" />

      {/* Hero */}
      <header className="mx-auto max-w-6xl px-6 pt-16 pb-10 text-center">
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

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 pb-24 lg:grid-cols-[1fr_320px]">
        {/* Left: controls + canvas */}
        <div className="space-y-6">
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

            {roomImage && !canvasImage && (
              <div className="mt-4">
                <p className="mb-2 text-xs text-muted-foreground">Your room:</p>
                <img
                  src={roomImage}
                  alt="Uploaded room"
                  className="max-h-40 rounded-lg border border-border object-cover"
                />
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                AI Canvas
              </h2>
              {statusText && (
                <span className="animate-pulse text-xs text-muted-foreground">
                  {statusText}
                </span>
              )}
            </div>
            <div className="relative aspect-video w-full bg-muted">
              {canvasImage ? (
                <img
                  src={canvasImage}
                  alt="Generated room"
                  className={`h-full w-full object-cover transition-[filter] duration-700 ${
                    isFinal ? "blur-0" : "blur-2xl"
                  }`}
                />
              ) : busy ? (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="h-full w-full animate-pulse bg-gradient-to-br from-muted via-accent to-muted" />
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                  Your redesigned room will appear here.
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right: shop-the-look sidebar */}
        <aside className="lg:sticky lg:top-6 lg:h-fit">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Shop the Look
            </h3>
            <div className="space-y-3">
              {loadingProducts ? (
                <>
                  <ProductCardSkeleton />
                  <ProductCardSkeleton />
                  <ProductCardSkeleton />
                </>
              ) : products.length > 0 ? (
                products.map((p) => <ProductCard key={p.id} product={p} />)
              ) : (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Generate a design to see matching furniture.
                </p>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
