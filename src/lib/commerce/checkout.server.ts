/**
 * Server-only checkout logic. Inventory reservations, session state changes and
 * cart locking happen inside transactional database functions — this module only
 * orchestrates and snapshots.
 */
import { getAdmin } from "./core.server";
import {
  buildCartView,
  loadCartAuthorized,
  mergeTaxIntoLines,
  repriceCart,
  type CartRow,
} from "./cart.server";
import type { AddressInput, CheckoutView, ShippingMethodView } from "./cart-types";
import { writeTaxSnapshot } from "./tax/tax.server";
import { isVatValidationValid } from "./tax/vat.server";

export type SessionRow = {
  id: string;
  organization_id: string;
  shop_id: string;
  cart_id: string;
  status: "open" | "validated" | "awaiting_payment" | "completed" | "expired" | "cancelled";
  email: string | null;
  shipping_address_id: string | null;
  billing_address_id: string | null;
  billing_same_as_shipping: boolean;
  shipping_option_id: string | null;
  price_snapshot_id: string | null;
  expires_at: string;
  customer_type: "consumer" | "business";
  company_name: string | null;
  customer_vat_id: string | null;
  vat_validation_id: string | null;
};

const OPEN_STATES = ["open", "validated", "awaiting_payment"] as const;

export async function loadSession(sessionId: string) {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("checkout_sessions")
    .select(
      "id, organization_id, shop_id, cart_id, status, email, shipping_address_id, billing_address_id, billing_same_as_shipping, shipping_option_id, price_snapshot_id, expires_at, customer_type, company_name, customer_vat_id, vat_validation_id",
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Checkout-Sitzung nicht gefunden.");
  return data as SessionRow;
}

/** Authorises through the cart: same guest token / customer rules. */
export async function loadSessionAuthorized(
  sessionId: string,
  token: string | null,
  customerId?: string | null,
) {
  const session = await loadSession(sessionId);
  const cart = await loadCartAuthorized(session.cart_id, token, customerId ?? null);
  return { session, cart };
}

export async function expireDueSessions(organizationId: string | null = null) {
  const admin = await getAdmin();
  const { data, error } = await admin.rpc(
    "cart_expire_checkout_sessions" as never,
    {
      _org: organizationId,
    } as never,
  );
  if (error) throw new Error(error.message);
  return (data ?? { expired_sessions: 0 }) as { expired_sessions: number };
}

/** Latest still-open session of a cart, if any. Makes checkout start idempotent. */
export async function findActiveSessionForCart(cart: CartRow): Promise<SessionRow | null> {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("checkout_sessions")
    .select(
      "id, organization_id, shop_id, cart_id, status, email, shipping_address_id, billing_address_id, billing_same_as_shipping, shipping_option_id, price_snapshot_id, expires_at, customer_type, company_name, customer_vat_id, vat_validation_id",
    )
    .eq("organization_id", cart.organization_id)
    .eq("cart_id", cart.id)
    .in("status", [...OPEN_STATES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SessionRow | null) ?? null;
}

export async function startCheckout(cart: CartRow, email: string | null, ttlMinutes = 20) {
  const admin = await getAdmin();
  await expireDueSessions(cart.organization_id);
  const { snapshotId } = await repriceCart(cart, { persist: true });

  const { data, error } = await admin.rpc(
    "cart_start_checkout" as never,
    {
      _org: cart.organization_id,
      _shop: cart.shop_id,
      _cart: cart.id,
      _snapshot: snapshotId,
      _actor: cart.customer_id,
      _email: email ?? cart.customer_email,
      _ttl_minutes: ttlMinutes,
      _idem: null,
    } as never,
  );
  if (error) throw new Error(error.message);
  const result = data as { checkout_session_id: string; reservations: number };
  return result;
}

export async function cancelCheckout(
  organizationId: string,
  sessionId: string,
  actorId: string | null,
  status: "cancelled" | "expired" = "cancelled",
) {
  const admin = await getAdmin();
  const { data, error } = await admin.rpc(
    "cart_cancel_checkout" as never,
    {
      _org: organizationId,
      _session: sessionId,
      _actor: actorId,
      _status: status,
      _idem: null,
    } as never,
  );
  if (error) throw new Error(error.message);
  return data as { checkout_session_id: string; status: string; released: number };
}

export async function saveAddress(
  session: SessionRow,
  type: "shipping" | "billing",
  address: AddressInput,
) {
  const admin = await getAdmin();
  const payload = {
    organization_id: session.organization_id,
    shop_id: session.shop_id,
    checkout_session_id: session.id,
    type,
    first_name: address.firstName.trim(),
    last_name: address.lastName.trim(),
    company: address.company ?? null,
    street: address.street.trim(),
    street2: address.street2 ?? null,
    postal_code: address.postalCode.trim(),
    city: address.city.trim(),
    state: address.state ?? null,
    country_code: address.countryCode.trim().toUpperCase(),
    phone: address.phone ?? null,
  };
  for (const key of ["first_name", "last_name", "street", "postal_code", "city"] as const) {
    if (!payload[key]) throw new Error("Bitte alle Pflichtfelder der Adresse ausfüllen.");
  }
  if (!/^[A-Z]{2}$/.test(payload.country_code))
    throw new Error("Ungültiges Land (ISO-2 erwartet).");

  const { data, error } = await admin
    .from("checkout_addresses")
    .upsert(payload as never, { onConflict: "checkout_session_id,type" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const id = (data as { id: string }).id;
  await admin
    .from("checkout_sessions")
    .update(type === "shipping" ? { shipping_address_id: id } : { billing_address_id: id })
    .eq("id", session.id);
  return id;
}

export async function listShippingMethods(
  organizationId: string,
  shopId: string,
  subtotalMinor: number,
  countryCode: string | null,
): Promise<ShippingMethodView[]> {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("shipping_methods")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .eq("status", "active")
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapShippingMethod).filter((m) => {
    if (m.countries.length && countryCode && !m.countries.includes(countryCode.toUpperCase()))
      return false;
    if (m.minSubtotalMinor !== null && subtotalMinor < m.minSubtotalMinor) return false;
    if (m.maxSubtotalMinor !== null && subtotalMinor > m.maxSubtotalMinor) return false;
    return true;
  });
}

export function mapShippingMethod(row: Record<string, unknown>): ShippingMethodView {
  return {
    id: row["id"] as string,
    name: row["name"] as string,
    code: row["code"] as string,
    description: (row["description"] as string) ?? null,
    pricingType: row["pricing_type"] as "fixed" | "free",
    amountMinor: Number(row["amount_minor"] ?? 0),
    currencyCode: row["currency_code"] as string,
    countries: (row["countries"] as string[]) ?? [],
    minSubtotalMinor: row["min_subtotal_minor"] === null ? null : Number(row["min_subtotal_minor"]),
    maxSubtotalMinor: row["max_subtotal_minor"] === null ? null : Number(row["max_subtotal_minor"]),
    freeAboveMinor: row["free_above_minor"] === null ? null : Number(row["free_above_minor"]),
    position: Number(row["position"] ?? 0),
    status: row["status"] as string,
  };
}

async function loadAddress(id: string | null) {
  if (!id) return null;
  const admin = await getAdmin();
  const { data } = await admin.from("checkout_addresses").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    id: r["id"] as string,
    firstName: r["first_name"] as string,
    lastName: r["last_name"] as string,
    company: (r["company"] as string) ?? null,
    street: r["street"] as string,
    street2: (r["street2"] as string) ?? null,
    postalCode: r["postal_code"] as string,
    city: r["city"] as string,
    state: (r["state"] as string) ?? null,
    countryCode: r["country_code"] as string,
    phone: (r["phone"] as string) ?? null,
  };
}

export async function buildCheckoutView(session: SessionRow, cart: CartRow): Promise<CheckoutView> {
  const admin = await getAdmin();
  const shippingAddress = await loadAddress(session.shipping_address_id);
  const billingAddress = await loadAddress(session.billing_address_id);

  let shippingMethod: ShippingMethodView | null = null;
  if (session.shipping_option_id) {
    const { data } = await admin
      .from("shipping_methods")
      .select("*")
      .eq("id", session.shipping_option_id)
      .maybeSingle();
    if (data) shippingMethod = mapShippingMethod(data as Record<string, unknown>);
  }

  const vatIdValid = await isVatValidationValid(session.vat_validation_id);
  const cartView = await buildCartView(cart, {
    shippingMethodId: session.shipping_option_id,
    countryCode: shippingAddress?.countryCode ?? null,
    customerType: session.customer_type,
    vatIdValid,
    persist: false,
  });

  const issues: string[] = [];
  if (!(OPEN_STATES as readonly string[]).includes(session.status))
    issues.push(`Sitzung ist ${session.status}.`);
  if (Date.parse(session.expires_at) <= Date.now())
    issues.push("Die Checkout-Sitzung ist abgelaufen.");
  if (!cartView.items.length) issues.push("Der Warenkorb ist leer.");
  if (!session.email) issues.push("E-Mail-Adresse fehlt.");
  if (!shippingAddress) issues.push("Lieferadresse fehlt.");
  if (!session.billing_same_as_shipping && !billingAddress) issues.push("Rechnungsadresse fehlt.");
  if (!shippingMethod) issues.push("Versandart fehlt.");
  issues.push(...cartView.warnings);

  return {
    id: session.id,
    status: session.status,
    cartId: session.cart_id,
    email: session.email,
    expiresAt: session.expires_at,
    shippingAddress,
    billingAddress: session.billing_same_as_shipping ? shippingAddress : billingAddress,
    billingSameAsShipping: session.billing_same_as_shipping,
    shippingMethod,
    totals: cartView.totals,
    currencyCode: cartView.currencyCode,
    ready: issues.length === 0,
    issues,
    cart: cartView,
  };
}

/** Final, immutable checkout snapshot — the handover point to phase 5. */
export async function writeCheckoutSnapshot(
  session: SessionRow,
  cart: CartRow,
  view: CheckoutView,
) {
  const admin = await getAdmin();
  const vatIdValid = await isVatValidationValid(session.vat_validation_id);
  const { snapshotId, calculation, tax } = await repriceCart(cart, {
    shippingMethodId: session.shipping_option_id,
    countryCode: view.shippingAddress?.countryCode ?? null,
    customerType: session.customer_type,
    vatIdValid,
    persist: true,
  });

  const taxSnapshotId = await writeTaxSnapshot({
    organizationId: session.organization_id,
    shopId: session.shop_id,
    cartId: session.cart_id,
    checkoutSessionId: session.id,
    result: tax,
  });

  const { data: last } = await admin
    .from("checkout_snapshots")
    .select("version")
    .eq("checkout_session_id", session.id)
    .order("version", { ascending: false })
    .limit(1);
  const version = (((last ?? [])[0] as { version: number } | undefined)?.version ?? 0) + 1;

  const { error } = await admin.from("checkout_snapshots").insert({
    organization_id: session.organization_id,
    shop_id: session.shop_id,
    checkout_session_id: session.id,
    version,
    cart_snapshot_id: snapshotId,
    email: session.email,
    shipping_address: (view.shippingAddress ?? {}) as never,
    billing_address: (view.billingAddress ?? {}) as never,
    shipping_method: (view.shippingMethod ?? {}) as never,
    totals: {
      ...calculation.totals,
      netTotalMinor: tax.netTotalMinor,
      taxMinor: tax.taxMinor,
      grossTotalMinor: calculation.totals.totalMinor,
    } as never,
    lines: mergeTaxIntoLines(calculation, tax) as never,
    tax_breakdown: tax.breakdown as never,
    tax_engine_version: tax.engineVersion,
    promotions: calculation.appliedPromotions as never,
    currency_code: calculation.currencyCode,
  });
  if (error) throw new Error(error.message);

  await admin
    .from("checkout_sessions")
    .update({
      status: "validated",
      validated_at: new Date().toISOString(),
      price_snapshot_id: snapshotId,
    })
    .eq("id", session.id);

  return { version, totals: calculation.totals, taxSnapshotId };
}
