import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  cancelTransfer,
  completeTransfer,
  listInventory,
  listLocations,
  listTransfers,
  startTransfer,
} from "@/lib/commerce/inventory.functions";
import { TRANSFER_STATUS_LABEL, type TransferStatus } from "@/lib/commerce/inventory.types";
import { newIdempotencyKey } from "@/lib/commerce/inventory.validation";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/lager/transfers")({
  head: () => ({
    meta: [
      { title: "Umlagerungen – EYIS" },
      {
        name: "description",
        content:
          "Bestände zwischen Lagerorten verschieben – mit Zwischenstatus unterwegs und sauberem Journal.",
      },
      { property: "og:title", content: "Umlagerungen – EYIS" },
      {
        property: "og:description",
        content: "Transfers zwischen Lagerorten transaktionssicher steuern.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TransfersPage,
});

function TransfersPage() {
  const queryClient = useQueryClient();
  const { organizationId, shopId, can } = useActiveWorkspace();

  const [fromLocationId, setFrom] = useState("");
  const [toLocationId, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Record<string, string>>({});
  const [reference, setReference] = useState("");

  const fetchLocations = useServerFn(listLocations);
  const fetchTransfers = useServerFn(listTransfers);
  const fetchInventory = useServerFn(listInventory);
  const runStart = useServerFn(startTransfer);
  const runComplete = useServerFn(completeTransfer);
  const runCancel = useServerFn(cancelTransfer);

  const locationsQuery = useQuery({
    queryKey: ["inventory-locations", organizationId, shopId],
    enabled: Boolean(organizationId && shopId),
    queryFn: () => fetchLocations({ data: { organizationId, shopId } }),
  });

  const transfersQuery = useQuery({
    queryKey: ["inventory-transfers", organizationId, shopId],
    enabled: Boolean(organizationId && shopId),
    queryFn: () => fetchTransfers({ data: { organizationId, shopId } }),
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory", organizationId, shopId, search, fromLocationId, "transfer"],
    enabled: Boolean(organizationId && shopId && fromLocationId),
    queryFn: () =>
      fetchInventory({
        data: { organizationId, shopId, search: search || null, locationId: fromLocationId },
      }),
  });

  const rows = (inventoryQuery.data?.rows ?? []).filter((row) => row.track_inventory);
  const selected = useMemo(
    () =>
      rows
        .map((row) => ({ row, quantity: Number(items[row.inventory_item_id] ?? "") }))
        .filter((entry) => Number.isInteger(entry.quantity) && entry.quantity > 0),
    [rows, items],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["inventory-transfers"] });
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
  };

  const startMutation = useMutation({
    mutationFn: () =>
      runStart({
        data: {
          organizationId,
          shopId,
          fromLocationId,
          toLocationId,
          reference: reference || null,
          items: selected.map((entry) => ({
            inventoryItemId: entry.row.inventory_item_id,
            quantity: entry.quantity,
          })),
          idempotencyKey: newIdempotencyKey(),
        },
      }),
    onSuccess: () => {
      toast.success("Umlagerung gestartet – Ware ist unterwegs.");
      setItems({});
      setReference("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const completeMutation = useMutation({
    mutationFn: (transferId: string) =>
      runComplete({ data: { organizationId, transferId, idempotencyKey: newIdempotencyKey() } }),
    onSuccess: () => {
      toast.success("Umlagerung abgeschlossen.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (transferId: string) =>
      runCancel({ data: { organizationId, transferId, idempotencyKey: newIdempotencyKey() } }),
    onSuccess: () => {
      toast.success("Umlagerung storniert – Bestand zurückgebucht.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const locations = locationsQuery.data ?? [];
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? "—";
  const canTransfer = can("inventory.transfer");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-semibold">Umlagerungen</h1>
        <p className="text-muted-foreground text-sm">
          Beim Start wird der Bestand aus dem Quelllager entnommen und als „unterwegs“ geführt, beim
          Abschluss im Ziellager eingebucht.
        </p>
      </header>

      {canTransfer && (
        <section className="space-y-4 rounded-lg border p-5">
          <h2 className="font-display text-lg font-semibold">Neue Umlagerung</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Von</Label>
              <Select value={fromLocationId} onValueChange={setFrom}>
                <SelectTrigger aria-label="Quelllager">
                  <SelectValue placeholder="Quelllager" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nach</Label>
              <Select value={toLocationId} onValueChange={setTo}>
                <SelectTrigger aria-label="Ziellager">
                  <SelectValue placeholder="Ziellager" />
                </SelectTrigger>
                <SelectContent>
                  {locations
                    .filter((location) => location.id !== fromLocationId)
                    .map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Referenz (optional)</Label>
              <Input value={reference} onChange={(event) => setReference(event.target.value)} />
            </div>
          </div>

          {fromLocationId && (
            <>
              <Input
                placeholder="Variante oder SKU suchen"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {inventoryQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <div className="max-h-80 overflow-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0 text-left">
                      <tr>
                        <th className="p-3 font-medium">Variante</th>
                        <th className="p-3 text-right font-medium">Verfügbar</th>
                        <th className="p-3 text-right font-medium">Menge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.inventory_item_id} className="border-t">
                          <td className="p-3">
                            {row.product_name}
                            <div className="text-muted-foreground text-xs">{row.variant_title}</div>
                          </td>
                          <td className="p-3 text-right">{row.available}</td>
                          <td className="p-3 text-right">
                            <Input
                              className="ml-auto w-24 text-right"
                              inputMode="numeric"
                              value={items[row.inventory_item_id] ?? ""}
                              onChange={(event) =>
                                setItems((prev) => ({
                                  ...prev,
                                  [row.inventory_item_id]: event.target.value,
                                }))
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <Button
            onClick={() => startMutation.mutate()}
            disabled={
              !fromLocationId || !toLocationId || selected.length === 0 || startMutation.isPending
            }
          >
            Umlagerung starten ({selected.length})
          </Button>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Verlauf</h2>
        {transfersQuery.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (transfersQuery.data ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm">
            Noch keine Umlagerungen.
          </div>
        ) : (
          <div className="space-y-3">
            {(transfersQuery.data ?? []).map((transfer) => (
              <div key={transfer.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {locationName(transfer.from_location_id)} →{" "}
                      {locationName(transfer.to_location_id)}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {new Date(transfer.created_at).toLocaleString("de-DE")}
                      {transfer.reference ? ` · ${transfer.reference}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={transfer.status === "in_transit" ? "default" : "secondary"}>
                      {TRANSFER_STATUS_LABEL[transfer.status as TransferStatus]}
                    </Badge>
                    {transfer.status === "in_transit" && canTransfer && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => completeMutation.mutate(transfer.id)}
                          disabled={completeMutation.isPending}
                        >
                          Abschließen
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => cancelMutation.mutate(transfer.id)}
                          disabled={cancelMutation.isPending}
                        >
                          Stornieren
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <ul className="text-muted-foreground mt-3 space-y-1 text-xs">
                  {transfer.inventory_transfer_items.map((item) => (
                    <li key={item.inventory_item_id}>
                      {item.inventory_items?.product_variants?.products?.name ?? "Produkt"} ·{" "}
                      {item.inventory_items?.product_variants?.title ?? ""} × {item.quantity}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
