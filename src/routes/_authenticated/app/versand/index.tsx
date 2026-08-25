import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listFulfillments, createFulfillmentFn, getAllocationSuggestion } from "@/lib/commerce/fulfillment/fulfillment.functions";
import { listOrdersFn } from "@/lib/commerce/orders/order.functions";
import { FULFILLMENT_STATE_LABELS, type FulfillmentState } from "@/lib/commerce/fulfillment/fulfillment.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { carrierLabel } from "@/lib/commerce/shipping/carriers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/versand/")({
  head: () => ({
    meta: [
      { title: "Versand & Fulfillment – Commerce OS" },
      {
        name: "description",
        content: "Offene Bestellungen kommissionieren, verpacken, Labels erzeugen und Sendungen verfolgen.",
      },
      { property: "og:title", content: "Versand & Fulfillment – Commerce OS" },
      { property: "og:description", content: "Der operative Arbeitsplatz für Kommissionierung und Versand." },
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
      fetchOrders({ data: { organizationId, shopId: shopId || null, paymentStatus: "paid" } }).then((rows) =>
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
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Versand & Fulfillment</h1>
          <p className="text-muted-foreground text-sm">
            Bezahlte Bestellungen kommissionieren, verpacken und versenden.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/app/versand/versandarten">Versandarten</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/app/versand/dienstleister">Dienstleister</Link>
          </Button>
          {can("fulfillment.manage") && (
            <Button onClick={() => setOrderPickerOpen(true)}>Fulfillment anlegen</Button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Button key={t.key} size="sm" variant={t.key === tab ? "default" : "outline"} onClick={() => setTab(t.key)}>
            {t.label}
          </Button>
        ))}
        <Input
          className="ml-auto max-w-xs"
          placeholder="Bestellnummer oder Sendungsnummer"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {queue.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !queue.data?.length ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Keine Vorgänge in dieser Ansicht.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
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
                <tr key={f.id} className="border-t">
                  <td className="p-3 font-medium">{f.orderNumber}</td>
                  <td className="p-3">
                    <Badge variant={f.hasException ? "destructive" : f.status === "delivered" ? "secondary" : "default"}>
                      {FULFILLMENT_STATE_LABELS[f.status]}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground p-3 text-xs">
                    {f.pickedQuantity}/{f.totalQuantity} gepickt · {f.packedQuantity} gepackt · {f.shippedQuantity} versendet
                  </td>
                  <td className="p-3">{f.locationName ?? "—"}</td>
                  <td className="p-3">{f.packageCount}</td>
                  <td className="p-3">{f.carrierProvider ? carrierLabel(f.carrierProvider) : "—"}</td>
                  <td className="text-muted-foreground p-3 font-mono text-xs">{f.trackingNumber ?? "—"}</td>
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
        </div>
      )}

      <Dialog
        open={orderPickerOpen}
        onOpenChange={(open) => {
          setOrderPickerOpen(open);
          if (!open) setAllocationOrderId(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{allocationOrderId ? "Positionen zuweisen" : "Offene Bestellung wählen"}</DialogTitle>
          </DialogHeader>

          {!allocationOrderId ? (
            openOrders.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !openOrders.data?.length ? (
              <p className="text-muted-foreground text-sm">Keine offenen Bestellungen.</p>
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {openOrders.data.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setAllocationOrderId(o.id)}
                    className="hover:bg-muted flex w-full items-center justify-between rounded-md border p-3 text-left text-sm"
                  >
                    <span className="font-medium">{o.orderNumber}</span>
                    <span className="text-muted-foreground">{o.email ?? "—"}</span>
                  </button>
                ))}
              </div>
            )
          ) : allocation.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border">
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
                      const suggested = l.options.find((o) => o.locationId === l.suggestedLocationId);
                      return (
                        <tr key={l.orderItemId} className="border-t">
                          <td className="p-2">
                            {l.title}
                            {l.variantTitle ? <span className="text-muted-foreground"> · {l.variantTitle}</span> : null}
                          </td>
                          <td className="p-2">
                            {l.openQuantity} / {l.orderedQuantity}
                          </td>
                          <td className="p-2">
                            {suggested ? `${suggested.locationName} · ${suggested.available}` : "Kein Lagerort"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-2">
                <Label>Lagerort</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger>
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
                <p className="text-muted-foreground text-xs">
                  Der Vorschlag basiert auf Verfügbarkeit und Priorität und wird nie automatisch ausgeführt.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAllocationOrderId(null)}>
                  Zurück
                </Button>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
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
