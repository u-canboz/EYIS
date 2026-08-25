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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    return <p className="text-muted-foreground text-sm">Keine Berechtigung für Bestellungen.</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Bestellungen</h1>
        <p className="text-muted-foreground text-sm">
          Bestellungen entstehen ausschließlich nach serverseitig bestätigter Zahlung.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Bestellnummer, E-Mail oder SKU"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={orderStatus} onValueChange={setOrderStatus}>
          <SelectTrigger className="w-48">
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
          <SelectTrigger className="w-48">
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
      </div>

      {orders.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !orders.data?.length ? (
        <p className="text-muted-foreground text-sm">Noch keine Bestellungen.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
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
                <tr key={o.id} className="hover:bg-muted/40 border-t">
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
                  <td className="p-3">{new Date(o.placedAt).toLocaleString("de-DE")}</td>
                  <td className="p-3">{o.email ?? "—"}</td>
                  <td className="p-3">
                    <Badge variant="secondary">{ORDER_STATUS_LABELS[o.orderStatus]}</Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant={o.paymentStatus === "paid" ? "default" : "outline"}>
                      {PAYMENT_STATUS_LABELS[o.paymentStatus]}
                    </Badge>
                  </td>
                  <td className="p-3">{FULFILLMENT_STATUS_LABELS[o.fulfillmentStatus]}</td>
                  <td className="p-3 text-right">
                    {formatMoney(o.totalMinor, o.currencyCode)}
                    {o.refundedMinor > 0 && (
                      <span className="text-muted-foreground block text-xs">
                        −{formatMoney(o.refundedMinor, o.currencyCode)} erstattet
                      </span>
                    )}
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
