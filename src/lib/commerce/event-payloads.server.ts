/**
 * Builders that turn a database row into the flat payload shape the
 * communication and automation engines expect (see automation/event-registry).
 *
 * These helpers never throw into the caller's transaction: a failure to publish
 * a domain event must not roll back the commercial state change that caused it.
 */
import { getAdmin } from "./core.server";
import { publishDomainEvent } from "./events.server";

type OrderRow = {
  id: string;
  organization_id: string;
  shop_id: string;
  order_number: string;
  email: string | null;
  currency_code: string;
  total_minor: number;
  gross_total_minor: number | null;
  payment_status: string;
  fulfillment_status: string;
  order_status: string;
  customer_id: string | null;
};

async function loadOrder(orderId: string): Promise<OrderRow | null> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("orders")
    .select(
      "id, organization_id, shop_id, order_number, email, currency_code, total_minor, gross_total_minor, payment_status, fulfillment_status, order_status, customer_id",
    )
    .eq("id", orderId)
    .maybeSingle();
  return (data as OrderRow | null) ?? null;
}

async function orderPayload(order: OrderRow) {
  const admin = await getAdmin();
  const { count } = await admin
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("order_id", order.id);
  let shippingCountry: string | null = null;
  let customerKind = "b2c";
  const { data: address } = await admin
    .from("order_addresses")
    .select("address")
    .eq("order_id", order.id)
    .eq("type", "shipping")
    .maybeSingle();
  const addr = (address as { address: Record<string, unknown> } | null)?.address;
  if (addr && typeof addr["country_code"] === "string") shippingCountry = addr["country_code"];
  if (order.customer_id) {
    const { data: customer } = await admin
      .from("customers")
      .select("customer_type")
      .eq("id", order.customer_id)
      .maybeSingle();
    const kind = (customer as { customer_type: string } | null)?.customer_type;
    if (kind) customerKind = kind;
  }
  return {
    order_id: order.id,
    order_number: order.order_number,
    total_gross_minor: Number(order.gross_total_minor ?? order.total_minor),
    currency: order.currency_code,
    item_count: count ?? 0,
    customer_email: order.email,
    customer_kind: customerKind,
    shipping_country: shippingCountry,
    payment_status: order.payment_status,
    fulfillment_status: order.fulfillment_status,
    order_status: order.order_status,
  };
}

/** Publishes an order-scoped domain event (order.*, payment.*, refund.*). */
export async function publishOrderEvent(
  orderId: string,
  eventType: string,
  extra: Record<string, unknown> = {},
) {
  try {
    const order = await loadOrder(orderId);
    if (!order) return;
    await publishDomainEvent({
      organizationId: order.organization_id,
      shopId: order.shop_id,
      eventType,
      payload: { ...(await orderPayload(order)), ...extra },
    });
  } catch (error) {
    console.error("[events] order event failed", eventType, error);
  }
}

/** Publishes a shipment-scoped domain event and enriches it with order data. */
export async function publishShipmentEvent(
  shipmentId: string,
  eventType: string,
  extra: Record<string, unknown> = {},
) {
  try {
    const admin = await getAdmin();
    const { data } = await admin
      .from("shipments")
      .select(
        "id, organization_id, shop_id, carrier_provider, tracking_number, tracking_url, normalized_tracking_status, fulfillment_id, fulfillments(order_id)",
      )
      .eq("id", shipmentId)
      .maybeSingle();
    const row = data as
      | {
          id: string;
          organization_id: string;
          shop_id: string;
          carrier_provider: string;
          tracking_number: string | null;
          tracking_url: string | null;
          normalized_tracking_status: string | null;
          fulfillments: { order_id: string } | { order_id: string }[] | null;
        }
      | null;
    if (!row) return;
    const ful = Array.isArray(row.fulfillments) ? row.fulfillments[0] : row.fulfillments;
    const orderId = ful?.order_id ?? null;
    const orderPart = orderId ? await loadOrder(orderId) : null;
    await publishDomainEvent({
      organizationId: row.organization_id,
      shopId: row.shop_id,
      eventType,
      payload: {
        shipment_id: row.id,
        order_id: orderId,
        order_number: orderPart?.order_number ?? null,
        customer_email: orderPart?.email ?? null,
        carrier: row.carrier_provider,
        tracking_number: row.tracking_number,
        tracking_url: row.tracking_url,
        status: row.normalized_tracking_status,
        ...extra,
      },
    });
  } catch (error) {
    console.error("[events] shipment event failed", eventType, error);
  }
}

