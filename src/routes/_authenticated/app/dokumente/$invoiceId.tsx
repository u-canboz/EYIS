import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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

export const Route = createFileRoute("/_authenticated/app/dokumente/$invoiceId")({
  head: () => ({
    meta: [
      { title: "Rechnung – Commerce OS" },
      {
        name: "description",
        content: "Positionen, Steuerausweis, Gutschriften und PDF-Versionen einer Rechnung.",
      },
      { property: "og:title", content: "Rechnung – Commerce OS" },
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
    mutationFn: () => regenerate({ data: { organizationId, documentType: "invoice", documentId: invoiceId } }),
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

  if (invoice.error) return <p className="text-destructive text-sm">{(invoice.error as Error).message}</p>;
  if (!invoice.data) return <Skeleton className="h-64 w-full" />;
  const inv = invoice.data;
  const currency = inv.currencyCode;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/app/dokumente" className="text-muted-foreground text-xs hover:underline">
            ← Alle Dokumente
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {inv.invoiceNumber ?? "Rechnungsentwurf"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {inv.orderNumber && (
              <Link
                to="/app/bestellungen/$orderId"
                params={{ orderId: inv.orderId }}
                className="hover:underline"
              >
                {inv.orderNumber}
              </Link>
            )}
            {inv.issueDate ? ` · Rechnungsdatum ${new Date(inv.issueDate).toLocaleDateString("de-DE")}` : " · Entwurf"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={inv.status === "issued" ? "default" : "outline"}>
            {INVOICE_STATUS_LABELS[inv.status]}
          </Badge>
          {inv.status === "draft" && (
            <Button
              size="sm"
              disabled={!can("invoices.issue") || issueMutation.isPending}
              onClick={() => issueMutation.mutate()}
            >
              Rechnung ausstellen
            </Button>
          )}
          {inv.files.some((f) => f.format === "pdf") && (
            <Button size="sm" variant="outline" onClick={() => open(inv.id)}>
              PDF öffnen
            </Button>
          )}
          {can("invoices.manage") && (
            <Button size="sm" variant="ghost" onClick={() => regenerateMutation.mutate()} disabled={regenerateMutation.isPending}>
              PDF neu erzeugen
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-lg border p-4">
            <h2 className="mb-3 font-medium">Positionen</h2>
            <ul className="space-y-2 text-sm">
              {inv.items.map((i) => (
                <li key={i.position} className="flex justify-between gap-3">
                  <span>
                    {i.quantity} × {i.productName}
                    {i.variantName && <span className="text-muted-foreground"> · {i.variantName}</span>}
                    {i.sku && <span className="text-muted-foreground"> · {i.sku}</span>}
                    <span className="text-muted-foreground"> · {rate(i.taxRateBasisPoints)}</span>
                  </span>
                  <span>{formatMoney(i.lineNetMinor, currency)}</span>
                </li>
              ))}
            </ul>
            <Separator className="my-3" />
            <dl className="space-y-1 text-sm">
              <Row label="Zwischensumme netto" value={formatMoney(inv.subtotalNetMinor, currency)} />
              {inv.shippingNetMinor > 0 && (
                <Row label="Versand netto" value={formatMoney(inv.shippingNetMinor, currency)} />
              )}
              {inv.taxBreakdown.map((t, idx) => (
                <Row
                  key={idx}
                  label={`USt ${rate(t.rateBasisPoints)}`}
                  value={formatMoney(t.taxMinor, currency)}
                />
              ))}
              <Row label="Umsatzsteuer" value={formatMoney(inv.taxTotalMinor, currency)} />
              <Row label="Gesamt brutto" value={formatMoney(inv.totalGrossMinor, currency)} strong />
              <Row label="Bezahlt" value={formatMoney(inv.paidMinor, currency)} />
              {inv.creditedMinor > 0 && (
                <Row label="Gutgeschrieben" value={`−${formatMoney(inv.creditedMinor, currency)}`} />
              )}
            </dl>
          </section>

          <section className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 text-sm font-medium">Rechnungsempfänger</h3>
              <p className="text-muted-foreground text-sm whitespace-pre-line">
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
            <div>
              <h3 className="mb-1 text-sm font-medium">Rechnungssteller</h3>
              <p className="text-muted-foreground text-sm whitespace-pre-line">
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
          </section>

          <section className="rounded-lg border p-4">
            <h2 className="mb-3 font-medium">Gutschriften</h2>
            {!inv.creditNotes.length ? (
              <p className="text-muted-foreground text-sm">Keine Gutschriften zu dieser Rechnung.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {inv.creditNotes.map((cn) => (
                  <li key={cn.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {cn.creditNoteNumber ?? "Entwurf"} ·{" "}
                      <span className="text-muted-foreground">{CREDIT_NOTE_STATUS_LABELS[cn.status]}</span>
                      {cn.reason && <span className="text-muted-foreground"> · {cn.reason}</span>}
                    </span>
                    <span className="flex items-center gap-2">
                      {formatMoney(cn.totalGrossMinor, cn.currencyCode)}
                      <Button size="sm" variant="ghost" onClick={() => open(cn.id)}>
                        PDF
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border p-4">
            <h2 className="mb-3 font-medium">Dateiversionen</h2>
            {!inv.files.length ? (
              <p className="text-muted-foreground text-sm">Noch keine Datei erzeugt.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {inv.files.map((f) => (
                  <li key={f.id} className="flex justify-between gap-3">
                    <span>
                      {f.format.toUpperCase()} · Version {f.version}
                      <span className="text-muted-foreground font-mono text-xs">
                        {" "}
                        · {f.checksum?.slice(0, 12)}
                      </span>
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(f.createdAt).toLocaleString("de-DE")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="space-y-2 rounded-lg border p-4">
            <h2 className="font-medium">Gutschrift erstellen</h2>
            <p className="text-muted-foreground text-xs">
              Noch gutschreibbar: {formatMoney(inv.creditableMinor, currency)}
            </p>
            <div className="grid gap-2">
              <Label className="text-xs">Betrag (brutto)</Label>
              <Input
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="z. B. 19,90"
              />
              <Label className="text-xs">Grund</Label>
              <Input value={creditReason} onChange={(e) => setCreditReason(e.target.value)} />
            </div>
            <Button
              size="sm"
              variant="outline"
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
          </section>

          <section className="space-y-2 rounded-lg border p-4">
            <h2 className="font-medium">{inv.status === "draft" ? "Entwurf verwerfen" : "Rechnung stornieren"}</h2>
            <p className="text-muted-foreground text-xs">
              Ausgestellte Rechnungen bleiben erhalten und werden nur als storniert markiert.
            </p>
            {inv.status !== "draft" && (
              <Input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Grund" />
            )}
            <Button
              size="sm"
              variant="ghost"
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
            {inv.voidReason && <p className="text-muted-foreground text-xs">Storniert: {inv.voidReason}</p>}
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
