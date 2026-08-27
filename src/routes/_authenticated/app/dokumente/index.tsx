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
import {
  INVOICE_STATUS_LABELS,
  SETUP_LABELS,
  type InvoiceStatus,
} from "@/lib/commerce/documents/document.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { formatMoney } from "@/lib/commerce/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shell/PageHeader";
import { ScrollTabs } from "@/components/shell/DetailLayout";
import { FilterBar } from "@/components/data/FilterBar";
import { RecordCard, RecordCardList } from "@/components/data/RecordCard";
import { TableScroll } from "@/components/data/TableScroll";
import { EmptyState, ListSkeleton } from "@/components/data/States";

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
      {
        property: "og:description",
        content: "Rechnungs- und Dokumentenverwaltung für deinen Shop.",
      },
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
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Dokumente"
        description="Rechnungen, Gutschriften und Lieferscheine — nummeriert, unveränderbar, als PDF archiviert."
        actions={
          can("documents.settings") ? (
            <Button variant="outline" className="h-11" asChild>
              <Link to="/app/dokumente/einstellungen">Einstellungen</Link>
            </Button>
          ) : undefined
        }
      />

      {!!setup.data?.missing.length && (
        <div className="min-w-0 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">Rechnungsstellung noch nicht einsatzbereit</p>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {setup.data.missing.map((m) => (
              <li key={m}>{SETUP_LABELS[m] ?? m}</li>
            ))}
          </ul>
          <Button variant="outline" className="mt-3 h-11" asChild>
            <Link to="/app/dokumente/einstellungen">Jetzt einrichten</Link>
          </Button>
        </div>
      )}

      <Tabs defaultValue="invoices">
        <ScrollTabs>
          <TabsList>
            <TabsTrigger value="invoices">Rechnungen</TabsTrigger>
            <TabsTrigger value="delivery">Lieferscheine</TabsTrigger>
          </TabsList>
        </ScrollTabs>

        <TabsContent value="invoices" className="min-w-0 space-y-4 pt-4">
          <FilterBar
            search={
              <Input
                className="h-11 w-full"
                aria-label="Rechnungen suchen"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nummer, Kunde oder Bestellung"
              />
            }
            filters={
              <Select value={status} onValueChange={(v) => setStatus(v as InvoiceStatus | "all")}>
                <SelectTrigger className="h-11 w-full md:w-56">
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
            }
          />

          {invoices.isLoading ? (
            <ListSkeleton />
          ) : !invoices.data?.length ? (
            <EmptyState
              title="Noch keine Rechnungen"
              description="Rechnungen entstehen aus einer Bestellung heraus."
            />
          ) : (
            <>
              <RecordCardList>
                {invoices.data.map((inv) => (
                  <RecordCard
                    key={inv.id}
                    title={
                      <Link to="/app/dokumente/$invoiceId" params={{ invoiceId: inv.id }}>
                        {inv.invoiceNumber ?? "Entwurf"}
                      </Link>
                    }
                    subtitle={`${inv.orderNumber ?? "—"} · ${inv.customerName ?? "ohne Namen"}`}
                    trailing={formatMoney(inv.totalGrossMinor, inv.currencyCode)}
                    badges={
                      <Badge variant={inv.status === "issued" ? "default" : "outline"}>
                        {INVOICE_STATUS_LABELS[inv.status]}
                      </Badge>
                    }
                    fields={[
                      {
                        label: "Erstellt",
                        value: new Date(inv.createdAt).toLocaleDateString("de-DE"),
                      },
                    ]}
                    actions={
                      inv.hasPdf ? (
                        <Button size="sm" variant="ghost" className="h-10" onClick={() => open(inv.id)}>
                          PDF
                        </Button>
                      ) : undefined
                    }
                  />
                ))}
              </RecordCardList>

              <TableScroll desktopOnly>
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-3 font-medium">Nummer</th>
                      <th className="p-3 font-medium">Bestellung</th>
                      <th className="p-3 font-medium">Kunde</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 text-right font-medium">Summe</th>
                      <th className="p-3 font-medium">Erstellt</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.data.map((inv) => (
                      <tr key={inv.id} className="border-t hover:bg-muted/40">
                        <td className="p-3">
                          <Link
                            to="/app/dokumente/$invoiceId"
                            params={{ invoiceId: inv.id }}
                            className="font-medium underline-offset-2 hover:underline"
                          >
                            {inv.invoiceNumber ?? "Entwurf"}
                          </Link>
                        </td>
                        <td className="p-3">{inv.orderNumber ?? "—"}</td>
                        <td className="max-w-[14rem] truncate p-3">
                          {inv.customerName ?? "ohne Namen"}
                        </td>
                        <td className="p-3">
                          <Badge variant={inv.status === "issued" ? "default" : "outline"}>
                            {INVOICE_STATUS_LABELS[inv.status]}
                          </Badge>
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {formatMoney(inv.totalGrossMinor, inv.currencyCode)}
                        </td>
                        <td className="p-3 tabular-nums text-muted-foreground">
                          {new Date(inv.createdAt).toLocaleDateString("de-DE")}
                        </td>
                        <td className="p-3 text-right">
                          {inv.hasPdf && (
                            <Button size="sm" variant="ghost" className="h-10" onClick={() => open(inv.id)}>
                              PDF
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            </>
          )}
        </TabsContent>

        <TabsContent value="delivery" className="min-w-0 space-y-4 pt-4">
          {deliveryNotes.isLoading ? (
            <ListSkeleton />
          ) : !deliveryNotes.data?.length ? (
            <EmptyState
              title="Noch keine Lieferscheine"
              description="Sie entstehen beim Verpacken im Versand-Workspace."
            />
          ) : (
            <>
              <RecordCardList>
                {deliveryNotes.data.map((dn) => (
                  <RecordCard
                    key={dn.id}
                    title={dn.documentNumber ?? "Entwurf"}
                    subtitle={`${dn.itemCount} Position(en)`}
                    fields={[
                      { label: "Bestellung", value: dn.orderNumber ?? "—" },
                      {
                        label: "Erstellt",
                        value: new Date(dn.createdAt).toLocaleDateString("de-DE"),
                      },
                    ]}
                    actions={
                      <>
                        <Link
                          to="/app/bestellungen/$orderId"
                          params={{ orderId: dn.orderId }}
                          className="inline-flex min-h-9 items-center text-xs text-muted-foreground hover:underline"
                        >
                          Bestellung
                        </Link>
                        <Button size="sm" variant="ghost" className="h-10" onClick={() => open(dn.id)}>
                          PDF
                        </Button>
                      </>
                    }
                  />
                ))}
              </RecordCardList>

              <TableScroll desktopOnly>
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-3 font-medium">Nummer</th>
                      <th className="p-3 font-medium">Bestellung</th>
                      <th className="p-3 text-right font-medium">Positionen</th>
                      <th className="p-3 font-medium">Erstellt</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryNotes.data.map((dn) => (
                      <tr key={dn.id} className="border-t hover:bg-muted/40">
                        <td className="p-3 font-medium">{dn.documentNumber ?? "Entwurf"}</td>
                        <td className="p-3">
                          <Link
                            to="/app/bestellungen/$orderId"
                            params={{ orderId: dn.orderId }}
                            className="hover:underline"
                          >
                            {dn.orderNumber ?? "—"}
                          </Link>
                        </td>
                        <td className="p-3 text-right tabular-nums">{dn.itemCount}</td>
                        <td className="p-3 tabular-nums text-muted-foreground">
                          {new Date(dn.createdAt).toLocaleDateString("de-DE")}
                        </td>
                        <td className="p-3 text-right">
                          <Button size="sm" variant="ghost" className="h-10" onClick={() => open(dn.id)}>
                            PDF
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
