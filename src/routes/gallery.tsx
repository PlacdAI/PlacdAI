import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, Loader2, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/apiFetch";
import { AppNav } from "@/components/AppNav";
import type { Product } from "@/lib/types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type Item = {
  id: string;
  public_url: string;
  storage_path: string;
  style: string | null;
  created_at: string;
  expires_at: string;
  products: Product[] | null;
};

export const Route = createFileRoute("/gallery")({
  head: () => ({ meta: [{ title: "Your gallery — PlacdAI" }] }),
  component: Gallery,
});

// 🔧 Below this many ms remaining, the countdown badge turns red (matches
// the mockup: 4h remaining was red, 16h/23h/33h/69h were not). Adjust this
// single constant if you want the "expiring soon" warning to kick in
// earlier or later.
const URGENT_THRESHOLD_MS = 6 * 3_600_000; // 6h

// 🔧 Combined h+m label, no seconds (seconds would just cause a re-render
// every second for no real benefit at this granularity). Returns null once
// truly expired — callers use that to filter/purge rather than display
// "Expired" at all, since expired items shouldn't be shown.
function formatCountdown(expiresAt: string, now: number): { label: string; urgent: boolean } | null {
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const label = h >= 1 ? `${h}h ${m}m` : `${m}m`;
  return { label: `Expires in ${label}`, urgent: diff < URGENT_THRESHOLD_MS };
}

/** Small, self-contained confirmation modal — no external dialog library
 * dependency, so it doesn't assume a component that may not be set up
 * elsewhere in this project. */
function ConfirmDeleteModal({
  onConfirm,
  onCancel,
  isDeleting,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          className="absolute right-3 top-3 text-gray-400 transition hover:text-gray-600"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>

        <h2 className="mt-4 text-base font-semibold text-gray-900">Delete this design?</h2>
        <p className="mt-1 text-sm text-gray-500">
          This can't be undone — the image will be permanently removed.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Card({
  item,
  now,
  onDelete,
}: {
  item: Item;
  now: number;
  onDelete: (id: string) => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const countdown = formatCountdown(item.expires_at, now);

  const download = async () => {
    const r = await fetch(item.public_url);
    const b = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = `placdai-${item.id}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await apiFetch("/api/delete-generation", {
        method: "DELETE",
        body: JSON.stringify({ id: item.id, storage_path: item.storage_path }),
      });

      if (!res.ok) throw new Error("Failed to delete");

      onDelete(item.id); // Remove from UI
    } catch (e) {
      console.error(e);
      alert("Could not delete the image.");
      setIsDeleting(false);
      setConfirming(false);
    }
  };

  // Expired items are purged by the parent (see Gallery's auto-purge
  // effect) before they'd ever reach here — this is just a defensive
  // fallback in case a render slips in between expiry and purge.
  if (!countdown) return null;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <img
        src={item.public_url}
        alt={item.style ?? "Generated room"}
        className="h-56 w-full object-cover"
      />
      <span
        className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${
          countdown.urgent ? "bg-red-600" : "bg-black/70"
        }`}
      >
        {countdown.label}
      </span>

      {/* Action Buttons Group */}
      <div className="absolute right-2 top-2 flex items-center gap-2">
        {/* Hover-reveal: hidden by default, fades in on card hover (relies
            on the `group` class on the card's wrapping div). */}
        <button
          onClick={() => setConfirming(true)}
          disabled={isDeleting}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-md opacity-0 transition-opacity duration-200 hover:bg-white group-hover:opacity-100 disabled:opacity-50"
          title="Delete image"
        >
          {isDeleting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </button>
        <button
          onClick={download}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg hover:bg-primary/90"
        >
          <Download className="h-3 w-3" /> Download
        </button>
      </div>

      {(item.style || (item.products && item.products.length > 0)) && (
        <div className="border-t border-border/60 px-3 py-2.5">
          {item.style && <p className="text-xs text-muted-foreground">{item.style}</p>}

          {item.products && item.products.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Buyable products ({item.products.length})
              </p>
              {item.products.map((p, i) => (
                <a
                  key={p.id}
                  href={p.productUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-border bg-background p-1.5 transition hover:border-primary/40"
                >
                  <span className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = "https://placehold.co/72x72?text=%20";
                      }}
                    />
                    <span className="absolute left-0 top-0 flex h-3.5 w-3.5 items-center justify-center rounded-br-md bg-primary text-[9px] font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-medium">{p.name}</span>
                    <span className="block text-[10px] font-semibold text-muted-foreground">
                      {typeof p.price === "number" ? currency.format(p.price) : null}
                    </span>
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {confirming && (
        <ConfirmDeleteModal
          isDeleting={isDeleting}
          onCancel={() => setConfirming(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

function Gallery() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[] | null>(null);

  // 🔧 One shared clock for the whole page instead of each card running
  // its own interval — also what lets the auto-purge effect below and
  // each card's countdown/urgency color stay in sync with each other.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    apiFetch("/api/list-generations")
      .then((r) => r.json())
      .then((j) => setItems(j.items ?? []))
      .catch(() => setItems([]));
  }, [user]);

  // Removes the item from the state without needing to re-fetch the whole list
  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev?.filter((item) => item.id !== id) ?? null);
  };

  // 🔧 Auto-purge: as soon as an item's expires_at is in the past, drop it
  // from the gallery AND fire the same delete call the trash button uses,
  // so it's actually removed (storage + DB row), not just hidden from
  // view. Runs whenever the shared clock ticks or the item list changes.
  // Best-effort on the delete call — an item that's expired shouldn't
  // reappear even if this particular cleanup request fails; a later tick,
  // or the same check next time the gallery loads, will catch it again
  // since it's still gone from `items` either way.
  useEffect(() => {
    if (!items || items.length === 0) return;
    const expired = items.filter((i) => new Date(i.expires_at).getTime() <= now);
    if (expired.length === 0) return;

    setItems((prev) => prev?.filter((i) => new Date(i.expires_at).getTime() > now) ?? null);

    for (const item of expired) {
      apiFetch("/api/delete-generation", {
        method: "DELETE",
        body: JSON.stringify({ id: item.id, storage_path: item.storage_path }),
      }).catch((e) => console.error("Auto-purge delete failed for", item.id, e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, now]);

  // Newest first. Sorted here (not trusted from the API) so this holds
  // regardless of what order /api/list-generations happens to return.
  const sortedItems = useMemo(
    () =>
      items
        ? [...items].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          )
        : null,
    [items],
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <AppNav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-bold">Your gallery</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Saved rooms are kept for 72 hours (max 20). Download to keep them.
        </p>
        {sortedItems === null ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="mt-16 text-center text-sm text-muted-foreground">
            No generations yet — head back home and create one.
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedItems.map((i) => (
              <Card key={i.id} item={i} now={now} onDelete={handleRemoveItem} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}