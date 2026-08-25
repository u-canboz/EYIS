import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getOrderFn,
  setOrderNoteFn,
  cancelOrderFn,
  createRefundFn,
} from "@/lib/commerce/orders/order.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { formatMoney } from "@/lib/commerce/money";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  FULFILLMENT_STATUS_LABELS,
  REFUND_STATUS_LABELS,
} from "@/lib/commerce/payments/payment-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/bestellungen/$orderId")({
  head: () => ({
    meta: [
      { title: "Bestelldetails – Commerce OS" },
      {
        name: "description",
        content: "Positionen, Adressen, Zahlungsbuchungen, Erstattungen und Verlauf einer Bestellung.",
      },
      { property: "og:title", content: "Bestelldetails – Commerce OS" },
      { property: "og:description", content: "Vollständige Historie einer Bestellung." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderDetailPage,
});

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const { organizationId, can } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const [note, setNote] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const get = useServerFn(getOrderFn);
  const saveNote = useServerFn(setOrderNoteFn);
  const cancel = useServerFn(cancelOrderFn);
  const refund = useServerFn(createRefundFn);

  const order = useQuery({
    queryKey: ["order", organizationId, orderId],
    enabled: !!organizationId,
    queryFn: () => get({ data: { organizationId, orderId } }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["order", organizationId, orderId] });
  const fail = (e: Error) => toast.error(e.message);

  const noteMutation = useMutation({
    mutationFn: () => saveNote({ data: { organizationId, orderId, note: note ?? "" } }),
    onSuccess: () => {
      toast.success("Notiz gespeichert.");
      invalidate();
    },
    onError: fail,
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancel({ data: { organizationId, orderId, reason: cancelReason } }),
    onSuccess: () => {
      toast.success("Bestellung storniert.");
      setCancelReason("");
      invalidate();
    },
    onError: fail,
  });

  const refundMutation = useMutation({
    mutationFn: () =>
      refund({
        data: {
          organizationId,
          orderId,
          amountMinor: Math.round(Number(refundAmount.replace(",", ".")) * 100),
          reason: refundReason,
        },
      }),
    onSuccess: () => {
      toast.success("Erstattung ausgelöst.");
      setRefundAmount("");
      setRefundReason("");
      invalidate();
    },
    onError: fail,
  });

  if (order.isLoading) return <Skeleton className="h-64 w-full" />;
  if (order.error) return <p className="text-destructive text-sm">{(order.error as Error).message}</p>;
  const o = order.data!;
  const currency = o.currencyCode;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/app/bestellungen" className="text-muted-foreground text-xs hover:underline">
            ← Alle Bestellungen
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{o.orderNumber}</h1>
          <p className="text-muted-foreground text-sm">
            {new Date(o.placedAt).toLocaleString("de-DE")} · {o.email ?? "ohne E-Mail"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{ORDER_STATUS_LABELS[o.orderStatus]}</Badge>
          <Badge variant={o.paymentStatus === "paid" ? "default" : "outline"}>
            {PAYMENT_STATUS_LABELS[o.paymentStatus]}
          </Badge>
          <Badge variant="outline">{FULFILLMENT_STATUS_LABELS[o.fulfillmentStatus]}</Badge>
          {o.environment === "test" && <Badge variant="outline">Test</Badge>}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-lg border p-4">
            <h2 className="mb-3 font-medium">Positionen</h2>
            <ul className="space-y-2 text-sm">
              {o.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3">
                  <span>
                    {i.quantity} × {i.title} · <span className="text-muted-foreground">{i.variantTitle}</span>
                    {i.sku && <span className="text-muted-foreground"> · {i.sku}</span>}
                  </span>
                  <span>{formatMoney(i.lineTotalMinor, currency)}</span>
                </li>
              ))}
            </ul>
            <Separator className="my-3" />
            <dl className="space-y-1 text-sm">
              <Row label="Zwischensumme" value={formatMoney(o.subtotalMinor, currency)} />
              <Row label="Rabatt" value={`−${formatMoney(o.discountMinor, currency)}`} />
              <Row label="Versand" value={formatMoney(o.shippingMinor, currency)} />
              <Row label="Netto" value={formatMoney(o.netTotalMinor, currency)} />
              {(o.taxBreakdown as Array<Record<string, number | string>>).map((b, idx) => (
                <Row
                  key={idx}
                  label={`USt ${(Number(b['rateBasisPoints'] ?? 0) / 100).toFixed(
                    Number(b['rateBasisPoints'] ?? 0) % 100 === 0 ? 0 : 2,
                  )} %`}
                  value={formatMoney(Number(b['taxMinor'] ?? 0), currency)}
                />
              ))}
              <Row label="Steuer" value={formatMoney(o.taxMinor, currency)} />
              <Row label="Gesamt" value={formatMoney(o.totalMinor, currency)} strong />
              {o.refundedMinor > 0 && (
                <Row label="Erstattet" value={`−${formatMoney(o.refundedMinor, currency)}`} />
              )}
            </dl>
          </section>

          <section className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
            {o.addresses.map((a) => (
              <div key={a.type}>
                <h3 className="mb-1 text-sm font-medium">
                  {a.type === "shipping" ? "Lieferadresse" : "Rechnungsadresse"}
                </h3>
                <p className="text-muted-foreground text-sm whitespace-pre-line">
                  {[
                    `${a['firstName'] ?? ""} ${a['lastName'] ?? ""}`.trim(),
                    a['company'],
                    a['street'],
                    a['street2'],
                    `${a['postalCode'] ?? ""} ${a['city'] ?? ""}`.trim(),
                    a['countryCode'],
                  ]
                    .filter(Boolean)
                    .join("\n")}
                </p>
              </div>
            ))}
          </section>

          <section className="rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-medium">Versand & Sendungsverfolgung</h2>
              <Link to="/app/versand" className="text-muted-foreground text-xs hover:underline">
                Fulfillment-Workspace →
              </Link>
            </div>
            {fulfillments.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : !fulfillments.data?.length ? (
              <p className="text-muted-foreground text-sm">
                Noch kein Fulfillment angelegt. Bezahlte Bestellungen lassen sich im Versand-Workspace
                kommissionieren.
              </p>
            ) : (
              <ul className="space-y-4">
                {fulfillments.data.map((f) => (
                  <li key={f.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        to="/app/versand/$fulfillmentId"
                        params={{ fulfillmentId: f.id }}
                        className="text-sm font-medium hover:underline"
                      >
                        {f.reference ?? f.id.slice(0, 8)}
                      </Link>
                      <Badge variant="outline">{FULFILLMENT_STATE_LABELS[f.status]}</Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {f.items.reduce((sum, i) => sum + i.quantity, 0)} Artikel ·{" "}
                      {f.packages.length} Paket(e)
                    </p>
                    {f.shipments.map((s) => (
                      <div key={s.id} className="mt-2 border-t pt-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            {s.carrierProvider}
                            {s.trackingNumber && (
                              <span className="text-muted-foreground font-mono text-xs"> · {s.trackingNumber}</span>
                            )}
                          </span>
                          <Badge variant="secondary">{SHIPMENT_STATUS_LABELS[s.status]}</Badge>
                        </div>
                        {s.trackingUrl && (
                          <a
                            href={s.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary text-xs hover:underline"
                          >
                            Sendung beim Dienstleister verfolgen
                          </a>
                        )}
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            )}

            {!!tracking.data?.shipments.length && (
              <>
                <Separator className="my-3" />
                <h3 className="mb-2 text-sm font-medium">Verlauf</h3>
                <ul className="space-y-1 text-sm">
                  {tracking.data.shipments.flatMap((s) =>
                    s.events.map((e, idx) => (
                      <li key={`${s.trackingNumber ?? s.carrierProvider}-${idx}`} className="flex justify-between gap-3">
                        <span>
                          {TRACKING_STATUS_LABELS[e.status]}
                          {e.description && (
                            <span className="text-muted-foreground"> · {e.description}</span>
                          )}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {new Date(e.occurredAt).toLocaleString("de-DE")}
                        </span>
                      </li>
                    )),
                  )}
                </ul>
              </>
            )}
          </section>



          <section className="rounded-lg border p-4">
            <h2 className="mb-3 font-medium">Zahlungsbuchungen</h2>
            {!o.transactions.length ? (
              <p className="text-muted-foreground text-sm">Keine Buchungen.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {o.transactions.map((t) => (
                  <li key={t.id} className="flex justify-between gap-3">
                    <span>
                      {t.type} · {t.provider} ·{" "}
                      <span className="text-muted-foreground">{t.providerTransactionId ?? "—"}</span>
                    </span>
                    <span>{formatMoney(t.amountMinor, t.currencyCode)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border p-4">
            <h2 className="mb-3 font-medium">Verlauf</h2>
            <ul className="space-y-1 text-sm">
              {o.timeline.map((t) => (
                <li key={t.id} className="flex justify-between gap-3">
                  <span>{t.action}</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(t.createdAt).toLocaleString("de-DE")}
                  </span>
                </li>
              ))}
              {!o.timeline.length && <li className="text-muted-foreground">Keine Einträge.</li>}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="space-y-2 rounded-lg border p-4">
            <h2 className="font-medium">Interne Notiz</h2>
            <Textarea
              rows={4}
              value={note ?? o.internalNote ?? ""}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nur intern sichtbar"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!can("orders.manage") || noteMutation.isPending}
              onClick={() => noteMutation.mutate()}
            >
              Notiz speichern
            </Button>
          </section>

          <section className="space-y-2 rounded-lg border p-4">
            <h2 className="font-medium">Erstattung</h2>
            <p className="text-muted-foreground text-xs">
              Erstattbar: {formatMoney(o.refundableMinor, currency)}
            </p>
            <div className="grid gap-2">
              <Label className="text-xs">Betrag</Label>
              <Input
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="z. B. 19,90"
              />
              <Label className="text-xs">Grund</Label>
              <Input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={
                !can("payments.refund") ||
                refundMutation.isPending ||
                !refundAmount ||
                o.refundableMinor <= 0
              }
              onClick={() => refundMutation.mutate()}
            >
              Erstattung auslösen
            </Button>
            {o.refunds.length > 0 && (
              <ul className="space-y-1 pt-2 text-xs">
                {o.refunds.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span>
                      {formatMoney(r.amountMinor, r.currencyCode)} · {REFUND_STATUS_LABELS[r.status]}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("de-DE")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2 rounded-lg border p-4">
            <h2 className="font-medium">Stornieren</h2>
            <p className="text-muted-foreground text-xs">
              Storniert die Bestellung und schreibt den Grund unveränderbar ins Protokoll.
            </p>
            <Input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Grund"
            />
            <Button
              size="sm"
              variant="ghost"
              disabled={
                !can("orders.cancel") ||
                cancelMutation.isPending ||
                !cancelReason ||
                o.orderStatus === "cancelled"
              }
              onClick={() => cancelMutation.mutate()}
            >
              Bestellung stornieren
            </Button>
            {o.cancelReason && (
              <p className="text-muted-foreground text-xs">Storniert: {o.cancelReason}</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold" : ""}`}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
