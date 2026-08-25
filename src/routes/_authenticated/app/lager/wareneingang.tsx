import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listInventory, listLocations, receiveStock } from "@/lib/commerce/inventory.functions";
import { newIdempotencyKey } from "@/lib/commerce/inventory.validation";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/lager/wareneingang")({
  head: () => ({
    meta: [
      { title: "Wareneingang buchen – Commerce OS" },
      {
        name: "description",
        content: "Gelieferte Ware pro Lagerort und Variante erfassen und nachvollziehbar einbuchen.",
      },
      { property: "og:title", content: "Wareneingang buchen – Commerce OS" },
      { property: "og:description", content: "Zugänge erfassen und im Bewegungsjournal dokumentieren." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReceivingPage,
});

function ReceivingPage() {
  const navigate = useNavigate();
  const { organizationId, shopId, can } = useActiveWorkspace();

  const [step, setStep] = useState(0);
  const [locationId, setLocationId] = useState("");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Record<string, string>>({});
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const fetchLocations = useServerFn(listLocations);
  const fetchInventory = useServerFn(listInventory);
  const runReceive = useServerFn(receiveStock);

  const locationsQuery = useQuery({
    queryKey: ["inventory-locations", organizationId, shopId],
    enabled: Boolean(organizationId && shopId),
    queryFn: () => fetchLocations({ data: { organizationId, shopId } }),
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory", organizationId, shopId, search, "receiving"],
    enabled: Boolean(organizationId && shopId) && step >= 1,
    queryFn: () => fetchInventory({ data: { organizationId, shopId, search: search || null } }),
  });

  const rows = (inventoryQuery.data?.rows ?? []).filter((row) => row.track_inventory);
  const selected = useMemo(
    () =>
      rows
        .map((row) => ({ row, quantity: Number(lines[row.inventory_item_id] ?? "") }))
        .filter((entry) => Number.isInteger(entry.quantity) && entry.quantity > 0),
    [rows, lines],
  );

  const mutation = useMutation({
    mutationFn: () =>
      runReceive({
        data: {
          organizationId,
          shopId,
          locationId,
          lines: selected.map((entry) => ({
            inventoryItemId: entry.row.inventory_item_id,
            quantity: entry.quantity,
          })),
          reference: reference || null,
          note: note || null,
          idempotencyKey: newIdempotencyKey(),
        },
      }),
    onSuccess: () => {
      toast.success("Wareneingang gebucht.");
      navigate({ to: "/app/lager" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!can("inventory.receive")) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm">
        Dir fehlt die Berechtigung, Wareneingänge zu buchen.
      </div>
    );
  }

  const locations = locationsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Wareneingang</h1>
        <p className="text-muted-foreground text-sm">
          Schritt {step + 1} von 3 · Lagerort, Mengen, Bestätigung
        </p>
      </header>

      {step === 0 && (
        <section className="max-w-md space-y-4 rounded-lg border p-5">
          <div className="space-y-2">
            <Label>Lagerort</Label>
            {locationsQuery.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Lagerort wählen" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name} ({location.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Button disabled={!locationId} onClick={() => setStep(1)}>
            Weiter
          </Button>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-4">
          <Input
            placeholder="Produkt, Variante oder SKU suchen"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {inventoryQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3 font-medium">Produkt / Variante</th>
                    <th className="p-3 font-medium">SKU</th>
                    <th className="p-3 text-right font-medium">Physisch</th>
                    <th className="p-3 text-right font-medium">Zugang</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.inventory_item_id} className="border-t">
                      <td className="p-3">
                        {row.product_name}
                        <div className="text-muted-foreground text-xs">{row.variant_title}</div>
                      </td>
                      <td className="text-muted-foreground p-3">{row.sku ?? "—"}</td>
                      <td className="p-3 text-right">{row.totals.on_hand}</td>
                      <td className="p-3 text-right">
                        <Input
                          className="ml-auto w-24 text-right"
                          inputMode="numeric"
                          value={lines[row.inventory_item_id] ?? ""}
                          onChange={(event) =>
                            setLines((prev) => ({
                              ...prev,
                              [row.inventory_item_id]: event.target.value,
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td className="text-muted-foreground p-6 text-center" colSpan={4}>
                        Keine Varianten mit aktivierter Bestandsverfolgung gefunden. Aktiviere den Tab
                        „Bestand“ im Produkteditor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Referenz (optional)</Label>
              <Input value={reference} onChange={(event) => setReference(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notiz (optional)</Label>
              <Input value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(0)}>
              Zurück
            </Button>
            <Button disabled={selected.length === 0} onClick={() => setStep(2)}>
              Weiter ({selected.length} Positionen)
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="max-w-2xl space-y-4 rounded-lg border p-5">
          <h2 className="font-display text-lg font-semibold">Bestätigung</h2>
          <p className="text-muted-foreground text-sm">
            Lagerort: {locations.find((l) => l.id === locationId)?.name ?? "—"}
          </p>
          <ul className="space-y-2 text-sm">
            {selected.map((entry) => (
              <li key={entry.row.inventory_item_id} className="flex justify-between border-b pb-2">
                <span>
                  {entry.row.product_name} · {entry.row.variant_title}
                </span>
                <span className="font-medium">
                  {entry.row.totals.on_hand} → {entry.row.totals.on_hand + entry.quantity} (+
                  {entry.quantity})
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Zurück
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              Wareneingang buchen
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
