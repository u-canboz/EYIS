import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, FileText } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PortalCard,
  PortalRow,
  PortalStatus,
  PortalTimeline,
  type PortalTimelineEntry,
} from "@/components/portal/PortalChrome";

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

const FULFILLMENT_HEADLINE: Record<string, string> = {
  fulfilled: "Deine Bestellung ist unterwegs bzw. zugestellt.",
  partially_fulfilled: "Ein Teil deiner Bestellung ist unterwegs.",
  unfulfilled: "Wir bereiten deine Bestellung vor.",
  cancelled: "Diese Bestellung wurde storniert.",
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

  const headline =
    FULFILLMENT_HEADLINE[order.fulfillmentStatus] ?? "Wir bearbeiten deine Bestellung.";
  const tone: "neutral" | "positive" | "attention" =
    order.fulfillmentStatus === "fulfilled"
      ? "positive"
      : order.fulfillmentStatus === "cancelled"
        ? "attention"
        : "neutral";

  return (
    <div className="min-w-0 space-y-5">
      <header className="min-w-0">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Bestellung</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight break-words sm:text-3xl">
          {order.orderNumber}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date(order.placedAt).toLocaleDateString("de-DE")} · {order.itemCount} Artikel ·{" "}
          <span className="tabular-nums">{formatMoney(order.totalMinor, order.currencyCode)}</span>
        </p>
      </header>

      <PortalStatus
        headline={headline}
        tone={tone}
        detail={
          <span className="inline-flex flex-wrap gap-2">
            <Badge variant="secondary">Zahlung: {order.paymentStatus}</Badge>
            <Badge variant="secondary">Versand: {order.fulfillmentStatus}</Badge>
          </span>
        }
      />

      <PortalCard title="Artikel">
        <ul className="min-w-0 divide-y divide-border/70">
          {order.items.map((it) => (
            <li key={it.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3 first:pt-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-pretty">
                  {it.title}
                  {it.variantTitle ? ` · ${it.variantTitle}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Menge {it.quantity}</p>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {formatMoney(it.lineTotalMinor, order.currencyCode)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 border-t border-border/70 pt-3">
          <PortalRow
            label="Zwischensumme"
            value={formatMoney(order.subtotalMinor, order.currencyCode)}
          />
          <PortalRow label="Versand" value={formatMoney(order.shippingMinor, order.currencyCode)} />
          <PortalRow label="Steuer" value={formatMoney(order.taxMinor, order.currencyCode)} />
          <PortalRow
            label="Gesamt"
            strong
            value={formatMoney(order.totalMinor, order.currencyCode)}
          />
        </dl>
      </PortalCard>

      {order.tracking.length > 0 && (
        <PortalCard title="Sendungsverfolgung">
          <div className="min-w-0 space-y-6">
            {order.tracking.map((t) => {
              const entries: PortalTimelineEntry[] = t.events.map((e, i) => ({
                title: e.description ?? e.code,
                meta: `${new Date(e.occurredAt).toLocaleString("de-DE")}${e.location ? ` · ${e.location}` : ""}`,
                done: i === 0,
              }));
              return (
                <div key={t.shipmentId} className="min-w-0">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <p className="min-w-0 text-sm font-medium break-words">
                      {t.carrier}
                      {t.trackingNumber ? ` · ${t.trackingNumber}` : ""}
                    </p>
                    <Badge variant="secondary" className="shrink-0">
                      {t.status}
                    </Badge>
                  </div>
                  {t.trackingUrl && (
                    <a
                      href={t.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      Sendung verfolgen
                      <ExternalLink className="size-4 shrink-0" aria-hidden />
                    </a>
                  )}
                  <div className="mt-3">
                    <PortalTimeline entries={entries} />
                  </div>
                </div>
              );
            })}
          </div>
        </PortalCard>
      )}

      <PortalCard title="Dokumente">
        {!order.documents.length ? (
          <p className="text-sm text-muted-foreground">Noch keine Dokumente verfügbar.</p>
        ) : (
          <ul className="min-w-0 divide-y divide-border/70">
            {order.documents.map((d) => (
              <li
                key={d.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 first:pt-0"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {DOC_LABELS[d.kind]} {d.number ?? ""}
                    </p>
                    {d.issuedAt && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(d.issuedAt).toLocaleDateString("de-DE")}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 shrink-0"
                  onClick={() => openDocument(d.kind, d.id)}
                >
                  PDF öffnen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </PortalCard>

      {order.returns.length > 0 && (
        <PortalCard title="Deine Retouren">
          <ul className="min-w-0 divide-y divide-border/70">
            {order.returns.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 first:pt-0"
              >
                <span className="min-w-0 truncate text-sm font-medium">{r.returnNumber}</span>
                <Badge variant="secondary" className="shrink-0">
                  {RETURN_STATUS_LABELS[r.status as ReturnStatus] ?? r.status}
                </Badge>
              </li>
            ))}
          </ul>
        </PortalCard>
      )}

      <PortalCard
        title="Rücksendung"
        description="Etwas passt nicht? Melde die betroffenen Artikel an, wir kümmern uns um den Rest."
      >
        {!eligibility ? (
          <p className="text-sm text-muted-foreground">Rückgabeoptionen werden geladen …</p>
        ) : !eligibility.eligible ? (
          <p className="text-sm text-pretty text-muted-foreground">
            {eligibility.reason ?? "Für diese Bestellung ist aktuell keine Rücksendung möglich."}
          </p>
        ) : !wizardOpen ? (
          <div className="space-y-3">
            {eligibility.windowEndsAt && (
              <p className="text-sm text-muted-foreground">
                Rückgabe möglich bis {new Date(eligibility.windowEndsAt).toLocaleDateString("de-DE")}
                .
              </p>
            )}
            <Button className="h-11 w-full sm:w-auto" onClick={() => setWizardOpen(true)}>
              Rücksendung anmelden
            </Button>
          </div>
        ) : (
          <div className="min-w-0 space-y-4">
            {eligibility.lines.map((l) => (
              <div
                key={l.orderItemId}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-pretty">
                    {l.title}
                    {l.variantTitle ? ` · ${l.variantTitle}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
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
                  aria-label={`Menge ${l.title}`}
                  className="h-11 w-20 shrink-0 tabular-nums"
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

            <div className="space-y-1.5">
              <Label htmlFor="return-reason">Grund</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as ReturnReasonCode)}>
                <SelectTrigger id="return-reason" className="h-11">
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

            <div className="space-y-1.5">
              <Label htmlFor="return-note">Nachricht (optional)</Label>
              <Textarea id="return-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="h-11 sm:flex-1" onClick={submitReturn} disabled={busy}>
                Rücksendung absenden
              </Button>
              <Button
                variant="outline"
                className="h-11 sm:flex-1"
                onClick={() => setWizardOpen(false)}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        )}
      </PortalCard>
    </div>
  );
}
