import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCart, useProduct } from "@/lib/store-sdk/react/hooks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/store/produkt/$handle")({
  head: () => ({
    meta: [
      { title: "Produkt – Referenz-Storefront" },
      {
        name: "description",
        content: "Produktdetails und Varianten, geladen über das öffentliche Commerce SDK.",
      },
      { property: "og:title", content: "Produkt – Referenz-Storefront" },
      { property: "og:description", content: "Produktdetails der Referenz-Storefront." },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StoreProductPage,
});

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: currency || "EUR" }).format(
    minor / 100,
  );

function StoreProductPage() {
  const { handle } = Route.useParams();
  const navigate = useNavigate();
  const product = useProduct(handle);
  const cart = useCart();
  const [variantId, setVariantId] = useState<string | null>(null);

  if (product.isLoading) return <Skeleton className="h-72 w-full" />;
  if (product.error)
    return <p className="text-sm text-destructive">{(product.error as Error).message}</p>;
  const data = product.data;
  if (!data) return null;

  const selected = data.variants.find((v) => v.id === variantId) ?? data.variants[0] ?? null;

  return (
    <article className="space-y-6">
      <Link to="/store" className="text-sm text-muted-foreground hover:underline">
        ← Katalog
      </Link>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          {data.images.slice(0, 3).map((img) => (
            <img
              key={img.url}
              src={img.url}
              alt={img.alt ?? data.title}
              className="w-full rounded-lg object-cover"
              loading="lazy"
            />
          ))}
        </div>
        <div className="space-y-4">
          <h1 className="font-display text-2xl font-semibold">{data.title}</h1>
          {data.subtitle ? <p className="text-muted-foreground">{data.subtitle}</p> : null}
          <p className="text-xl font-medium">
            {selected?.price
              ? money(selected.price.unitAmountMinor, selected.price.currencyCode)
              : "Preis auf Anfrage"}
          </p>
          <Badge variant={selected?.availability === "out_of_stock" ? "destructive" : "secondary"}>
            {selected?.availability === "out_of_stock" ? "Nicht verfügbar" : "Verfügbar"}
          </Badge>

          {data.variants.length > 1 ? (
            <div className="space-y-2">
              <label htmlFor="variant" className="text-sm font-medium">
                Variante
              </label>
              <select
                id="variant"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={selected?.id ?? ""}
                onChange={(e) => setVariantId(e.target.value)}
              >
                {data.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <Button
            disabled={
              !selected || selected.availability === "out_of_stock" || cart.addItem.isPending
            }
            onClick={() =>
              selected &&
              cart.addItem.mutate(
                { variantId: selected.id, quantity: 1 },
                {
                  onSuccess: () => {
                    toast.success("Zum Warenkorb hinzugefügt.");
                    void navigate({ to: "/store/warenkorb" });
                  },
                  onError: (e: Error) => toast.error(e.message),
                },
              )
            }
          >
            In den Warenkorb
          </Button>

          {data.description ? (
            <p className="whitespace-pre-line text-sm text-muted-foreground">{data.description}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
