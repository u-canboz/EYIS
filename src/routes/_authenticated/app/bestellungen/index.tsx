import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listOrdersFn } from "@/lib/commerce/orders/order.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { formatMoney } from "@/lib/commerce/money";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  FULFILLMENT_STATUS_LABELS,
} from "@/lib/commerce/payments/payment-types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/data/StatusBadge";
import { orderTone, paymentTone, fulfillmentTone } from "@/components/data/status-tones";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shell/PageHeader";
import { FilterBar } from "@/components/data/FilterBar";
import { TabsBar } from "@/components/data/TabsBar";
import { SectionPanel } from "@/components/data/SectionPanel";
import { RecordList, RecordRow } from "@/components/data/RecordRow";
import { EmptyState, ErrorState, ListSkeleton, PermissionState } from "@/components/data/States";


export const Route = createFileRoute("/_authenticated/app/bestellungen/")({
  head: () => ({
    meta: [
      { title: "Bestellungen – Commerce OS" },
      {
        name: "description",
        content:
          "Alle Bestellungen mit Zahlungsstatus, Erstattungen und unveränderbaren Snapshots aus Checkout und Zahlung.",
      },
      { property: "og:title", content: "Bestellungen – Commerce OS" },
      { property: "og:description", content: "Bestell- und Zahlungsübersicht des Shops." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

/** Inbox segments — the way orders are actually worked through. */
const SEGMENTS = [
  { value: "all", label: "Alle" },
  { value: "open", label: "Offen" },
  { value: "unpaid", label: "Unbezahlt" },
  { value: "toship", label: "Zu versenden" },
  { value: "done", label: "Erledigt" },
] as const;

type Segment = (typeof SEGMENTS)[number]["value"];

function matchesSegment(
  o: { orderStatus: string; paymentStatus: string; fulfillmentStatus: string },
  segment: Segment,
) {
  switch (segment) {
    case "open":
      return o.orderStatus !== "cancelled" && o.orderStatus !== "completed";
    case "unpaid":
      return o.paymentStatus === "unpaid" || o.paymentStatus === "failed";
    case "toship":
      return o.paymentStatus === "paid" && o.fulfillmentStatus !== "fulfilled";
    case "done":
      return o.fulfillmentStatus === "fulfilled" || o.orderStatus === "completed";
    default:
      return true;
  }
}

function OrdersPage() {
  const { organizationId, shopId, can } = useActiveWorkspace();
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [orderStatus, setOrderStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");

  const list = useServerFn(listOrdersFn);
  const orders = useQuery({
    queryKey: ["orders", organizationId, shopId, search, orderStatus, paymentStatus],
    enabled: !!organizationId && can("orders.read"),
    queryFn: () =>
      list({
        data: {
          organizationId,
          shopId: shopId || null,
          search: search || null,
          orderStatus: orderStatus === "all" ? null : orderStatus,
          paymentStatus: paymentStatus === "all" ? null : paymentStatus,
        },
      }),
  });

  if (!can("orders.read")) {
    return <PermissionState what="Bestellungen" />;
  }

  const activeFilters = (orderStatus !== "all" ? 1 : 0) + (paymentStatus !== "all" ? 1 : 0);
  const all = orders.data ?? [];
  const rows = all.filter((o) => matchesSegment(o, segment));

  return (
    <div className="min-w-0">
      <PageHeader
        title="Bestellungen"
        description="Bestellungen entstehen ausschließlich nach serverseitig bestätigter Zahlung."
      />

      <TabsBar
        ariaLabel="Bestellungen filtern"
        value={segment}
        onChange={(v) => setSegment(v as Segment)}
        items={SEGMENTS.map((s) => ({
          value: s.value,
          label: s.label,
          count: all.filter((o) => matchesSegment(o, s.value)).length,
        }))}
      />

      <div className="mt-3">
        <FilterBar
          activeCount={activeFilters}
          onReset={() => {
            setOrderStatus("all");
            setPaymentStatus("all");
          }}
          search={
            <Input
              className="h-11 w-full"
              placeholder="Bestellnummer, E-Mail oder SKU"
              aria-label="Bestellungen suchen"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          }
          filters={
            <>
              <Select value={orderStatus} onValueChange={setOrderStatus}>
                <SelectTrigger aria-label="Bestellstatus" className="h-11 w-full md:w-48">
                  <SelectValue placeholder="Bestellstatus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Bestellstatus</SelectItem>
                  {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger aria-label="Zahlungsstatus" className="h-11 w-full md:w-48">
                  <SelectValue placeholder="Zahlungsstatus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Zahlungsstatus</SelectItem>
                  {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
        />
      </div>

      <div className="mt-4">
        {orders.isLoading ? (
          <ListSkeleton />
        ) : orders.error ? (
          <ErrorState description={(orders.error as Error).message} />
        ) : !rows.length ? (
          <EmptyState
            title="Keine Bestellungen"
            description="Für diese Auswahl gibt es keine Bestellungen. Setze Segment und Filter zurück, um alle Bestellungen zu sehen."
          />
        ) : (
          <SectionPanel flush>
            <RecordList>
              {rows.map((o) => (
                <RecordRow
                  key={o.id}
                  to="/app/bestellungen/$orderId"
                  params={{ orderId: o.id }}
                  title={
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate tabular-nums">{o.orderNumber}</span>
                      {o.environment === "test" ? (
                        <Badge variant="outline" className="shrink-0">
                          Test
                        </Badge>
                      ) : null}
                    </span>
                  }
                  subtitle={`${new Date(o.placedAt).toLocaleString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })} · ${o.email ?? "Gast"}`}
                  badges={
                    <>
                      <StatusBadge tone={paymentTone(o.paymentStatus)}>
                        {PAYMENT_STATUS_LABELS[o.paymentStatus]}
                      </StatusBadge>
                      <StatusBadge tone={fulfillmentTone(o.fulfillmentStatus)}>
                        {FULFILLMENT_STATUS_LABELS[o.fulfillmentStatus]}
                      </StatusBadge>
                      {o.orderStatus === "cancelled" ? (
                        <StatusBadge tone={orderTone(o.orderStatus)}>
                          {ORDER_STATUS_LABELS[o.orderStatus]}
                        </StatusBadge>
                      ) : null}
                    </>
                  }
                  trailing={formatMoney(o.totalMinor, o.currencyCode)}
                  {...(o.refundedMinor > 0
                    ? { trailingHint: `−${formatMoney(o.refundedMinor, o.currencyCode)}` }
                    : {})}
                />
              ))}
            </RecordList>
          </SectionPanel>
        )}
      </div>
    </div>
  );
}

