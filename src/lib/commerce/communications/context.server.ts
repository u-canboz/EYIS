/**
 * Builds the typed rendering context for a communication.
 * Nothing else is exposed to templates: no raw database rows, no ids, no
 * permanent document URLs. Guest document access always goes through a
 * short-lived portal link.
 */
import { getAdmin } from "../core.server";
import { formatMoney } from "../money";
import { issueGuestToken } from "../customers/customer.server";
import type { CommunicationContext, ContextLineItem } from "./communication.types";

type Row = Record<string, unknown>;

export function baseUrl() {
  return (
    process.env["APP_BASE_URL"] ??
    "https://project--b27965a8-6cc7-4efa-8375-cc233e90dcf7.lovable.app"
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(new Date(value));
}

function splitName(full: string | null, first?: string | null, last?: string | null) {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  if (f || l) return { first: f, last: l, full: [f, l].filter(Boolean).join(" ") };
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: "", last: "", full: "" };
  return { first: parts[0]!, last: parts.slice(1).join(" "), full: parts.join(" ") };
}

function addressLines(address: Row | null | undefined): string[] {
  if (!address) return [];
  const a = address;
  return [
    [a["first_name"], a["last_name"]].filter(Boolean).join(" "),
    (a["company"] as string) ?? "",
    [a["street"] ?? a["line1"], a["house_number"]].filter(Boolean).join(" "),
    (a["line2"] as string) ?? "",
    [a["postal_code"], a["city"]].filter(Boolean).join(" "),
    (a["country_code"] as string) ?? "",
  ]
    .map((l) => String(l ?? "").trim())
    .filter(Boolean);
}

export type ContextRequest = {
  organizationId: string;
  shopId: string;
  orderId?: string | null;
  shipmentId?: string | null;
  returnId?: string | null;
  invoiceId?: string | null;
  creditNoteId?: string | null;
  refundId?: string | null;
  customerId?: string | null;
  recipientEmail?: string | null;
  /** Issues a short-lived guest link instead of relying on a portal login. */
  guestAccess?: boolean;
};

export type BuiltContext = {
  context: CommunicationContext;
  recipient: string;
  customerId: string | null;
  orderId: string | null;
};

