import { createFileRoute, Link } from "@tanstack/react-router";
import { usePaymentConfirmation } from "@/lib/store-sdk/react/use-payment-confirmation";
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
  const { order, error, testAvailable, confirming, confirmTest } = usePaymentConfirmation();

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
        {testAvailable ? (
          <div className="rounded-xl border border-border p-6">
            <h1 className="text-2xl">Testzahlung</h1>
            <p className="mt-3 text-muted-foreground">Es wird kein Geld abgebucht.</p>
            <button
              onClick={() => void confirmTest()}
              disabled={confirming}
              className="mt-6 bg-primary px-6 py-3 text-primary-foreground disabled:opacity-50"
            >
              {confirming ? "Wird bestätigt …" : "Testzahlung bestätigen"}
            </button>
          </div>
        ) : (
          <div role="status" aria-label="Zahlung wird geprüft" className="space-y-4">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-24">
      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Vielen Dank</p>
      <h1 className="mt-4 text-3xl sm:text-4xl">Bestellung {order.orderNumber} ist eingegangen</h1>
      <p className="mt-4 text-muted-foreground">
        Deine Bestellung wurde gespeichert. Bestelldatum: {formatDate(order.placedAt)}.
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
            <span className="tabular-nums">
              {formatMoney(item.lineTotalMinor, order.currencyCode)}
            </span>
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
