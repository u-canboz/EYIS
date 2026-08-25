import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listInvoicesFn,
  listDeliveryNotesFn,
  getDocumentSetupFn,
  getDocumentUrlFn,
} from "@/lib/commerce/documents/document.functions";
import { INVOICE_STATUS_LABELS, SETUP_LABELS, type InvoiceStatus } from "@/lib/commerce/documents/document.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { formatMoney } from "@/lib/commerce/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/dokumente/")({
  head: () => ({
    meta: [
      { title: "Dokumente – Commerce OS" },
      {
        name: "description",
        content:
          "Rechnungen, Gutschriften und Lieferscheine: Nummernkreise, Ausstellung, PDF-Download und revisionssichere Historie.",
      },
      { property: "og:title", content: "Dokumente – Commerce OS" },
      { property: "og:description", content: "Rechnungs- und Dokumentenverwaltung für deinen Shop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const { organizationId, shopId, can } = useActiveWorkspace();
  const [status, setStatus] = useState<InvoiceStatus | "all">("all");
  const [search, setSearch] = useState("");

  const list = useServerFn(listInvoicesFn);
  const listNotes = useServerFn(listDeliveryNotesFn);
  const getSetup = useServerFn(getDocumentSetupFn);
  const getUrl = useServerFn(getDocumentUrlFn);

  const invoices = useQuery({
    queryKey: ["invoices", organizationId, status, search],
    enabled: !!organizationId,
    queryFn: () =>
      list({
        data: {
          organizationId,
          status: status === "all" ? null : status,
          search: search || null,
        },
      }),
  });

  const deliveryNotes = useQuery({
    queryKey: ["delivery-notes", organizationId],
    enabled: !!organizationId,
    queryFn: () => listNotes({ data: { organizationId } }),
  });

  const setup = useQuery({
    queryKey: ["document-setup", organizationId, shopId],
    enabled: !!organizationId && !!shopId,
    queryFn: () => getSetup({ data: { organizationId, shopId } }),
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
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dokumente</h1>
          <p className="text-muted-foreground text-sm">
            Rechnungen, Gutschriften und Lieferscheine — nummeriert, unveränderbar, als PDF archiviert.
          </p>
        </div>
        {can("documents.settings") && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/dokumente/einstellungen">Einstellungen</Link>
          </Button>
        )}
      </header>

      {!!setup.data?.missing.length && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">Rechnungsstellung noch nicht einsatzbereit</p>
          <ul className="text-muted-foreground mt-1 list-inside list-disc">
            {setup.data.missing.map((m) => (
              <li key={m}>{SETUP_LABELS[m] ?? m}</li>
            ))}
          </ul>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link to="/app/dokumente/einstellungen">Jetzt einrichten</Link>
          </Button>
        </div>
      )}

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Rechnungen</TabsTrigger>
          <TabsTrigger value="delivery">Lieferscheine</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-4 pt-4">
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nummer, Kunde oder Bestellung"
              className="max-w-xs"
            />
            <Select value={status} onValueChange={(v) => setStatus(v as InvoiceStatus | "all")}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {invoices.isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : !invoices.data?.length ? (
            <p className="text-muted-foreground text-sm">
              Noch keine Rechnungen. Rechnungen entstehen aus einer Bestellung heraus.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {invoices.data.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <Link
                      to="/app/dokumente/$invoiceId"
                      params={{ invoiceId: inv.id }}
                      className="font-medium hover:underline"
                    >
                      {inv.invoiceNumber ?? "Entwurf"}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {inv.orderNumber ?? "—"} · {inv.customerName ?? "ohne Namen"} ·{" "}
                      {new Date(inv.createdAt).toLocaleDateString("de-DE")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={inv.status === "issued" ? "default" : "outline"}>
                      {INVOICE_STATUS_LABELS[inv.status]}
                    </Badge>
                    <span className="text-sm font-medium">
                      {formatMoney(inv.totalGrossMinor, inv.currencyCode)}
                    </span>
                    {inv.hasPdf && (
                      <Button size="sm" variant="ghost" onClick={() => open(inv.id)}>
                        PDF
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="delivery" className="space-y-4 pt-4">
          {deliveryNotes.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !deliveryNotes.data?.length ? (
            <p className="text-muted-foreground text-sm">
              Noch keine Lieferscheine. Sie entstehen beim Verpacken im Versand-Workspace.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {deliveryNotes.data.map((dn) => (
                <li key={dn.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{dn.documentNumber ?? "Entwurf"}</p>
                    <p className="text-muted-foreground text-xs">
                      {dn.orderNumber ?? "—"} · {dn.itemCount} Position(en) ·{" "}
                      {new Date(dn.createdAt).toLocaleDateString("de-DE")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      to="/app/bestellungen/$orderId"
                      params={{ orderId: dn.orderId }}
                      className="text-muted-foreground text-xs hover:underline"
                    >
                      Bestellung
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => open(dn.id)}>
                      PDF
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
