import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function ProductCard({ product }: { product: Product }) {
  return (
    <div className="group flex gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition hover:shadow-md">
      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover transition group-hover:scale-105"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              "https://placehold.co/160x160?text=No+Image";
          }}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {product.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {product.brand}
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {currency.format(Number(product.price) || 0)}
          </p>
        </div>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="mt-2 h-7 w-fit text-xs"
        >
          <a href={product.productUrl} target="_blank" rel="noreferrer">
            Shop <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        </Button>
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-card p-3">
      <div className="h-20 w-20 flex-shrink-0 animate-pulse rounded-lg bg-muted" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
