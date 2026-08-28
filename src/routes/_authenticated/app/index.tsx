import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  CheckSquare,
  Mail,
  PackageCheck,
  RotateCcw,
  Truck,
  Warehouse,
  Workflow,
} from "lucide-react";
import { getWorkspace } from "@/lib/commerce/workspace.functions";
import { listOrdersFn } from "@/lib/commerce/orders/order.functions";
import { listReturnsFn } from "@/lib/commerce/returns/return.functions";
import { lowStockSummary } from "@/lib/commerce/inventory.functions";
import { automationInboxFn } from "@/lib/commerce/automation/automation.functions";
import { listCommunicationsFn } from "@/lib/commerce/communications/communication.functions";
import { useWorkspaceStore } from "@/lib/commerce/useWorkspaceStore";
import { formatMoney } from "@/lib/commerce/money";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel } from "@/components/shell/DetailLayout";
import { EmptyState, ListSkeleton } from "@/components/data/States";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "Betriebsübersicht – Commerce OS" },
      {
        name: "description",
        content:
          "Operative Startseite: offene Bestellungen, Retouren, Bestände, Versand, Kommunikation und Aufgaben auf einen Blick.",
      },
      { property: "og:title", content: "Betriebsübersicht – Commerce OS" },
      {
        property: "og:description",
        content: "Was heute Aufmerksamkeit braucht — Bestellungen, Retouren, Bestände, Aufgaben.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Overview,
});

