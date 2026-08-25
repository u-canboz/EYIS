import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLocations, listMovements } from "@/lib/commerce/inventory.functions";
import { MOVEMENT_LABEL, type MovementType } from "@/lib/commerce/inventory.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
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

export const Route = createFileRoute("/_authenticated/app/lager/bewegungen")({
  head: () => ({
    meta: [
      { title: "Bestandsbewegungen – Commerce OS" },
      {
        name: "description",
        content: "Unveränderbares Journal aller Bestandsbewegungen mit Grund, Referenz und Benutzer.",
      },
      { property: "og:title", content: "Bestandsbewegungen – Commerce OS" },
      { property: "og:description", content: "Jede Bestandsänderung bleibt nachvollziehbar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MovementsPage,
});

const TYPES: MovementType[] = [
  "initial_stock",
  "receipt",
  "adjustment",
  "reservation",
  "reservation_release",
  "sale_commit",
  "return",
  "transfer_out",
  "transfer_in",
  "damage",
  "correction",
];

function MovementsPage() {
  const { organizationId, shopId } = useActiveWorkspace();
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("all");
  const [movementType, setMovementType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reference, setReference] = useState("");

  const fetchMovements = useServerFn(listMovements);
  const fetchLocations = useServerFn(listLocations);

  const locationsQuery = useQuery({
    queryKey: ["inventory-locations", organizationId, shopId],
    enabled: Boolean(organizationId && shopId),
    queryFn: () => fetchLocations({ data: { organizationId, shopId } }),
  });

  const movementsQuery = useQuery({
    queryKey: ["inventory-movements", organizationId, shopId, search, locationId, movementType, from, to, reference],
    enabled: Boolean(organizationId && shopId),
    queryFn: () =>
      fetchMovements({
        data: {
          organizationId,
          shopId,
          search: search || null,
          locationId: locationId === "all" ? null : locationId,
          movementType: movementType === "all" ? null : (movementType as MovementType),
          from: from ? new Date(from).toISOString() : null,
          to: to ? new Date(`${to}T23:59:59`).toISOString() : null,
          reference: reference || null,
        },
      }),
  });

  const rows = movementsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Bestandsbewegungen</h1>
        <p className="text-muted-foreground text-sm">
          Das Journal ist unveränderbar. Korrekturen entstehen ausschließlich durch Gegenbuchungen.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Input
          placeholder="Produkt oder SKU"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger>
            <SelectValue placeholder="Lagerort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Lagerorte</SelectItem>
            {(locationsQuery.data ?? []).map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={movementType} onValueChange={setMovementType}>
          <SelectTrigger>
            <SelectValue placeholder="Typ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            {TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {MOVEMENT_LABEL[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="space-y-1">
          <Label className="text-xs">Von</Label>
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Bis</Label>
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <Input
          placeholder="Referenz"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />
      </div>

      {movementsQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm">
          Für diese Filter gibt es keine Bewegungen.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Zeit</th>
                <th className="p-3 font-medium">Produkt / Variante</th>
                <th className="p-3 font-medium">Lager</th>
                <th className="p-3 font-medium">Typ</th>
                <th className="p-3 text-right font-medium">Änderung</th>
                <th className="p-3 font-medium">Grund</th>
                <th className="p-3 font-medium">Referenz</th>
                <th className="p-3 font-medium">Benutzer</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="text-muted-foreground p-3 whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString("de-DE")}
                  </td>
                  <td className="p-3">
                    {row.product_name ?? "—"}
                    <div className="text-muted-foreground text-xs">
                      {row.variant_title ?? ""} {row.sku ? `· ${row.sku}` : ""}
                    </div>
                  </td>
                  <td className="p-3">{row.location_name ?? "—"}</td>
                  <td className="p-3">{MOVEMENT_LABEL[row.movement_type]}</td>
                  <td
                    className={`p-3 text-right font-medium ${row.quantity_delta < 0 ? "text-destructive" : ""}`}
                  >
                    {row.quantity_delta > 0 ? "+" : ""}
                    {row.quantity_delta}
                  </td>
                  <td className="text-muted-foreground p-3">{row.reason ?? "—"}</td>
                  <td className="text-muted-foreground p-3">
                    {row.reference_type ? `${row.reference_type}${row.reference_id ? ` · ${row.reference_id.slice(0, 8)}` : ""}` : "—"}
                  </td>
                  <td className="text-muted-foreground p-3">{row.actor_email ?? "System"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
