import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCart } from "@/lib/store-sdk/react/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/store/warenkorb")({
  head: () => ({
    meta: [
      { title: "Warenkorb – Referenz-Storefront" },
      {
        name: "description",
        content: "Warenkorb der Referenz-Storefront mit Mengen, Gutscheincodes und Summen.",
      },
      { property: "og:title", content: "Warenkorb – Referenz-Storefront" },
      { property: "og:description", content: "Positionen, Rabatte und Summen im Überblick." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StoreCartPage,
});

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: currency || "EUR" }).format(minor / 100);

function StoreCartPage() {
  const cart = useCart();
  const [code, setCode] = useState("");

  if (cart.isLoading) return <Skeleton className="h-64 w-full" />;
  const data = cart.data;

  if (!data || data.items.length === 0)
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold">Warenkorb</h1>
        <p className="text-sm text-muted-foreground">Der Warenkorb ist leer.</p>
        <Button asChild variant="outline">
          <Link to="/store">Zum Katalog</Link>
        </Button>
      </div>
    );

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">Warenkorb</h1>

      <ul className="divide-y rounded-lg border">
        {data.items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.variantTitle}</p>
            </div>
            <Input
              type="number"
              min={1}
              className="w-20"
              aria-label={`Menge ${item.title}`}
              value={item.quantity}
              onChange={(e) =>
                cart.updateItem.mutate({ itemId: item.id, quantity: Number(e.target.value) || 1 })
              }
            />
            <span className="w-24 text-right text-sm">
              {money(item.lineTotalMinor, data.currencyCode)}
            </span>
            <Button variant="ghost" size="sm" onClick={() => cart.removeItem.mutate(item.id)}>
              Entfernen
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-56"
          placeholder="Gutscheincode"
          aria-label="Gutscheincode"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Button
          variant="outline"
          disabled={!code.trim() || cart.applyPromotion.isPending}
          onClick={() =>
            cart.applyPromotion.mutate(code.trim(), {
              onSuccess: () => {
                setCode("");
                toast.success("Code geprüft.");
              },
              onError: (e: Error) => toast.error(e.message),
            })
          }
        >
          Einlösen
        </Button>
      </div>

      {data.promotionCodes.length ? (
        <div className="flex flex-wrap gap-2 text-sm">
          {data.promotionCodes.map((c) => (
            <button
              key={c}
              className="rounded-full border px-3 py-1"
              onClick={() => cart.removePromotion.mutate(c)}
            >
              {c} ✕
            </button>
          ))}
        </div>
      ) : null}

      <dl className="space-y-1 rounded-lg border p-4 text-sm">
        <div className="flex justify-between">
          <dt>Zwischensumme</dt>
          <dd>{money(data.totals.subtotalMinor, data.currencyCode)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Rabatt</dt>
          <dd>−{money(data.totals.discountMinor, data.currencyCode)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Steuer</dt>
          <dd>{money(data.totals.taxMinor, data.currencyCode)}</dd>
        </div>
        <div className="flex justify-between font-medium">
          <dt>Gesamt</dt>
          <dd>{money(data.totals.totalMinor, data.currencyCode)}</dd>
        </div>
      </dl>

      <Button asChild className="w-full">
        <Link to="/store/checkout">Zur Kasse</Link>
      </Button>
    </div>
  );
}
