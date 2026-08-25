/**
 * Server-only fulfillment reads and lifecycle orchestration.
 * Every state transition goes through a locking SQL function; nothing here
 * touches inventory levels — stock was already committed at order finalisation.
 */
import { getAdmin } from "../core.server";
import type {
  AllocationLine,
  AllocationSuggestion,
  FulfillmentQueueItem,
  FulfillmentState,
  FulfillmentView,
  NextAction,
  PackageView,
  ShipmentView,
} from "./fulfillment.types";
import type { TrackingStatusCode } from "../shipping/provider";

type Row = Record<string, unknown>;

function num(v: unknown) {
  return Number(v ?? 0);
}

export function mapShipment(r: Row, labelPath: string | null = null): ShipmentView {
  const err = r['last_error'] as { code?: string; message?: string } | null;
  return {
    id: r['id'] as string,
    fulfillmentId: r['fulfillment_id'] as string,
    packageId: (r['package_id'] as string) ?? null,
    carrierProvider: r['carrier_provider'] as string,
    carrierService: (r['carrier_service'] as string) ?? null,
    providerShipmentId: (r['provider_shipment_id'] as string) ?? null,
    trackingNumber: (r['tracking_number'] as string) ?? null,
    trackingUrl: (r['tracking_url'] as string) ?? null,
    status: r['status'] as ShipmentView["status"],
    normalizedTrackingStatus: r['normalized_tracking_status'] as TrackingStatusCode,
    shippedAt: (r['shipped_at'] as string) ?? null,
    deliveredAt: (r['delivered_at'] as string) ?? null,
    labelId: (r['label_id'] as string) ?? null,
    labelPath,
    carrierCostMinor: r['carrier_cost_minor'] === null ? null : num(r['carrier_cost_minor']),
    currencyCode: (r['currency_code'] as string) ?? null,
    lastError: err && err.code ? { code: err.code, message: err.message ?? "" } : null,
  };
}

