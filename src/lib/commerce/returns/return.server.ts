/**
 * Server-only return (RMA) orchestration.
 * Every state transition goes through a locking SECURITY DEFINER function;
 * quantities can never exceed what was ordered and not yet effectively returned.
 */
import { getAdmin } from "../core.server";
import type {
import { publishReturnEvent } from "../event-payloads.server";
  EligibilityLine,
  ReturnDetail,
  ReturnEligibility,
  ReturnItemCondition,
  ReturnItemView,
  ReturnListItem,
  ReturnReasonCode,
  ReturnSettings,
  ReturnStatus,
  RestockDecision,
  ShippingRefundMode,
} from "./return.types";

type Row = Record<string, unknown>;

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const admin = await getAdmin();
  const { data, error } = await admin.rpc(fn as never, args as never);
  if (error) throw new Error(error.message);
  return data as unknown as T;
}

/* ------------------------------- settings ------------------------------- */

const DEFAULT_SETTINGS = (shopId: string): ReturnSettings => ({
  shopId,
  returnsEnabled: true,
  defaultReturnWindowDays: 30,
  windowStart: "delivery_date",
  approvalStrategy: "manual",
  customerPaysReturnShipping: true,
  autoRefundOnApproval: false,
  autoRestock: false,
  instructions: null,
});

function mapSettings(r: Row): ReturnSettings {
  return {
    shopId: r['shop_id'] as string,
    returnsEnabled: Boolean(r['returns_enabled']),
    defaultReturnWindowDays: Number(r['default_return_window_days'] ?? 30),
    windowStart: r['window_start'] as ReturnSettings["windowStart"],
    approvalStrategy: r['approval_strategy'] as ReturnSettings["approvalStrategy"],
    customerPaysReturnShipping: Boolean(r['customer_pays_return_shipping']),
    autoRefundOnApproval: Boolean(r['auto_refund_on_approval']),
    autoRestock: Boolean(r['auto_restock']),
    instructions: (r['instructions'] as string) ?? null,
  };
}

export async function loadReturnSettings(organizationId: string, shopId: string): Promise<ReturnSettings> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("return_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .maybeSingle();
  return data ? mapSettings(data as Row) : DEFAULT_SETTINGS(shopId);
}

