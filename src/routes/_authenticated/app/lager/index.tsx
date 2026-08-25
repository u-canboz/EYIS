import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listInventory,
  listLocations,
  adjustStock,
  markDamaged,
  receiveStock,
  updateItemSettings,
} from "@/lib/commerce/inventory.functions";
import { STOCK_STATUS_LABEL, type InventoryRow } from "@/lib/commerce/inventory.types";
import { ADJUSTMENT_REASONS } from "@/lib/commerce/inventory.types";
import { newIdempotencyKey } from "@/lib/commerce/inventory.validation";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/lager/")({
  head: () => ({
    meta: [
      { title: "Lagerbestand – Commerce OS" },
      {
        name: "description",
        content:
          "Physischer Bestand, Reservierungen, verfügbare Mengen und Warnungen für jede Variante deines Shops.",
      },
      { property: "og:title", content: "Lagerbestand – Commerce OS" },
      { property: "og:description", content: "Bestände je Variante und Lagerort im Überblick." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InventoryPage,
});

type DialogMode = "receive" | "adjust" | "damage" | null;

function InventoryPage() {
  const queryClient = useQueryClient();
  const { organizationId, shopId, can } = useActiveWorkspace();

  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("all");
  const [status, setStatus] = useState("all");
  const [mode, setMode] = useState<DialogMode>(null);
  const [activeRow, setActiveRow] = useState<InventoryRow | null>(null);
  const [dialogLocation, setDialogLocation] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<string>(ADJUSTMENT_REASONS[0]);
  const [note, setNote] = useState("");

  const fetchInventory = useServerFn(listInventory);
  const fetchLocations = useServerFn(listLocations);
  const runReceive = useServerFn(receiveStock);
  const runAdjust = useServerFn(adjustStock);
  const runDamage = useServerFn(markDamaged);
  const runSettings = useServerFn(updateItemSettings);

  const locationsQuery = useQuery({
    queryKey: ["inventory-locations", organizationId, shopId],
    enabled: Boolean(organizationId && shopId),
    queryFn: () => fetchLocations({ data: { organizationId, shopId } }),
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory", organizationId, shopId, search, locationId, status],
    enabled: Boolean(organizationId && shopId),
    queryFn: () =>
      fetchInventory({
        data: {
          organizationId,
          shopId,
          search: search || null,
          locationId: locationId === "all" ? null : locationId,
          status: status === "all" ? null : (status as "low" | "out" | "backorder" | "untracked"),
        },
      }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
  };

  const closeDialog = () => {
    setMode(null);
    setActiveRow(null);
    setQuantity("");
    setNote("");
  };

  const openDialog = (row: InventoryRow, next: Exclude<DialogMode, null>) => {
    setActiveRow(row);
    setMode(next);
    setQuantity("");
    setNote("");
    setReason(ADJUSTMENT_REASONS[0]);
    const preferred = row.locations[0]?.location_id ?? locationsQuery.data?.[0]?.id ?? "";
    setDialogLocation(locationId === "all" ? preferred : locationId);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!activeRow) throw new Error("Keine Position gewählt.");
      if (!dialogLocation) throw new Error("Bitte einen Lagerort wählen.");
      const value = Number(quantity);
      if (!Number.isInteger(value)) throw new Error("Bitte eine ganze Zahl eingeben.");
      const key = newIdempotencyKey();
      if (mode === "receive") {
        return runReceive({
          data: {
            organizationId,
            shopId,
            locationId: dialogLocation,
            lines: [{ inventoryItemId: activeRow.inventory_item_id, quantity: value }],
            note: note || null,
            idempotencyKey: key,
          },
        });
      }
      if (mode === "adjust") {
        return runAdjust({
          data: {
            organizationId,
            shopId,
            inventoryItemId: activeRow.inventory_item_id,
            locationId: dialogLocation,
            countedQuantity: value,
            reason,
            note: note || null,
            idempotencyKey: key,
          },
        });
      }
      return runDamage({
        data: {
          organizationId,
          shopId,
          inventoryItemId: activeRow.inventory_item_id,
          locationId: dialogLocation,
          quantity: value,
          reason,
          note: note || null,
          idempotencyKey: key,
        },
      });
    },
    onSuccess: () => {
      toast.success("Buchung gespeichert.");
      closeDialog();
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const settingsMutation = useMutation({
    mutationFn: (input: {
      inventoryItemId: string;
      trackInventory?: boolean;
      allowBackorder?: boolean;
    }) => runSettings({ data: { organizationId, ...input } }),
    onSuccess: () => {
      toast.success("Einstellung gespeichert.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = inventoryQuery.data?.rows ?? [];
  const locations = locationsQuery.data ?? [];
  const canAdjust = can("inventory.adjust");
  const canReceive = can("inventory.receive");
  const canSettings = can("inventory.manage_settings");

  const currentLevel = activeRow?.locations.find((l) => l.location_id === dialogLocation);
  const currentOnHand = currentLevel?.level.on_hand ?? 0;
  const parsedQuantity = Number(quantity);
  const consequence = (() => {
    if (!Number.isInteger(parsedQuantity)) return null;
    if (mode === "receive")
      return `Commerce OS bucht: +${parsedQuantity} (physischer Bestand ${currentOnHand} → ${currentOnHand + parsedQuantity})`;
    if (mode === "adjust") {
      const delta = parsedQuantity - currentOnHand;
      return `Commerce OS bucht: ${delta >= 0 ? "+" : ""}${delta} (physischer Bestand ${currentOnHand} → ${parsedQuantity})`;
    }
    return `Commerce OS bucht ${parsedQuantity} Stück als beschädigt. Verfügbarkeit sinkt entsprechend.`;
  })();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Lagerbestand</h1>
          <p className="text-muted-foreground text-sm">
            Physischer Bestand abzüglich beschädigter Ware und Reservierungen ergibt die verfügbare
            Menge.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/app/lager/wareneingang">Wareneingang</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/lager/transfers">Umlagerungen</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/lager/reservierungen">Reservierungen</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/lager/bewegungen">Bewegungen</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/lager/lagerorte">Lagerorte</Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          placeholder="Produkt, Variante, SKU oder Barcode"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger>
            <SelectValue placeholder="Lagerort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Lagerorte</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="low">Niedriger Bestand</SelectItem>
            <SelectItem value="out">Ausverkauft</SelectItem>
            <SelectItem value="backorder">Nachbestellbar</SelectItem>
            <SelectItem value="untracked">Tracking deaktiviert</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {inventoryQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm font-medium">Noch keine Bestandsdaten</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Öffne ein Produkt und aktiviere dort den Tab „Bestand“, oder buche direkt einen
            Wareneingang.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Produkt / Variante</th>
                <th className="p-3 font-medium">SKU</th>
                <th className="p-3 text-right font-medium">Physisch</th>
                <th className="p-3 text-right font-medium">Beschädigt</th>
                <th className="p-3 text-right font-medium">Reserviert</th>
                <th className="p-3 text-right font-medium">Verfügbar</th>
                <th className="p-3 text-right font-medium">Erwartet</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Tracking</th>
                <th className="p-3 font-medium">Backorder</th>
                <th className="p-3 text-right font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.inventory_item_id} className="border-t align-middle">
                  <td className="p-3">
                    <Link
                      to="/app/produkte/$productId"
                      params={{ productId: row.product_id }}
                      className="font-medium hover:underline"
                    >
                      {row.product_name}
                    </Link>
                    <div className="text-muted-foreground text-xs">{row.variant_title}</div>
                    {row.locations.length > 0 && (
                      <div className="text-muted-foreground mt-1 text-xs">
                        {row.locations
                          .map((l) => `${l.location_name}: ${l.available} verfügbar`)
                          .join(" · ")}
                      </div>
                    )}
                  </td>
                  <td className="text-muted-foreground p-3">{row.sku ?? "—"}</td>
                  <td className="p-3 text-right">
                    {row.track_inventory ? row.totals.on_hand : "—"}
                  </td>
                  <td className="p-3 text-right">
                    {row.track_inventory ? row.totals.damaged : "—"}
                  </td>
                  <td className="p-3 text-right">
                    {row.track_inventory ? row.totals.reserved : "—"}
                  </td>
                  <td className="p-3 text-right font-medium">
                    {row.track_inventory ? row.available : "∞"}
                  </td>
                  <td className="p-3 text-right">
                    {row.track_inventory ? row.totals.incoming : "—"}
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={
                        row.status === "out_of_stock"
                          ? "destructive"
                          : row.status === "low_stock"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {STOCK_STATUS_LABEL[row.status]}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Switch
                      checked={row.track_inventory}
                      disabled={!canSettings || settingsMutation.isPending}
                      onCheckedChange={(checked) =>
                        settingsMutation.mutate({
                          inventoryItemId: row.inventory_item_id,
                          trackInventory: checked,
                        })
                      }
                    />
                  </td>
                  <td className="p-3">
                    <Switch
                      checked={row.allow_backorder}
                      disabled={!canSettings || settingsMutation.isPending}
                      onCheckedChange={(checked) =>
                        settingsMutation.mutate({
                          inventoryItemId: row.inventory_item_id,
                          allowBackorder: checked,
                        })
                      }
                    />
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canReceive || !row.track_inventory}
                        onClick={() => openDialog(row, "receive")}
                      >
                        Eingang
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canAdjust || !row.track_inventory}
                        onClick={() => openDialog(row, "adjust")}
                      >
                        Korrektur
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canAdjust || !row.track_inventory}
                        onClick={() => openDialog(row, "damage")}
                      >
                        Schaden
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={mode !== null} onOpenChange={(open) => (open ? null : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "receive"
                ? "Wareneingang buchen"
                : mode === "adjust"
                  ? "Bestand korrigieren"
                  : "Beschädigte Ware buchen"}
            </DialogTitle>
            <DialogDescription>
              {activeRow?.product_name} · {activeRow?.variant_title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Lagerort</Label>
              <Select value={dialogLocation} onValueChange={setDialogLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Lagerort wählen" />
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

            <div className="bg-muted/50 rounded-md p-3 text-sm">
              Physischer Bestand aktuell: <strong>{currentOnHand}</strong>
            </div>

            <div className="space-y-2">
              <Label>
                {mode === "receive"
                  ? "Zugang"
                  : mode === "adjust"
                    ? "Tatsächlich gezählt"
                    : "Beschädigte Menge"}
              </Label>
              <Input
                inputMode="numeric"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder={mode === "adjust" ? String(currentOnHand) : "0"}
              />
            </div>

            {mode !== "receive" && (
              <div className="space-y-2">
                <Label>Grund</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADJUSTMENT_REASONS.map((entry) => (
                      <SelectItem key={entry} value={entry}>
                        {entry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notiz (optional)</Label>
              <Input value={note} onChange={(event) => setNote(event.target.value)} />
            </div>

            {consequence && (
              <p className="border-primary/40 bg-primary/5 rounded-md border p-3 text-sm">
                {consequence}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={closeDialog}>
                Abbrechen
              </Button>
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                Buchen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