/** Queue for the workspace. Loaded in bulk — never one query per fulfillment. */
export async function listFulfillmentQueue(input: {
  organizationId: string;
  shopId?: string | null;
  statuses?: FulfillmentState[] | null;
  locationId?: string | null;
  carrierProvider?: string | null;
  search?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
}): Promise<FulfillmentQueueItem[]> {
  const admin = await getAdmin();
  let query = admin
    .from("fulfillments")
    .select("*")
    .eq("organization_id", input.organizationId)
    .order("created_at", { ascending: false })
    .limit(Math.min(input.limit ?? 100, 200));

  if (input.shopId) query = query.eq("shop_id", input.shopId);
  if (input.statuses?.length) query = query.in("status", input.statuses as never);
  if (input.locationId) query = query.eq("location_id", input.locationId);
  if (input.from) query = query.gte("created_at", input.from);
  if (input.to) query = query.lte("created_at", input.to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  if (!rows.length) return [];

  const ids = rows.map((r) => r['id'] as string);
  const orderIds = [...new Set(rows.map((r) => r['order_id'] as string))];
  const locationIds = [...new Set(rows.map((r) => r['location_id']).filter(Boolean))] as string[];

  const [items, packages, shipments, orders, locations] = await Promise.all([
    admin.from("fulfillment_items").select("fulfillment_id, quantity, picked_quantity, packed_quantity, shipped_quantity").in("fulfillment_id", ids),
    admin.from("packages").select("id, fulfillment_id, status").in("fulfillment_id", ids),
    admin.from("shipments").select("*").in("fulfillment_id", ids),
    admin.from("orders").select("id, order_number, shipping_method, placed_at").in("id", orderIds),
    locationIds.length
      ? admin.from("inventory_locations").select("id, name").in("id", locationIds)
      : Promise.resolve({ data: [] as Row[] }),
  ]);

  const orderById = new Map(((orders.data ?? []) as Row[]).map((o) => [o['id'] as string, o]));
  const locationById = new Map(((locations.data ?? []) as Row[]).map((l) => [l['id'] as string, l['name'] as string]));

  const list = rows.map((f) => {
    const id = f['id'] as string;
    const own = ((items.data ?? []) as Row[]).filter((i) => i['fulfillment_id'] === id);
    const pkgs = ((packages.data ?? []) as Row[]).filter((p) => p['fulfillment_id'] === id);
    const ships = ((shipments.data ?? []) as Row[]).filter((s) => s['fulfillment_id'] === id);
    const active = ships.find((s) => s['status'] !== "cancelled") ?? null;
    const order = orderById.get(f['order_id'] as string);
    const method = (order?.['shipping_method'] as { name?: string } | null) ?? null;

    return {
      id,
      orderId: f['order_id'] as string,
      orderNumber: (order?.['order_number'] as string) ?? "—",
      status: f['status'] as FulfillmentState,
      locationName: f['location_id'] ? (locationById.get(f['location_id'] as string) ?? null) : null,
      createdAt: f['created_at'] as string,
      totalQuantity: own.reduce((s, i) => s + num(i['quantity']), 0),
      pickedQuantity: own.reduce((s, i) => s + num(i['picked_quantity']), 0),
      packedQuantity: own.reduce((s, i) => s + num(i['packed_quantity']), 0),
      shippedQuantity: own.reduce((s, i) => s + num(i['shipped_quantity']), 0),
      packageCount: pkgs.length,
      carrierProvider: (active?.['carrier_provider'] as string) ?? null,
      trackingNumber: (active?.['tracking_number'] as string) ?? null,
      hasException: ships.some((s) => s['status'] === "exception" || s['last_error'] !== null),
      shippingMethodName: method?.name ?? null,
    } satisfies FulfillmentQueueItem;
  });

  const filtered = list.filter((f) => {
    if (input.carrierProvider && f.carrierProvider !== input.carrierProvider) return false;
    const term = (input.search ?? "").trim().toLowerCase();
    if (!term) return true;
    return (
      f.orderNumber.toLowerCase().includes(term) || (f.trackingNumber ?? "").toLowerCase().includes(term)
    );
  });
  return filtered;
}

export async function loadFulfillment(organizationId: string, fulfillmentId: string): Promise<FulfillmentView> {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("fulfillments")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", fulfillmentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Fulfillment nicht gefunden.");
  const f = data as Row;

  const [itemRows, packageRows, shipmentRows, labelRows, orderRow, locationRow] = await Promise.all([
    admin.from("fulfillment_items").select("*").eq("fulfillment_id", fulfillmentId).order("created_at"),
    admin.from("packages").select("*").eq("fulfillment_id", fulfillmentId).order("package_number"),
    admin.from("shipments").select("*").eq("fulfillment_id", fulfillmentId).order("created_at"),
    admin.from("shipping_labels").select("id, shipment_id, storage_path").eq("organization_id", organizationId).is("voided_at", null),
    admin.from("orders").select("id, order_number").eq("id", f['order_id'] as string).maybeSingle(),
    f['location_id']
      ? admin.from("inventory_locations").select("name").eq("id", f['location_id'] as string).maybeSingle()
      : Promise.resolve({ data: null as Row | null }),
  ]);

  const items = (itemRows.data ?? []) as Row[];
  const orderItemIds = items.map((i) => i['order_item_id'] as string);
  const { data: orderItems } = orderItemIds.length
    ? await admin.from("order_items").select("id, title_snapshot, variant_title_snapshot, sku_snapshot").in("id", orderItemIds)
    : { data: [] as Row[] };
  const orderItemById = new Map(((orderItems ?? []) as Row[]).map((o) => [o['id'] as string, o]));

  const packageItemIds = ((packageRows.data ?? []) as Row[]).map((p) => p['id'] as string);
  const { data: packageItems } = packageItemIds.length
    ? await admin.from("package_items").select("*").in("package_id", packageItemIds)
    : { data: [] as Row[] };

  const labelByShipment = new Map(
    ((labelRows.data ?? []) as Row[]).map((l) => [l['shipment_id'] as string, l['storage_path'] as string]),
  );

  const mappedItems = items.map((i) => {
    const oi = orderItemById.get(i['order_item_id'] as string);
    return {
      id: i['id'] as string,
      orderItemId: i['order_item_id'] as string,
      title: (oi?.['title_snapshot'] as string) ?? "Position",
      variantTitle: (oi?.['variant_title_snapshot'] as string) ?? null,
      sku: (oi?.['sku_snapshot'] as string) ?? null,
      quantity: num(i['quantity']),
      pickedQuantity: num(i['picked_quantity']),
      packedQuantity: num(i['packed_quantity']),
      shippedQuantity: num(i['shipped_quantity']),
    };
  });
  const titleByItemId = new Map(mappedItems.map((i) => [i.id, i.title]));

  const packages: PackageView[] = ((packageRows.data ?? []) as Row[]).map((p) => {
    const shipment = ((shipmentRows.data ?? []) as Row[]).find(
      (s) => s['package_id'] === p['id'] && s['status'] !== "cancelled",
    );
    return {
      id: p['id'] as string,
      packageNumber: num(p['package_number']),
      status: p['status'] as PackageView["status"],
      weightGrams: p['weight_grams'] === null ? null : num(p['weight_grams']),
      lengthMm: p['length_mm'] === null ? null : num(p['length_mm']),
      widthMm: p['width_mm'] === null ? null : num(p['width_mm']),
      heightMm: p['height_mm'] === null ? null : num(p['height_mm']),
      packagingType: (p['packaging_type'] as string) ?? null,
      items: ((packageItems ?? []) as Row[])
        .filter((pi) => pi['package_id'] === p['id'])
        .map((pi) => ({
          id: pi['id'] as string,
          fulfillmentItemId: pi['fulfillment_item_id'] as string,
          title: titleByItemId.get(pi['fulfillment_item_id'] as string) ?? "Position",
          quantity: num(pi['quantity']),
        })),
      shipment: shipment ? mapShipment(shipment, labelByShipment.get(shipment['id'] as string) ?? null) : null,
    };
  });

  return {
    id: f['id'] as string,
    orderId: f['order_id'] as string,
    orderNumber: ((orderRow.data as Row | null)?.['order_number'] as string) ?? "—",
    shopId: f['shop_id'] as string,
    locationId: (f['location_id'] as string) ?? null,
    locationName: ((locationRow.data as Row | null)?.['name'] as string) ?? null,
    status: f['status'] as FulfillmentState,
    notes: (f['notes'] as string) ?? null,
    createdAt: f['created_at'] as string,
    shippedAt: (f['shipped_at'] as string) ?? null,
    deliveredAt: (f['delivered_at'] as string) ?? null,
    items: mappedItems,
    packages,
  };
}

