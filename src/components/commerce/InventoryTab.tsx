import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adjustStock,
  listInventory,
  listLocations,
  receiveStock,
  setupInventoryForProduct,
  updateItemSettings,
} from "@/lib/commerce/inventory.functions";
import {
  ADJUSTMENT_REASONS,
  STOCK_STATUS_LABEL,
  type InventoryRow,
} from "@/lib/commerce/inventory.types";
import { newIdempotencyKey } from "@/lib/commerce/inventory.validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  productId: string;
  organizationId: string;
  shopId: string;
  canEdit: boolean;
};

export function InventoryTab({ productId, organizationId, shopId, canEdit }: Props) {
  const queryClient = useQueryClient();
  const fetchInventory = useServerFn(listInventory);
  const fetchLocations = useServerFn(listLocations);
  const runSetup = useServerFn(setupInventoryForProduct);
  const runSettings = useServerFn(updateItemSettings);

  const locationsQuery = useQuery({
    queryKey: ["inventory-locations", organizationId, shopId],
    enabled: Boolean(organizationId && shopId),
    queryFn: () => fetchLocations({ data: { organizationId, shopId } }),
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory", organizationId, shopId, productId],
    enabled: Boolean(organizationId && shopId),
    queryFn: () => fetchInventory({ data: { organizationId, shopId, productId } }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
  };

  const setupMutation = useMutation({
    mutationFn: () => runSetup({ data: { organizationId, shopId, productId } }),
    onSuccess: () => {
      toast.success("Bestandsführung eingerichtet.");
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
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast.error(error.message),
  });

  if (inventoryQuery.isLoading) return <Skeleton className="h-48 w-full" />;

  const rows = inventoryQuery.data?.rows ?? [];
  const locations = locationsQuery.data ?? [];

  if (rows.length === 0) {
    return (
      <div className="space-y-4 rounded-lg border border-dashed p-10 text-center">
        <p className="text-sm">
          Für dieses Produkt ist noch keine Bestandsführung eingerichtet.
        </p>
        <Button onClick={() => setupMutation.mutate()} disabled={!canEdit || setupMutation.isPending}>
          Bestandsführung aktivieren
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Verfügbar = physischer Bestand − beschädigt − reserviert.
        </p>
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/lager/bewegungen">Bewegungsjournal</Link>
        </Button>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.inventory_item_id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium">{row.variant_title}</div>
                <div className="text-muted-foreground text-xs">SKU: {row.sku ?? "—"}</div>
              </div>
              <Badge variant={row.status === "in_stock" ? "outline" : "secondary"}>
                {STOCK_STATUS_LABEL[row.status]}
              </Badge>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
              <Metric label="Physisch" value={row.totals.on_hand} />
              <Metric label="Reserviert" value={row.totals.reserved} />
              <Metric label="Beschädigt" value={row.totals.damaged} />
              <Metric label="Erwartet" value={row.totals.incoming} />
              <Metric label="Verfügbar" value={row.available} strong />
            </div>

            <div className="mt-3 space-y-1 text-xs">
              {row.locations.map((location) => (
                <div key={location.location_id} className="text-muted-foreground flex justify-between">
                  <span>{location.location_name}</span>
                  <span>
                    {location.level.on_hand} physisch · {location.available} verfügbar
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={row.track_inventory}
                  disabled={!canEdit}
                  onCheckedChange={(checked) =>
                    settingsMutation.mutate({
                      inventoryItemId: row.inventory_item_id,
                      trackInventory: checked,
                    })
                  }
                />
                Bestand verfolgen
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={row.allow_backorder}
                  disabled={!canEdit}
                  onCheckedChange={(checked) =>
                    settingsMutation.mutate({
                      inventoryItemId: row.inventory_item_id,
                      allowBackorder: checked,
                    })
                  }
                />
                Nachbestellung erlauben
              </label>
              {canEdit && locations.length > 0 && (
                <div className="ml-auto flex gap-2">
                  <ReceiveDialog
                    row={row}
                    locations={locations}
                    organizationId={organizationId}
                    shopId={shopId}
                    onDone={invalidate}
                  />
                  <AdjustDialog
                    row={row}
                    locations={locations}
                    organizationId={organizationId}
                    shopId={shopId}
                    onDone={invalidate}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className={strong ? "text-lg font-semibold" : "text-lg"}>{value}</div>
    </div>
  );
}

type LocationOption = { id: string; name: string };

function ReceiveDialog({
  row,
  locations,
  organizationId,
  shopId,
  onDone,
}: {
  row: InventoryRow;
  locations: LocationOption[];
  organizationId: string;
  shopId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const run = useServerFn(receiveStock);

  const mutation = useMutation({
    mutationFn: () =>
      run({
        data: {
          organizationId,
          shopId,
          locationId,
          lines: [{ inventoryItemId: row.inventory_item_id, quantity: Number(quantity) }],
          note: note || null,
          idempotencyKey: newIdempotencyKey(),
        },
      }),
    onSuccess: () => {
      toast.success("Zugang gebucht.");
      setOpen(false);
      setQuantity("");
      setNote("");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Zugang
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Zugang buchen · {row.variant_title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <LocationSelect value={locationId} onChange={setLocationId} locations={locations} />
          <div className="space-y-2">
            <Label>Menge</Label>
            <Input
              inputMode="numeric"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Notiz (optional)</Label>
            <Input value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !locationId || !Number(quantity)}
          >
            Buchen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({
  row,
  locations,
  organizationId,
  shopId,
  onDone,
}: {
  row: InventoryRow;
  locations: LocationOption[];
  organizationId: string;
  shopId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [counted, setCounted] = useState("");
  const [reason, setReason] = useState<string>(ADJUSTMENT_REASONS[0]);
  const [note, setNote] = useState("");
  const run = useServerFn(adjustStock);

  const mutation = useMutation({
    mutationFn: () =>
      run({
        data: {
          organizationId,
          shopId,
          inventoryItemId: row.inventory_item_id,
          locationId,
          countedQuantity: Number(counted),
          reason,
          note: note || null,
          idempotencyKey: newIdempotencyKey(),
        },
      }),
    onSuccess: () => {
      toast.success("Bestand korrigiert.");
      setOpen(false);
      setCounted("");
      setNote("");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Korrektur
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inventurkorrektur · {row.variant_title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <LocationSelect value={locationId} onChange={setLocationId} locations={locations} />
          <div className="space-y-2">
            <Label>Gezählter Bestand</Label>
            <Input
              inputMode="numeric"
              value={counted}
              onChange={(event) => setCounted(event.target.value)}
            />
          </div>
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
          <div className="space-y-2">
            <Label>Notiz (optional)</Label>
            <Input value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !locationId || counted === ""}
          >
            Korrigieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LocationSelect({
  value,
  onChange,
  locations,
}: {
  value: string;
  onChange: (value: string) => void;
  locations: LocationOption[];
}) {
  return (
    <div className="space-y-2">
      <Label>Lagerort</Label>
      <Select value={value} onValueChange={onChange}>
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
  );
}
