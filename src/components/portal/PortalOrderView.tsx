import { useState } from "react";
import { toast } from "sonner";
import type { PortalOrderDetail } from "@/lib/commerce/portal/portal.server";
import type { ReturnEligibility, ReturnReasonCode } from "@/lib/commerce/returns/return.types";
import {
  RETURN_REASON_LABELS,
  RETURN_STATUS_LABELS,
  type ReturnStatus,
} from "@/lib/commerce/returns/return.types";
import { formatMoney } from "@/lib/commerce/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  order: PortalOrderDetail;
  eligibility?: ReturnEligibility | null;
  onDocument: (
    kind: "invoice" | "credit_note" | "delivery_note",
    documentId: string,
  ) => Promise<{ url: string }>;
  onCreateReturn: (input: {
    items: { orderItemId: string; quantity: number }[];
    reason: ReturnReasonCode;
    note: string | null;
    idempotencyKey: string;
  }) => Promise<unknown>;
};

const DOC_LABELS: Record<string, string> = {
  invoice: "Rechnung",
  credit_note: "Gutschrift",
  delivery_note: "Lieferschein",
};

export function PortalOrderView({ order, eligibility, onDocument, onCreateReturn }: Props) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReasonCode>("changed_mind");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const openDocument = async (kind: "invoice" | "credit_note" | "delivery_note", id: string) => {
    try {
      const { url } = await onDocument(kind, id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const submitReturn = async () => {
    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    if (!items.length) {
      toast.error("Bitte mindestens eine Position auswählen.");
      return;
    }
    setBusy(true);
    try {
      await onCreateReturn({
        items,
        reason,
        note: note || null,
        idempotencyKey: `${order.id}-${items.map((i) => `${i.orderItemId}:${i.quantity}`).join("|")}-${reason}`,
      });
      toast.success("Retoure angemeldet. Du erhältst die nächsten Schritte per E-Mail.");
      setWizardOpen(false);
      setQuantities({});
      setNote("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Bestellung {order.orderNumber}</h1>
        <p className="text-sm text-muted-foreground">
          {new Date(order.placedAt).toLocaleDateString("de-DE")} · {order.itemCount} Artikel ·{" "}
          {formatMoney(order.totalMinor, order.currencyCode)}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="secondary">Zahlung: {order.paymentStatus}</Badge>
          <Badge variant="secondary">Versand: {order.fulfillmentStatus}</Badge>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Artikel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {order.items.map((it) => (
            <div
              key={it.id}
              className="flex items-center justify-between border-b pb-2 last:border-none"
            >
              <div>
                <p className="font-medium">
                  {it.title} {it.variantTitle ? `· ${it.variantTitle}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">Menge {it.quantity}</p>
              </div>
              <span>{formatMoney(it.lineTotalMinor, order.currencyCode)}</span>
            </div>
          ))}
          <div className="space-y-1 pt-2 text-right">
            <p className="text-xs text-muted-foreground">
              Zwischensumme {formatMoney(order.subtotalMinor, order.currencyCode)} · Versand{" "}
              {formatMoney(order.shippingMinor, order.currencyCode)} · Steuer{" "}
              {formatMoney(order.taxMinor, order.currencyCode)}
            </p>
            <p className="font-semibold">
              Gesamt {formatMoney(order.totalMinor, order.currencyCode)}
            </p>
          </div>
        </CardContent>
      </Card>

      {order.tracking.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sendungsverfolgung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {order.tracking.map((t) => (
              <div key={t.shipmentId} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">
                    {t.carrier} {t.trackingNumber ? `· ${t.trackingNumber}` : ""}
                  </p>
                  <Badge variant="secondary">{t.status}</Badge>
                </div>
                {t.trackingUrl && (
                  <a
                    href={t.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline"
                  >
                    Sendung beim Versanddienstleister verfolgen
                  </a>
                )}
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {t.events.map((e, i) => (
                    <li key={`${t.shipmentId}-${i}`}>
                      {new Date(e.occurredAt).toLocaleString("de-DE")} · {e.description ?? e.code}
                      {e.location ? ` · ${e.location}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dokumente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!order.documents.length ? (
            <p className="text-muted-foreground">Noch keine Dokumente verfügbar.</p>
          ) : (
            order.documents.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between border-b pb-2 last:border-none"
              >
                <div>
                  <p className="font-medium">
                    {DOC_LABELS[d.kind]} {d.number ?? ""}
                  </p>
                  {d.issuedAt && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(d.issuedAt).toLocaleDateString("de-DE")}
                    </p>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => openDocument(d.kind, d.id)}>
                  PDF öffnen
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {order.returns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deine Retouren</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {order.returns.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between border-b pb-2 last:border-none"
              >
                <span className="font-medium">{r.returnNumber}</span>
                <Badge variant="secondary">
                  {RETURN_STATUS_LABELS[r.status as ReturnStatus] ?? r.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rücksendung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {!eligibility ? (
            <p className="text-muted-foreground">Rückgabeoptionen werden geladen …</p>
          ) : !eligibility.eligible ? (
            <p className="text-muted-foreground">
              {eligibility.reason ?? "Für diese Bestellung ist aktuell keine Rücksendung möglich."}
            </p>
          ) : !wizardOpen ? (
            <div className="space-y-2">
              {eligibility.windowEndsAt && (
                <p className="text-muted-foreground">
                  Rückgabe möglich bis{" "}
                  {new Date(eligibility.windowEndsAt).toLocaleDateString("de-DE")}.
                </p>
              )}
              <Button onClick={() => setWizardOpen(true)}>Rücksendung anmelden</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {eligibility.lines.map((l) => (
                <div
                  key={l.orderItemId}
                  className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr,auto]"
                >
                  <div>
                    <p className="font-medium">
                      {l.title} {l.variantTitle ? `· ${l.variantTitle}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {l.blockedReason
                        ? l.blockedReason
                        : `bis zu ${l.returnableQuantity} von ${l.quantity} rücksendbar`}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={l.returnableQuantity}
                    disabled={l.returnableQuantity < 1}
                    className="w-24"
                    value={quantities[l.orderItemId] ?? 0}
                    onChange={(e) =>
                      setQuantities({
                        ...quantities,
                        [l.orderItemId]: Math.max(
                          0,
                          Math.min(l.returnableQuantity, Number(e.target.value)),
                        ),
                      })
                    }
                  />
                </div>
              ))}

              <div>
                <Label>Grund</Label>
                <Select value={reason} onValueChange={(v) => setReason(v as ReturnReasonCode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RETURN_REASON_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Nachricht (optional)</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
              </div>

              <div className="flex gap-2">
                <Button onClick={submitReturn} disabled={busy}>
                  Rücksendung absenden
                </Button>
                <Button variant="outline" onClick={() => setWizardOpen(false)}>
                  Abbrechen
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
