import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  CreditCard,
  FileText,
  RotateCcw,
  Settings2,
  Truck,
  Users,
} from "lucide-react";
import {
  getOrderFn,
  setOrderNoteFn,
  cancelOrderFn,
  createRefundFn,
} from "@/lib/commerce/orders/order.functions";
import { getOrderFulfillments } from "@/lib/commerce/fulfillment/fulfillment.functions";
import { getOrderDocumentsFn, createInvoiceFn } from "@/lib/commerce/documents/document.functions";
import { INVOICE_STATUS_LABELS } from "@/lib/commerce/documents/document.types";
import { getOrderTrackingFn } from "@/lib/commerce/shipping/carrier.functions";
import {
  FULFILLMENT_STATE_LABELS,
  SHIPMENT_STATUS_LABELS,
  TRACKING_STATUS_LABELS,
} from "@/lib/commerce/fulfillment/fulfillment.types";
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
import { PageHeader } from "@/components/shell/PageHeader";
import { DetailLayout, Panel, DataRow, RelatedLinks } from "@/components/shell/DetailLayout";
import { EmptyState, ErrorState } from "@/components/data/States";

export const Route = createFileRoute("/_authenticated/app/bestellungen/$orderId")({
  head: () => ({
    meta: [
      { title: "Bestelldetails – Commerce OS" },
      {
        name: "description",
        content:
          "Positionen, Adressen, Zahlungsbuchungen, Erstattungen und Verlauf einer Bestellung.",
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
  const listOrderFulfillments = useServerFn(getOrderFulfillments);
  const getTracking = useServerFn(getOrderTrackingFn);
  const getDocuments = useServerFn(getOrderDocumentsFn);
  const createInvoice = useServerFn(createInvoiceFn);

  const order = useQuery({
    queryKey: ["order", organizationId, orderId],
    enabled: !!organizationId,
    queryFn: () => get({ data: { organizationId, orderId } }),
  });

  const fulfillments = useQuery({
    queryKey: ["order-fulfillments", organizationId, orderId],
    enabled: !!organizationId,
    queryFn: () => listOrderFulfillments({ data: { organizationId, orderId } }),
  });

  const tracking = useQuery({
    queryKey: ["order-tracking", organizationId, orderId],
    enabled: !!organizationId,
    queryFn: () => getTracking({ data: { organizationId, orderId } }),
  });

  const documents = useQuery({
    queryKey: ["order-documents", organizationId, orderId],
    enabled: !!organizationId,
    queryFn: () => getDocuments({ data: { organizationId, orderId } }),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["order", organizationId, orderId] });
  const fail = (e: Error) => toast.error(e.message);

  const createInvoiceMutation = useMutation({
    mutationFn: () => createInvoice({ data: { organizationId, orderId } }),
    onSuccess: () => {
      toast.success("Rechnungsentwurf erstellt.");
      queryClient.invalidateQueries({ queryKey: ["order-documents", organizationId, orderId] });
    },
    onError: fail,
  });

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

  if (order.error)
    return <ErrorState description={(order.error as Error).message} />;
  if (!order.data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  const o = order.data;
  const currency = o.currencyCode;

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        eyebrow={
          <Link
            to="/app/bestellungen"
            className="inline-flex min-h-11 items-center gap-1.5 hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
            Alle Bestellungen
          </Link>
        }
        title={o.orderNumber}
        description={`${new Date(o.placedAt).toLocaleString("de-DE")} · ${o.email ?? "ohne E-Mail"}`}
      />

      <div className="flex min-w-0 flex-wrap gap-2">
        <Badge variant="secondary">{ORDER_STATUS_LABELS[o.orderStatus]}</Badge>
        <Badge variant={o.paymentStatus === "paid" ? "default" : "outline"}>
          {PAYMENT_STATUS_LABELS[o.paymentStatus]}
        </Badge>
        <Badge variant="outline">{FULFILLMENT_STATUS_LABELS[o.fulfillmentStatus]}</Badge>
        {o.environment === "test" && <Badge variant="outline">Test</Badge>}
      </div>

      <DetailLayout
        main={
          <>
            <Panel title="Positionen" description={`${o.items.length} Position(en)`}>
              <ul className="min-w-0 divide-y divide-border text-sm">
                {o.items.map((i) => (
                  <li
                    key={i.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-2 first:pt-0"
                  >
                    <div className="min-w-0">
                      <p className="min-w-0 break-words font-medium">
                        <span className="tabular-nums">{i.quantity} ×</span> {i.title}
                      </p>
                      <p className="mt-0.5 min-w-0 break-words text-xs text-muted-foreground">
                        {i.variantTitle}
                        {i.sku ? ` · ${i.sku}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums">
                      {formatMoney(i.lineTotalMinor, currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <Separator className="my-3" />
              <dl className="min-w-0">
                <DataRow label="Zwischensumme" value={formatMoney(o.subtotalMinor, currency)} />
                <DataRow label="Rabatt" value={`−${formatMoney(o.discountMinor, currency)}`} />
                <DataRow label="Versand" value={formatMoney(o.shippingMinor, currency)} />
                <DataRow label="Netto" value={formatMoney(o.netTotalMinor, currency)} />
                {(o.taxBreakdown as Array<Record<string, number | string>>).map((b, idx) => (
                  <DataRow
                    key={idx}
                    label={`USt ${(Number(b["rateBasisPoints"] ?? 0) / 100).toFixed(
                      Number(b["rateBasisPoints"] ?? 0) % 100 === 0 ? 0 : 2,
                    )} %`}
                    value={formatMoney(Number(b["taxMinor"] ?? 0), currency)}
                  />
                ))}
                <DataRow label="Steuer" value={formatMoney(o.taxMinor, currency)} />
                <DataRow
                  label={<span className="font-semibold text-foreground">Gesamt</span>}
                  value={
                    <span className="text-base font-semibold">
                      {formatMoney(o.totalMinor, currency)}
                    </span>
                  }
                />
                {o.refundedMinor > 0 && (
                  <DataRow
                    label="Erstattet"
                    value={`−${formatMoney(o.refundedMinor, currency)}`}
                  />
                )}
              </dl>
            </Panel>

            <Panel title="Adressen">
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                {o.addresses.map((a) => (
                  <div key={a.type} className="min-w-0">
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {a.type === "shipping" ? "Lieferadresse" : "Rechnungsadresse"}
                    </h3>
                    <p className="min-w-0 break-words whitespace-pre-line text-sm">
                      {[
                        `${a["firstName"] ?? ""} ${a["lastName"] ?? ""}`.trim(),
                        a["company"],
                        a["street"],
                        a["street2"],
                        `${a["postalCode"] ?? ""} ${a["city"] ?? ""}`.trim(),
                        a["countryCode"],
                      ]
                        .filter(Boolean)
                        .join("\n")}
                    </p>
                  </div>
                ))}
                {!o.addresses.length ? (
                  <p className="text-sm text-muted-foreground">Keine Adressen hinterlegt.</p>
                ) : null}
              </div>
            </Panel>

            <Panel
              title="Versand & Sendungsverfolgung"
              actions={
                <Link
                  to="/app/versand"
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  Workspace →
                </Link>
              }
            >
              {fulfillments.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : !fulfillments.data?.length ? (
                <EmptyState
                  title="Noch kein Fulfillment"
                  description="Bezahlte Bestellungen lassen sich im Versand-Workspace kommissionieren."
                />
              ) : (
                <ul className="min-w-0 space-y-3">
                  {fulfillments.data.map((f) => (
                    <li key={f.id} className="min-w-0 rounded-lg border border-border p-3">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                        <Link
                          to="/app/versand/$fulfillmentId"
                          params={{ fulfillmentId: f.id }}
                          className="min-w-0 break-words text-sm font-medium hover:underline"
                        >
                          {f.orderNumber} · {f.locationName ?? "ohne Lagerort"}
                        </Link>
                        <Badge variant="outline" className="shrink-0">
                          {FULFILLMENT_STATE_LABELS[f.status]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {f.items.reduce((sum, i) => sum + i.quantity, 0)} Artikel ·{" "}
                        {f.packages.length} Paket(e)
                      </p>
                      {f.packages
                        .map((p) => p.shipment)
                        .filter((s) => s !== null)
                        .map((s) => (
                          <div key={s.id} className="mt-2 min-w-0 border-t border-border pt-2">
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 text-sm">
                              <span className="min-w-0 break-words">
                                {s.carrierProvider}
                                {s.trackingNumber && (
                                  <span className="font-mono text-xs text-muted-foreground">
                                    {" "}
                                    · {s.trackingNumber}
                                  </span>
                                )}
                              </span>
                              <Badge variant="secondary" className="shrink-0">
                                {SHIPMENT_STATUS_LABELS[s.status]}
                              </Badge>
                            </div>
                            {s.trackingUrl && (
                              <a
                                href={s.trackingUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex min-h-11 items-center text-xs text-primary hover:underline"
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
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Verlauf
                  </h3>
                  <ul className="min-w-0 space-y-1.5 text-sm">
                    {tracking.data.shipments.flatMap((s) =>
                      s.events.map((e, idx) => (
                        <li
                          key={`${s.trackingNumber ?? s.carrierProvider}-${idx}`}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"
                        >
                          <span className="min-w-0 break-words">
                            {TRACKING_STATUS_LABELS[e.status]}
                            {e.description && (
                              <span className="text-muted-foreground"> · {e.description}</span>
                            )}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {new Date(e.occurredAt).toLocaleString("de-DE")}
                          </span>
                        </li>
                      )),
                    )}
                  </ul>
                </>
              )}
            </Panel>

            <Panel
              title="Dokumente"
              actions={
                <Link
                  to="/app/dokumente"
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  Alle →
                </Link>
              }
            >
              {documents.isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  {!documents.data?.invoices.length ? (
                    <p className="text-sm text-muted-foreground">
                      Für diese Bestellung existiert noch keine Rechnung.
                    </p>
                  ) : (
                    <ul className="min-w-0 space-y-2 text-sm">
                      {documents.data.invoices.map((inv) => (
                        <li
                          key={inv.id}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
                        >
                          <Link
                            to="/app/dokumente/$invoiceId"
                            params={{ invoiceId: inv.id }}
                            className="min-w-0 truncate font-medium hover:underline"
                          >
                            {inv.invoiceNumber ?? "Rechnungsentwurf"}
                          </Link>
                          <span className="flex shrink-0 items-center gap-2">
                            <Badge variant={inv.status === "issued" ? "default" : "outline"}>
                              {INVOICE_STATUS_LABELS[inv.status]}
                            </Badge>
                            <span className="tabular-nums">
                              {formatMoney(inv.totalGrossMinor, inv.currencyCode)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!!documents.data?.deliveryNotes.length && (
                    <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
                      {documents.data.deliveryNotes.map((dn) => (
                        <li key={dn.id} className="min-w-0 break-words">
                          Lieferschein {dn.documentNumber ?? "Entwurf"} · {dn.itemCount}{" "}
                          Position(en)
                        </li>
                      ))}
                    </ul>
                  )}
                  {!documents.data?.invoices.length && (
                    <Button
                      variant="outline"
                      className="mt-3 min-h-11 w-full sm:w-auto"
                      disabled={!can("invoices.manage") || createInvoiceMutation.isPending}
                      onClick={() => createInvoiceMutation.mutate()}
                    >
                      Rechnung erstellen
                    </Button>
                  )}
                </>
              )}
            </Panel>

            <Panel title="Zahlungsbuchungen">
              {!o.transactions.length ? (
                <p className="text-sm text-muted-foreground">Keine Buchungen.</p>
              ) : (
                <ul className="min-w-0 space-y-1.5 text-sm">
                  {o.transactions.map((t) => (
                    <li
                      key={t.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"
                    >
                      <span className="min-w-0 break-words">
                        {t.type} · {t.provider}
                        <span className="block text-xs text-muted-foreground">
                          {t.providerTransactionId ?? "—"}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatMoney(t.amountMinor, t.currencyCode)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Verlauf">
              <ul className="min-w-0 space-y-1.5 text-sm">
                {o.timeline.map((t) => (
                  <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <span className="min-w-0 break-words">{t.action}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {new Date(t.createdAt).toLocaleString("de-DE")}
                    </span>
                  </li>
                ))}
                {!o.timeline.length && (
                  <li className="text-muted-foreground">Keine Einträge.</li>
                )}
              </ul>
            </Panel>
          </>
        }
        aside={
          <>
            <RelatedLinks
              items={[
                {
                  to: "/app/versand",
                  label: "Versand & Fulfillment",
                  hint: "Kommissionierung, Pakete, Labels",
                  icon: Truck,
                },
                {
                  to: "/app/versand/versandarten",
                  label: "Versandarten",
                  hint: "Preise und Regeln je Shop",
                  icon: Settings2,
                },
                {
                  to: "/app/zahlungen",
                  label: "Zahlungen",
                  hint: "Buchungen und Erstattungen",
                  icon: CreditCard,
                },
                {
                  to: "/app/dokumente",
                  label: "Belege",
                  hint: "Rechnungen und Gutschriften",
                  icon: FileText,
                },
                {
                  to: "/app/retouren",
                  label: "Retouren",
                  hint: "Rücksendungen zu dieser Bestellung",
                  icon: RotateCcw,
                },
                {
                  to: "/app/kunden",
                  label: "Kunde",
                  hint: o.email ?? "Gastbestellung",
                  icon: Users,
                },
              ]}
            />

            <Panel title="Interne Notiz" bodyClassName="space-y-3">

              <Textarea
                rows={4}
                value={note ?? o.internalNote ?? ""}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nur intern sichtbar"
              />
              <Button
                variant="outline"
                className="min-h-11 w-full"
                disabled={!can("orders.manage") || noteMutation.isPending}
                onClick={() => noteMutation.mutate()}
              >
                Notiz speichern
              </Button>
            </Panel>

            <Panel
              title="Erstattung"
              description={`Erstattbar: ${formatMoney(o.refundableMinor, currency)}`}
              bodyClassName="space-y-3"
            >
              <div className="grid gap-2">
                <Label htmlFor="refund-amount" className="text-xs">
                  Betrag
                </Label>
                <Input
                  id="refund-amount"
                  className="h-11"
                  inputMode="decimal"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="z. B. 19,90"
                />
                <Label htmlFor="refund-reason" className="text-xs">
                  Grund
                </Label>
                <Input
                  id="refund-reason"
                  className="h-11"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                className="min-h-11 w-full"
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
                <ul className="space-y-1 border-t border-border pt-2 text-xs">
                  {o.refunds.map((r) => (
                    <li
                      key={r.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2"
                    >
                      <span className="min-w-0 break-words tabular-nums">
                        {formatMoney(r.amountMinor, r.currencyCode)} ·{" "}
                        {REFUND_STATUS_LABELS[r.status]}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString("de-DE")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title="Stornieren"
              description="Schreibt den Grund unveränderbar ins Protokoll."
              bodyClassName="space-y-3"
            >
              <Input
                className="h-11"
                aria-label="Stornogrund"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Grund"
              />
              <Button
                variant="ghost"
                className="min-h-11 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
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
                <p className="text-xs text-muted-foreground">Storniert: {o.cancelReason}</p>
              )}
            </Panel>
          </>
        }
      />
    </div>
  );
}
