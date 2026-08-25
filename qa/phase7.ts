/* Phase 7 acceptance run: fulfillment → pick → pack → label → shipped → tracking. */
import { admin, check, summary } from "./lib";
import {
  createFulfillment,
  startPicking,
  completePicking,
  packFulfillment,
  loadFulfillment,
  nextAction,
} from "../src/lib/commerce/fulfillment/fulfillment.server";
import { createShipmentWithLabel, markShipped, refreshTracking, getLabelUrl } from "../src/lib/commerce/shipping/shipping.server";
import { listTrackingEvents } from "../src/lib/commerce/tracking/tracking.server";

const ORG = "ba039523-f8ec-44ff-bb9d-2b5b86b0c0a6";
const SHOP = "a9751182-2f3a-4f9a-a2e6-73b6ffd48974";
const ACTOR = "0e0aa7a8-7f55-4474-96dc-542f438b16ee";
const ORDER = process.env['QA_ORDER_ID'] ?? "0da70596-d520-4305-9554-c1e708f20f34";
const LOCATION = "ad5bd83e-16cc-4f41-86d5-5554bd40f868";

await admin.from("shipping_provider_configs").upsert(
  {
    organization_id: ORG,
    shop_id: SHOP,
    provider: "mock",
    display_name: "Test-Carrier",
    status: "active",
    test_mode: true,
  } as never,
  { onConflict: "shop_id,provider" } as never,
);

const { data: items } = await admin.from("order_items").select("id, quantity").eq("order_id", ORDER);
const lines = (items ?? []) as { id: string; quantity: number }[];

const created = await createFulfillment({
  organizationId: ORG,
  shopId: SHOP,
  orderId: ORDER,
  locationId: LOCATION,
  actorId: ACTOR,
  items: lines.map((l) => ({ orderItemId: l.id, quantity: l.quantity })),
  idempotencyKey: `qa7:${ORDER}`,
});
check("Fulfillment angelegt", !!created.fulfillment_id, created.fulfillment_id);

const again = await createFulfillment({
  organizationId: ORG,
  shopId: SHOP,
  orderId: ORDER,
  locationId: LOCATION,
  actorId: ACTOR,
  items: lines.map((l) => ({ orderItemId: l.id, quantity: l.quantity })),
  idempotencyKey: `qa7:${ORDER}`,
});
check("Idempotenz beim Anlegen", again.fulfillment_id === created.fulfillment_id);

const fid = created.fulfillment_id;
await startPicking({ organizationId: ORG, fulfillmentId: fid, actorId: ACTOR });
let view = await loadFulfillment(ORG, fid);
check("Status picking", view.status === "picking", view.status);

await completePicking({
  organizationId: ORG,
  fulfillmentId: fid,
  actorId: ACTOR,
  picked: view.items.map((i) => ({ fulfillmentItemId: i.id, pickedQuantity: i.quantity })),
});
view = await loadFulfillment(ORG, fid);
check("Alles gepickt", view.items.every((i) => i.pickedQuantity === i.quantity));

await packFulfillment({
  organizationId: ORG,
  fulfillmentId: fid,
  actorId: ACTOR,
  packages: [{ weightGrams: 900, items: view.items.map((i) => ({ fulfillmentItemId: i.id, quantity: i.pickedQuantity })) }],
});
view = await loadFulfillment(ORG, fid);
check("Status packed", view.status === "packed", view.status);
check("Ein Paket vorhanden", view.packages.length === 1);
check("Nächster Schritt = Label", nextAction(view).action === "create_label", nextAction(view).action);

const pkgId = view.packages[0]!.id;
const shipment = await createShipmentWithLabel({
  organizationId: ORG,
  fulfillmentId: fid,
  packageId: pkgId,
  provider: "mock",
  service: null,
  actorId: ACTOR,
});
check("Label erzeugt", !!shipment.trackingNumber && !!shipment.labelPath, shipment.trackingNumber ?? "");

const shipmentAgain = await createShipmentWithLabel({
  organizationId: ORG,
  fulfillmentId: fid,
  packageId: pkgId,
  provider: "mock",
  service: null,
  actorId: ACTOR,
});
check("Kein Doppel-Label", shipmentAgain.id === shipment.id && shipmentAgain.labelId === shipment.labelId);

const { url } = await getLabelUrl(ORG, shipment.id);
check("Label-URL signiert", url.includes("token=") || url.includes("sign/"), url.slice(0, 60));

const shippedResult = await markShipped({ organizationId: ORG, shipmentId: shipment.id, actorId: ACTOR });
check("Sendung versendet", shippedResult.status === "shipped");
const { data: orderRow } = await admin.from("orders").select("fulfillment_status").eq("id", ORDER).single();
check(
  "Bestellstatus fulfilled",
  (orderRow as { fulfillment_status: string }).fulfillment_status === "fulfilled",
  (orderRow as { fulfillment_status: string }).fulfillment_status,
);

const tracking = await refreshTracking(ORG, shipment.id);
check("Tracking-Ereignisse gespeichert", tracking.stored > 0, String(tracking.stored));
const second = await refreshTracking(ORG, shipment.id);
check("Tracking-Dedupe", second.stored === 0 && second.duplicates > 0, `${second.stored}/${second.duplicates}`);

const events = await listTrackingEvents(ORG, shipment.id);
check("Verlauf lesbar", events.length > 0, String(events.length));

const { data: finalShipment } = await admin.from("shipments").select("normalized_tracking_status").eq("id", shipment.id).single();
const status = (finalShipment as { normalized_tracking_status: string }).normalized_tracking_status;
check("Endstatus zugestellt", status === "delivered", status);

// Rückwärts-Event darf den Status nicht zurücksetzen.
await admin.rpc("track_record_event" as never, {
  _org: ORG,
  _shipment: shipment.id,
  _provider: "mock",
  _provider_event_id: "qa-late-event",
  _code: "LATE",
  _normalized: "in_transit",
  _description: "Verspätetes Ereignis",
  _location: null,
  _occurred_at: new Date().toISOString(),
  _raw: {},
} as never);
const { data: afterLate } = await admin.from("shipments").select("normalized_tracking_status").eq("id", shipment.id).single();
check(
  "Kein Status-Rückschritt",
  (afterLate as { normalized_tracking_status: string }).normalized_tracking_status === "delivered",
);

summary();
