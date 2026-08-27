import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useCart } from "@/lib/store-sdk/react/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  StoreContainer,
  StoreHeading,
  StoreNotice,
  formatPrice,
} from "@/components/storefront/StoreChrome";

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

function StoreCartPage() {
  const cart = useCart();
  const [code, setCode] = useState("");

  if (cart.isLoading)
    return (
      <StoreContainer className="py-8">
        <Skeleton className="h-64 w-full rounded-2xl" />
      </StoreContainer>
    );

  const data = cart.data;

  if (!data || data.items.length === 0)
    return (
      <StoreContainer className="py-8 sm:py-12">
        <StoreHeading title="Warenkorb" />
        <div className="mt-6">
          <StoreNotice
            title="Dein Warenkorb ist leer"
            description="Sieh dich in der Kollektion um – wir legen alles versandfertig für dich zurück."
            action={
              <Button asChild className="mt-2 h-11">
                <Link to="/store">Zur Kollektion</Link>
              </Button>
            }
          />
        </div>
      </StoreContainer>
    );

  return (
    <StoreContainer className="py-8 sm:py-12">
      <StoreHeading title="Warenkorb" />

      <ul className="mt-7 min-w-0 divide-y divide-border rounded-2xl border border-border">
        {data.items.map((item) => (
          <li key={item.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-pretty">{item.title}</p>
              {item.variantTitle ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{item.variantTitle}</p>
              ) : null}
              <div className="mt-3 flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  className="h-11 w-20 tabular-nums"
                  aria-label={`Menge ${item.title}`}
                  value={item.quantity}
                  onChange={(e) =>
                    cart.updateItem.mutate({
                      itemId: item.id,
                      quantity: Number(e.target.value) || 1,
                    })
                  }
                />
                <Button
                  variant="ghost"
                  className="size-11 shrink-0"
                  aria-label={`${item.title} entfernen`}
                  onClick={() => cart.removeItem.mutate(item.id)}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
            <span className="shrink-0 text-sm font-medium tabular-nums">
              {formatPrice(item.lineTotalMinor, data.currencyCode)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Input
          className="h-11 sm:max-w-64"
          placeholder="Gutscheincode"
          aria-label="Gutscheincode"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Button
          variant="outline"
          className="h-11"
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
        <div className="mt-3 flex flex-wrap gap-2">
          {data.promotionCodes.map((c) => (
            <button
              key={c}
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm"
              onClick={() => cart.removePromotion.mutate(c)}
            >
              <span className="min-w-0 break-words">{c}</span>
              <X className="size-3.5 shrink-0" aria-hidden />
            </button>
          ))}
        </div>
      ) : null}

      <dl className="mt-7 rounded-2xl border border-border p-5 text-sm">
        <div className="flex justify-between gap-4 py-1">
          <dt className="text-muted-foreground">Zwischensumme</dt>
          <dd className="tabular-nums">{formatPrice(data.totals.subtotalMinor, data.currencyCode)}</dd>
        </div>
        <div className="flex justify-between gap-4 py-1">
          <dt className="text-muted-foreground">Rabatt</dt>
          <dd className="tabular-nums">
            −{formatPrice(data.totals.discountMinor, data.currencyCode)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-1">
          <dt className="text-muted-foreground">Steuer</dt>
          <dd className="tabular-nums">{formatPrice(data.totals.taxMinor, data.currencyCode)}</dd>
        </div>
        <div className="mt-2 flex justify-between gap-4 border-t border-border pt-3">
          <dt className="font-medium">Gesamt</dt>
          <dd className="text-base font-semibold tabular-nums">
            {formatPrice(data.totals.totalMinor, data.currencyCode)}
          </dd>
        </div>
      </dl>

      <Button asChild className="mt-6 h-12 w-full text-base">
        <Link to="/store/checkout">Zur Kasse</Link>
      </Button>
    </StoreContainer>
  );
}
