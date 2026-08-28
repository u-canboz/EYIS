import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  commitReservation,
  expireReservations,
  listReservations,
  releaseReservation,
} from "@/lib/commerce/inventory.functions";
import { RESERVATION_STATUS_LABEL, type ReservationStatus } from "@/lib/commerce/inventory.types";
import { newIdempotencyKey } from "@/lib/commerce/inventory.validation";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/lager/reservierungen")({
  head: () => ({
    meta: [
      { title: "Reservierungen – EYIS" },
      {
        name: "description",
        content:
          "Aktive Bestandsreservierungen einsehen, freigeben, verbuchen oder abgelaufene bereinigen.",
      },
      { property: "og:title", content: "Reservierungen – EYIS" },
      {
        property: "og:description",
        content: "Reservierter Bestand bleibt jederzeit nachvollziehbar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReservationsPage,
});

function ReservationsPage() {
  const queryClient = useQueryClient();
  const { organizationId, shopId, can } = useActiveWorkspace();
  const [status, setStatus] = useState("active");

  const fetchReservations = useServerFn(listReservations);
  const runRelease = useServerFn(releaseReservation);
  const runCommit = useServerFn(commitReservation);
  const runExpire = useServerFn(expireReservations);

  const reservationsQuery = useQuery({
    queryKey: ["inventory-reservations", organizationId, shopId, status],
    enabled: Boolean(organizationId && shopId),
    queryFn: () =>
      fetchReservations({
        data: { organizationId, shopId, status: status === "all" ? null : status },
      }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["inventory-reservations"] });
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
  };

  const releaseMutation = useMutation({
    mutationFn: (reservationId: string) =>
      runRelease({ data: { organizationId, reservationId, idempotencyKey: newIdempotencyKey() } }),
    onSuccess: () => {
      toast.success("Reservierung freigegeben.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const commitMutation = useMutation({
    mutationFn: (reservationId: string) =>
      runCommit({ data: { organizationId, reservationId, idempotencyKey: newIdempotencyKey() } }),
    onSuccess: () => {
      toast.success("Reservierung verbucht.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const expireMutation = useMutation({
    mutationFn: () => runExpire({ data: { organizationId } }),
    onSuccess: () => {
      toast.success("Abgelaufene Reservierungen bereinigt.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = reservationsQuery.data ?? [];
  const canManage = can("inventory.adjust");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Reservierungen</h1>
          <p className="text-muted-foreground text-sm">
            Reservierter Bestand ist physisch vorhanden, aber nicht mehr verkäuflich.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktiv</SelectItem>
              <SelectItem value="released">Freigegeben</SelectItem>
              <SelectItem value="committed">Verbucht</SelectItem>
              <SelectItem value="expired">Abgelaufen</SelectItem>
              <SelectItem value="all">Alle</SelectItem>
            </SelectContent>
          </Select>
          {canManage && (
            <Button
              variant="outline"
              onClick={() => expireMutation.mutate()}
              disabled={expireMutation.isPending}
            >
              Abgelaufene bereinigen
            </Button>
          )}
        </div>
      </header>

      {reservationsQuery.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm">
          Keine Reservierungen in diesem Status.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Variante</th>
                <th className="p-3 text-right font-medium">Menge</th>
                <th className="p-3 text-right font-medium">Backorder</th>
                <th className="p-3 font-medium">Referenz</th>
                <th className="p-3 font-medium">Läuft ab</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3">
                    {row.inventory_items?.product_variants?.products?.name ?? "—"}
                    <div className="text-muted-foreground text-xs">
                      {row.inventory_items?.product_variants?.title ?? ""}
                      {row.inventory_items?.sku ? ` · ${row.inventory_items.sku}` : ""}
                    </div>
                  </td>
                  <td className="p-3 text-right">{row.quantity}</td>
                  <td className="p-3 text-right">{row.backordered_quantity}</td>
                  <td className="text-muted-foreground p-3">
                    {row.reference_type ?? "—"}
                    {row.reference_id ? ` · ${row.reference_id.slice(0, 8)}` : ""}
                  </td>
                  <td className="text-muted-foreground p-3">
                    {row.expires_at ? new Date(row.expires_at).toLocaleString("de-DE") : "—"}
                  </td>
                  <td className="p-3">
                    <Badge variant={row.status === "active" ? "default" : "secondary"}>
                      {RESERVATION_STATUS_LABEL[row.status as ReservationStatus] ?? row.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {row.status === "active" && canManage && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => releaseMutation.mutate(row.id)}
                          disabled={releaseMutation.isPending}
                        >
                          Freigeben
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => commitMutation.mutate(row.id)}
                          disabled={commitMutation.isPending}
                        >
                          Verbuchen
                        </Button>
                      </>
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
