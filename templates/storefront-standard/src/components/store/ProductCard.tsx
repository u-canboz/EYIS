import { Link } from "@tanstack/react-router";
import type { StoreProductSummary } from "@/lib/store-sdk";
import { formatMoney } from "@/lib/storefront/money";
import { ProductImage } from "./ProductImage";

const AVAILABILITY: Record<string, string> = {
  low_stock: "Nur noch wenige",
  out_of_stock: "Ausverkauft",
  backorder: "Nachbestellt",
};

export function ProductCard({ product }: { product: StoreProductSummary }) {
  const note = AVAILABILITY[product.availability];
  return (
    <Link
      to="/produkt/$handle"
      params={{ handle: product.handle }}
      className="group block focus-visible:outline-none"
    >
      <div className="relative aspect-3/4 w-full overflow-hidden border border-border bg-card">
        <ProductImage
          src={product.image?.url}
          alt={product.image?.alt}
          title={product.title}
          className="transition-transform duration-700 ease-out group-hover:scale-[1.045]"
        />
        {note ? (
          <span className="absolute left-3 top-3 bg-background/90 px-2 py-1 text-[11px] uppercase tracking-widest text-muted-foreground">
            {note}
          </span>
        ) : null}
      </div>
      <div className="mt-4 grid min-w-0 gap-1 sm:mt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-4">
        <h3 className="min-w-0 font-display text-lg leading-snug underline-offset-4 group-hover:underline">
          {product.title}
        </h3>
        {product.price ? (
          <span className="shrink-0 text-sm tabular-nums">
            {formatMoney(product.price.unitAmountMinor, product.price.currencyCode)}
          </span>
        ) : null}
      </div>
      {product.subtitle ? (
        <p className="mt-1 text-sm text-muted-foreground">{product.subtitle}</p>
      ) : null}
    </Link>
  );
}
