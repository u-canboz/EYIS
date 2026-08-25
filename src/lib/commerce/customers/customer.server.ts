/**
 * Server-only customer reads and writes.
 * Guest order access uses 256-bit tokens; only the SHA-256 hash is stored.
 */
import { safeSearchTerm } from "../search";
import { emitEvent, generateToken, getAdmin, hashToken, writeAudit } from "../core.server";
import type {
  CustomerAddress,
  CustomerAddressInput,
  CustomerDetail,
  CustomerListItem,
  CustomerStatus,
} from "./customer.types";

type Row = Record<string, unknown>;

function str(v: unknown): string | null {
  return (v as string | null) ?? null;
}

function mapAddress(r: Row): CustomerAddress {
  return {
    id: r["id"] as string,
    customerId: r["customer_id"] as string,
    type: r["type"] as CustomerAddress["type"],
    firstName: r["first_name"] as string,
    lastName: r["last_name"] as string,
    company: str(r["company"]),
    street: r["street"] as string,
    street2: str(r["street2"]),
    postalCode: r["postal_code"] as string,
    city: r["city"] as string,
    state: str(r["state"]),
    countryCode: r["country_code"] as string,
    phone: str(r["phone"]),
    isDefault: Boolean(r["is_default"]),
  };
}

function baseItem(r: Row): CustomerListItem {
  return {
    id: r["id"] as string,
    shopId: r["shop_id"] as string,
    email: r["email"] as string,
    firstName: str(r["first_name"]),
    lastName: str(r["last_name"]),
    phone: str(r["phone"]),
    status: r["status"] as CustomerStatus,
    customerType: r["customer_type"] as CustomerListItem["customerType"],
    hasAccount: Boolean(r["auth_user_id"]),
    createdAt: r["created_at"] as string,
    orderCount: 0,
    totalSpentMinor: 0,
    currencyCode: "EUR",
    lastOrderAt: null,
  };
}

/** Aggregates order stats for a set of customers in one query. */
async function orderStats(organizationId: string, customerIds: string[]) {
  const stats = new Map<
    string,
    { count: number; total: number; last: string | null; currency: string }
  >();
  if (!customerIds.length) return stats;
  const admin = await getAdmin();
  const { data } = await admin
    .from("orders")
    .select("customer_id, total_minor, currency_code, placed_at, payment_status")
    .eq("organization_id", organizationId)
    .in("customer_id", customerIds);
  for (const row of (data ?? []) as Row[]) {
    const id = row["customer_id"] as string;
    const entry = stats.get(id) ?? { count: 0, total: 0, last: null, currency: "EUR" };
    entry.count += 1;
    if (row["payment_status"] === "paid") entry.total += Number(row["total_minor"] ?? 0);
    entry.currency = (row["currency_code"] as string) ?? entry.currency;
    const placed = row["placed_at"] as string;
    if (!entry.last || placed > entry.last) entry.last = placed;
    stats.set(id, entry);
  }
  return stats;
}

export async function listCustomers(input: {
  organizationId: string;
  shopId?: string | null;
  search?: string | null;
  status?: CustomerStatus | null;
  limit?: number;
}): Promise<CustomerListItem[]> {
  const admin = await getAdmin();
  let query = admin
    .from("customers")
    .select("*")
    .eq("organization_id", input.organizationId)
    .order("created_at", { ascending: false })
    .limit(Math.min(input.limit ?? 100, 200));
  if (input.shopId) query = query.eq("shop_id", input.shopId);
  if (input.status) query = query.eq("status", input.status as never);
  const term = safeSearchTerm(input.search);
  if (term) {
    query = query.or(
      [`email.ilike.%${term}%`, `first_name.ilike.%${term}%`, `last_name.ilike.%${term}%`].join(
        ",",
      ),
    );
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  const stats = await orderStats(
    input.organizationId,
    rows.map((r) => r["id"] as string),
  );
  return rows.map((r) => {
    const item = baseItem(r);
    const s = stats.get(item.id);
    return s
      ? {
          ...item,
          orderCount: s.count,
          totalSpentMinor: s.total,
          lastOrderAt: s.last,
          currencyCode: s.currency,
        }
      : item;
  });
}

export async function loadCustomer(
  organizationId: string,
  customerId: string,
): Promise<CustomerDetail> {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("customers")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", customerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kunde nicht gefunden.");

  const [addresses, groups, orders, notes, returns] = await Promise.all([
    admin.from("customer_addresses").select("*").eq("customer_id", customerId).order("created_at"),
    admin.from("customer_group_members").select("customer_group_id").eq("customer_id", customerId),
    admin
      .from("orders")
      .select(
        "id, order_number, placed_at, total_minor, currency_code, order_status, payment_status, fulfillment_status",
      )
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .order("placed_at", { ascending: false })
      .limit(50),
    admin
      .from("customer_notes")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
    admin.from("returns").select("id").eq("customer_id", customerId),
  ]);

  const orderRows = (orders.data ?? []) as Row[];
  const item = baseItem(data as Row);
  const paid = orderRows.filter((o) => o["payment_status"] === "paid");

  return {
    ...item,
    orderCount: orderRows.length,
    totalSpentMinor: paid.reduce((sum, o) => sum + Number(o["total_minor"] ?? 0), 0),
    currencyCode: (orderRows[0]?.["currency_code"] as string) ?? "EUR",
    lastOrderAt: (orderRows[0]?.["placed_at"] as string) ?? null,
    addresses: ((addresses.data ?? []) as Row[]).map(mapAddress),
    groupIds: ((groups.data ?? []) as Row[]).map((g) => g["customer_group_id"] as string),
    orders: orderRows.map((o) => ({
      id: o["id"] as string,
      orderNumber: o["order_number"] as string,
      placedAt: o["placed_at"] as string,
      totalMinor: Number(o["total_minor"] ?? 0),
      currencyCode: o["currency_code"] as string,
      orderStatus: o["order_status"] as string,
      paymentStatus: o["payment_status"] as string,
      fulfillmentStatus: o["fulfillment_status"] as string,
    })),
    notes: ((notes.data ?? []) as Row[]).map((n) => ({
      id: n["id"] as string,
      body: n["body"] as string,
      authorId: str(n["author_id"]),
      createdAt: n["created_at"] as string,
    })),
    returnCount: ((returns.data ?? []) as Row[]).length,
  };
}

