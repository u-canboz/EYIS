/** Server-only order read/write helpers for the admin workspace. */
import { getAdmin } from "../core.server";
import type {
  JsonValue,
  OrderDetailView,
  OrderListItem,
  OrderState,
  OrderPaymentStatus,
} from "../payments/payment-types";

function toListItem(r: Record<string, unknown>): OrderListItem {
  return {
    id: r['id'] as string,
    orderNumber: r['order_number'] as string,
    placedAt: r['placed_at'] as string,
    email: (r['email'] as string) ?? null,
    currencyCode: r['currency_code'] as string,
    totalMinor: Number(r['total_minor'] ?? 0),
    refundedMinor: Number(r['refunded_minor'] ?? 0),
    orderStatus: r['order_status'] as OrderState,
    paymentStatus: r['payment_status'] as OrderPaymentStatus,
    fulfillmentStatus: r['fulfillment_status'] as OrderDetailView["fulfillmentStatus"],
    environment: r['environment'] as "test" | "live",
  };
}

export async function listOrders(input: {
  organizationId: string;
  shopId?: string | null;
  search?: string | null;
  orderStatus?: string | null;
  paymentStatus?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
}) {
  const admin = await getAdmin();
  let query = admin
    .from("orders")
    .select("*")
    .eq("organization_id", input.organizationId)
    .order("placed_at", { ascending: false })
    .limit(Math.min(input.limit ?? 100, 200));

  if (input.shopId) query = query.eq("shop_id", input.shopId);
  if (input.orderStatus) query = query.eq("order_status", input.orderStatus as never);
  if (input.paymentStatus) query = query.eq("payment_status", input.paymentStatus as never);
  if (input.from) query = query.gte("placed_at", input.from);
  if (input.to) query = query.lte("placed_at", input.to);

  const term = (input.search ?? "").trim();
  if (term) {
    const { data: hits } = await admin
      .from("order_items")
      .select("order_id")
      .eq("organization_id", input.organizationId)
      .ilike("sku_snapshot", `%${term}%`)
      .limit(200);
    const ids = ((hits ?? []) as { order_id: string }[]).map((h) => h.order_id);
    const orFilter = [`order_number.ilike.%${term}%`, `email.ilike.%${term}%`];
    if (ids.length) orFilter.push(`id.in.(${ids.join(",")})`);
    query = query.or(orFilter.join(","));
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(toListItem);
}

export async function loadOrderDetail(organizationId: string, orderId: string): Promise<OrderDetailView> {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("orders")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Bestellung nicht gefunden.");
  const o = data as Record<string, unknown>;

  const [items, addresses, promotions, transactions, refunds, timeline] = await Promise.all([
    admin.from("order_items").select("*").eq("order_id", orderId).order("created_at"),
    admin.from("order_addresses").select("*").eq("order_id", orderId),
    admin.from("order_promotions").select("*").eq("order_id", orderId),
    admin.from("payment_transactions").select("*").eq("order_id", orderId).order("created_at"),
    admin.from("refunds").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
    admin
      .from("audit_log")
      .select("id, action, created_at, metadata")
      .eq("organization_id", organizationId)
      .eq("entity_id", orderId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const refundRows = (refunds.data ?? []) as Record<string, unknown>[];
  const blocked = refundRows
    .filter((r) => ["requested", "processing", "completed"].includes(r['status'] as string))
    .reduce((sum, r) => sum + Number(r['amount_minor'] ?? 0), 0);

  return {
    ...toListItem(o),
    subtotalMinor: Number(o['subtotal_minor'] ?? 0),
    discountMinor: Number(o['discount_minor'] ?? 0),
    shippingMinor: Number(o['shipping_minor'] ?? 0),
    taxMinor: Number(o['tax_minor'] ?? 0),
    netTotalMinor: Number(o['net_total_minor'] ?? 0),
    taxBreakdown: ((o['tax_breakdown'] as JsonValue[] | null) ?? []),
    internalNote: (o['internal_note'] as string) ?? null,
    cancelReason: (o['cancel_reason'] as string) ?? null,
    shippingMethod: (o['shipping_method'] as Record<string, JsonValue>) ?? {},
    items: ((items.data ?? []) as Record<string, unknown>[]).map((i) => ({
      id: i['id'] as string,
      title: i['title_snapshot'] as string,
      variantTitle: i['variant_title_snapshot'] as string,
      sku: (i['sku_snapshot'] as string) ?? null,
      quantity: Number(i['quantity'] ?? 0),
      unitResolvedMinor: Number(i['unit_resolved_minor'] ?? 0),
      lineDiscountMinor: Number(i['line_discount_minor'] ?? 0),
      lineTotalMinor: Number(i['line_total_minor'] ?? 0),
    })),
    addresses: ((addresses.data ?? []) as Record<string, unknown>[]).map((a) => ({
      ...((a['address'] as Record<string, JsonValue>) ?? {}),
      type: a['type'] as "shipping" | "billing",
    })),
    promotions: ((promotions.data ?? []) as Record<string, unknown>[]).map((p) => ({
      id: p['id'] as string,
      name: p['name_snapshot'] as string,
      code: (p['code_snapshot'] as string) ?? null,
      discountMinor: Number(p['discount_minor'] ?? 0),
    })),
    transactions: ((transactions.data ?? []) as Record<string, unknown>[]).map((t) => ({
      id: t['id'] as string,
      type: t['type'] as string,
      provider: t['provider'] as string,
      amountMinor: Number(t['amount_minor'] ?? 0),
      currencyCode: t['currency_code'] as string,
      providerTransactionId: (t['provider_transaction_id'] as string) ?? null,
      createdAt: t['created_at'] as string,
    })),
    refunds: refundRows.map((r) => ({
      id: r['id'] as string,
      amountMinor: Number(r['amount_minor'] ?? 0),
      currencyCode: r['currency_code'] as string,
      status: r['status'] as OrderDetailView["refunds"][number]["status"],
      reason: (r['reason'] as string) ?? null,
      createdAt: r['created_at'] as string,
      providerRefundId: (r['provider_refund_id'] as string) ?? null,
    })),
    timeline: ((timeline.data ?? []) as Record<string, unknown>[]).map((t) => ({
      id: t['id'] as string,
      action: t['action'] as string,
      createdAt: t['created_at'] as string,
      metadata: (t['metadata'] as Record<string, JsonValue>) ?? {},
    })),
    refundableMinor: Math.max(Number(o['total_minor'] ?? 0) - blocked, 0),
  };
}
