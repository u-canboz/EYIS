import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listReturnsFn } from "@/lib/commerce/returns/return.functions";
import {
  RETURN_REASON_LABELS,
  RETURN_STATUS_LABELS,
  type ReturnStatus,
} from "@/lib/commerce/returns/return.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { formatMoney } from "@/lib/commerce/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shell/PageHeader";
import { ScrollTabs } from "@/components/shell/DetailLayout";
import { FilterBar } from "@/components/data/FilterBar";
import { RecordCard, RecordCardList } from "@/components/data/RecordCard";
import { TableScroll } from "@/components/data/TableScroll";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/data/States";

export const Route = createFileRoute("/_authenticated/app/retouren/")({
  head: () => ({
    meta: [
      { title: "Retouren – Commerce OS" },
      {
        name: "description",
        content: "RMA-Workspace: Retouren genehmigen, Wareneingang buchen, prüfen und erstatten.",
      },
      { property: "og:title", content: "Retouren – Commerce OS" },
      { property: "og:description", content: "Retourenprozess von Antrag bis Erstattung steuern." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReturnsPage,
});

const FILTERS: { key: string; label: string; statuses: ReturnStatus[] | null }[] = [
  {
    key: "open",
    label: "Offen",
    statuses: ["requested", "authorized", "in_transit", "received", "inspection"],
  },
  { key: "requested", label: "Neu beantragt", statuses: ["requested"] },
  { key: "inspection", label: "In Prüfung", statuses: ["received", "inspection"] },
  { key: "settle", label: "Zu erstatten", statuses: ["approved", "partially_approved"] },
  {
    key: "done",
    label: "Abgeschlossen",
    statuses: ["completed", "refunded", "rejected", "cancelled"],
  },
  { key: "all", label: "Alle", statuses: null },
];

function ReturnsPage() {
  const { organizationId, shopId } = useActiveWorkspace();
  const [tab, setTab] = useState("open");
  const [search, setSearch] = useState("");
  const fetchReturns = useServerFn(listReturnsFn);
  const statuses = FILTERS.find((f) => f.key === tab)?.statuses ?? null;

  const returns = useQuery({
    queryKey: ["returns", organizationId, shopId, tab, search],
    enabled: !!organizationId,
    queryFn: () =>
      fetchReturns({
        data: { organizationId, shopId: shopId || null, statuses, search: search || null },
      }),
  });

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Retouren"
        description="Von der Anfrage über Wareneingang und Prüfung bis zur Erstattung."
        actions={
          <Button asChild variant="outline" className="h-11">
            <Link to="/app/retouren/einstellungen">Retouren-Einstellungen</Link>
          </Button>
        }
      />

      <ScrollTabs>
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            className="h-9"
            variant={tab === f.key ? "default" : "outline"}
            onClick={() => setTab(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </ScrollTabs>

      <FilterBar
        filters={null}
        search={
          <Input
            className="h-11 w-full"
            placeholder="RMA- oder Bestellnummer"
            aria-label="Retouren suchen"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        }
      />

      {returns.isLoading ? (
        <ListSkeleton />
      ) : returns.error ? (
        <ErrorState description={(returns.error as Error).message} />
      ) : !returns.data?.length ? (
        <EmptyState
          title="Keine Retouren"
          description="Für diese Auswahl gibt es keine Retouren."
        />
      ) : (
        <>
          <RecordCardList>
            {returns.data.map((r) => (
              <Link
                key={r.id}
                to="/app/retouren/$returnId"
                params={{ returnId: r.id }}
                className="min-w-0"
              >
                <RecordCard
                  interactive
                  title={r.returnNumber}
                  subtitle={r.customerEmail ?? "Gast"}
                  trailing={formatMoney(r.refundTotalMinor, r.currencyCode)}
                  badges={
                    <>
                      <Badge variant="secondary">{RETURN_STATUS_LABELS[r.status]}</Badge>
                      <Badge variant="outline">{RETURN_REASON_LABELS[r.reasonCategory]}</Badge>
                    </>
                  }
                  fields={[
                    { label: "Bestellung", value: r.orderNumber },
                    { label: "Positionen", value: r.itemCount },
                    {
                      label: "Beantragt",
                      value: new Date(r.requestedAt).toLocaleDateString("de-DE"),
                    },
                  ]}
                />
              </Link>
            ))}
          </RecordCardList>

          <TableScroll desktopOnly>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">RMA</th>
                  <th className="p-3 font-medium">Bestellung</th>
                  <th className="p-3 font-medium">Grund</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 text-right font-medium">Positionen</th>
                  <th className="p-3 text-right font-medium">Erstattung</th>
                  <th className="p-3 font-medium">Beantragt</th>
                </tr>
              </thead>
              <tbody>
                {returns.data.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/40">
                    <td className="p-3">
                      <Link
                        to="/app/retouren/$returnId"
                        params={{ returnId: r.id }}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {r.returnNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground">{r.customerEmail ?? "Gast"}</p>
                    </td>
                    <td className="p-3">
                      <Link
                        to="/app/bestellungen/$orderId"
                        params={{ orderId: r.orderId }}
                        className="hover:underline"
                      >
                        {r.orderNumber}
                      </Link>
                    </td>
                    <td className="p-3">{RETURN_REASON_LABELS[r.reasonCategory]}</td>
                    <td className="p-3">
                      <Badge variant="secondary">{RETURN_STATUS_LABELS[r.status]}</Badge>
                    </td>
                    <td className="p-3 text-right tabular-nums">{r.itemCount}</td>
                    <td className="p-3 text-right tabular-nums">
                      {formatMoney(r.refundTotalMinor, r.currencyCode)}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(r.requestedAt).toLocaleDateString("de-DE")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </>
      )}
    </div>
  );
}
