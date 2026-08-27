import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCommerce } from "@/lib/store-sdk/react/provider";
import type { StoreOrder } from "@/lib/store-sdk";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  StoreContainer,
  StoreHeading,
  StoreNotice,
  formatPrice,
} from "@/components/storefront/StoreChrome";

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
      <StoreContainer className="py-8 sm:py-12">
        <StoreHeading title="Bestellung" />
        <div className="mt-6">
          <StoreNotice
            tone="error"
            title="Bestellung konnte nicht bestätigt werden"
            description={error}
            action={
              <Button asChild variant="outline" className="mt-2 h-11">
                <Link to="/store">Zum Katalog</Link>
              </Button>
            }
          />
        </div>
      </StoreContainer>
    );

  if (!order)
    return (
      <StoreContainer className="py-8 sm:py-12">
        <StoreHeading title="Bestellung" />
        <div className="mt-7 space-y-4">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </StoreContainer>
    );

  return (
    <StoreContainer className="py-8 sm:py-12">
      <StoreHeading
        eyebrow="Bestätigt"
        title="Vielen Dank für die Bestellung"
        description={
          <span className="min-w-0 break-words">Bestellnummer: {order.orderNumber}</span>
        }
      />

      <ul className="mt-7 min-w-0 divide-y divide-border rounded-2xl border border-border">
        {order.items.map((item, index) => (
          <li
            key={`${item.sku ?? item.title}-${index}`}
            className="flex min-w-0 items-start justify-between gap-3 p-4 text-sm"
          >
            <span className="min-w-0 text-pretty">
              {item.quantity} × {item.title}
            </span>
            <span className="shrink-0 tabular-nums">
              {formatPrice(item.lineTotalMinor, order.currencyCode)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-right text-base font-semibold tabular-nums">
        Gesamt: {formatPrice(order.totalMinor, order.currencyCode)}
      </p>

      <Button asChild variant="outline" className="mt-6 h-12 w-full text-base">
        <Link to="/store">Weiter einkaufen</Link>
      </Button>
    </StoreContainer>
  );
}
