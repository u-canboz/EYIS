import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listReturnsFn } from "@/lib/commerce/returns/return.functions";
import { RETURN_REASON_LABELS, RETURN_STATUS_LABELS, type ReturnStatus } from "@/lib/commerce/returns/return.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { formatMoney } from "@/lib/commerce/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/retouren/")({
  head: () => ({
    meta: [
      { title: "Retouren – Commerce OS" },
      { name: "description", content: "RMA-Workspace: Retouren genehmigen, Wareneingang buchen, prüfen und erstatten." },
      { property: "og:title", content: "Retouren – Commerce OS" },
      { property: "og:description", content: "Retourenprozess von Antrag bis Erstattung steuern." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReturnsPage,
});

const FILTERS: { key: string; label: string; statuses: ReturnStatus[] | null }[] = [
  { key: "open", label: "Offen", statuses: ["requested", "authorized", "in_transit", "received", "inspection"] },
  { key: "requested", label: "Neu beantragt", statuses: ["requested"] },
  { key: "inspection", label: "In Prüfung", statuses: ["received", "inspection"] },
  { key: "settle", label: "Zu erstatten", statuses: ["approved", "partially_approved"] },
  { key: "done", label: "Abgeschlossen", statuses: ["completed", "refunded", "rejected", "cancelled"] },
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
      fetchReturns({ data: { organizationId, shopId: shopId || null, statuses, search: search || null } }),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Retouren</h1>
          <p className="text-sm text-muted-foreground">
            Von der Anfrage über Wareneingang und Prüfung bis zur Erstattung.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/app/retouren/einstellungen">Retouren-Einstellungen</Link>
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Button key={f.key} size="sm" variant={tab === f.key ? "default" : "outline"} onClick={() => setTab(f.key)}>
            {f.label}
          </Button>
        ))}
        <Input
          className="ml-auto w-56"
          placeholder="RMA- oder Bestellnummer"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {returns.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !returns.data?.length ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Keine Retouren in dieser Auswahl.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">RMA</th>
                <th className="px-4 py-3">Bestellung</th>
                <th className="px-4 py-3">Grund</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Positionen</th>
                <th className="px-4 py-3 text-right">Erstattung</th>
                <th className="px-4 py-3">Beantragt</th>
              </tr>
            </thead>
            <tbody>
              {returns.data.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      to="/app/retouren/$returnId"
                      params={{ returnId: r.id }}
                      className="font-medium hover:underline"
                    >
                      {r.returnNumber}
                    </Link>
                    <p className="text-xs text-muted-foreground">{r.customerEmail ?? "Gast"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to="/app/bestellungen/$orderId"
                      params={{ orderId: r.orderId }}
                      className="hover:underline"
                    >
                      {r.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{RETURN_REASON_LABELS[r.reasonCategory]}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{RETURN_STATUS_LABELS[r.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">{r.itemCount}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(r.refundTotalMinor, r.currencyCode)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(r.requestedAt).toLocaleDateString("de-DE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
