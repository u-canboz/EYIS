import { createFileRoute, Link } from "@tanstack/react-router";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shell/PageHeader";
import { FilterBar } from "@/components/data/FilterBar";
import { RecordCard, RecordCardList } from "@/components/data/RecordCard";
import { TableScroll } from "@/components/data/TableScroll";
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

function OrdersPage() {
  const { organizationId, shopId, can } = useActiveWorkspace();
  const [search, setSearch] = useState("");
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

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Bestellungen"
        description="Bestellungen entstehen ausschließlich nach serverseitig bestätigter Zahlung."
      />

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

      {orders.isLoading ? (
        <ListSkeleton />
      ) : orders.error ? (
        <ErrorState description={(orders.error as Error).message} />
      ) : !orders.data?.length ? (
        <EmptyState
          title="Keine Bestellungen"
          description="Für diese Filter gibt es keine Bestellungen. Setze die Filter zurück, um alle Bestellungen zu sehen."
        />
      ) : (
        <>
          <RecordCardList>
            {orders.data.map((o) => (
              <Link
                key={o.id}
                to="/app/bestellungen/$orderId"
                params={{ orderId: o.id }}
                className="min-w-0"
              >
                <RecordCard
                  interactive
                  title={o.orderNumber}
                  subtitle={o.email ?? "Gast"}
                  trailing={formatMoney(o.totalMinor, o.currencyCode)}
                  badges={
                    <>
                      <Badge variant="secondary">{ORDER_STATUS_LABELS[o.orderStatus]}</Badge>
                      <Badge variant={o.paymentStatus === "paid" ? "default" : "outline"}>
                        {PAYMENT_STATUS_LABELS[o.paymentStatus]}
                      </Badge>
                      <Badge variant="outline">
                        {FULFILLMENT_STATUS_LABELS[o.fulfillmentStatus]}
                      </Badge>
                      {o.environment === "test" ? <Badge variant="outline">Test</Badge> : null}
                    </>
                  }
                  fields={[
                    { label: "Datum", value: new Date(o.placedAt).toLocaleString("de-DE") },
                    ...(o.refundedMinor > 0
                      ? [
                          {
                            label: "Erstattet",
                            value: `−${formatMoney(o.refundedMinor, o.currencyCode)}`,
                          },
                        ]
                      : []),
                  ]}
                />
              </Link>
            ))}
          </RecordCardList>

          <TableScroll desktopOnly>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">Nummer</th>
                  <th className="p-3 font-medium">Datum</th>
                  <th className="p-3 font-medium">Kunde</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Zahlung</th>
                  <th className="p-3 font-medium">Versand</th>
                  <th className="p-3 text-right font-medium">Summe</th>
                </tr>
              </thead>
              <tbody>
                {orders.data.map((o) => (
                  <tr key={o.id} className="border-t hover:bg-muted/40">
                    <td className="p-3">
                      <Link
                        to="/app/bestellungen/$orderId"
                        params={{ orderId: o.id }}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                      {o.environment === "test" && (
                        <Badge variant="outline" className="ml-2">
                          Test
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap tabular-nums">
                      {new Date(o.placedAt).toLocaleString("de-DE")}
                    </td>
                    <td className="max-w-[16rem] truncate p-3">{o.email ?? "—"}</td>
                    <td className="p-3">
                      <Badge variant="secondary">{ORDER_STATUS_LABELS[o.orderStatus]}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={o.paymentStatus === "paid" ? "default" : "outline"}>
                        {PAYMENT_STATUS_LABELS[o.paymentStatus]}
                      </Badge>
                    </td>
                    <td className="p-3">{FULFILLMENT_STATUS_LABELS[o.fulfillmentStatus]}</td>
                    <td className="p-3 text-right tabular-nums">
                      {formatMoney(o.totalMinor, o.currencyCode)}
                      {o.refundedMinor > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          −{formatMoney(o.refundedMinor, o.currencyCode)} erstattet
                        </span>
                      )}
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

