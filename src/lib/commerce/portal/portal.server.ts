/**
 * Server-only customer portal reads.
 * Access is always proven first: either the order belongs to a customer record
 * of the signed-in auth user, or a valid guest token grants access to exactly
 * that one order. Blocked customers keep access to existing orders/documents.
 */
import { getAdmin } from "../core.server";

type Row = Record<string, unknown>;

export type PortalOrderSummary = {
  id: string;
  orderNumber: string;
  placedAt: string;
  totalMinor: number;
  currencyCode: string;
  orderStatus: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  itemCount: number;
};

export type PortalDocument = {
  id: string;
  kind: "invoice" | "credit_note" | "delivery_note";
  number: string | null;
  issuedAt: string | null;
  totalMinor: number | null;
};

export type PortalTracking = {
  shipmentId: string;
  carrier: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  events: {
    code: string;
    description: string | null;
    occurredAt: string;
    location: string | null;
  }[];
};

export type PortalOrderDetail = PortalOrderSummary & {
  organizationId: string;
  shopId: string;
  email: string | null;
  items: {
    id: string;
    title: string;
    variantTitle: string | null;
    sku: string | null;
    quantity: number;
    lineTotalMinor: number;
  }[];
  addresses: { type: string; address: Record<string, string | null> }[];
  subtotalMinor: number;
  shippingMinor: number;
  taxMinor: number;
  discountMinor: number;
  documents: PortalDocument[];
  tracking: PortalTracking[];
  returns: { id: string; returnNumber: string; status: string; requestedAt: string }[];
};

/** Order ids the signed-in auth user owns through a customer record. */
export async function ownedOrderIds(userId: string) {
  const admin = await getAdmin();
  const { data: customers } = await admin.from("customers").select("id").eq("auth_user_id", userId);
  const ids = ((customers ?? []) as Row[]).map((c) => c["id"] as string);
  if (!ids.length) return { customerIds: [] as string[], orderIds: [] as string[] };
  const { data: orders } = await admin.from("orders").select("id").in("customer_id", ids);
  return { customerIds: ids, orderIds: ((orders ?? []) as Row[]).map((o) => o["id"] as string) };
}

