/** Server-only tracking journal. Events are append-only and never rewritten. */
import { getAdmin } from "../core.server";
import type { NormalizedTrackingEvent, TrackingStatusCode } from "../shipping/provider";
import type { OrderTrackingView, TrackingEventView } from "./tracking.types";
import { publishShipmentEvent } from "../event-payloads.server";

type Row = Record<string, unknown>;

/**
 * Stores events in chronological order. Duplicates are dropped by the database;
 * late events are kept historically but never move the shipment backwards.
 */
export async function recordTrackingEvents(
  organizationId: string,
  shipmentId: string,
  provider: string,
  events: NormalizedTrackingEvent[],
) {
  const admin = await getAdmin();
  const ordered = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  let stored = 0;
  let duplicates = 0;
  let advanced = false;

  for (const event of ordered) {
    const { data, error } = await admin.rpc("track_record_event" as never, {
      _org: organizationId,
      _shipment: shipmentId,
      _provider: provider,
      _provider_event_id: event.providerEventId,
      _code: event.code,
      _normalized: event.status,
      _description: event.description,
      _location: event.location,
      _occurred_at: event.occurredAt,
      _raw: event.raw ?? {},
    } as never);
    if (error) throw new Error(error.message);
    const result = data as unknown as { duplicate: boolean; advanced?: boolean };
    if (result.duplicate) duplicates += 1;
    else stored += 1;
    if (result.advanced) advanced = true;
    if (result.advanced && !result.duplicate) {
      if (event.status === "delivered") await publishShipmentEvent(shipmentId, "shipment.delivered");
      else if (event.status === "exception") {
        await publishShipmentEvent(shipmentId, "shipment.exception", {
          message: event.description ?? null,
        });
      }
    }
  }
  return { stored, duplicates, advanced };
}

export async function listTrackingEvents(organizationId: string, shipmentId: string): Promise<TrackingEventView[]> {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("tracking_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("shipment_id", shipmentId)
    .order("occurred_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((r) => ({
    id: r['id'] as string,
    shipmentId: r['shipment_id'] as string,
    carrierProvider: r['carrier_provider'] as string,
    eventCode: r['event_code'] as string,
    normalizedStatus: r['normalized_status'] as TrackingStatusCode,
    description: (r['description'] as string) ?? null,
    location: (r['location'] as string) ?? null,
    occurredAt: r['occurred_at'] as string,
  }));
}

/** Safe projection for a later customer portal: no internal ids, no notes. */
export async function getOrderTracking(organizationId: string, orderId: string): Promise<OrderTrackingView> {
  const admin = await getAdmin();
  const { data: order } = await admin
    .from("orders")
    .select("order_number")
    .eq("organization_id", organizationId)
    .eq("id", orderId)
    .maybeSingle();
  if (!order) throw new Error("Bestellung nicht gefunden.");

  const { data: fulfillments } = await admin
    .from("fulfillments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("order_id", orderId);
  const ids = ((fulfillments ?? []) as Row[]).map((f) => f['id'] as string);
  if (!ids.length) return { orderNumber: (order as Row)['order_number'] as string, shipments: [] };

  const { data: shipments } = await admin
    .from("shipments")
    .select("id, carrier_provider, tracking_number, tracking_url, normalized_tracking_status, shipped_at, delivered_at")
    .in("fulfillment_id", ids)
    .neq("status", "cancelled");
  const shipmentRows = (shipments ?? []) as Row[];
  const shipmentIds = shipmentRows.map((s) => s['id'] as string);

  const { data: events } = shipmentIds.length
    ? await admin
        .from("tracking_events")
        .select("shipment_id, normalized_status, description, occurred_at")
        .in("shipment_id", shipmentIds)
        .order("occurred_at", { ascending: false })
    : { data: [] as Row[] };

  return {
    orderNumber: (order as Row)['order_number'] as string,
    shipments: shipmentRows.map((s) => ({
      carrierProvider: s['carrier_provider'] as string,
      trackingNumber: (s['tracking_number'] as string) ?? null,
      trackingUrl: (s['tracking_url'] as string) ?? null,
      status: s['normalized_tracking_status'] as TrackingStatusCode,
      shippedAt: (s['shipped_at'] as string) ?? null,
      deliveredAt: (s['delivered_at'] as string) ?? null,
      events: ((events ?? []) as Row[])
        .filter((e) => e['shipment_id'] === s['id'])
        .map((e) => ({
          status: e['normalized_status'] as TrackingStatusCode,
          description: (e['description'] as string) ?? null,
          occurredAt: e['occurred_at'] as string,
        })),
    })),
  };
}
