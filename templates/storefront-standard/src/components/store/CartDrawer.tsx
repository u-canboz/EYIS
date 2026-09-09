import { Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/store-sdk/react/hooks";
import { errorMessage } from "@/lib/storefront/errors";
import { formatMoney } from "@/lib/storefront/money";
import { ProductImage } from "./ProductImage";
import { FreeShippingProgress } from "./FreeShippingProgress";

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cart = useCart();
  const navigate = useNavigate();
  const data = cart.data;

  return (
    <div className={open ? "fixed inset-0 z-60 overflow-hidden" : "pointer-events-none fixed inset-0 z-60 overflow-hidden"} aria-hidden={!open}>
      <Button
        variant="ghost"
        aria-label="Warenkorb schließen"
        onClick={onClose}
        className={`absolute inset-0 h-full w-full rounded-none bg-foreground/35 transition-opacity duration-300 hover:bg-foreground/35 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        aria-label="Warenkorb"
        className={`fixed inset-y-0 right-0 flex w-[min(92vw,28rem)] flex-col bg-background shadow-[var(--elevation-2)] transition-transform duration-500 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center border-b border-border px-5">
          <div className="flex min-w-0 items-center gap-3">
            <ShoppingBag className="size-5 shrink-0 text-brass" aria-hidden />
            <h2 className="truncate font-display text-2xl">Dein Warenkorb</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Warenkorb schließen">
            <X />
          </Button>
        </div>

        {!data || data.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <ShoppingBag className="size-9 text-brass" aria-hidden />
            <p className="mt-5 font-display text-2xl">Noch ist hier Platz.</p>
            <p className="mt-2 text-sm text-muted-foreground">Entdecke unser Sortiment.</p>
            <Button asChild className="mt-7" onClick={onClose}>
              <Link to="/shop">Sortiment entdecken</Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-border overflow-y-auto px-5">
              {data.items.map((item) => (
                <li key={item.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 py-5">
                   <div className="aspect-square overflow-hidden border border-border bg-card">
                    <ProductImage src={item.image} title={item.title} />
                  </div>
                  <div className="min-w-0">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <div className="min-w-0">
                        <p className="font-display text-lg leading-tight">{item.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.variantTitle}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${item.title} entfernen`}
                        onClick={() => cart.removeItem.mutate(item.id, { onError: (error) => toast.error(errorMessage(error)) })}
                      >
                        <X />
                      </Button>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="flex h-11 items-center border border-border">
                        <Button variant="ghost" size="icon" disabled={item.quantity <= 1} aria-label="Menge verringern" onClick={() => cart.updateItem.mutate({ itemId: item.id, quantity: item.quantity - 1 })}><Minus /></Button>
                        <span className="min-w-7 text-center text-sm tabular-nums">{item.quantity}</span>
                        <Button variant="ghost" size="icon" aria-label="Menge erhöhen" onClick={() => cart.updateItem.mutate({ itemId: item.id, quantity: item.quantity + 1 })}><Plus /></Button>
                      </div>
                      <span className="shrink-0 text-sm tabular-nums">{formatMoney(item.lineTotalMinor, data.currencyCode)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-border bg-surface p-5 pb-safe">
              <FreeShippingProgress
                className="mb-4"
                subtotalMinor={data.totals.subtotalMinor}
                currencyCode={data.currencyCode}
              />
              <div className="flex items-baseline justify-between">
                <span className="text-sm">Zwischensumme</span>
                <strong className="font-display text-2xl font-normal tabular-nums">{formatMoney(data.totals.subtotalMinor, data.currencyCode)}</strong>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Versand und Steuern werden in der Kasse final berechnet.</p>
              <Button className="mt-5 w-full" size="lg" onClick={() => { onClose(); void navigate({ to: "/checkout" }); }}>Sicher zur Kasse</Button>
              <Button asChild variant="link" className="mt-2 w-full" onClick={onClose}><Link to="/warenkorb">Warenkorb bearbeiten</Link></Button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}