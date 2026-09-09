import { TrustPoints } from "@/components/store/TrustBar";
import { FreeShippingProgress } from "@/components/store/FreeShippingProgress";
import { RecentlyViewed } from "@/components/store/RecentlyViewed";
import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Minus, Plus, X } from "lucide-react";
import { useCart } from "@/lib/store-sdk/react/hooks";
import { ProductImage } from "@/components/store/ProductImage";
import { EmptyState, ErrorState, Skeleton } from "@/components/store/StateBlocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/storefront/money";
import { errorMessage } from "@/lib/storefront/errors";

export const Route = createFileRoute("/warenkorb")({
  head: () => ({
    meta: [
      { title: "Warenkorb | Hauptshop" },
      { name: "description", content: "Deine ausgewählten Artikel im Überblick." },
      { property: "og:title", content: "Warenkorb | Hauptshop" },
      { property: "og:description", content: "Deine ausgewählten Artikel im Überblick." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const cart = useCart();
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  if (cart.isPending) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-5 py-16">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (cart.isError) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24">
        <ErrorState error={cart.error} onRetry={() => cart.refetch()} />
      </div>
    );
  }

  const data = cart.data;

  if (!data || data.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24">
        <h1 className="mb-8 text-3xl">Warenkorb</h1>
        <EmptyState title="Dein Warenkorb ist leer" hint="Sieh dich im Shop um." />
        <div className="mt-8 text-center">
          <Link to="/shop" className="bg-primary px-6 py-3 text-sm text-primary-foreground">
            Zum Shop
          </Link>
        </div>
      </div>
    );
  }

  const currency = data.currencyCode;

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <h1 className="text-3xl sm:text-4xl">Warenkorb</h1>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1.5fr_1fr]">
        <ul className="divide-y divide-border border-y border-border">
          {data.items.map((item) => (
            <li key={item.id} className="flex gap-4 py-6">
              <div className="size-24 shrink-0 overflow-hidden bg-secondary">
                <ProductImage src={item.image} title={item.title} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="font-display">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.variantTitle}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Entfernen"
                    onClick={() =>
                      cart.removeItem.mutate(item.id, {
                        onError: (error) => toast.error(errorMessage(error)),
                      })
                    }
                  >
                    <X className="size-4 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center border border-border">
                    <button
                      type="button"
                      aria-label="Menge verringern"
                      className="px-3 py-2 disabled:opacity-40"
                      disabled={item.quantity <= 1 || cart.updateItem.isPending}
                      onClick={() =>
                        cart.updateItem.mutate({ itemId: item.id, quantity: item.quantity - 1 })
                      }
                    >
                      <Minus className="size-3" />
                    </button>
                    <span className="min-w-10 text-center text-sm tabular-nums">{item.quantity}</span>
                    <button
                      type="button"
                      aria-label="Menge erhöhen"
                      className="px-3 py-2 disabled:opacity-40"
                      disabled={cart.updateItem.isPending}
                      onClick={() =>
                        cart.updateItem.mutate(
                          { itemId: item.id, quantity: item.quantity + 1 },
                          { onError: (error) => toast.error(errorMessage(error)) },
                        )
                      }
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                  <span className="text-sm tabular-nums">
                    {formatMoney(item.lineTotalMinor, currency)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit border border-border p-6">
          <h2 className="text-lg">Zusammenfassung</h2>
          <dl className="mt-6 space-y-3 text-sm">
            <Row label="Zwischensumme" value={formatMoney(data.totals.subtotalMinor, currency)} />
            {data.totals.discountMinor > 0 ? (
              <Row label="Rabatt" value={`− ${formatMoney(data.totals.discountMinor, currency)}`} />
            ) : null}
            <Row
              label="Versand"
              value={
                data.totals.shippingMinor > 0
                  ? formatMoney(data.totals.shippingMinor, currency)
                  : "Im Checkout"
              }
            />
            <Row label="enthaltene Steuer" value={formatMoney(data.totals.taxMinor, currency)} muted />
            <div className="flex justify-between border-t border-border pt-3 text-base">
              <dt>Gesamt</dt>
              <dd className="tabular-nums">{formatMoney(data.totals.totalMinor, currency)}</dd>
            </div>
          </dl>

          <form
            className="mt-6 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!code.trim()) return;
              cart.applyPromotion.mutate(code.trim(), {
                onSuccess: () => {
                  toast.success("Gutschein angewendet");
                  setCode("");
                },
                onError: (error) => toast.error(errorMessage(error)),
              });
            }}
          >
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Gutscheincode"
              aria-label="Gutscheincode"
            />
            <Button type="submit" variant="outline" disabled={cart.applyPromotion.isPending}>
              Einlösen
            </Button>
          </form>

          {data.promotionCodes.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {data.promotionCodes.map((promo) => (
                <li key={promo}>
                  <button
                    type="button"
                    className="flex items-center gap-2 border border-border px-3 py-1 text-xs"
                    onClick={() => cart.removePromotion.mutate(promo)}
                  >
                    {promo}
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <Button className="mt-6 w-full" size="lg" onClick={() => navigate({ to: "/checkout" })}>
            Zur Kasse
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Versandkosten und Steuern werden im Checkout final berechnet.
          </p>
          <FreeShippingProgress
            className="mt-6 border-t border-border pt-6"
            subtotalMinor={data.totals.subtotalMinor}
            currencyCode={currency}
          />
          <TrustPoints className="mt-6 border-t border-border pt-6" />
        </aside>
      </div>

      <RecentlyViewed />
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-muted-foreground" : ""}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
