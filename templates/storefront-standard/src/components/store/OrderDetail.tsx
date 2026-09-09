import type { StoreOrder } from "@/lib/store-sdk";
import { formatDate, formatMoney } from "@/lib/storefront/money";

const DOCUMENT_LABELS: Record<string, string> = {
  invoice: "Rechnung",
  credit_note: "Gutschrift",
  delivery_note: "Lieferschein",
};

export function OrderDetail({
  order,
  onDocument,
}: {
  order: StoreOrder;
  onDocument?: (documentId: string) => void;
}) {
  const currency = order.currencyCode;

  return (
    <div className="mt-6">
      <h1 className="text-3xl">Bestellung {order.orderNumber}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {formatDate(order.placedAt)} · Zahlung: {order.paymentStatus} · Versand: {order.fulfillmentStatus}
      </p>

      <ul className="mt-8 divide-y divide-border border-y border-border text-sm">
        {order.items.map((item, index) => (
          <li key={index} className="flex justify-between gap-4 py-4">
            <span>
              {item.quantity} × {item.title}
              {item.variantTitle ? (
                <span className="block text-xs text-muted-foreground">{item.variantTitle}</span>
              ) : null}
            </span>
            <span className="tabular-nums">{formatMoney(item.lineTotalMinor, currency)}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-6 space-y-2 text-sm">
        <Row label="Zwischensumme" value={formatMoney(order.subtotalMinor, currency)} />
        {order.discountMinor > 0 ? (
          <Row label="Rabatt" value={`− ${formatMoney(order.discountMinor, currency)}`} />
        ) : null}
        <Row label="Versand" value={formatMoney(order.shippingMinor, currency)} />
        <Row label="enthaltene Steuer" value={formatMoney(order.taxMinor, currency)} />
        <div className="flex justify-between border-t border-border pt-3 text-base">
          <dt>Gesamt</dt>
          <dd className="tabular-nums">{formatMoney(order.totalMinor, currency)}</dd>
        </div>
      </dl>

      {order.addresses.length > 0 ? (
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {order.addresses.map((entry) => (
            <div key={entry.type}>
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
                {entry.type === "billing" ? "Rechnungsadresse" : "Lieferadresse"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed">
                {[
                  `${entry.address["firstName"] ?? ""} ${entry.address["lastName"] ?? ""}`.trim(),
                  entry.address["company"],
                  entry.address["street"],
                  `${entry.address["postalCode"] ?? ""} ${entry.address["city"] ?? ""}`.trim(),
                  entry.address["countryCode"],

                ]
                  .filter(Boolean)
                  .map((line, index) => (
                    <span key={index} className="block">
                      {line}
                    </span>
                  ))}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {order.tracking.length > 0 ? (
        <div className="mt-10">
          <h2 className="text-lg">Sendungsverfolgung</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {order.tracking.map((tracking, index) => (
              <li key={index} className="border border-border p-4">
                <p>
                  {tracking.carrier} · {tracking.status}
                </p>
                {tracking.trackingUrl ? (
                  <a
                    href={tracking.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline underline-offset-4"
                  >
                    Sendung verfolgen ({tracking.trackingNumber})
                  </a>
                ) : null}
                {tracking.events.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {tracking.events.map((event, eventIndex) => (
                      <li key={eventIndex}>
                        {formatDate(event.occurredAt)} — {event.description ?? event.code}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {order.documents.length > 0 && onDocument ? (
        <div className="mt-10">
          <h2 className="text-lg">Belege</h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            {order.documents.map((document) => (
              <li key={document.id}>
                <button
                  type="button"
                  onClick={() => onDocument(document.id)}
                  className="border border-border px-4 py-2 text-sm hover:bg-secondary"
                >
                  {DOCUMENT_LABELS[document.kind] ?? document.kind}
                  {document.number ? ` ${document.number}` : ""}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {order.returns.length > 0 ? (
        <div className="mt-10">
          <h2 className="text-lg">Retouren</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {order.returns.map((entry) => (
              <li key={entry.id}>
                {entry.returnNumber} · {entry.status} · {formatDate(entry.requestedAt)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