type Attention = {
  key: string;
  label: string;
  count: number;
  hint: string;
  to: string;
  icon: typeof ClipboardList;
  tone: "critical" | "warn" | "neutral";
};

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
  const openOrders = orderRows.filter(
    (o) => o.orderStatus !== "cancelled" && o.fulfillmentStatus !== "fulfilled",
  );
  const unpaid = orderRows.filter(
    (o) => o.paymentStatus === "unpaid" || o.paymentStatus === "failed",
  );
  const shippingIssues = orderRows.filter(
    (o) => o.fulfillmentStatus === "partially_fulfilled" && o.orderStatus !== "cancelled",
  );
  const openReturns = (returns.data ?? []).filter(
    (r) => r.status !== "completed" && r.status !== "rejected" && r.status !== "cancelled",
  );

  const openTasks = inbox.data?.tasks ?? [];
  const automationFailures = inbox.data?.failures ?? [];
  const failedComms = comms.data ?? [];

  const loading = orders.isLoading || returns.isLoading || inbox.isLoading;

  const attention: Attention[] = [
    {
      key: "orders",
      label: "Offene Bestellungen",
      count: openOrders.length,
      hint: "warten auf Bearbeitung",
      to: "/app/bestellungen",
      icon: ClipboardList,
      tone: openOrders.length > 0 ? "warn" : "neutral",
    },
    {
      key: "payments",
      label: "Zahlung offen",
      count: unpaid.length,
      hint: "ausstehend oder fehlgeschlagen",
      to: "/app/zahlungen",
      icon: PackageCheck,
      tone: unpaid.length > 0 ? "critical" : "neutral",
    },
    {
      key: "returns",
      label: "Retouren",
      count: openReturns.length,
      hint: "in Bearbeitung",
      to: "/app/retouren",
      icon: RotateCcw,
      tone: openReturns.length > 0 ? "warn" : "neutral",
    },
    {
      key: "stock",
      label: "Niedrige Bestände",
      count: (stock.data?.low ?? 0) + (stock.data?.out ?? 0),
      hint: `${stock.data?.out ?? 0} ausverkauft`,
      to: "/app/lager",
      icon: Warehouse,
      tone: (stock.data?.out ?? 0) > 0 ? "critical" : "warn",
    },
    {
      key: "shipping",
      label: "Versandprobleme",
      count: shippingIssues.length,
      hint: "teilweise versendet",
      to: "/app/versand",
      icon: Truck,
      tone: shippingIssues.length > 0 ? "warn" : "neutral",
    },
    {
      key: "comms",
      label: "Fehlgeschlagene E-Mails",
      count: failedComms.length,
      hint: "nicht zugestellt",
      to: "/app/kommunikation/verlauf",
      icon: Mail,
      tone: failedComms.length > 0 ? "critical" : "neutral",
    },
    {
      key: "automation",
      label: "Automationsfehler",
      count: automationFailures.length,
      hint: "fehlgeschlagene Läufe",
      to: "/app/automationen/verlauf",
      icon: Workflow,
      tone: automationFailures.length > 0 ? "critical" : "neutral",
    },
    {
      key: "tasks",
      label: "Offene Aufgaben",
      count: openTasks.length,
      hint: "zugewiesen im Team",
      to: "/app/automationen/aufgaben",
      icon: CheckSquare,
      tone: openTasks.length > 0 ? "warn" : "neutral",
    },
  ];

  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow={<span className="truncate">Betrieb</span>}
        title={org?.name ?? "Übersicht"}
        description="Was heute Aufmerksamkeit braucht. Jede Kachel führt direkt in die zuständige Ansicht."
      />

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {attention.map((a) => (
            <AttentionTile {...a} key={a.key} />
          ))}
        </div>
      )}

      <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-2">
        <Panel
          title="Zuletzt eingegangen"
          description="Die zehn jüngsten Bestellungen"
          actions={
            <Link
              to="/app/bestellungen"
              className="-mr-2 inline-flex min-h-11 min-w-11 items-center justify-end gap-1 px-2 text-xs font-medium text-primary"
            >
              Alle <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
          bodyClassName="p-0"
        >
          {orders.isLoading ? (
            <div className="p-4">
              <ListSkeleton rows={4} />
            </div>
          ) : orderRows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Noch keine Bestellungen"
                description="Sobald ein Checkout abgeschlossen wird, erscheint die Bestellung hier."
              />
            </div>
          ) : (
            <ul className="min-w-0 divide-y divide-border">
              {orderRows.slice(0, 10).map((o) => (
                <li key={o.id} className="min-w-0">
                  <Link
                    to="/app/bestellungen/$orderId"
                    params={{ orderId: o.id }}
                    className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 hover:bg-muted/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium tabular-nums">
                        {o.orderNumber}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {o.email ?? "Gast"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <StatusDot status={o.paymentStatus} />
                      <span className="text-sm font-medium tabular-nums">
                        {formatMoney(o.totalMinor, o.currencyCode)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Aufgaben & Störungen"
          description="Offene Arbeit aus Automationen und Team"
          bodyClassName="p-0"
        >
          {openTasks.length === 0 && automationFailures.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Nichts blockiert"
                description="Keine offenen Aufgaben und keine fehlgeschlagenen Automationsläufe."
              />
            </div>
          ) : (
            <ul className="min-w-0 divide-y divide-border">
              {automationFailures.slice(0, 5).map((f) => (
                <li
                  key={f.id}
                  className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 px-4 py-3"
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
              {openTasks.slice(0, 6).map((t) => (
                <li
                  key={t.id}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
                >
                  <p className="min-w-0 truncate text-sm">{t.title}</p>
                  <Badge variant="outline" className="shrink-0 capitalize">
                    {t.priority}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function AttentionTile({ label, count, hint, to, icon: Icon, tone }: Attention) {
  const alert = count > 0;
  return (
    <Link
      to={to}
      className={cn(
        "group grid min-w-0 grid-rows-[auto_auto_auto] gap-1 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/50 hover:bg-muted/40",
        alert && tone === "critical"
          ? "border-destructive/40"
          : alert && tone === "warn"
            ? "border-warning/45"
            : "border-border",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon
          className={cn(
            "size-4 shrink-0",
            !alert
              ? "text-muted-foreground"
              : tone === "critical"
                ? "text-destructive"
                : "text-warning",
          )}
          aria-hidden
        />
        <span className="min-w-0 truncate text-xs font-medium text-muted-foreground">{label}</span>
      </span>
      <span
        className={cn(
          "font-display text-2xl leading-none font-semibold tabular-nums",
          !alert && "text-muted-foreground",
        )}
      >
        {count}
      </span>
      <span className="min-w-0 truncate text-xs text-muted-foreground">{hint}</span>
    </Link>
  );
}

function StatusDot({ status }: { status: string }): ReactNode {
  const tone =
    status === "paid"
      ? "bg-success"
      : status === "failed"
        ? "bg-destructive"
        : status === "refunded"
          ? "bg-muted-foreground"
          : "bg-warning";
  return <span className={cn("size-2 shrink-0 rounded-full", tone)} aria-label={status} />;
}

