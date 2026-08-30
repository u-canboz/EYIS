import { createFileRoute } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { getWorkspace } from "@/lib/commerce/workspace.functions";
import { listOrdersFn } from "@/lib/commerce/orders/order.functions";
import { listReturnsFn } from "@/lib/commerce/returns/return.functions";
import { lowStockSummary } from "@/lib/commerce/inventory.functions";
import { automationInboxFn } from "@/lib/commerce/automation/automation.functions";
import { listCommunicationsFn } from "@/lib/commerce/communications/communication.functions";
import { useWorkspaceStore } from "@/lib/commerce/useWorkspaceStore";
import { formatMoney } from "@/lib/commerce/money";
import { PageHeader } from "@/eyis/shell/PageHeader";
import { SectionPanel, SectionLink } from "@/eyis/data/SectionPanel";
import { RecordList, RecordRow } from "@/eyis/data/RecordRow";
import {
  AttentionList,
  DistributionBar,
  LeadMetric,
  SubMetric,
} from "@/eyis/data/Metrics";
import { StatusBadge } from "@/eyis/data/StatusBadge";
import { paymentTone } from "@/eyis/data/status-tones";
import { PAYMENT_STATUS_LABELS } from "@/lib/commerce/payments/payment-types";
import { EmptyState, ListSkeleton } from "@/eyis/data/States";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "Betriebsübersicht – EYIS" },
      {
        name: "description",
        content:
          "Operative Startseite: Umsatz, offene Bestellungen, Zahlungen, Bestände und Aktivitäten auf einen Blick.",
      },
      { property: "og:title", content: "Betriebsübersicht – EYIS" },
      {
        property: "og:description",
        content: "Umsatz, offene Bestellungen, Zahlungen und Bestände in einer Ansicht.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Overview,
});

