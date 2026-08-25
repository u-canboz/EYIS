import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/versand/$fulfillmentId")({
  head: () => ({
    meta: [
      { title: "Kommissionierung & Versand – Commerce OS" },
      {
        name: "description",
        content: "Pickliste abarbeiten, Pakete packen, Versandlabel erzeugen und Sendungsstatus verfolgen.",
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
      return createLabel({ data: { organizationId, fulfillmentId, packageId, provider, service: null } });
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
      toast.success(r.supported ? `${r.stored} neue Ereignisse.` : "Dieser Dienstleister unterstützt kein Tracking.");
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["tracking-events"] });
    },
    onError: fail,
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelFul({ data: { organizationId, fulfillmentId, reason: "Manuell storniert" } }),
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

  if (detail.isLoading || !view) return <Skeleton className="h-96 w-full" />;

  const showPicking = view.status === "picking";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">
            <Link to="/app/versand" className="hover:underline">
              Versand
            </Link>{" "}
            /{" "}
            <Link to="/app/bestellungen/$orderId" params={{ orderId: view.orderId }} className="hover:underline">
              {view.orderNumber}
            </Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Fulfillment {view.orderNumber}</h1>
          <p className="text-muted-foreground text-sm">
            {FULFILLMENT_STATE_LABELS[view.status]}
            {view.locationName ? ` · ${view.locationName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {next && next.action !== "done" && <Badge variant="secondary">Nächster Schritt: {next.label}</Badge>}
          {can("fulfillment.manage") && view.status !== "cancelled" && view.status !== "shipped" && (
            <Button variant="ghost" onClick={() => cancelMutation.mutate()}>
              Stornieren
            </Button>
          )}
        </div>
      </header>

      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Pickliste</h2>
          {can("fulfillment.pick") && (view.status === "ready" || view.status === "draft") && (
            <Button size="sm" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
              Kommissionierung starten
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2 font-medium">Artikel</th>
                <th className="p-2 font-medium">SKU</th>
                <th className="p-2 font-medium">Menge</th>
                <th className="p-2 font-medium">Gepickt</th>
                <th className="p-2 font-medium">Gepackt</th>
                <th className="p-2 font-medium">Versendet</th>
              </tr>
            </thead>
            <tbody>
              {view.items.map((i: FulfillmentItemView) => (
                <tr key={i.id} className="border-t">
                  <td className="p-2">
                    {i.title}
                    {i.variantTitle ? <span className="text-muted-foreground"> · {i.variantTitle}</span> : null}
                  </td>
                  <td className="text-muted-foreground p-2 font-mono text-xs">{i.sku ?? "—"}</td>
                  <td className="p-2">{i.quantity}</td>
                  <td className="p-2">
                    {showPicking && can("fulfillment.pick") ? (
                      <Input
                        className="h-8 w-20"
                        value={picked[i.id] ?? String(i.pickedQuantity || i.quantity)}
                        onChange={(e) => setPicked({ ...picked, [i.id]: e.target.value })}
                      />
                    ) : (
                      i.pickedQuantity
                    )}
                  </td>
                  <td className="p-2">{i.packedQuantity}</td>
                  <td className="p-2">{i.shippedQuantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {showPicking && can("fulfillment.pick") && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => pickMutation.mutate()} disabled={pickMutation.isPending}>
              Pickliste speichern
            </Button>
          </div>
        )}
      </section>

      {can("fulfillment.pack") && showPicking && (
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-medium">Verpacken</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <Label>Gewicht (g)</Label>
              <Input className="w-40" value={packWeight} onChange={(e) => setPackWeight(e.target.value)} />
            </div>
            {presets.data?.length ? (
              <div className="grid gap-2">
                <Label>Verpackungs-Preset</Label>
                <Select onValueChange={(id) => setPackWeight(String(presets.data?.find((p) => p.id === id)?.weightGrams ?? ""))}>
                  <SelectTrigger className="w-56">
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
            <Button onClick={() => packMutation.mutate()} disabled={packMutation.isPending}>
              Alle gepickten Positionen verpacken
            </Button>
          </div>
        </section>
      )}

      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Pakete & Sendungen</h2>
          {can("shipping.create_label") && (
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="w-56">
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
          )}
        </div>

        {!view.packages.length ? (
          <p className="text-muted-foreground text-sm">Noch keine Pakete gepackt.</p>
        ) : (
          <div className="space-y-3">
            {view.packages.map((p) => (
              <div key={p.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">Paket {p.packageNumber}</p>
                    <p className="text-muted-foreground text-xs">
                      {p.items.reduce((s, i) => s + i.quantity, 0)} Positionen
                      {p.weightGrams ? ` · ${p.weightGrams} g` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {p.shipment ? (
                      <>
                        <Badge variant={p.shipment.status === "exception" ? "destructive" : "secondary"}>
                          {SHIPMENT_STATUS_LABELS[p.shipment.status]}
                        </Badge>
                        <span className="text-muted-foreground font-mono text-xs">
                          {p.shipment.trackingNumber ?? "—"}
                        </span>
                        {p.shipment.labelPath && (
                          <Button size="sm" variant="outline" onClick={() => openLabel(p.shipment!.id)}>
                            Label öffnen
                          </Button>
                        )}
                        {can("shipping.manage") && !p.shipment.shippedAt && (
                          <Button size="sm" onClick={() => shipMutation.mutate(p.shipment!.id)}>
                            Als versendet melden
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => refreshMutation.mutate(p.shipment!.id)}>
                          Tracking aktualisieren
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setOpenEvents(openEvents === p.shipment!.id ? null : p.shipment!.id)}
                        >
                          Verlauf
                        </Button>
                        {can("shipping.cancel") && !p.shipment.shippedAt && (
                          <Button size="sm" variant="ghost" onClick={() => cancelShipMutation.mutate(p.shipment!.id)}>
                            Sendung stornieren
                          </Button>
                        )}
                      </>
                    ) : (
                      can("shipping.create_label") && (
                        <Button size="sm" onClick={() => labelMutation.mutate(p.id)} disabled={labelMutation.isPending}>
                          Label erstellen
                        </Button>
                      )
                    )}
                  </div>
                </div>

                {p.shipment?.lastError && (
                  <p className="text-destructive mt-2 text-xs">
                    {p.shipment.lastError.code}: {p.shipment.lastError.message}
                  </p>
                )}
                {p.shipment?.carrierCostMinor !== null && p.shipment?.currencyCode && (
                  <p className="text-muted-foreground mt-2 text-xs">
                    Versandkosten Carrier: {formatMoney(p.shipment.carrierCostMinor!, p.shipment.currencyCode)}
                  </p>
                )}

                {openEvents === p.shipment?.id && (
                  <div className="mt-3 border-t pt-3">
                    {events.isLoading ? (
                      <Skeleton className="h-16 w-full" />
                    ) : !events.data?.length ? (
                      <p className="text-muted-foreground text-xs">Noch keine Tracking-Ereignisse.</p>
                    ) : (
                      <ul className="space-y-2 text-xs">
                        {events.data.map((e) => (
                          <li key={e.id} className="flex justify-between gap-4">
                            <span>
                              <strong>{TRACKING_STATUS_LABELS[e.normalizedStatus]}</strong>
                              {e.description ? ` — ${e.description}` : ""}
                              {e.location ? ` (${e.location})` : ""}
                            </span>
                            <span className="text-muted-foreground whitespace-nowrap">
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
      </section>
    </div>
  );
}
