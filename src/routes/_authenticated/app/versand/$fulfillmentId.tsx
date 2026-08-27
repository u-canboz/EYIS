import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import {
  getFulfillment,
  startPickingFn,
  completePickingFn,
  packFulfillmentFn,
  cancelFulfillmentFn,
} from "@/lib/commerce/fulfillment/fulfillment.functions";
import {
  listCarrierConfigs,
  createLabelFn,
  getLabelUrlFn,
  markShippedFn,
  cancelShipmentFn,
  refreshTrackingFn,
  listTrackingEventsFn,
  listPackagePresetsFn,
} from "@/lib/commerce/shipping/carrier.functions";
import {
  FULFILLMENT_STATE_LABELS,
  SHIPMENT_STATUS_LABELS,
  TRACKING_STATUS_LABELS,
  type FulfillmentItemView,
} from "@/lib/commerce/fulfillment/fulfillment.types";
import { carrierLabel } from "@/lib/commerce/shipping/carriers";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { formatMoney } from "@/lib/commerce/money";
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
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel } from "@/components/shell/DetailLayout";
import { TableScroll } from "@/components/data/TableScroll";

export const Route = createFileRoute("/_authenticated/app/versand/$fulfillmentId")({
  head: () => ({
    meta: [
      { title: "Kommissionierung & Versand – Commerce OS" },
      {
        name: "description",
        content:
          "Pickliste abarbeiten, Pakete packen, Versandlabel erzeugen und Sendungsstatus verfolgen.",
      },
      { property: "og:title", content: "Kommissionierung & Versand – Commerce OS" },
      { property: "og:description", content: "Ein Vorgang von der Pickliste bis zur Zustellung." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FulfillmentDetail,
});

function FulfillmentDetail() {
  const { fulfillmentId } = Route.useParams();
  const queryClient = useQueryClient();
  const { organizationId, shopId, can } = useActiveWorkspace();

  const fetchFulfillment = useServerFn(getFulfillment);
  const fetchConfigs = useServerFn(listCarrierConfigs);
  const fetchPresets = useServerFn(listPackagePresetsFn);
  const startPick = useServerFn(startPickingFn);
  const completePick = useServerFn(completePickingFn);
  const pack = useServerFn(packFulfillmentFn);
  const cancelFul = useServerFn(cancelFulfillmentFn);
  const createLabel = useServerFn(createLabelFn);
  const labelUrl = useServerFn(getLabelUrlFn);
  const markShipped = useServerFn(markShippedFn);
  const cancelShip = useServerFn(cancelShipmentFn);
  const refresh = useServerFn(refreshTrackingFn);
  const listEventsFn = useServerFn(listTrackingEventsFn);

  const [picked, setPicked] = useState<Record<string, string>>({});
  const [packWeight, setPackWeight] = useState("");
  const [provider, setProvider] = useState("");
  const [openEvents, setOpenEvents] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ["fulfillment", organizationId, fulfillmentId],
    enabled: !!organizationId,
    queryFn: () => fetchFulfillment({ data: { organizationId, fulfillmentId } }),
  });

  const configs = useQuery({
    queryKey: ["carrier-configs", organizationId, shopId],
    enabled: !!organizationId,
    queryFn: () => fetchConfigs({ data: { organizationId, shopId: shopId || null } }),
  });

  const presets = useQuery({
    queryKey: ["package-presets", organizationId, shopId],
    enabled: !!organizationId,
    queryFn: () => fetchPresets({ data: { organizationId, shopId: shopId || null } }),
  });

  const events = useQuery({
    queryKey: ["tracking-events", organizationId, openEvents],
    enabled: !!organizationId && !!openEvents,
    queryFn: () => listEventsFn({ data: { organizationId, shipmentId: openEvents! } }),
  });

  const view = detail.data?.fulfillment;
  const next = detail.data?.nextAction;
  const activeProviders = useMemo(
    () => (configs.data ?? []).filter((c) => c.status === "active"),
    [configs.data],
  );
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["fulfillment", organizationId, fulfillmentId] });
    queryClient.invalidateQueries({ queryKey: ["fulfillments"] });
  };
  const fail = (e: Error) => toast.error(e.message);

  const startMutation = useMutation({
    mutationFn: () => startPick({ data: { organizationId, fulfillmentId } }),
    onSuccess: () => {
      toast.success("Kommissionierung gestartet.");
      invalidate();
    },
    onError: fail,
  });

  const pickMutation = useMutation({
    mutationFn: () =>
      completePick({
        data: {
          organizationId,
          fulfillmentId,
          picked: (view?.items ?? []).map((i) => ({
            fulfillmentItemId: i.id,
            pickedQuantity: Number(picked[i.id] ?? i.quantity),
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Pickliste gespeichert.");
      invalidate();
    },
    onError: fail,
  });

  const packMutation = useMutation({
    mutationFn: () => {
      const items = (view?.items ?? [])
        .map((i) => ({ fulfillmentItemId: i.id, quantity: i.pickedQuantity - i.packedQuantity }))
        .filter((i) => i.quantity > 0);
      if (!items.length) throw new Error("Es gibt keine gepickten Positionen zum Verpacken.");
      return pack({
        data: {
          organizationId,
          fulfillmentId,
          packages: [{ weightGrams: packWeight ? Number(packWeight) : null, items }],
        },
      });
    },
    onSuccess: () => {
      toast.success("Paket erstellt.");
      setPackWeight("");
      invalidate();
    },
    onError: fail,
  });

  const labelMutation = useMutation({
    mutationFn: (packageId: string) => {
      if (!provider) throw new Error("Bitte einen Versanddienstleister wählen.");
      return createLabel({
        data: { organizationId, fulfillmentId, packageId, provider, service: null },
      });
    },
    onSuccess: () => {
      toast.success("Label erstellt.");
      invalidate();
    },
    onError: fail,
  });

  const shipMutation = useMutation({
    mutationFn: (shipmentId: string) => markShipped({ data: { organizationId, shipmentId } }),
    onSuccess: () => {
      toast.success("Sendung als versendet gemeldet.");
      invalidate();
    },
    onError: fail,
  });

  const cancelShipMutation = useMutation({
    mutationFn: (shipmentId: string) => cancelShip({ data: { organizationId, shipmentId } }),
    onSuccess: () => {
      toast.success("Sendung storniert.");
      invalidate();
    },
    onError: fail,
  });

  const refreshMutation = useMutation({
    mutationFn: (shipmentId: string) => refresh({ data: { organizationId, shipmentId } }),
    onSuccess: (r) => {
      toast.success(
        r.supported
          ? `${r.stored} neue Ereignisse.`
          : "Dieser Dienstleister unterstützt kein Tracking.",
      );
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["tracking-events"] });
    },
    onError: fail,
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      cancelFul({ data: { organizationId, fulfillmentId, reason: "Manuell storniert" } }),
    onSuccess: () => {
      toast.success("Fulfillment storniert.");
      invalidate();
    },
    onError: fail,
  });

  const openLabel = async (shipmentId: string) => {
    try {
      const { url } = await labelUrl({ data: { organizationId, shipmentId } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      fail(e as Error);
    }
  };

  if (detail.isLoading || !view)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );

  const showPicking = view.status === "picking";

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        eyebrow={
          <>
            <Link
              to="/app/versand"
              className="inline-flex min-h-11 items-center gap-1.5 hover:text-foreground"
            >
              <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
              Versand
            </Link>
            <span>/</span>
            <Link
              to="/app/bestellungen/$orderId"
              params={{ orderId: view.orderId }}
              className="min-h-11 truncate hover:text-foreground hover:underline"
            >
              {view.orderNumber}
            </Link>
          </>
        }
        title={`Fulfillment ${view.orderNumber}`}
        description={`${FULFILLMENT_STATE_LABELS[view.status]}${view.locationName ? ` · ${view.locationName}` : ""}`}
        actions={
          <>
            {next && next.action !== "done" && (
              <Badge variant="secondary">Nächster Schritt: {next.label}</Badge>
            )}
            {can("fulfillment.manage") &&
              view.status !== "cancelled" &&
              view.status !== "shipped" && (
                <Button variant="ghost" className="h-11" onClick={() => cancelMutation.mutate()}>
                  Stornieren
                </Button>
              )}
          </>
        }
      />

      <Panel
        title="Pickliste"
        actions={
          can("fulfillment.pick") && (view.status === "ready" || view.status === "draft") ? (
            <Button
              size="sm"
              className="min-h-11"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
            >
              Kommissionierung starten
            </Button>
          ) : undefined
        }
        bodyClassName="space-y-3 p-0"
      >
        <TableScroll className="border-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Artikel</th>
                <th className="p-3 font-medium">SKU</th>
                <th className="p-3 font-medium">Menge</th>
                <th className="p-3 font-medium">Gepickt</th>
                <th className="p-3 font-medium">Gepackt</th>
                <th className="p-3 font-medium">Versendet</th>
              </tr>
            </thead>
            <tbody>
              {view.items.map((i: FulfillmentItemView) => (
                <tr key={i.id} className="border-t border-border">
                  <td className="p-3 break-words">
                    {i.title}
                    {i.variantTitle ? (
                      <span className="text-muted-foreground"> · {i.variantTitle}</span>
                    ) : null}
                  </td>
                  <td className="p-3 font-mono text-xs break-words text-muted-foreground">
                    {i.sku ?? "—"}
                  </td>
                  <td className="p-3 tabular-nums">{i.quantity}</td>
                  <td className="p-3">
                    {showPicking && can("fulfillment.pick") ? (
                      <Input
                        className="h-9 w-20"
                        value={picked[i.id] ?? String(i.pickedQuantity || i.quantity)}
                        onChange={(e) => setPicked({ ...picked, [i.id]: e.target.value })}
                      />
                    ) : (
                      <span className="tabular-nums">{i.pickedQuantity}</span>
                    )}
                  </td>
                  <td className="p-3 tabular-nums">{i.packedQuantity}</td>
                  <td className="p-3 tabular-nums">{i.shippedQuantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
        {showPicking && can("fulfillment.pick") && (
          <div className="flex justify-end p-4 pt-0">
            <Button
              size="sm"
              className="min-h-11"
              onClick={() => pickMutation.mutate()}
              disabled={pickMutation.isPending}
            >
              Pickliste speichern
            </Button>
          </div>
        )}
      </Panel>

      {can("fulfillment.pack") && showPicking && (
        <Panel title="Verpacken">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <Label>Gewicht (g)</Label>
              <Input
                className="h-11 w-40"
                value={packWeight}
                onChange={(e) => setPackWeight(e.target.value)}
              />
            </div>
            {presets.data?.length ? (
              <div className="grid gap-2">
                <Label>Verpackungs-Preset</Label>
                <Select
                  onValueChange={(id) =>
                    setPackWeight(String(presets.data?.find((p) => p.id === id)?.weightGrams ?? ""))
                  }
                >
                  <SelectTrigger className="h-11 w-56">
                    <SelectValue placeholder="Preset wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.data.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <Button className="h-11" onClick={() => packMutation.mutate()} disabled={packMutation.isPending}>
              Alle gepickten Positionen verpacken
            </Button>
          </div>
        </Panel>
      )}

      <Panel
        title="Pakete & Sendungen"
        actions={
          can("shipping.create_label") ? (
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="h-9 w-56">
                <SelectValue placeholder="Versanddienstleister" />
              </SelectTrigger>
              <SelectContent>
                {activeProviders.map((c) => (
                  <SelectItem key={c.id} value={c.provider}>
                    {carrierLabel(c.provider)}
                    {c.testMode ? " (Test)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
      >
        {!view.packages.length ? (
          <p className="text-sm text-muted-foreground">Noch keine Pakete gepackt.</p>
        ) : (
          <div className="min-w-0 space-y-3">
            {view.packages.map((p) => (
              <div key={p.id} className="min-w-0 rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">Paket {p.packageNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.items.reduce((s, i) => s + i.quantity, 0)} Positionen
                      {p.weightGrams ? ` · ${p.weightGrams} g` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {p.shipment ? (
                      <>
                        <Badge
                          variant={p.shipment.status === "exception" ? "destructive" : "secondary"}
                        >
                          {SHIPMENT_STATUS_LABELS[p.shipment.status]}
                        </Badge>
                        <span className="font-mono text-xs break-words text-muted-foreground">
                          {p.shipment.trackingNumber ?? "—"}
                        </span>
                        {p.shipment.labelPath && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openLabel(p.shipment!.id)}
                          >
                            Label öffnen
                          </Button>
                        )}
                        {can("shipping.manage") && !p.shipment.shippedAt && (
                          <Button size="sm" onClick={() => shipMutation.mutate(p.shipment!.id)}>
                            Als versendet melden
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => refreshMutation.mutate(p.shipment!.id)}
                        >
                          Tracking aktualisieren
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setOpenEvents(openEvents === p.shipment!.id ? null : p.shipment!.id)
                          }
                        >
                          Verlauf
                        </Button>
                        {can("shipping.cancel") && !p.shipment.shippedAt && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cancelShipMutation.mutate(p.shipment!.id)}
                          >
                            Sendung stornieren
                          </Button>
                        )}
                      </>
                    ) : (
                      can("shipping.create_label") && (
                        <Button
                          size="sm"
                          onClick={() => labelMutation.mutate(p.id)}
                          disabled={labelMutation.isPending}
                        >
                          Label erstellen
                        </Button>
                      )
                    )}
                  </div>
                </div>

                {p.shipment?.lastError && (
                  <p className="mt-2 text-xs break-words text-destructive">
                    {p.shipment.lastError.code}: {p.shipment.lastError.message}
                  </p>
                )}
                {p.shipment?.carrierCostMinor !== null && p.shipment?.currencyCode && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Versandkosten Carrier:{" "}
                    {formatMoney(p.shipment.carrierCostMinor!, p.shipment.currencyCode)}
                  </p>
                )}

                {openEvents === p.shipment?.id && (
                  <div className="mt-3 border-t border-border pt-3">
                    {events.isLoading ? (
                      <Skeleton className="h-16 w-full" />
                    ) : !events.data?.length ? (
                      <p className="text-xs text-muted-foreground">
                        Noch keine Tracking-Ereignisse.
                      </p>
                    ) : (
                      <ul className="space-y-2 text-xs">
                        {events.data.map((e) => (
                          <li key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                            <span className="min-w-0 break-words">
                              <strong>{TRACKING_STATUS_LABELS[e.normalizedStatus]}</strong>
                              {e.description ? ` — ${e.description}` : ""}
                              {e.location ? ` (${e.location})` : ""}
                            </span>
                            <span className="shrink-0 text-muted-foreground tabular-nums">
                              {new Date(e.occurredAt).toLocaleString("de-DE")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
