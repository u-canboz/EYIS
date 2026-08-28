import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listFulfillments,
  createFulfillmentFn,
  getAllocationSuggestion,
} from "@/lib/commerce/fulfillment/fulfillment.functions";
import { listOrdersFn } from "@/lib/commerce/orders/order.functions";
import {
  FULFILLMENT_STATE_LABELS,
  type FulfillmentState,
} from "@/lib/commerce/fulfillment/fulfillment.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { carrierLabel } from "@/lib/commerce/shipping/carriers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shell/PageHeader";
import { ScrollTabs } from "@/components/shell/DetailLayout";
import { RecordCard, RecordCardList } from "@/components/data/RecordCard";
import { TableScroll } from "@/components/data/TableScroll";
import { EmptyState, ListSkeleton } from "@/components/data/States";

export const Route = createFileRoute("/_authenticated/app/versand/")({
  head: () => ({
    meta: [
      { title: "Versand & Fulfillment – EYIS" },
      {
        name: "description",
        content:
          "Offene Bestellungen kommissionieren, verpacken, Labels erzeugen und Sendungen verfolgen.",
      },
      { property: "og:title", content: "Versand & Fulfillment – EYIS" },
      {
        property: "og:description",
        content: "Der operative Arbeitsplatz für Kommissionierung und Versand.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FulfillmentWorkspace,
});

const TABS: { key: string; label: string; statuses: FulfillmentState[] | null }[] = [
  { key: "open", label: "Neu", statuses: ["draft", "ready"] },
  { key: "picking", label: "Kommissionierung", statuses: ["picking"] },
  { key: "packed", label: "Verpackt", statuses: ["packed"] },
  { key: "shipped", label: "Versendet", statuses: ["shipped"] },
  { key: "delivered", label: "Zugestellt", statuses: ["delivered"] },
  { key: "all", label: "Alle", statuses: null },
];

function FulfillmentWorkspace() {
  const queryClient = useQueryClient();
  const { organizationId, shopId, can } = useActiveWorkspace();
  const [tab, setTab] = useState("open");
  const [search, setSearch] = useState("");
  const [orderPickerOpen, setOrderPickerOpen] = useState(false);
  const [allocationOrderId, setAllocationOrderId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string>("");

  const fetchQueue = useServerFn(listFulfillments);
  const fetchOrders = useServerFn(listOrdersFn);
  const fetchAllocation = useServerFn(getAllocationSuggestion);
  const create = useServerFn(createFulfillmentFn);

  const statuses = TABS.find((t) => t.key === tab)?.statuses ?? null;

  const queue = useQuery({
    queryKey: ["fulfillments", organizationId, shopId, tab, search],
    enabled: !!organizationId,
    queryFn: () =>
      fetchQueue({
        data: { organizationId, shopId: shopId || null, statuses, search: search || null },
      }),
  });

  const openOrders = useQuery({
    queryKey: ["fulfillment-open-orders", organizationId, shopId],
    enabled: !!organizationId && orderPickerOpen,
    queryFn: () =>
      fetchOrders({ data: { organizationId, shopId: shopId || null, paymentStatus: "paid" } }).then(
        (rows) =>
          rows.filter((o) => o.fulfillmentStatus !== "fulfilled" && o.orderStatus !== "cancelled"),
      ),
  });

  const allocation = useQuery({
    queryKey: ["allocation", organizationId, allocationOrderId],
    enabled: !!organizationId && !!allocationOrderId,
    queryFn: () => fetchAllocation({ data: { organizationId, orderId: allocationOrderId! } }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const lines = (allocation.data?.lines ?? []).filter((l) => l.openQuantity > 0);
      if (!lines.length) throw new Error("Keine offenen Positionen für diese Bestellung.");
      return await create({
        data: {
          organizationId,
          shopId: allocation.data!.shopId,
          orderId: allocationOrderId!,
          locationId: locationId || lines[0]?.suggestedLocationId || null,
          items: lines.map((l) => ({ orderItemId: l.orderItemId, quantity: l.openQuantity })),
          idempotencyKey: `ful:${allocationOrderId}:${lines.map((l) => `${l.orderItemId}x${l.openQuantity}`).join(",")}`,
        },
      });
    },
    onSuccess: () => {
      toast.success("Fulfillment angelegt.");
      setAllocationOrderId(null);
      setOrderPickerOpen(false);
      setLocationId("");
      queryClient.invalidateQueries({ queryKey: ["fulfillments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const locationOptions = allocation.data?.lines[0]?.options ?? [];

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Versand & Fulfillment"
        description="Bezahlte Bestellungen kommissionieren, verpacken und versenden."
        actions={
          <>
            <Button variant="outline" className="h-11" asChild>
              <Link to="/app/versand/versandarten">Versandarten</Link>
            </Button>
            <Button variant="outline" className="h-11" asChild>
              <Link to="/app/versand/dienstleister">Dienstleister</Link>
            </Button>
            {can("fulfillment.manage") && (
              <Button className="h-11" onClick={() => setOrderPickerOpen(true)}>
                Fulfillment anlegen
              </Button>
            )}
          </>
        }
      />

      <ScrollTabs>
        {TABS.map((t) => (
          <Button
            key={t.key}
            size="sm"
            variant={t.key === tab ? "default" : "outline"}
            className="min-h-11 shrink-0"
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </ScrollTabs>

      <Input
        className="h-11 w-full sm:max-w-xs"
        placeholder="Bestellnummer oder Sendungsnummer"
        aria-label="Vorgänge suchen"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {queue.isLoading ? (
        <ListSkeleton />
      ) : !queue.data?.length ? (
        <EmptyState title="Keine Vorgänge" description="Für diese Ansicht gibt es keine Vorgänge." />
      ) : (
        <>
          <RecordCardList>
            {queue.data.map((f) => (
              <Link
                key={f.id}
                to="/app/versand/$fulfillmentId"
                params={{ fulfillmentId: f.id }}
                className="min-w-0"
              >
                <RecordCard
                  interactive
                  title={f.orderNumber}
                  subtitle={f.locationName ?? "ohne Lagerort"}
                  badges={
                    <>
                      <Badge variant={f.hasException ? "destructive" : f.status === "delivered" ? "secondary" : "default"}>
                        {FULFILLMENT_STATE_LABELS[f.status]}
                      </Badge>
                      {f.carrierProvider ? (
                        <Badge variant="outline">{carrierLabel(f.carrierProvider)}</Badge>
                      ) : null}
                    </>
                  }
                  fields={[
                    {
                      label: "Fortschritt",
                      value: `${f.pickedQuantity}/${f.totalQuantity} gepickt`,
                    },
                    { label: "Pakete", value: f.packageCount },
                    ...(f.trackingNumber
                      ? [{ label: "Sendungsnummer", value: f.trackingNumber }]
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
                  <th className="p-3 font-medium">Bestellung</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Fortschritt</th>
                  <th className="p-3 font-medium">Lagerort</th>
                  <th className="p-3 font-medium">Pakete</th>
                  <th className="p-3 font-medium">Carrier</th>
                  <th className="p-3 font-medium">Sendungsnummer</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {queue.data.map((f) => (
                  <tr key={f.id} className="border-t border-border hover:bg-muted/40">
                    <td className="p-3 font-medium">{f.orderNumber}</td>
                    <td className="p-3">
                      <Badge
                        variant={
                          f.hasException
                            ? "destructive"
                            : f.status === "delivered"
                              ? "secondary"
                              : "default"
                        }
                      >
                        {FULFILLMENT_STATE_LABELS[f.status]}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {f.pickedQuantity}/{f.totalQuantity} gepickt · {f.packedQuantity} gepackt ·{" "}
                      {f.shippedQuantity} versendet
                    </td>
                    <td className="p-3">{f.locationName ?? "—"}</td>
                    <td className="p-3 tabular-nums">{f.packageCount}</td>
                    <td className="p-3">
                      {f.carrierProvider ? carrierLabel(f.carrierProvider) : "—"}
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground break-words">
                      {f.trackingNumber ?? "—"}
                    </td>
                    <td className="p-3 text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/app/versand/$fulfillmentId" params={{ fulfillmentId: f.id }}>
                          Öffnen
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </>
      )}

      <Dialog
        open={orderPickerOpen}
        onOpenChange={(open) => {
          setOrderPickerOpen(open);
          if (!open) setAllocationOrderId(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {allocationOrderId ? "Positionen zuweisen" : "Offene Bestellung wählen"}
            </DialogTitle>
          </DialogHeader>

          {!allocationOrderId ? (
            openOrders.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !openOrders.data?.length ? (
              <EmptyState title="Keine offenen Bestellungen" />
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {openOrders.data.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setAllocationOrderId(o.id)}
                    className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-border p-3 text-left text-sm hover:bg-muted"
                  >
                    <span className="min-w-0 truncate font-medium">{o.orderNumber}</span>
                    <span className="shrink-0 text-muted-foreground">{o.email ?? "—"}</span>
                  </button>
                ))}
              </div>
            )
          ) : allocation.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="space-y-4">
              <TableScroll>
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-2 font-medium">Position</th>
                      <th className="p-2 font-medium">Offen</th>
                      <th className="p-2 font-medium">Verfügbar (Vorschlag)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocation.data?.lines.map((l) => {
                      const suggested = l.options.find(
                        (o) => o.locationId === l.suggestedLocationId,
                      );
                      return (
                        <tr key={l.orderItemId} className="border-t border-border">
                          <td className="p-2 break-words">
                            {l.title}
                            {l.variantTitle ? (
                              <span className="text-muted-foreground"> · {l.variantTitle}</span>
                            ) : null}
                          </td>
                          <td className="p-2 tabular-nums">
                            {l.openQuantity} / {l.orderedQuantity}
                          </td>
                          <td className="p-2">
                            {suggested
                              ? `${suggested.locationName} · ${suggested.available}`
                              : "Kein Lagerort"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableScroll>

              <div className="grid gap-2">
                <Label>Lagerort</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger aria-label="Vorschlag übernehmen" className="h-11">
                    <SelectValue placeholder="Vorschlag übernehmen" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationOptions.map((o) => (
                      <SelectItem key={o.locationId} value={o.locationId}>
                        {o.locationName} · verfügbar {o.available}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Der Vorschlag basiert auf Verfügbarkeit und Priorität und wird nie automatisch
                  ausgeführt.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="h-11" onClick={() => setAllocationOrderId(null)}>
                  Zurück
                </Button>
                <Button
                  className="h-11"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                >
                  Fulfillment anlegen
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
