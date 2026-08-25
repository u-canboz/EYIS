import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCommerce } from "@/lib/store-sdk/react/provider";
import type { StoreOrder } from "@/lib/store-sdk";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/store/bestaetigung")({
  validateSearch: (search: Record<string, unknown>) => ({
    session: typeof search["session"] === "string" ? (search["session"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Bestellbestätigung – Referenz-Storefront" },
      {
        name: "description",
        content:
          "Bestellbestätigung nach erfolgreicher Zahlung, abgesichert über einen kurzlebigen Einmal-Token.",
      },
      { property: "og:title", content: "Bestellbestätigung – Referenz-Storefront" },
      { property: "og:description", content: "Details zur abgeschlossenen Bestellung." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StoreConfirmationPage,
});

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: currency || "EUR" }).format(
    minor / 100,
  );

function StoreConfirmationPage() {
  const client = useCommerce();
  const search = Route.useSearch();
  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const sessionId =
      search.session ??
      (typeof window === "undefined"
        ? null
        : window.sessionStorage.getItem("commerce.paymentSessionId"));
    if (!sessionId) {
      setError("Keine Zahlungssitzung gefunden.");
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      try {
        const status = await client.payments.status(sessionId);
        if (cancelled) return;
        if (status.confirmationToken) {
          // Single use, short lived, scoped: redeemed immediately, never stored.
          const result = await client.orders.redeemConfirmation(status.confirmationToken);
          if (cancelled) return;
          window.sessionStorage.removeItem("commerce.paymentSessionId");
          setOrder(result);
          return;
        }
        if (status.status === "failed" || status.status === "cancelled") {
          setError("Die Zahlung wurde nicht abgeschlossen.");
          return;
        }
        if (++attempts > 20) {
          setError("Zahlung wird noch verarbeitet. Bitte später erneut prüfen.");
          return;
        }
        setTimeout(poll, 1500);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [client, search.session]);

  if (error)
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold">Bestellung</h1>
        <p className="text-sm text-destructive">{error}</p>
        <Button asChild variant="outline">
          <Link to="/store">Zum Katalog</Link>
        </Button>
      </div>
    );

  if (!order) return <Skeleton className="h-56 w-full" />;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">Vielen Dank für die Bestellung</h1>
      <p className="text-sm text-muted-foreground">Bestellnummer: {order.orderNumber}</p>

      <ul className="divide-y rounded-lg border">
        {order.items.map((item, index) => (
          <li
            key={`${item.sku ?? item.title}-${index}`}
            className="flex justify-between gap-3 p-4 text-sm"
          >
            <span>
              {item.quantity} × {item.title}
            </span>
            <span>{money(item.lineTotalMinor, order.currencyCode)}</span>
          </li>
        ))}
      </ul>

      <p className="text-right font-medium">
        Gesamt: {money(order.totalMinor, order.currencyCode)}
      </p>

      <Button asChild variant="outline">
        <Link to="/store">Weiter einkaufen</Link>
      </Button>
    </div>
  );
}
