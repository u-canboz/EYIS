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
import { PageHeader } from "@/components/shell/PageHeader";
import { TabsBar } from "@/components/data/TabsBar";
import { SectionPanel } from "@/components/data/SectionPanel";
import { RecordList, RecordRow } from "@/components/data/RecordRow";
import { ActionMenu } from "@/components/data/ActionMenu";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/data/States";

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
    <div className="min-w-0">
      <PageHeader
        title="Lagerbestand"
        description="Physischer Bestand abzüglich beschädigter Ware und Reservierungen ergibt die verfügbare Menge."
      />

      <TabsBar
        ariaLabel="Bestand filtern"
        value={status}
        onChange={setStatus}
        items={[
          { value: "all", label: "Alle" },
          { value: "low", label: "Niedrig" },
          { value: "out", label: "Ausverkauft" },
          { value: "backorder", label: "Nachbestellbar" },
          { value: "untracked", label: "Ohne Tracking" },
        ]}
      />

      <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_16rem]">
        <Input
          className="h-11"
          placeholder="Produkt, Variante, SKU oder Barcode"
          aria-label="Bestand durchsuchen"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger aria-label="Lagerort" className="h-11">
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
      </div>

      <nav aria-label="Lagerbereiche" className="scroll-x -mx-4 mt-3 flex gap-2 px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {[
          { to: "/app/lager/wareneingang", label: "Wareneingang" },
          { to: "/app/lager/transfers", label: "Umlagerungen" },
          { to: "/app/lager/reservierungen", label: "Reservierungen" },
          { to: "/app/lager/bewegungen", label: "Bewegungen" },
          { to: "/app/lager/lagerorte", label: "Lagerorte" },
        ].map((entry) => (
          <Link
            key={entry.to}
            to={entry.to}
            className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      <div className="mt-4">
        {inventoryQuery.isLoading ? (
          <ListSkeleton />
        ) : inventoryQuery.error ? (
          <ErrorState description={(inventoryQuery.error as Error).message} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Noch keine Bestandsdaten"
            description="Öffne ein Produkt und aktiviere dort den Tab „Bestand“, oder buche direkt einen Wareneingang."
          />
        ) : (
          <SectionPanel flush>
            <RecordList>
              {rows.map((row) => (
                <RecordRow
                  key={row.inventory_item_id}
                  to="/app/produkte/$productId"
                  params={{ productId: row.product_id }}
                  title={row.product_name}
                  subtitle={`${row.variant_title}${row.sku ? ` · ${row.sku}` : ""}`}
                  badges={
                    row.status === "in_stock" ? null : (
                      <Badge
                        variant={row.status === "out_of_stock" ? "destructive" : "secondary"}
                      >
                        {STOCK_STATUS_LABEL[row.status]}
                      </Badge>
                    )
                  }
                  trailing={row.track_inventory ? String(row.available) : "∞"}
                  trailingHint="verfügbar"
                  meta={
                    row.track_inventory
                      ? [
                          { label: "Physisch", value: row.totals.on_hand },
                          { label: "Reserviert", value: row.totals.reserved },
                          { label: "Beschädigt", value: row.totals.damaged },
                          { label: "Erwartet", value: row.totals.incoming },
                        ]
                      : undefined
                  }
                  actions={
                    <ActionMenu
                      label={`Buchungen für ${row.product_name}`}
                      items={[
                        {
                          label: "Wareneingang buchen",
                          onSelect: () => openDialog(row, "receive"),
                          disabled: !canReceive || !row.track_inventory,
                        },
                        {
                          label: "Bestand korrigieren",
                          onSelect: () => openDialog(row, "adjust"),
                          disabled: !canAdjust || !row.track_inventory,
                        },
                        {
                          label: "Schaden buchen",
                          onSelect: () => openDialog(row, "damage"),
                          disabled: !canAdjust || !row.track_inventory,
                          destructive: true,
                        },
                        {
                          label: row.track_inventory
                            ? "Bestandsführung deaktivieren"
                            : "Bestandsführung aktivieren",
                          onSelect: () =>
                            settingsMutation.mutate({
                              inventoryItemId: row.inventory_item_id,
                              trackInventory: !row.track_inventory,
                            }),
                          disabled: !canSettings || settingsMutation.isPending,
                          separatorBefore: true,
                        },
                        {
                          label: row.allow_backorder
                            ? "Nachbestellung sperren"
                            : "Nachbestellung erlauben",
                          onSelect: () =>
                            settingsMutation.mutate({
                              inventoryItemId: row.inventory_item_id,
                              allowBackorder: !row.allow_backorder,
                            }),
                          disabled: !canSettings || settingsMutation.isPending,
                        },
                      ]}
                    />
                  }
                />
              ))}
            </RecordList>
          </SectionPanel>
        )}
      </div>


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
                <SelectTrigger aria-label="Lagerort wählen">
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
