import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useProducts, useSearch } from "@/lib/store-sdk/react/hooks";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ProductGrid,
  ProductMedia,
  StoreContainer,
  StoreHeading,
  StoreNotice,
  formatPrice,
} from "@/components/storefront/StoreChrome";

export const Route = createFileRoute("/store/")({
  head: () => ({
    meta: [
      { title: "Katalog – Referenz-Storefront" },
      {
        name: "description",
        content:
          "Produkte der Referenz-Storefront: vollständig über das öffentliche Commerce SDK geladen.",
      },
      { property: "og:title", content: "Katalog – Referenz-Storefront" },
      {
        property: "og:description",
        content: "Beispielhafte Storefront, die ausschließlich die öffentliche Store API nutzt.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StoreCatalog,
});

function StoreCatalog() {
  const [term, setTerm] = useState("");
  const list = useProducts({ pageSize: 24 });
  const search = useSearch(term);
  const active = term.trim().length > 1 ? search : list;
  const products = active.data?.data ?? [];

  return (
    <StoreContainer wide className="py-8 sm:py-12">
      <StoreHeading
        eyebrow="Kollektion"
        title="Ausgewählte Stücke"
        description="Sorgfältig kuratiert, in kleinen Auflagen gefertigt und direkt versandbereit."
      />

      <div className="relative mt-7 mb-9 max-w-md">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Produkte suchen…"
          aria-label="Produkte suchen"
          className="h-11 pl-9"
        />
      </div>

      {active.isLoading ? (
        <ProductGrid>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square w-full rounded-2xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </ProductGrid>
      ) : active.error ? (
        <StoreNotice
          tone="error"
          title="Der Katalog konnte nicht geladen werden"
          description={(active.error as Error).message}
        />
      ) : products.length === 0 ? (
        <StoreNotice
          title="Keine Produkte gefunden"
          description="Versuche einen anderen Suchbegriff oder sieh dir die gesamte Kollektion an."
        />
      ) : (
        <ProductGrid>
          {products.map((product) => (
            <Link
              key={product.id}
              to="/store/produkt/$handle"
              params={{ handle: product.handle }}
              className="group min-w-0"
            >
              <ProductMedia src={product.image?.url} alt={product.image?.alt ?? product.title} />
              <h2 className="mt-3 min-w-0 text-sm font-medium wrap-anywhere text-pretty sm:text-base">
                {product.title}
              </h2>
              <p className="mt-1 text-sm wrap-anywhere text-muted-foreground tabular-nums">
                {formatPrice(
                  product.price?.unitAmountMinor ?? 0,
                  product.price?.currencyCode ?? "EUR",
                )}
              </p>
            </Link>
          ))}
        </ProductGrid>
      )}
    </StoreContainer>
  );
}
