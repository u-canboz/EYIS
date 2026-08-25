import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useProducts, useSearch } from "@/lib/store-sdk/react/hooks";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

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

function price(minor: number, currency: string) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: currency || "EUR" }).format(
    minor / 100,
  );
}

function StoreCatalog() {
  const [term, setTerm] = useState("");
  const list = useProducts({ pageSize: 24 });
  const search = useSearch(term);
  const active = term.trim().length > 1 ? search : list;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">Katalog</h1>
      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Produkte suchen…"
        aria-label="Produkte suchen"
      />

      {active.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : active.error ? (
        <p className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
          {(active.error as Error).message}
        </p>
      ) : (active.data?.data ?? []).length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Keine Produkte gefunden.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(active.data?.data ?? []).map((product) => (
            <Link key={product.id} to="/store/produkt/$handle" params={{ handle: product.handle }}>
              <Card className="h-full transition hover:border-primary">
                <CardContent className="space-y-2 pt-6">
                  {product.image ? (
                    <img
                      src={product.image.url}
                      alt={product.image.alt ?? product.title}
                      className="aspect-square w-full rounded-md object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <h2 className="font-medium">{product.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {price(product.price?.unitAmountMinor ?? 0, product.price?.currencyCode ?? "EUR")}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