export async function loadOrderFulfillments(organizationId: string, orderId: string): Promise<FulfillmentView[]> {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("fulfillments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("order_id", orderId)
    .order("created_at");
  if (error) throw new Error(error.message);
  const ids = ((data ?? []) as Row[]).map((r) => r['id'] as string);
  return await Promise.all(ids.map((id) => loadFulfillment(organizationId, id)));
}

/** Location proposal — never an automatic decision. */
export async function suggestAllocation(organizationId: string, orderId: string): Promise<AllocationSuggestion> {
  const admin = await getAdmin();
  const { data: order, error } = await admin
    .from("orders")
    .select("id, order_number, shop_id")
    .eq("organization_id", organizationId)
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) throw new Error("Bestellung nicht gefunden.");
  const o = order as Row;

  const [{ data: itemRows }, { data: locationRows }] = await Promise.all([
    admin.from("order_items").select("*").eq("order_id", orderId).order("created_at"),
    admin
      .from("inventory_locations")
      .select("id, name, priority")
      .eq("organization_id", organizationId)
      .eq("shop_id", o['shop_id'] as string)
      .eq("status", "active")
      .order("priority"),
  ]);
  const items = (itemRows ?? []) as Row[];
  const locations = (locationRows ?? []) as Row[];

  const variantIds = items.map((i) => i['variant_id']).filter(Boolean) as string[];
  const { data: invItems } = variantIds.length
    ? await admin.from("inventory_items").select("id, variant_id").eq("organization_id", organizationId).in("variant_id", variantIds)
    : { data: [] as Row[] };
  const invItemByVariant = new Map(((invItems ?? []) as Row[]).map((r) => [r['variant_id'] as string, r['id'] as string]));

  const invItemIds = [...invItemByVariant.values()];
  const { data: levels } = invItemIds.length
    ? await admin
        .from("inventory_levels")
        .select("inventory_item_id, location_id, on_hand, reserved, damaged")
        .eq("organization_id", organizationId)
        .in("inventory_item_id", invItemIds)
    : { data: [] as Row[] };

  const { data: planned } = await admin
    .from("fulfillment_items")
    .select("order_item_id, quantity, fulfillments!inner(status, order_id)")
    .eq("organization_id", organizationId);
  const plannedByItem = new Map<string, number>();
  for (const p of (planned ?? []) as Row[]) {
    const rel = p['fulfillments'] as { status: string; order_id: string } | null;
    if (!rel || rel.order_id !== orderId || rel.status === "cancelled") continue;
    const key = p['order_item_id'] as string;
    plannedByItem.set(key, (plannedByItem.get(key) ?? 0) + num(p['quantity']));
  }

  const lines: AllocationLine[] = items.map((i) => {
    const invItemId = invItemByVariant.get(i['variant_id'] as string) ?? null;
    const options = locations.map((l) => {
      const level = ((levels ?? []) as Row[]).find(
        (lv) => lv['location_id'] === l['id'] && lv['inventory_item_id'] === invItemId,
      );
      return {
        locationId: l['id'] as string,
        locationName: l['name'] as string,
        available: level ? num(level['on_hand']) - num(level['reserved']) - num(level['damaged']) : 0,
        priority: num(l['priority']),
      };
    });
    const alreadyPlanned = plannedByItem.get(i['id'] as string) ?? 0;
    const open = Math.max(num(i['quantity']) - alreadyPlanned, 0);
    const sorted = [...options].sort(
      (a, b) => Number(b.available >= open) - Number(a.available >= open) || b.available - a.available || a.priority - b.priority,
    );
    return {
      orderItemId: i['id'] as string,
      title: (i['title_snapshot'] as string) ?? "Position",
      variantTitle: (i['variant_title_snapshot'] as string) ?? null,
      sku: (i['sku_snapshot'] as string) ?? null,
      orderedQuantity: num(i['quantity']),
      alreadyPlanned,
      openQuantity: open,
      suggestedLocationId: sorted[0]?.locationId ?? null,
      options,
    };
  });

  return {
    orderId,
    orderNumber: o['order_number'] as string,
    shopId: o['shop_id'] as string,
    trackedByInventory: invItemByVariant.size > 0,
    lines,
  };
}

