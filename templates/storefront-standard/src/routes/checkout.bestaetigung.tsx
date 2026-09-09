import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCommerce } from "@/lib/store-sdk/react/provider";
import type { StoreOrder } from "@/lib/store-sdk";
import { ErrorState, Skeleton } from "@/components/store/StateBlocks";
import { formatDate, formatMoney } from "@/lib/storefront/money";

export const Route = createFileRoute("/checkout/bestaetigung")({
  head: () => ({
    meta: [
      { title: "Bestellung bestätigt | Hauptshop" },
      { name: "description", content: "Deine Bestellung ist eingegangen." },
      { property: "og:title", content: "Bestellung bestätigt | Hauptshop" },
      { property: "og:description", content: "Deine Bestellung ist eingegangen." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const client = useCommerce();
  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [error, setError] = useState<unknown>(null);
  const redeemed = useRef(false);

  useEffect(() => {
    if (redeemed.current) return;
    redeemed.current = true;

    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");
    // Der Token wird genau einmal eingelöst und danach aus der Adresse entfernt.
    url.searchParams.delete("token");
    window.history.replaceState({}, "", url.pathname + (url.search || ""));

    if (!token) {
      setError(new Error("Für diese Seite fehlt der Bestätigungslink."));
      return;
    }

    client.orders
      .redeemConfirmation(token)
      .then(setOrder)
      .catch(setError);
  }, [client]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24">
        <ErrorState error={error} />
        <div className="mt-6 text-center">
          <Link to="/bestellung/gast" className="text-sm underline underline-offset-4">
            Bestellung per E-Mail-Link öffnen
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-5 py-24">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-24">
      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Vielen Dank</p>
      <h1 className="mt-4 text-3xl sm:text-4xl">Bestellung {order.orderNumber} ist eingegangen</h1>
      <p className="mt-4 text-muted-foreground">
        Wir haben dir eine Bestätigung per E-Mail geschickt. Bestelldatum: {formatDate(order.placedAt)}.
      </p>

      <ul className="mt-10 divide-y divide-border border-y border-border text-sm">
        {order.items.map((item, index) => (
          <li key={index} className="flex justify-between gap-4 py-4">
            <span>
              {item.quantity} × {item.title}
              {item.variantTitle ? (
                <span className="block text-xs text-muted-foreground">{item.variantTitle}</span>
              ) : null}
            </span>
            <span className="tabular-nums">{formatMoney(item.lineTotalMinor, order.currencyCode)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex justify-between text-base">
        <span>Gesamt</span>
        <span className="tabular-nums">{formatMoney(order.totalMinor, order.currencyCode)}</span>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link to="/shop" className="bg-primary px-6 py-3 text-sm text-primary-foreground">
          Weiter einkaufen
        </Link>
        <Link to="/konto" className="border border-border px-6 py-3 text-sm">
          Zum Kundenkonto
        </Link>
      </div>
    </div>
  );
}
