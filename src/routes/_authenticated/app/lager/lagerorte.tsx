import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listLocations, saveLocation } from "@/lib/commerce/inventory.functions";
import { LOCATION_TYPE_LABEL, type LocationType } from "@/lib/commerce/inventory.types";
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

export const Route = createFileRoute("/_authenticated/app/lager/lagerorte")({
  head: () => ({
    meta: [
      { title: "Lagerorte – Commerce OS" },
      {
        name: "description",
        content:
          "Lager, Filialen und Fulfillment-Center mit Priorität für die spätere Bestandszuteilung.",
      },
      { property: "og:title", content: "Lagerorte – Commerce OS" },
      { property: "og:description", content: "Multi-Location von Anfang an." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LocationsPage,
});

const TYPES: LocationType[] = ["warehouse", "store", "fulfillment_center", "virtual"];

function LocationsPage() {
  const queryClient = useQueryClient();
  const { organizationId, shopId, can } = useActiveWorkspace();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<LocationType>("warehouse");
  const [priority, setPriority] = useState("100");
  const [status, setStatus] = useState<"active" | "inactive" | "archived">("active");

  const fetchLocations = useServerFn(listLocations);
  const runSave = useServerFn(saveLocation);

  const locationsQuery = useQuery({
    queryKey: ["inventory-locations", organizationId, shopId],
    enabled: Boolean(organizationId && shopId),
    queryFn: () => fetchLocations({ data: { organizationId, shopId } }),
  });

  const reset = () => {
    setEditingId(null);
    setName("");
    setCode("");
    setType("warehouse");
    setPriority("100");
    setStatus("active");
  };

  const mutation = useMutation({
    mutationFn: () =>
      runSave({
        data: {
          organizationId,
          shopId,
          id: editingId,
          name,
          code,
          type,
          status,
          priority: Number(priority) || 100,
        },
      }),
    onSuccess: () => {
      toast.success("Lagerort gespeichert.");
      reset();
      queryClient.invalidateQueries({ queryKey: ["inventory-locations"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const canManage = can("inventory.manage_locations");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Lagerorte</h1>
        <p className="text-muted-foreground text-sm">
          Die Priorität bestimmt später, welches Lager bevorzugt beliefert oder entnommen wird.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="overflow-x-auto rounded-lg border">
          {locationsQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Code</th>
                  <th className="p-3 font-medium">Typ</th>
                  <th className="p-3 text-right font-medium">Priorität</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {(locationsQuery.data ?? []).map((location) => (
                  <tr key={location.id} className="border-t">
                    <td className="p-3 font-medium">{location.name}</td>
                    <td className="text-muted-foreground p-3">{location.code}</td>
                    <td className="p-3">{LOCATION_TYPE_LABEL[location.type as LocationType]}</td>
                    <td className="p-3 text-right">{location.priority}</td>
                    <td className="p-3">
                      <Badge variant={location.status === "active" ? "outline" : "secondary"}>
                        {location.status === "active" ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!canManage}
                        onClick={() => {
                          setEditingId(location.id);
                          setName(location.name);
                          setCode(location.code);
                          setType(location.type as LocationType);
                          setPriority(String(location.priority));
                          setStatus(location.status as "active" | "inactive" | "archived");
                        }}
                      >
                        Bearbeiten
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="h-fit space-y-4 rounded-lg border p-5">
          <h2 className="font-display text-lg font-semibold">
            {editingId ? "Lagerort bearbeiten" : "Neuer Lagerort"}
          </h2>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Code</Label>
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="BER"
            />
          </div>
          <div className="space-y-2">
            <Label>Typ</Label>
            <Select value={type} onValueChange={(value) => setType(value as LocationType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {LOCATION_TYPE_LABEL[entry]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Priorität</Label>
            <Input
              inputMode="numeric"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            />
          </div>
          {editingId && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="inactive">Inaktiv</SelectItem>
                  <SelectItem value="archived">Archiviert</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              onClick={() => mutation.mutate()}
              disabled={!canManage || mutation.isPending || !name || !code}
            >
              Speichern
            </Button>
            {editingId && (
              <Button variant="ghost" onClick={reset}>
                Abbrechen
              </Button>
            )}
          </div>
          {!canManage && (
            <p className="text-muted-foreground text-xs">
              Dir fehlt die Berechtigung, Lagerorte zu verwalten.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