/** One clear next step per fulfillment — the UI never has to guess. */
export function nextAction(view: FulfillmentView): NextAction {
  if (view.status === "cancelled") return { action: "done", label: "Storniert", fulfillmentId: view.id };
  if (view.status === "delivered") return { action: "done", label: "Abgeschlossen", fulfillmentId: view.id };
  if (view.status === "ready" || view.status === "draft")
    return { action: "start_picking", label: "Kommissionierung starten", fulfillmentId: view.id };
  if (view.status === "picking") {
    const picked = view.items.reduce((s, i) => s + i.pickedQuantity, 0);
    return picked > 0
      ? { action: "pack", label: "Verpacken", fulfillmentId: view.id }
      : { action: "complete_picking", label: "Pickliste abschließen", fulfillmentId: view.id };
  }
  if (view.status === "packed") {
    const withoutShipment = view.packages.filter((p) => !p.shipment);
    if (withoutShipment.length) return { action: "create_label", label: "Label erstellen", fulfillmentId: view.id };
    return { action: "mark_shipped", label: "Als versendet melden", fulfillmentId: view.id };
  }
  return { action: "await_delivery", label: "Wartet auf Zustellung", fulfillmentId: view.id };
}

type Rpc = Record<string, unknown>;
async function rpc<T>(name: string, args: Rpc): Promise<T> {
  const admin = await getAdmin();
  const { data, error } = await admin.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  return data as unknown as T;
}

export const createFulfillment = (a: {
  organizationId: string;
  shopId: string;
  orderId: string;
  locationId: string | null;
  actorId: string;
  items: { orderItemId: string; quantity: number }[];
  notes?: string | null;
  idempotencyKey?: string | null;
}) =>
  rpc<{ fulfillment_id: string; items: number; status: string }>("ful_create", {
    _org: a.organizationId,
    _shop: a.shopId,
    _order: a.orderId,
    _location: a.locationId,
    _actor: a.actorId,
    _items: a.items,
    _notes: a.notes ?? null,
    _idem: a.idempotencyKey ?? null,
  });

export const startPicking = (a: { organizationId: string; fulfillmentId: string; actorId: string; idempotencyKey?: string | null }) =>
  rpc<{ fulfillment_id: string; status: string; changed: boolean }>("ful_start_picking", {
    _org: a.organizationId,
    _ful: a.fulfillmentId,
    _actor: a.actorId,
    _idem: a.idempotencyKey ?? null,
  });

export const completePicking = (a: {
  organizationId: string;
  fulfillmentId: string;
  actorId: string;
  picked: { fulfillmentItemId: string; pickedQuantity: number }[];
  idempotencyKey?: string | null;
}) =>
  rpc<{ fulfillment_id: string; picked_total: number }>("ful_complete_picking", {
    _org: a.organizationId,
    _ful: a.fulfillmentId,
    _actor: a.actorId,
    _picked: a.picked,
    _idem: a.idempotencyKey ?? null,
  });

export const packFulfillment = (a: {
  organizationId: string;
  fulfillmentId: string;
  actorId: string;
  packages: {
    weightGrams?: number | null;
    lengthMm?: number | null;
    widthMm?: number | null;
    heightMm?: number | null;
    packagingType?: string | null;
    items: { fulfillmentItemId: string; quantity: number }[];
  }[];
  idempotencyKey?: string | null;
}) =>
  rpc<{ fulfillment_id: string; status: string; package_ids: string[] }>("ful_pack", {
    _org: a.organizationId,
    _ful: a.fulfillmentId,
    _actor: a.actorId,
    _packages: a.packages,
    _idem: a.idempotencyKey ?? null,
  });

export const cancelFulfillment = (a: {
  organizationId: string;
  fulfillmentId: string;
  actorId: string;
  reason?: string | null;
  idempotencyKey?: string | null;
}) =>
  rpc<{ fulfillment_id: string; status: string; changed: boolean }>("ful_cancel", {
    _org: a.organizationId,
    _ful: a.fulfillmentId,
    _actor: a.actorId,
    _reason: a.reason ?? null,
    _idem: a.idempotencyKey ?? null,
  });