/** Publishes invoice.issued and other document events. */
export async function publishInvoiceEvent(
  invoiceId: string,
  eventType: string,
  extra: Record<string, unknown> = {},
) {
  try {
    const admin = await getAdmin();
    const { data } = await admin
      .from("invoices")
      .select(
        "id, organization_id, shop_id, order_id, invoice_number, total_gross_minor, currency_code, customer_email",
      )
      .eq("id", invoiceId)
      .maybeSingle();
    const row = data as
      | {
          id: string;
          organization_id: string;
          shop_id: string;
          order_id: string | null;
          invoice_number: string | null;
          total_gross_minor: number;
          currency_code: string;
          customer_email: string | null;
        }
      | null;
    if (!row) return;
    await publishDomainEvent({
      organizationId: row.organization_id,
      shopId: row.shop_id,
      eventType,
      payload: {
        invoice_id: row.id,
        order_id: row.order_id,
        invoice_number: row.invoice_number,
        total_gross_minor: Number(row.total_gross_minor),
        currency: row.currency_code,
        customer_email: row.customer_email,
        ...extra,
      },
    });
  } catch (error) {
    console.error("[events] invoice event failed", eventType, error);
  }
}

/** Publishes return.* events with order context. */
export async function publishReturnEvent(
  returnId: string,
  eventType: string,
  extra: Record<string, unknown> = {},
) {
  try {
    const admin = await getAdmin();
    const { data } = await admin
      .from("returns")
      .select(
        "id, organization_id, shop_id, order_id, return_number, status, reason_category, refund_total_minor, currency_code",
      )
      .eq("id", returnId)
      .maybeSingle();
    const row = data as
      | {
          id: string;
          organization_id: string;
          shop_id: string;
          order_id: string;
          return_number: string;
          status: string;
          reason_category: string | null;
          refund_total_minor: number | null;
          currency_code: string;
        }
      | null;
    if (!row) return;
    const { count } = await admin
      .from("return_items")
      .select("id", { count: "exact", head: true })
      .eq("return_id", row.id);
    const order = await loadOrder(row.order_id);
    await publishDomainEvent({
      organizationId: row.organization_id,
      shopId: row.shop_id,
      eventType,
      payload: {
        return_id: row.id,
        order_id: row.order_id,
        order_number: order?.order_number ?? null,
        customer_email: order?.email ?? null,
        return_number: row.return_number,
        status: row.status,
        reason_code: row.reason_category,
        item_count: count ?? 0,
        refund_total_minor: Number(row.refund_total_minor ?? 0),
        currency: row.currency_code,
        ...extra,
      },
    });
  } catch (error) {
    console.error("[events] return event failed", eventType, error);
  }
}

/** Publishes customer.created and related customer events. */
export async function publishCustomerEvent(
  customerId: string,
  eventType: string,
  extra: Record<string, unknown> = {},
) {
  try {
    const admin = await getAdmin();
    const { data } = await admin
      .from("customers")
      .select("id, organization_id, shop_id, email, first_name, last_name, customer_type, status")
      .eq("id", customerId)
      .maybeSingle();
    const row = data as
      | {
          id: string;
          organization_id: string;
          shop_id: string;
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          customer_type: string;
          status: string;
        }
      | null;
    if (!row) return;
    await publishDomainEvent({
      organizationId: row.organization_id,
      shopId: row.shop_id,
      eventType,
      payload: {
        customer_id: row.id,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
        customer_kind: row.customer_type,
        status: row.status,
        ...extra,
      },
    });
  } catch (error) {
    console.error("[events] customer event failed", eventType, error);
  }
}