const DAY = 86_400_000;

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function Overview() {
  const { orgId } = useWorkspaceStore();
  const fetchWorkspace = useServerFn(getWorkspace);
  const fetchOrders = useServerFn(listOrdersFn);
  const fetchReturns = useServerFn(listReturnsFn);
  const fetchLowStock = useServerFn(lowStockSummary);
  const fetchInbox = useServerFn(automationInboxFn);
  const fetchComms = useServerFn(listCommunicationsFn);

  const workspace = useQuery({ queryKey: ["workspace"], queryFn: () => fetchWorkspace() });
  const shopId = workspace.data?.shops?.[0]?.id ?? "";
  const enabled = !!orgId;
  const scoped = enabled && !!shopId;

  const [orders, returns, stock, inbox, comms] = useQueries({
    queries: [
      {
        queryKey: ["dash-orders", orgId],
        queryFn: () => fetchOrders({ data: { organizationId: orgId } }),
        enabled,
      },
      {
        queryKey: ["dash-returns", orgId],
        queryFn: () => fetchReturns({ data: { organizationId: orgId } }),
        enabled,
      },
      {
        queryKey: ["dash-stock", orgId, shopId],
        queryFn: () => fetchLowStock({ data: { organizationId: orgId, shopId } }),
        enabled: scoped,
      },
      {
        queryKey: ["dash-inbox", orgId, shopId],
        queryFn: () => fetchInbox({ data: { organizationId: orgId, shopId } }),
        enabled: scoped,
      },
      {
        queryKey: ["dash-comms", orgId, shopId],
        queryFn: () =>
          fetchComms({ data: { organizationId: orgId, shopId, status: "failed", limit: 25 } }),
        enabled: scoped,
      },
    ],
  });

  const org = workspace.data?.organizations.find((o) => o.id === orgId);
  const orderRows = orders.data ?? [];
  const billable = orderRows.filter((o) => o.orderStatus !== "cancelled");
  const currency = orderRows[0]?.currencyCode ?? "EUR";

  const todayKey = dayKey(new Date().toISOString());
  const revenueToday = billable
    .filter((o) => dayKey(o.placedAt) === todayKey)
    .reduce((sum, o) => sum + o.totalMinor, 0);
  const ordersToday = billable.filter((o) => dayKey(o.placedAt) === todayKey).length;

  // 14-Tage-Verlauf aus echten Bestelldaten.
  const series: number[] = [];
  let prevWeek = 0;
  let thisWeek = 0;
  for (let i = 13; i >= 0; i--) {
    const key = dayKey(new Date(Date.now() - i * DAY).toISOString());
    const value = billable
      .filter((o) => dayKey(o.placedAt) === key)
      .reduce((sum, o) => sum + o.totalMinor, 0);
    series.push(value);
    if (i >= 7) prevWeek += value;
    else thisWeek += value;
  }
  const trend = prevWeek > 0 ? ((thisWeek - prevWeek) / prevWeek) * 100 : undefined;

  const openOrders = orderRows.filter(
    (o) => o.orderStatus !== "cancelled" && o.fulfillmentStatus !== "fulfilled",
  );
  const unpaid = orderRows.filter(
    (o) => o.paymentStatus === "unpaid" || o.paymentStatus === "failed",
  );
  const paidMinor = billable
    .filter((o) => o.paymentStatus === "paid")
    .reduce((sum, o) => sum + o.totalMinor, 0);
  const shippingIssues = orderRows.filter(
    (o) => o.fulfillmentStatus === "partially_fulfilled" && o.orderStatus !== "cancelled",
  );
  const openReturns = (returns.data ?? []).filter(
    (r) => r.status !== "completed" && r.status !== "rejected" && r.status !== "cancelled",
  );

  const openTasks = inbox.data?.tasks ?? [];
  const automationFailures = inbox.data?.failures ?? [];
  const failedComms = comms.data ?? [];
  const outOfStock = stock.data?.out ?? 0;
  const lowStock = stock.data?.low ?? 0;

  const loading = orders.isLoading || workspace.isLoading;

  const fulfillment = [
    {
      key: "open",
      label: "Offen",
      value: billable.filter((o) => o.fulfillmentStatus === "unfulfilled").length,
      className: "bg-warning",
    },
    {
      key: "partial",
      label: "Teilweise",
      value: billable.filter((o) => o.fulfillmentStatus === "partially_fulfilled").length,
      className: "bg-info",
    },
    {
      key: "done",
      label: "Versendet",
      value: billable.filter((o) => o.fulfillmentStatus === "fulfilled").length,
      className: "bg-success",
    },
    {
      key: "cancelled",
      label: "Storniert",
      value: orderRows.filter((o) => o.orderStatus === "cancelled").length,
      className: "bg-muted-foreground",
    },
  ];

  return (
    <div className="min-w-0">
      <PageHeader eyebrow={<span className="truncate">Betrieb</span>} title={org?.name ?? "Übersicht"} />

      <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
        {/* 1 — Umsatz: die eine große Zahl, mit dem einzigen Diagramm der Seite. */}
        <SectionPanel>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <>
              <LeadMetric
                label="Umsatz heute"
                value={formatMoney(revenueToday, currency)}
                caption={`${ordersToday} Bestellungen heute · 14-Tage-Verlauf`}
                {...(typeof trend === "number" ? { trendPercent: trend } : {})}
                series={series}
              />
              {/* 2 — Bestellungen & Zahlungen direkt darunter. */}
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4">
                <SubMetric
                  label="Bestellungen gesamt"
                  value={orderRows.length}
                  caption={`${openOrders.length} offen`}
                  to="/app/bestellungen"
                />
                <SubMetric
                  label="Zahlungseingang"
                  value={formatMoney(paidMinor, currency)}
                  caption={`${unpaid.length} offen oder fehlgeschlagen`}
                  to="/app/zahlungen"
                />
              </div>
            </>
          )}
        </SectionPanel>

        {/* 3 — Operative Aufmerksamkeit als eine scanbare Liste. */}
        <SectionPanel title="Braucht Aufmerksamkeit" flush bodyClassName="px-4 pb-3 sm:px-5">
          {loading ? (
            <ListSkeleton rows={4} />
          ) : (
            <AttentionList
              items={[
                {
                  key: "payments",
                  label: "Zahlung offen",
                  count: unpaid.length,
                  hint: "ausstehend oder fehlgeschlagen",
                  to: "/app/zahlungen",
                  tone: "critical",
                },
                {
                  key: "orders",
                  label: "Bestellungen zu bearbeiten",
                  count: openOrders.length,
                  hint: "noch nicht versendet",
                  to: "/app/bestellungen",
                  tone: "warn",
                },
                {
                  key: "shipping",
                  label: "Versandprobleme",
                  count: shippingIssues.length,
                  hint: "teilweise versendet",
                  to: "/app/versand",
                  tone: "warn",
                },
                {
                  key: "returns",
                  label: "Retouren",
                  count: openReturns.length,
                  hint: "in Bearbeitung",
                  to: "/app/retouren",
                  tone: "warn",
                },
                {
                  key: "comms",
                  label: "Fehlgeschlagene E-Mails",
                  count: failedComms.length,
                  hint: "nicht zugestellt",
                  to: "/app/kommunikation/verlauf",
                  tone: "critical",
                },
                {
                  key: "automation",
                  label: "Automationsfehler",
                  count: automationFailures.length,
                  hint: "fehlgeschlagene Läufe",
                  to: "/app/automationen/verlauf",
                  tone: "critical",
                },
                {
                  key: "tasks",
                  label: "Offene Aufgaben",
                  count: openTasks.length,
                  hint: "zugewiesen im Team",
                  to: "/app/automationen/aufgaben",
                  tone: "neutral",
                },
              ]}
            />
          )}
        </SectionPanel>

        <div className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-2">
          {/* 4 — Bestellstatus. */}
          <SectionPanel title="Bestellstatus" description="Verteilung über alle Bestellungen">
            {loading ? <Skeleton className="h-16 w-full" /> : <DistributionBar segments={fulfillment} />}
          </SectionPanel>

          {/* 5 — Kritische Bestände. */}
          <SectionPanel
            title="Kritische Bestände"
            action={<SectionLink to="/app/lager">Lager</SectionLink>}
          >
            {stock.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : outOfStock + lowStock === 0 ? (
              <EmptyState
                title="Bestände in Ordnung"
                description="Kein Artikel unter dem Meldebestand."
              />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <SubMetric
                  label="Ausverkauft"
                  value={outOfStock}
                  caption="sofort nachbestellen"
                  to="/app/lager"
                />
                <SubMetric
                  label="Niedriger Bestand"
                  value={lowStock}
                  caption="unter Meldebestand"
                  to="/app/lager"
                />
              </div>
            )}
          </SectionPanel>
        </div>

        {/* 6 — Letzte Bestellungen und Aktivitäten. */}
        <SectionPanel
          title="Letzte Bestellungen"
          action={<SectionLink to="/app/bestellungen" />}
          flush
        >
          {orders.isLoading ? (
            <div className="px-4 pb-4 sm:px-5">
              <ListSkeleton rows={4} />
            </div>
          ) : orderRows.length === 0 ? (
            <div className="px-4 pb-4 sm:px-5">
              <EmptyState
                title="Noch keine Bestellungen"
                description="Sobald ein Checkout abgeschlossen wird, erscheint die Bestellung hier."
              />
            </div>
          ) : (
            <RecordList className="border-t border-border">
              {orderRows.slice(0, 8).map((o) => (
                <RecordRow
                  key={o.id}
                  to="/app/bestellungen/$orderId"
                  params={{ orderId: o.id }}
                  title={o.orderNumber}
                  subtitle={o.email ?? "Gast"}
                  badges={<StatusBadge tone={paymentTone(o.paymentStatus)}>{PAYMENT_STATUS_LABELS[o.paymentStatus]}</StatusBadge>}
                  trailing={formatMoney(o.totalMinor, o.currencyCode)}
                  trailingHint={new Date(o.placedAt).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                />
              ))}
            </RecordList>
          )}
        </SectionPanel>

        {(automationFailures.length > 0 || openTasks.length > 0) && (
          <SectionPanel title="Aktivitäten" description="Aufgaben und Störungen" flush>
            <ul className="min-w-0 divide-y divide-border border-t border-border">
              {automationFailures.slice(0, 4).map((f) => (
                <li
                  key={f.id}
                  className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 px-4 py-3 sm:px-5"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                  <div className="min-w-0">
                    <p className="min-w-0 truncate text-sm font-medium">
                      {f.ruleName ?? "Automationslauf"}
                    </p>
                    <p className="min-w-0 text-xs text-pretty text-muted-foreground">
                      {f.error ?? f.errorCode ?? "Lauf fehlgeschlagen"}
                    </p>
                  </div>
                </li>
              ))}
              {openTasks.slice(0, 5).map((t) => (
                <li
                  key={t.id}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-5"
                >
                  <p className="min-w-0 truncate text-sm">{t.title}</p>
                  <Badge variant="outline" className="shrink-0 capitalize">
                    {t.priority}
                  </Badge>
                </li>
              ))}
            </ul>
          </SectionPanel>
        )}
      </div>
    </div>
  );
}