export async function saveReturnSettings(input: {
  organizationId: string;
  shopId: string;
  settings: Omit<ReturnSettings, "shopId">;
}) {
  const admin = await getAdmin();
  const s = input.settings;
  const { error } = await admin.from("return_settings").upsert(
    {
      organization_id: input.organizationId,
      shop_id: input.shopId,
      returns_enabled: s.returnsEnabled,
      default_return_window_days: s.defaultReturnWindowDays,
      window_start: s.windowStart,
      approval_strategy: s.approvalStrategy,
      customer_pays_return_shipping: s.customerPaysReturnShipping,
      auto_refund_on_approval: s.autoRefundOnApproval,
      auto_restock: s.autoRestock,
      instructions: s.instructions,
    } as never,
    { onConflict: "shop_id" } as never,
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* ------------------------------ eligibility ----------------------------- */

/** What can still be returned for this order, and until when. */
export async function getEligibility(organizationId: string, orderId: string): Promise<ReturnEligibility> {
  const admin = await getAdmin();
  const { data: orderRow, error } = await admin
    .from("orders")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!orderRow) throw new Error("Bestellung nicht gefunden.");
  const order = orderRow as Row;

  const settings = await loadReturnSettings(organizationId, order['shop_id'] as string);

  const [items, returnRows, shipments] = await Promise.all([
    admin.from("order_items").select("*").eq("order_id", orderId).order("created_at"),
    admin.from("returns").select("id, status").eq("order_id", orderId),
    admin
      .from("shipments")
      .select("shipped_at, delivered_at")
      .in(
        "fulfillment_id",
        ((
          await admin.from("fulfillments").select("id").eq("order_id", orderId)
        ).data ?? ([] as Row[])).map((f) => (f as Row)['id'] as string),
      ),
  ]);

  const returnIds = ((returnRows.data ?? []) as Row[])
    .filter((r) => !["rejected", "cancelled"].includes(r['status'] as string))
    .map((r) => r['id'] as string);

  const { data: returnItems } = returnIds.length
    ? await admin.from("return_items").select("*, returns!inner(status)").in("return_id", returnIds)
    : { data: [] as Row[] };

  const returnedByItem = new Map<string, number>();
  for (const ri of (returnItems ?? []) as Row[]) {
    const status = ((ri['returns'] as Row | null)?.['status'] as string) ?? "requested";
    const qty = ["approved", "partially_approved", "refunded", "completed"].includes(status)
      ? Number(ri['quantity_approved'] ?? 0)
      : Number(ri['quantity_requested'] ?? 0);
    const key = ri['order_item_id'] as string;
    returnedByItem.set(key, (returnedByItem.get(key) ?? 0) + qty);
  }

  const shipRows = (shipments.data ?? []) as Row[];
  const deliveredAt = shipRows
    .map((s) => s['delivered_at'] as string | null)
    .filter(Boolean)
    .sort()
    .pop() as string | undefined;
  const shippedAt = shipRows
    .map((s) => s['shipped_at'] as string | null)
    .filter(Boolean)
    .sort()
    .pop() as string | undefined;

  const startDate =
    settings.windowStart === "order_date"
      ? (order['placed_at'] as string)
      : settings.windowStart === "shipping_date"
        ? (shippedAt ?? (order['placed_at'] as string))
        : (deliveredAt ?? shippedAt ?? (order['placed_at'] as string));
  const windowEndsAt = new Date(
    new Date(startDate).getTime() + settings.defaultReturnWindowDays * 86_400_000,
  ).toISOString();

  const productIds = [...new Set(((items.data ?? []) as Row[]).map((i) => i['product_id']).filter(Boolean))] as string[];
  const { data: products } = productIds.length
    ? await admin.from("products").select("id, return_policy_type, return_policy_note").in("id", productIds)
    : { data: [] as Row[] };
  const policyByProduct = new Map(((products ?? []) as Row[]).map((p) => [p['id'] as string, p]));

  const lines: EligibilityLine[] = ((items.data ?? []) as Row[]).map((i) => {
    const alreadyReturned = returnedByItem.get(i['id'] as string) ?? 0;
    const quantity = Number(i['quantity'] ?? 0);
    const policy = policyByProduct.get(i['product_id'] as string);
    const nonReturnable = policy?.['return_policy_type'] === "non_returnable";
    const gross = Number(i['gross_minor'] ?? i['line_total_minor'] ?? 0);
    return {
      orderItemId: i['id'] as string,
      title: i['title_snapshot'] as string,
      variantTitle: (i['variant_title_snapshot'] as string) ?? null,
      sku: (i['sku_snapshot'] as string) ?? null,
      quantity,
      alreadyReturned,
      returnableQuantity: nonReturnable ? 0 : Math.max(quantity - alreadyReturned, 0),
      unitGrossMinor: quantity > 0 ? Math.round(gross / quantity) : 0,
      lineGrossMinor: gross,
      blockedReason: nonReturnable
        ? ((policy?.['return_policy_note'] as string) ?? "Artikel ist vom Rückgaberecht ausgeschlossen.")
        : alreadyReturned >= quantity
          ? "Bereits vollständig retourniert."
          : null,
    };
  });

  let reason: string | null = null;
  if (!settings.returnsEnabled) reason = "Retouren sind für diesen Shop deaktiviert.";
  else if (order['payment_status'] !== "paid") reason = "Nur bezahlte Bestellungen können retourniert werden.";
  else if (Date.now() > new Date(windowEndsAt).getTime()) reason = "Die Rückgabefrist ist abgelaufen.";
  else if (!lines.some((l) => l.returnableQuantity > 0)) reason = "Keine rückgabefähigen Positionen.";

  return {
    orderId,
    orderNumber: order['order_number'] as string,
    currencyCode: order['currency_code'] as string,
    eligible: reason === null,
    reason,
    windowEndsAt,
    lines,
  };
}

/* --------------------------------- reads -------------------------------- */

function mapListItem(r: Row, orderNumber: string, email: string | null, itemCount: number): ReturnListItem {
  return {
    id: r['id'] as string,
    returnNumber: r['return_number'] as string,
    orderId: r['order_id'] as string,
    orderNumber,
    customerId: (r['customer_id'] as string) ?? null,
    customerEmail: email,
    status: r['status'] as ReturnStatus,
    reasonCategory: r['reason_category'] as ReturnReasonCode,
    itemCount,
    refundTotalMinor: Number(r['refund_total_minor'] ?? 0),
    currencyCode: r['currency_code'] as string,
    requestedAt: r['requested_at'] as string,
  };
}

export async function listReturns(input: {
  organizationId: string;
  shopId?: string | null;
  statuses?: ReturnStatus[] | null;
  search?: string | null;
  customerId?: string | null;
  limit?: number;
}): Promise<ReturnListItem[]> {
  const admin = await getAdmin();
  let query = admin
    .from("returns")
    .select("*")
    .eq("organization_id", input.organizationId)
    .order("requested_at", { ascending: false })
    .limit(Math.min(input.limit ?? 100, 200));
  if (input.shopId) query = query.eq("shop_id", input.shopId);
  if (input.customerId) query = query.eq("customer_id", input.customerId);
  if (input.statuses?.length) query = query.in("status", input.statuses as never);
  const term = (input.search ?? "").trim();
  if (term) query = query.ilike("return_number", `%${term}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  if (!rows.length) return [];

  const [orders, items] = await Promise.all([
    admin.from("orders").select("id, order_number, email").in("id", rows.map((r) => r['order_id'] as string)),
    admin.from("return_items").select("return_id").in("return_id", rows.map((r) => r['id'] as string)),
  ]);
  const orderById = new Map(((orders.data ?? []) as Row[]).map((o) => [o['id'] as string, o]));
  const counts = new Map<string, number>();
  for (const i of (items.data ?? []) as Row[]) {
    const k = i['return_id'] as string;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  return rows.map((r) => {
    const order = orderById.get(r['order_id'] as string);
    return mapListItem(
      r,
      (order?.['order_number'] as string) ?? "—",
      (order?.['email'] as string) ?? null,
      counts.get(r['id'] as string) ?? 0,
    );
  });
}

export async function loadReturn(organizationId: string, returnId: string): Promise<ReturnDetail> {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("returns")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", returnId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Retoure nicht gefunden.");
  const r = data as Row;

  const [items, order, timeline] = await Promise.all([
    admin.from("return_items").select("*").eq("return_id", returnId).order("created_at"),
    admin.from("orders").select("id, order_number, email").eq("id", r['order_id'] as string).maybeSingle(),
    admin
      .from("audit_log")
      .select("id, action, created_at")
      .eq("organization_id", organizationId)
      .eq("entity_id", returnId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const itemRows = (items.data ?? []) as Row[];
  const { data: orderItems } = itemRows.length
    ? await admin
        .from("order_items")
        .select("id, title_snapshot, variant_title_snapshot, sku_snapshot, quantity")
        .in("id", itemRows.map((i) => i['order_item_id'] as string))
    : { data: [] as Row[] };
  const orderItemById = new Map(((orderItems ?? []) as Row[]).map((o) => [o['id'] as string, o]));

  const mappedItems: ReturnItemView[] = itemRows.map((i) => {
    const oi = orderItemById.get(i['order_item_id'] as string);
    return {
      id: i['id'] as string,
      orderItemId: i['order_item_id'] as string,
      title: (oi?.['title_snapshot'] as string) ?? "Position",
      variantTitle: (oi?.['variant_title_snapshot'] as string) ?? null,
      sku: (oi?.['sku_snapshot'] as string) ?? null,
      quantityOrdered: Number(oi?.['quantity'] ?? 0),
      quantityRequested: Number(i['quantity_requested'] ?? 0),
      quantityReceived: Number(i['quantity_received'] ?? 0),
      quantityApproved: Number(i['quantity_approved'] ?? 0),
      reasonCode: i['reason_code'] as ReturnReasonCode,
      condition: i['condition'] as ReturnItemCondition,
      resolution: i['resolution'] as ReturnItemView["resolution"],
      restockDecision: i['restock_decision'] as RestockDecision,
      restockedAt: (i['restocked_at'] as string) ?? null,
      restockLocationId: (i['restock_location_id'] as string) ?? null,
      refundAmountMinor: i['refund_amount_minor'] === null ? null : Number(i['refund_amount_minor']),
      inspectionNote: (i['inspection_note'] as string) ?? null,
    };
  });

  const o = order.data as Row | null;
  return {
    ...mapListItem(r, (o?.['order_number'] as string) ?? "—", (o?.['email'] as string) ?? null, itemRows.length),
    shopId: r['shop_id'] as string,
    customerNote: (r['customer_note'] as string) ?? null,
    internalNote: (r['internal_note'] as string) ?? null,
    rejectionReason: (r['rejection_reason'] as string) ?? null,
    shippingRefundMode: r['shipping_refund_mode'] as ShippingRefundMode,
    shippingRefundMinor: Number(r['shipping_refund_minor'] ?? 0),
    authorizedAt: (r['authorized_at'] as string) ?? null,
    receivedAt: (r['received_at'] as string) ?? null,
    inspectedAt: (r['inspected_at'] as string) ?? null,
    completedAt: (r['completed_at'] as string) ?? null,
    cancelledAt: (r['cancelled_at'] as string) ?? null,
    refundId: (r['refund_id'] as string) ?? null,
    creditNoteId: (r['credit_note_id'] as string) ?? null,
    items: mappedItems,
    timeline: ((timeline.data ?? []) as Row[]).map((t) => ({
      id: t['id'] as string,
      action: t['action'] as string,
      createdAt: t['created_at'] as string,
    })),
  };
}

/* ------------------------------ transitions ----------------------------- */

export async function requestReturn(input: {
  organizationId: string;
  shopId: string;
  orderId: string;
  customerId?: string | null;
  actorId?: string | null;
  items: { orderItemId: string; quantity: number; reasonCode?: ReturnReasonCode }[];
  reason: ReturnReasonCode;
  note?: string | null;
  idempotencyKey: string;
}) {
  const eligibility = await getEligibility(input.organizationId, input.orderId);
  if (!eligibility.eligible) throw new Error(eligibility.reason ?? "Retoure nicht möglich.");
  for (const line of input.items) {
    const match = eligibility.lines.find((l) => l.orderItemId === line.orderItemId);
    if (!match || line.quantity > match.returnableQuantity) {
      throw new Error("Rückgabemenge überschreitet die rückgabefähige Menge.");
    }
  }
  const requested = await rpc<{ return_id: string; return_number: string; status: string; duplicate: boolean }>("ret_request", {
    _org: input.organizationId,
    _shop: input.shopId,
    _order: input.orderId,
    _customer: input.customerId ?? null,
    _actor: input.actorId ?? null,
    _items: input.items.map((i) => ({
      order_item_id: i.orderItemId,
      quantity: i.quantity,
      reason_code: i.reasonCode ?? input.reason,
    })),
    _reason: input.reason,
    _note: input.note ?? null,
    _idem: input.idempotencyKey,
  });
}

export async function authorizeReturn(input: {
  organizationId: string;
  returnId: string;
  actorId: string;
  instructions?: string | null;
}) {
  return await rpc<{ status: string }>("ret_authorize", {
    _org: input.organizationId,
    _return: input.returnId,
    _actor: input.actorId,
    _instructions: input.instructions ?? null,
  });
}

export async function rejectReturn(input: {
  organizationId: string;
  returnId: string;
  actorId: string;
  reason: string;
  internalNote?: string | null;
}) {
  return await rpc<{ status: string }>("ret_reject", {
    _org: input.organizationId,
    _return: input.returnId,
    _actor: input.actorId,
    _reason: input.reason,
    _internal: input.internalNote ?? null,
  });
}

export async function markReturnInTransit(input: {
  organizationId: string;
  returnId: string;
  actorId: string;
  shipmentId?: string | null;
}) {
  return await rpc<{ status: string }>("ret_mark_in_transit", {
    _org: input.organizationId,
    _return: input.returnId,
    _actor: input.actorId,
    _shipment: input.shipmentId ?? null,
  });
}

export async function receiveReturn(input: {
  organizationId: string;
  returnId: string;
  actorId: string;
  items: { returnItemId: string; quantityReceived: number; condition?: ReturnItemCondition }[];
  idempotencyKey?: string | null;
}) {
  return await rpc<{ status: string }>("ret_receive", {
    _org: input.organizationId,
    _return: input.returnId,
    _actor: input.actorId,
    _items: input.items.map((i) => ({
      return_item_id: i.returnItemId,
      quantity_received: i.quantityReceived,
      condition: i.condition ?? null,
    })),
    _idem: input.idempotencyKey ?? null,
  });
}

export async function startInspection(input: { organizationId: string; returnId: string; actorId: string }) {
  return await rpc<{ status: string }>("ret_start_inspection", {
    _org: input.organizationId,
    _return: input.returnId,
    _actor: input.actorId,
  });
}

export async function inspectReturn(input: {
  organizationId: string;
  returnId: string;
  actorId: string;
  items: {
    returnItemId: string;
    quantityApproved: number;
    condition?: ReturnItemCondition;
    restockDecision?: RestockDecision;
    note?: string | null;
  }[];
  shippingRefundMode?: ShippingRefundMode;
  shippingRefundMinor?: number;
  idempotencyKey?: string | null;
}) {
  const result = await rpc<{ status: ReturnStatus; refund_total_minor: number }>("ret_inspect", {
    _org: input.organizationId,
    _return: input.returnId,
    _actor: input.actorId,
    _items: input.items.map((i) => ({
      return_item_id: i.returnItemId,
      quantity_approved: i.quantityApproved,
      condition: i.condition ?? null,
      restock_decision: i.restockDecision ?? null,
      note: i.note ?? null,
    })),
    _shipping_mode: input.shippingRefundMode ?? "none",
    _shipping_minor: Math.max(Math.floor(input.shippingRefundMinor ?? 0), 0),
    _idem: input.idempotencyKey ?? null,
  });

  // Auto-restock when the shop enabled it and the agent decided to restock.
  const detail = await loadReturn(input.organizationId, input.returnId);
  const settings = await loadReturnSettings(input.organizationId, detail.shopId);
  if (settings.autoRestock) {
    const admin = await getAdmin();
    const { data: locations } = await admin
      .from("inventory_locations")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("shop_id", detail.shopId)
      .limit(1);
    const locationId = ((locations ?? [])[0] as Row | undefined)?.['id'] as string | undefined;
    if (locationId) {
      for (const item of detail.items) {
        if (item.restockDecision === "restock" && !item.restockedAt && item.quantityApproved > 0) {
          await restockReturnItem({
            organizationId: input.organizationId,
            returnItemId: item.id,
            actorId: input.actorId,
            locationId,
          }).catch(() => undefined);
        }
      }
    }
  }
  return result;
}

export async function restockReturnItem(input: {
  organizationId: string;
  returnItemId: string;
  actorId: string;
  locationId: string;
}) {
  return await rpc<{ status: string; quantity: number }>("ret_restock", {
    _org: input.organizationId,
    _return_item: input.returnItemId,
    _actor: input.actorId,
    _location: input.locationId,
  });
}

export async function completeReturn(input: { organizationId: string; returnId: string; actorId: string }) {
  return await rpc<{ status: string }>("ret_complete", {
    _org: input.organizationId,
    _return: input.returnId,
    _actor: input.actorId,
  });
}

export async function cancelReturn(input: {
  organizationId: string;
  returnId: string;
  actorId?: string | null;
  byCustomer?: boolean;
}) {
  return await rpc<{ status: string }>("ret_cancel", {
    _org: input.organizationId,
    _return: input.returnId,
    _actor: input.actorId ?? null,
    _by_customer: input.byCustomer ?? false,
  });
}

/**
 * Money settlement: refund through the payment provider, optional credit note,
 * then link both to the return. Amounts always come from the inspection result.
 */
export async function settleReturn(input: {
  organizationId: string;
  returnId: string;
  actorId: string;
  amountMinor?: number | null;
  createCreditNote?: boolean;
  idempotencyKey?: string | null;
}) {
  const admin = await getAdmin();
  const detail = await loadReturn(input.organizationId, input.returnId);
  if (!["approved", "partially_approved"].includes(detail.status)) {
    throw new Error("Erstattung ist in diesem Status nicht möglich.");
  }
  const amount = Math.floor(input.amountMinor ?? detail.refundTotalMinor);
  if (amount <= 0) throw new Error("Kein erstattungsfähiger Betrag.");

  const created = await rpc<{ refund_id: string; amount_minor: number }>("refund_create", {
    _org: input.organizationId,
    _order: detail.orderId,
    _actor: input.actorId,
    _amount_minor: amount,
    _reason: `Retoure ${detail.returnNumber}`,
    _idem: input.idempotencyKey ?? `return:${input.returnId}`,
  });

  const { data: tx } = await admin
    .from("payment_transactions")
    .select("provider, provider_transaction_id")
    .eq("order_id", detail.orderId)
    .eq("type", "charge")
    .order("created_at", { ascending: false })
    .limit(1);
  const charge = ((tx ?? [])[0] ?? null) as { provider: string; provider_transaction_id: string | null } | null;

  let status: "completed" | "processing" | "failed" = "processing";
  let providerRefundId: string | null = null;
  let errorMessage: string | null = null;

  if (charge?.provider_transaction_id) {
    try {
      const { getProvider } = await import("../payments/provider.server");
      const provider = await getProvider(charge.provider);
      const result = await provider.refundPayment(
        charge.provider_transaction_id,
        Number(created.amount_minor),
        `Retoure ${detail.returnNumber}`,
      );
      status = result.status;
      providerRefundId = result.providerRefundId;
    } catch (e) {
      status = "failed";
      errorMessage = e instanceof Error ? e.message : "Erstattung beim Anbieter fehlgeschlagen.";
    }
  } else {
    status = "failed";
    errorMessage = "Keine Zahlungsbuchung mit Anbieter-Referenz gefunden.";
  }

  await rpc("refund_settle", {
    _org: input.organizationId,
    _refund: created.refund_id,
    _status: status,
    _provider: charge?.provider ?? null,
    _provider_refund_id: providerRefundId,
    _error: errorMessage,
  });
  if (errorMessage) throw new Error(errorMessage);

  let creditNoteId: string | null = null;
  if (input.createCreditNote) {
    const { data: invoice } = await admin
      .from("invoices")
      .select("id, status")
      .eq("organization_id", input.organizationId)
      .eq("order_id", detail.orderId)
      .eq("status", "issued")
      .maybeSingle();
    if (invoice) {
      const cn = await rpc<{ credit_note_id: string }>("credit_note_create", {
        _org: input.organizationId,
        _invoice: (invoice as Row)['id'] as string,
        _actor: input.actorId,
        _amount_minor: amount,
        _reason: `Retoure ${detail.returnNumber}`,
        _refund: created.refund_id,
        _idem: `return-cn:${input.returnId}`,
      });
      creditNoteId = cn.credit_note_id;
    }
  }

  await rpc("ret_link_settlement", {
    _org: input.organizationId,
    _return: input.returnId,
    _actor: input.actorId,
    _refund: created.refund_id,
    _credit_note: creditNoteId,
  });

  return { refundId: created.refund_id, creditNoteId, status, amountMinor: amount };
}