export async function buildContext(req: ContextRequest): Promise<BuiltContext> {
  const admin = await getAdmin();
  const base = baseUrl();
  const currencyFallback = "EUR";

  const { data: shopRow } = await admin
    .from("shops")
    .select("id, name, currency")
    .eq("id", req.shopId)
    .maybeSingle();
  const shop = (shopRow ?? {}) as Row;

  const ctx: CommunicationContext = {
    shop: {
      name: (shop["name"] as string) ?? "Shop",
      support_email: "",
      website_url: base,
    },
    customer: { first_name: "", last_name: "", full_name: "", email: "" },
    links: {
      order: `${base}/portal/bestellungen`,
      tracking: "",
      document: `${base}/portal`,
      return: `${base}/portal`,
      portal: `${base}/portal`,
      guest_access: "",
    },
  };

  let recipient = req.recipientEmail ?? "";
  let customerId = req.customerId ?? null;
  let orderId = req.orderId ?? null;
  let currency = (shop["currency"] as string) ?? currencyFallback;

  /* ------------------------------- order -------------------------------- */
  if (req.orderId) {
    const { data: orderRow } = await admin
      .from("orders")
      .select("*")
      .eq("id", req.orderId)
      .maybeSingle();
    const order = orderRow as Row | null;
    if (order) {
      orderId = order["id"] as string;
      currency = (order["currency_code"] as string) ?? currency;
      recipient = recipient || ((order["email"] as string) ?? "");
      customerId = customerId ?? ((order["customer_id"] as string) ?? null);

      const { data: itemRows } = await admin
        .from("order_items")
        .select("title_snapshot, variant_title_snapshot, quantity, line_total_minor, gross_minor")
        .eq("order_id", order["id"] as string);
      const items: ContextLineItem[] = ((itemRows ?? []) as Row[]).map((i) => ({
        name: [i["title_snapshot"], i["variant_title_snapshot"]].filter(Boolean).join(" – "),
        quantity: Number(i["quantity"] ?? 0),
        line_total: formatMoney(
          Number(i["gross_minor"] ?? i["line_total_minor"] ?? 0),
          currency,
        ),
      }));

      const { data: addressRows } = await admin
        .from("order_addresses")
        .select("type, address")
        .eq("order_id", order["id"] as string);
      const shippingAddress = ((addressRows ?? []) as Row[]).find((a) => a["type"] === "shipping");

      ctx.order = {
        number: (order["order_number"] as string) ?? "",
        date: formatDate((order["placed_at"] as string) ?? (order["created_at"] as string)),
        subtotal: formatMoney(Number(order["subtotal_minor"] ?? 0), currency),
        discount: order["discount_minor"]
          ? formatMoney(Number(order["discount_minor"]), currency)
          : "",
        shipping: formatMoney(Number(order["shipping_minor"] ?? 0), currency),
        tax: formatMoney(Number(order["tax_total_minor"] ?? order["tax_minor"] ?? 0), currency),
        total: formatMoney(Number(order["total_minor"] ?? order["gross_total_minor"] ?? 0), currency),
        currency,
        items,
        shipping_address: addressLines((shippingAddress?.["address"] as Row) ?? null),
      };
      ctx.payment = {
        method: (order["shipping_method"] as string) ?? "",
        amount: formatMoney(Number(order["total_minor"] ?? 0), currency),
        status: String(order["payment_status"] ?? ""),
      };
      ctx.links.order = `${base}/portal/bestellungen/${order["id"] as string}`;
    }
  }

  /* ------------------------------ customer ------------------------------ */
  if (customerId) {
    const { data: customerRow } = await admin
      .from("customers")
      .select("first_name, last_name, email")
      .eq("id", customerId)
      .maybeSingle();
    const c = (customerRow ?? {}) as Row;
    const name = splitName(null, c["first_name"] as string, c["last_name"] as string);
    ctx.customer = {
      first_name: name.first,
      last_name: name.last,
      full_name: name.full,
      email: (c["email"] as string) ?? recipient,
    };
    recipient = recipient || ((c["email"] as string) ?? "");
  } else {
    ctx.customer.email = recipient;
  }

  /* ------------------------------ shipment ------------------------------ */
  if (req.shipmentId) {
    const { data: shipmentRow } = await admin
      .from("shipments")
      .select("*")
      .eq("id", req.shipmentId)
      .maybeSingle();
    const s = shipmentRow as Row | null;
    if (s) {
      ctx.shipment = {
        carrier: String(s["carrier_provider"] ?? "").toUpperCase(),
        tracking_number: (s["tracking_number"] as string) ?? "",
        tracking_url: (s["tracking_url"] as string) ?? "",
        status: String(s["normalized_tracking_status"] ?? s["status"] ?? ""),
        items: ctx.order?.items ?? [],
      };
      ctx.links.tracking = (s["tracking_url"] as string) ?? ctx.links.order;
    }
  }

  /* ------------------------------ documents ----------------------------- */
  if (req.invoiceId) {
    const { data: row } = await admin
      .from("invoices")
      .select("invoice_number, issue_date, total_gross_minor, currency_code, customer_email")
      .eq("id", req.invoiceId)
      .maybeSingle();
    const i = row as Row | null;
    if (i) {
      ctx.invoice = {
        number: (i["invoice_number"] as string) ?? "",
        date: formatDate(i["issue_date"] as string),
        total: formatMoney(Number(i["total_gross_minor"] ?? 0), (i["currency_code"] as string) ?? currency),
      };
      recipient = recipient || ((i["customer_email"] as string) ?? "");
    }
  }
  if (req.creditNoteId) {
    const { data: row } = await admin
      .from("credit_notes")
      .select("credit_note_number, issued_at, total_gross_minor, currency_code")
      .eq("id", req.creditNoteId)
      .maybeSingle();
    const c = row as Row | null;
    if (c) {
      ctx.credit_note = {
        number: (c["credit_note_number"] as string) ?? "",
        date: formatDate(c["issued_at"] as string),
        total: formatMoney(Number(c["total_gross_minor"] ?? 0), (c["currency_code"] as string) ?? currency),
      };
    }
  }

  /* -------------------------------- return ------------------------------ */
  if (req.returnId) {
    const { data: row } = await admin
      .from("returns")
      .select("id, return_number, status, currency_code, order_id")
      .eq("id", req.returnId)
      .maybeSingle();
    const r = row as Row | null;
    if (r) {
      const { data: itemRows } = await admin
        .from("return_items")
        .select("quantity_requested, quantity_approved, refund_amount_minor, order_item_id")
        .eq("return_id", r["id"] as string);
      const orderItemIds = ((itemRows ?? []) as Row[]).map((i) => i["order_item_id"] as string);
      const { data: titleRows } = orderItemIds.length
        ? await admin.from("order_items").select("id, title_snapshot").in("id", orderItemIds)
        : { data: [] };
      const titles = new Map(
        ((titleRows ?? []) as Row[]).map((t) => [t["id"] as string, t["title_snapshot"] as string]),
      );
      ctx.return = {
        number: (r["return_number"] as string) ?? "",
        status: String(r["status"] ?? ""),
        items: ((itemRows ?? []) as Row[]).map((i) => ({
          name: titles.get(i["order_item_id"] as string) ?? "Artikel",
          quantity: Number(i["quantity_approved"] ?? i["quantity_requested"] ?? 0),
          line_total: formatMoney(
            Number(i["refund_amount_minor"] ?? 0),
            (r["currency_code"] as string) ?? currency,
          ),
        })),
        instructions: "",
      };
      ctx.links.return = `${base}/portal/retouren/${r["id"] as string}`;
    }
  }

  /* -------------------------------- refund ------------------------------ */
  if (req.refundId) {
    const { data: row } = await admin
      .from("refunds")
      .select("amount_minor, currency_code, reason")
      .eq("id", req.refundId)
      .maybeSingle();
    const rf = row as Row | null;
    if (rf) {
      ctx.refund = {
        amount: formatMoney(Number(rf["amount_minor"] ?? 0), (rf["currency_code"] as string) ?? currency),
        reason: (rf["reason"] as string) ?? "",
      };
    }
  }

  /* --------------------------- guest access link ------------------------ */
  if (req.guestAccess && orderId) {
    const { token } = await issueGuestToken({
      organizationId: req.organizationId,
      shopId: req.shopId,
      orderId,
      ttlHours: 72,
    });
    const link = `${base}/portal/gast?token=${token}`;
    ctx.links.guest_access = link;
    ctx.links.order = link;
    ctx.links.document = link;
  } else if (!customerId && orderId) {
    // Guests never receive a permanent document URL.
    ctx.links.document = `${base}/portal/gast`;
  } else {
    ctx.links.document = ctx.links.order;
  }

  return { context: ctx, recipient: recipient.trim().toLowerCase(), customerId, orderId };
}