export async function upsertCustomer(input: {
  organizationId: string;
  shopId: string;
  customerId?: string | null;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  customerType?: "b2c" | "b2b";
  actorId: string;
}) {
  const admin = await getAdmin();
  const payload = {
    organization_id: input.organizationId,
    shop_id: input.shopId,
    email: input.email.trim().toLowerCase(),
    first_name: input.firstName ?? null,
    last_name: input.lastName ?? null,
    phone: input.phone ?? null,
    customer_type: input.customerType ?? "b2c",
  };
  if (input.customerId) {
    const { error } = await admin
      .from("customers")
      .update(payload as never)
      .eq("organization_id", input.organizationId)
      .eq("id", input.customerId);
    if (error) throw new Error(error.message);
    await writeAudit({
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: "customer.updated",
      entityType: "customer",
      entityId: input.customerId,
    });
    return { customerId: input.customerId };
  }
  const { data, error } = await admin
    .from("customers")
    .insert(payload as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const id = (data as Row)["id"] as string;
  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "customer.created",
    entityType: "customer",
    entityId: id,
  });
  const { publishCustomerEvent } = await import("../event-payloads.server");
  await publishCustomerEvent(id, "customer.created");
  return { customerId: id };
}

/** Blocking stops new checkouts/logins by policy but never hides existing documents. */
export async function setCustomerStatus(input: {
  organizationId: string;
  customerId: string;
  status: CustomerStatus;
  reason?: string | null;
  actorId: string;
}) {
  const admin = await getAdmin();
  const { error } = await admin
    .from("customers")
    .update({ status: input.status } as never)
    .eq("organization_id", input.organizationId)
    .eq("id", input.customerId);
  if (error) throw new Error(error.message);
  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: input.status === "blocked" ? "customer.blocked" : "customer.status_changed",
    entityType: "customer",
    entityId: input.customerId,
    metadata: { status: input.status, reason: input.reason ?? null },
  });
  await emitEvent(input.organizationId, "customer.status_changed", {
    customer_id: input.customerId,
    status: input.status,
  });
  return { ok: true };
}

export async function saveAddress(input: {
  organizationId: string;
  customerId: string;
  address: CustomerAddressInput;
}) {
  const admin = await getAdmin();
  const { data: customer } = await admin
    .from("customers")
    .select("shop_id")
    .eq("organization_id", input.organizationId)
    .eq("id", input.customerId)
    .maybeSingle();
  if (!customer) throw new Error("Kunde nicht gefunden.");
  const a = input.address;
  const payload = {
    organization_id: input.organizationId,
    shop_id: (customer as Row)["shop_id"] as string,
    customer_id: input.customerId,
    type: a.type,
    first_name: a.firstName,
    last_name: a.lastName,
    company: a.company ?? null,
    street: a.street,
    street2: a.street2 ?? null,
    postal_code: a.postalCode,
    city: a.city,
    state: a.state ?? null,
    country_code: a.countryCode.toUpperCase(),
    phone: a.phone ?? null,
    is_default: a.isDefault ?? false,
  };
  if (a.id) {
    const { error } = await admin
      .from("customer_addresses")
      .update(payload as never)
      .eq("id", a.id);
    if (error) throw new Error(error.message);
    return { addressId: a.id };
  }
  const { data, error } = await admin
    .from("customer_addresses")
    .insert(payload as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { addressId: (data as Row)["id"] as string };
}

export async function deleteAddress(organizationId: string, addressId: string) {
  const admin = await getAdmin();
  const { error } = await admin
    .from("customer_addresses")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", addressId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function setCustomerGroups(input: {
  organizationId: string;
  customerId: string;
  groupIds: string[];
}) {
  const admin = await getAdmin();
  await admin.from("customer_group_members").delete().eq("customer_id", input.customerId);
  if (input.groupIds.length) {
    const { error } = await admin.from("customer_group_members").insert(
      input.groupIds.map((g) => ({
        organization_id: input.organizationId,
        customer_id: input.customerId,
        customer_group_id: g,
      })) as never,
    );
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export async function addCustomerNote(input: {
  organizationId: string;
  customerId: string;
  body: string;
  actorId: string;
}) {
  const admin = await getAdmin();
  const { error } = await admin.from("customer_notes").insert({
    organization_id: input.organizationId,
    customer_id: input.customerId,
    body: input.body,
    author_id: input.actorId,
  } as never);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Guest order access                                                   */
/* ------------------------------------------------------------------ */

/** Issues a single-order guest link. Returns the raw token exactly once. */
export async function issueGuestToken(input: {
  organizationId: string;
  shopId: string;
  orderId: string;
  ttlHours?: number;
  actorId?: string | null;
}) {
  const admin = await getAdmin();
  const token = generateToken(); // 32 random bytes = 256 bit
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + (input.ttlHours ?? 72) * 3600_000).toISOString();
  const { error } = await admin.from("guest_order_access_tokens").insert({
    organization_id: input.organizationId,
    shop_id: input.shopId,
    order_id: input.orderId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  } as never);
  if (error) throw new Error(error.message);
  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId ?? null,
    action: "customer.guest_access_issued",
    entityType: "order",
    entityId: input.orderId,
    metadata: { expires_at: expiresAt },
  });
  return { token, expiresAt };
}