export async function listPortalOrders(userId: string): Promise<PortalOrderSummary[]> {
  const admin = await getAdmin();
  const { customerIds } = await ownedOrderIds(userId);
  if (!customerIds.length) return [];
  const { data } = await admin
    .from("orders")
    .select(
      "id, order_number, placed_at, total_minor, currency_code, order_status, payment_status, fulfillment_status",
    )
    .in("customer_id", customerIds)
    .order("placed_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as Row[];
  if (!rows.length) return [];
  const { data: items } = await admin
    .from("order_items")
    .select("order_id, quantity")
    .in(
      "order_id",
      rows.map((r) => r["id"] as string),
    );
  const counts = new Map<string, number>();
  for (const i of (items ?? []) as Row[]) {
    const k = i["order_id"] as string;
    counts.set(k, (counts.get(k) ?? 0) + Number(i["quantity"] ?? 0));
  }
  return rows.map((r) => ({
    id: r["id"] as string,
    orderNumber: r["order_number"] as string,
    placedAt: r["placed_at"] as string,
    totalMinor: Number(r["total_minor"] ?? 0),
    currencyCode: r["currency_code"] as string,
    orderStatus: r["order_status"] as string,
    paymentStatus: r["payment_status"] as string,
    fulfillmentStatus: r["fulfillment_status"] as string,
    itemCount: counts.get(r["id"] as string) ?? 0,
  }));
}

export async function loadPortalOrder(orderId: string): Promise<PortalOrderDetail> {
  const admin = await getAdmin();
  const { data } = await admin.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!data) throw new Error("Bestellung nicht gefunden.");
  const o = data as Row;
  const organizationId = o["organization_id"] as string;

  const [items, addresses, invoices, creditNotes, deliveryNotes, fulfillments, returns] =
    await Promise.all([
      admin.from("order_items").select("*").eq("order_id", orderId).order("created_at"),
      admin.from("order_addresses").select("*").eq("order_id", orderId),
      admin
        .from("invoices")
        .select("id, invoice_number, issued_at, total_gross_minor, status")
        .eq("order_id", orderId),
      admin
        .from("credit_notes")
        .select("id, credit_note_number, issued_at, total_gross_minor, status")
        .eq("order_id", orderId),
      admin
        .from("delivery_notes")
        .select("id, document_number, issued_at, status")
        .eq("order_id", orderId),
      admin.from("fulfillments").select("id").eq("order_id", orderId),
      admin
        .from("returns")
        .select("id, return_number, status, requested_at")
        .eq("order_id", orderId)
        .order("requested_at", { ascending: false }),
    ]);

  const invoiceRows = (invoices.data ?? []) as Row[];
  const fulfillmentIds = new Set(
    ((fulfillments.data ?? []) as Row[]).map((f) => f["id"] as string),
  );

  const documents: PortalDocument[] = [
    ...invoiceRows
      .filter((i) => i["status"] === "issued" || i["status"] === "paid")
      .map<PortalDocument>((i) => ({
        id: i["id"] as string,
        kind: "invoice",
        number: (i["invoice_number"] as string) ?? null,
        issuedAt: (i["issued_at"] as string) ?? null,
        totalMinor: Number(i["total_gross_minor"] ?? 0),
      })),
    ...((creditNotes.data ?? []) as Row[])
      .filter((c) => c["status"] === "issued")
      .map<PortalDocument>((c) => ({
        id: c["id"] as string,
        kind: "credit_note",
        number: (c["credit_note_number"] as string) ?? null,
        issuedAt: (c["issued_at"] as string) ?? null,
        totalMinor: Number(c["total_gross_minor"] ?? 0),
      })),
    ...((deliveryNotes.data ?? []) as Row[])
      .filter((d) => d["status"] === "issued")
      .map<PortalDocument>((d) => ({
        id: d["id"] as string,
        kind: "delivery_note",
        number: (d["document_number"] as string) ?? null,
        issuedAt: (d["issued_at"] as string) ?? null,
        totalMinor: null,
      })),
  ];

  let tracking: PortalTracking[] = [];
  if (fulfillmentIds.size) {
    const { data: shipments } = await admin
      .from("shipments")
      .select("*")
      .in("fulfillment_id", [...fulfillmentIds]);
    const shipmentRows = (shipments ?? []) as Row[];
    const { data: events } = shipmentRows.length
      ? await admin
          .from("tracking_events")
          .select("shipment_id, code, description, occurred_at, location")
          .in(
            "shipment_id",
            shipmentRows.map((s) => s["id"] as string),
          )
          .order("occurred_at", { ascending: false })
      : { data: [] as Row[] };
    tracking = shipmentRows.map((s) => ({
      shipmentId: s["id"] as string,
      carrier: s["carrier_provider"] as string,
      trackingNumber: (s["tracking_number"] as string) ?? null,
      trackingUrl: (s["tracking_url"] as string) ?? null,
      status: (s["normalized_tracking_status"] as string) ?? (s["status"] as string),
      shippedAt: (s["shipped_at"] as string) ?? null,
      deliveredAt: (s["delivered_at"] as string) ?? null,
      events: ((events ?? []) as Row[])
        .filter((e) => e["shipment_id"] === s["id"])
        .map((e) => ({
          code: e["code"] as string,
          description: (e["description"] as string) ?? null,
          occurredAt: e["occurred_at"] as string,
          location: (e["location"] as string) ?? null,
        })),
    }));
  }

  return {
    id: orderId,
    organizationId,
    shopId: o["shop_id"] as string,
    orderNumber: o["order_number"] as string,
    placedAt: o["placed_at"] as string,
    email: (o["email"] as string) ?? null,
    totalMinor: Number(o["total_minor"] ?? 0),
    currencyCode: o["currency_code"] as string,
    orderStatus: o["order_status"] as string,
    paymentStatus: o["payment_status"] as string,
    fulfillmentStatus: o["fulfillment_status"] as string,
    subtotalMinor: Number(o["subtotal_minor"] ?? 0),
    shippingMinor: Number(o["shipping_minor"] ?? 0),
    taxMinor: Number(o["tax_minor"] ?? 0),
    discountMinor: Number(o["discount_minor"] ?? 0),
    itemCount: ((items.data ?? []) as Row[]).reduce((s, i) => s + Number(i["quantity"] ?? 0), 0),
    items: ((items.data ?? []) as Row[]).map((i) => ({
      id: i["id"] as string,
      title: i["title_snapshot"] as string,
      variantTitle: (i["variant_title_snapshot"] as string) ?? null,
      sku: (i["sku_snapshot"] as string) ?? null,
      quantity: Number(i["quantity"] ?? 0),
      lineTotalMinor: Number(i["gross_minor"] ?? i["line_total_minor"] ?? 0),
    })),
    addresses: ((addresses.data ?? []) as Row[]).map((a) => ({
      type: a["type"] as string,
      address: (a["address"] as Record<string, string | null>) ?? {},
    })),
    documents,
    tracking,
    returns: ((returns.data ?? []) as Row[]).map((r) => ({
      id: r["id"] as string,
      returnNumber: r["return_number"] as string,
      status: r["status"] as string,
      requestedAt: r["requested_at"] as string,
    })),
  };
}

/** Signed URL for a document the portal user proved access to. */
export async function signPortalDocument(kind: PortalDocument["kind"], documentId: string) {
  const admin = await getAdmin();
  const table =
    kind === "invoice" ? "invoices" : kind === "credit_note" ? "credit_notes" : "delivery_notes";
  const { data } = await admin
    .from("document_files")
    .select("storage_path, created_at")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(1);
  const path = ((data ?? []) as Row[])[0]?.["storage_path"] as string | undefined;
  if (!path) throw new Error(`Für dieses Dokument (${table}) liegt noch keine Datei vor.`);
  const signed = await admin.storage.from("documents").createSignedUrl(path, 300);
  if (signed.error) throw new Error(signed.error.message);
  return { url: signed.data?.signedUrl ?? null };
}
