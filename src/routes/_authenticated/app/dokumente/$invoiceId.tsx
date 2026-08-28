import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getInvoiceFn,
  issueInvoiceFn,
  voidInvoiceFn,
  createCreditNoteFn,
  regenerateDocumentPdfFn,
  getDocumentUrlFn,
} from "@/lib/commerce/documents/document.functions";
import {
  CREDIT_NOTE_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
} from "@/lib/commerce/documents/document.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { formatMoney } from "@/lib/commerce/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shell/PageHeader";
import { DetailLayout, Panel, DataRow } from "@/components/shell/DetailLayout";
import { ErrorState } from "@/components/data/States";

export const Route = createFileRoute("/_authenticated/app/dokumente/$invoiceId")({
  head: () => ({
    meta: [
      { title: "Rechnung – EYIS" },
      {
        name: "description",
        content: "Positionen, Steuerausweis, Gutschriften und PDF-Versionen einer Rechnung.",
      },
      { property: "og:title", content: "Rechnung – EYIS" },
      { property: "og:description", content: "Details und Historie einer Rechnung." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvoiceDetailPage,
});

function rate(bp: number) {
  return `${(bp / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;
}

function InvoiceDetailPage() {
  const { invoiceId } = Route.useParams();
  const { organizationId, can } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [voidReason, setVoidReason] = useState("");

  const get = useServerFn(getInvoiceFn);
  const issue = useServerFn(issueInvoiceFn);
  const voidFn = useServerFn(voidInvoiceFn);
  const credit = useServerFn(createCreditNoteFn);
  const regenerate = useServerFn(regenerateDocumentPdfFn);
  const getUrl = useServerFn(getDocumentUrlFn);

  const invoice = useQuery({
    queryKey: ["invoice", organizationId, invoiceId],
    enabled: !!organizationId,
    queryFn: () => get({ data: { organizationId, invoiceId } }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["invoice", organizationId, invoiceId] });
    queryClient.invalidateQueries({ queryKey: ["invoices", organizationId] });
  };
  const fail = (e: Error) => toast.error(e.message);

  const issueMutation = useMutation({
    mutationFn: () => issue({ data: { organizationId, invoiceId } }),
    onSuccess: (r) => {
      toast.success(`Rechnung ${r.invoice_number} ausgestellt.`);
      invalidate();
    },
    onError: fail,
  });

  const voidMutation = useMutation({
    mutationFn: () => voidFn({ data: { organizationId, invoiceId, reason: voidReason || null } }),
    onSuccess: (r) => {
      toast.success(r.deleted ? "Entwurf verworfen." : "Rechnung storniert.");
      if (r.deleted) navigate({ to: "/app/dokumente" });
      else invalidate();
    },
    onError: fail,
  });

  const creditMutation = useMutation({
    mutationFn: () =>
      credit({
        data: {
          organizationId,
          invoiceId,
          amountMinor: Math.round(Number(creditAmount.replace(",", ".")) * 100),
          reason: creditReason || null,
          issueImmediately: true,
        },
      }),
    onSuccess: () => {
      toast.success("Gutschrift ausgestellt.");
      setCreditAmount("");
      setCreditReason("");
      invalidate();
    },
    onError: fail,
  });

  const regenerateMutation = useMutation({
    mutationFn: () =>
      regenerate({ data: { organizationId, documentType: "invoice", documentId: invoiceId } }),
    onSuccess: () => {
      toast.success("PDF neu erzeugt.");
      invalidate();
    },
    onError: fail,
  });

  const open = async (documentId: string) => {
    try {
      const { url } = await getUrl({ data: { organizationId, documentId } });
      if (!url) {
        toast.error("Für dieses Dokument liegt noch kein PDF vor.");
        return;
      }
      window.open(url, "_blank", "noopener");
    } catch (e) {
      fail(e as Error);
    }
  };

  if (invoice.error) return <ErrorState description={(invoice.error as Error).message} />;
  if (!invoice.data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  const inv = invoice.data;
  const currency = inv.currencyCode;

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        eyebrow={
          <Link
            to="/app/dokumente"
            className="inline-flex min-h-11 items-center gap-1.5 hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
            Alle Dokumente
          </Link>
        }
        title={inv.invoiceNumber ?? "Rechnungsentwurf"}
        description={
          <>
            {inv.orderNumber && (
              <Link
                to="/app/bestellungen/$orderId"
                params={{ orderId: inv.orderId }}
                className="hover:underline"
              >
                {inv.orderNumber}
              </Link>
            )}
            {inv.issueDate
              ? ` · Rechnungsdatum ${new Date(inv.issueDate).toLocaleDateString("de-DE")}`
              : " · Entwurf"}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={inv.status === "issued" ? "default" : "outline"}>
              {INVOICE_STATUS_LABELS[inv.status]}
            </Badge>
            {inv.status === "draft" && (
              <Button
                className="h-11"
                disabled={!can("invoices.issue") || issueMutation.isPending}
                onClick={() => issueMutation.mutate()}
              >
                Rechnung ausstellen
              </Button>
            )}
            {inv.files.some((f) => f.format === "pdf") && (
              <Button className="h-11" variant="outline" onClick={() => open(inv.id)}>
                PDF öffnen
              </Button>
            )}
            {can("invoices.manage") && (
              <Button
                className="h-11"
                variant="ghost"
                onClick={() => regenerateMutation.mutate()}
                disabled={regenerateMutation.isPending}
              >
                PDF neu erzeugen
              </Button>
            )}
          </div>
        }
      />

      <DetailLayout
        main={
          <>
            <Panel title="Positionen">
              <ul className="min-w-0 divide-y divide-border text-sm">
                {inv.items.map((i) => (
                  <li
                    key={i.position}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-2 first:pt-0"
                  >
                    <div className="min-w-0">
                      <p className="min-w-0 break-words font-medium">
                        <span className="tabular-nums">{i.quantity} ×</span> {i.productName}
                      </p>
                      <p className="mt-0.5 min-w-0 break-words text-xs text-muted-foreground">
                        {i.variantName ? `${i.variantName} · ` : ""}
                        {i.sku ? `${i.sku} · ` : ""}
                        {rate(i.taxRateBasisPoints)}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums">
                      {formatMoney(i.lineNetMinor, currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <Separator className="my-3" />
              <dl className="min-w-0">
                <DataRow label="Zwischensumme netto" value={formatMoney(inv.subtotalNetMinor, currency)} />
                {inv.shippingNetMinor > 0 && (
                  <DataRow label="Versand netto" value={formatMoney(inv.shippingNetMinor, currency)} />
                )}
                {inv.taxBreakdown.map((t, idx) => (
                  <DataRow
                    key={idx}
                    label={`USt ${rate(t.rateBasisPoints)}`}
                    value={formatMoney(t.taxMinor, currency)}
                  />
                ))}
                <DataRow label="Umsatzsteuer" value={formatMoney(inv.taxTotalMinor, currency)} />
                <DataRow
                  label={<span className="font-semibold text-foreground">Gesamt brutto</span>}
                  value={
                    <span className="text-base font-semibold">
                      {formatMoney(inv.totalGrossMinor, currency)}
                    </span>
                  }
                />
                <DataRow label="Bezahlt" value={formatMoney(inv.paidMinor, currency)} />
                {inv.creditedMinor > 0 && (
                  <DataRow label="Gutgeschrieben" value={`−${formatMoney(inv.creditedMinor, currency)}`} />
                )}
              </dl>
            </Panel>

            <Panel title="Adressen">
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Rechnungsempfänger
                  </h3>
                  <p className="min-w-0 break-words whitespace-pre-line text-sm">
                    {[
                      inv.customerCompany,
                      inv.customerName,
                      inv.billingAddress.street,
                      inv.billingAddress.street2,
                      `${inv.billingAddress.postalCode ?? ""} ${inv.billingAddress.city ?? ""}`.trim(),
                      inv.billingAddress.countryCode,
                      inv.customerVatId ? `USt-IdNr. ${inv.customerVatId}` : "",
                    ]
                      .filter(Boolean)
                      .join("\n")}
                  </p>
                </div>
                <div className="min-w-0">
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Rechnungssteller
                  </h3>
                  <p className="min-w-0 break-words whitespace-pre-line text-sm">
                    {[
                      inv.seller.company_name,
                      inv.seller.address_line1,
                      `${inv.seller.postal_code ?? ""} ${inv.seller.city ?? ""}`.trim(),
                      inv.seller.tax_number ? `Steuernummer ${inv.seller.tax_number}` : "",
                      inv.seller.vat_id ? `USt-IdNr. ${inv.seller.vat_id}` : "",
                    ]
                      .filter(Boolean)
                      .join("\n")}
                  </p>
                </div>
              </div>
            </Panel>

            <Panel title="Gutschriften">
              {!inv.creditNotes.length ? (
                <p className="text-sm text-muted-foreground">Keine Gutschriften zu dieser Rechnung.</p>
              ) : (
                <ul className="min-w-0 space-y-2 text-sm">
                  {inv.creditNotes.map((cn) => (
                    <li
                      key={cn.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
                    >
                      <span className="min-w-0 break-words">
                        {cn.creditNoteNumber ?? "Entwurf"} ·{" "}
                        <span className="text-muted-foreground">
                          {CREDIT_NOTE_STATUS_LABELS[cn.status]}
                        </span>
                        {cn.reason && <span className="text-muted-foreground"> · {cn.reason}</span>}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 tabular-nums">
                        {formatMoney(cn.totalGrossMinor, cn.currencyCode)}
                        <Button size="sm" variant="ghost" className="min-h-11" onClick={() => open(cn.id)}>
                          PDF
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Dateiversionen">
              {!inv.files.length ? (
                <p className="text-sm text-muted-foreground">Noch keine Datei erzeugt.</p>
              ) : (
                <ul className="min-w-0 space-y-1.5 text-sm">
                  {inv.files.map((f) => (
                    <li key={f.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <span className="min-w-0 break-words">
                        {f.format.toUpperCase()} · Version {f.version}
                        <span className="font-mono text-xs text-muted-foreground">
                          {" "}
                          · {f.checksum?.slice(0, 12)}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {new Date(f.createdAt).toLocaleString("de-DE")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        }
        aside={
          <>
            <Panel
              title="Gutschrift erstellen"
              description={`Noch gutschreibbar: ${formatMoney(inv.creditableMinor, currency)}`}
              bodyClassName="space-y-3"
            >
              <div className="grid gap-2">
                <Label htmlFor="credit-amount" className="text-xs">
                  Betrag (brutto)
                </Label>
                <Input
                  id="credit-amount"
                  className="h-11"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="z. B. 19,90"
                />
                <Label htmlFor="credit-reason" className="text-xs">
                  Grund
                </Label>
                <Input
                  id="credit-reason"
                  className="h-11"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                className="min-h-11 w-full"
                disabled={
                  !can("invoices.credit") ||
                  creditMutation.isPending ||
                  !creditAmount ||
                  inv.creditableMinor <= 0 ||
                  !["issued", "partially_credited"].includes(inv.status)
                }
                onClick={() => creditMutation.mutate()}
              >
                Gutschrift ausstellen
              </Button>
            </Panel>

            <Panel
              title={inv.status === "draft" ? "Entwurf verwerfen" : "Rechnung stornieren"}
              description="Ausgestellte Rechnungen bleiben erhalten und werden nur als storniert markiert."
              bodyClassName="space-y-3"
            >
              {inv.status !== "draft" && (
                <Input
                  className="h-11"
                  aria-label="Stornogrund"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Grund"
                />
              )}
              <Button
                variant="ghost"
                className="min-h-11 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={
                  !can("invoices.manage") ||
                  voidMutation.isPending ||
                  inv.status === "voided" ||
                  inv.creditedMinor > 0 ||
                  (inv.status !== "draft" && !voidReason)
                }
                onClick={() => voidMutation.mutate()}
              >
                {inv.status === "draft" ? "Entwurf löschen" : "Stornieren"}
              </Button>
              {inv.voidReason && (
                <p className="text-xs text-muted-foreground">Storniert: {inv.voidReason}</p>
              )}
            </Panel>
          </>
        }
      />
    </div>
  );
}