export async function resolveGuestToken(token: string) {
  const admin = await getAdmin();
  const tokenHash = await hashToken(token);
  const { data } = await admin
    .from("guest_order_access_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data) return null;
  const row = data as Row;
  if (row["revoked_at"]) return null;
  if (new Date(row["expires_at"] as string).getTime() < Date.now()) return null;
  await admin
    .from("guest_order_access_tokens")
    .update({ used_at: new Date().toISOString() } as never)
    .eq("id", row["id"] as string);
  return {
    organizationId: row["organization_id"] as string,
    shopId: row["shop_id"] as string,
    orderId: row["order_id"] as string,
  };
}

export async function revokeGuestTokens(organizationId: string, orderId: string) {
  const admin = await getAdmin();
  await admin
    .from("guest_order_access_tokens")
    .update({ revoked_at: new Date().toISOString() } as never)
    .eq("organization_id", organizationId)
    .eq("order_id", orderId)
    .is("revoked_at", null);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Account linking                                                      */
/* ------------------------------------------------------------------ */

/**
 * Links guest orders of the same e-mail to the signed-in account.
 * Every claimed order is written as its own audit + security event because
 * this reassigns ownership of commercial documents.
 */
export async function claimOrdersForUser(input: { userId: string; email: string }) {
  const admin = await getAdmin();
  const email = input.email.trim().toLowerCase();
  const { data: orderRows } = await admin
    .from("orders")
    .select("id, organization_id, shop_id, email, customer_id")
    .ilike("email", email)
    .is("customer_id", null)
    .limit(200);

  const orders = (orderRows ?? []) as Row[];
  const claimed: string[] = [];
  const customerByShop = new Map<string, string>();

  for (const order of orders) {
    const shopId = order["shop_id"] as string;
    const orgId = order["organization_id"] as string;
    let customerId = customerByShop.get(shopId) ?? null;

    if (!customerId) {
      const { data: existing } = await admin
        .from("customers")
        .select("id, auth_user_id")
        .eq("shop_id", shopId)
        .ilike("email", email)
        .maybeSingle();
      if (existing) {
        customerId = (existing as Row)["id"] as string;
        if (!(existing as Row)["auth_user_id"]) {
          await admin
            .from("customers")
            .update({ auth_user_id: input.userId, status: "active" } as never)
            .eq("id", customerId);
        }
      } else {
        const { data: created, error } = await admin
          .from("customers")
          .insert({
            organization_id: orgId,
            shop_id: shopId,
            email,
            auth_user_id: input.userId,
            status: "active",
          } as never)
          .select("id")
          .single();
        if (error) continue;
        customerId = (created as Row)["id"] as string;
      }
      customerByShop.set(shopId, customerId);
    }

    const { error: linkError } = await admin
      .from("orders")
      .update({ customer_id: customerId } as never)
      .eq("id", order["id"] as string)
      .is("customer_id", null);
    if (linkError) continue;

    claimed.push(order["id"] as string);
    await writeAudit({
      organizationId: orgId,
      actorId: input.userId,
      actorEmail: email,
      action: "customer.order_claimed",
      entityType: "order",
      entityId: order["id"] as string,
      metadata: { customer_id: customerId, reason: "account_linking" },
    });
    await emitEvent(orgId, "security.customer_order_claimed", {
      order_id: order["id"],
      customer_id: customerId,
      auth_user_id: input.userId,
    });
  }

  return { claimed: claimed.length };
}

/** Customer records that belong to the signed-in auth user. */
export async function customersForUser(userId: string) {
  const admin = await getAdmin();
  const { data } = await admin.from("customers").select("*").eq("auth_user_id", userId);
  return ((data ?? []) as Row[]).map(baseItem);
}
