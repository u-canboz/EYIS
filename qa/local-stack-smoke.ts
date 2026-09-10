/** Real HTTP commerce smoke test against an explicitly isolated local Supabase. */
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { assertOperationAllowed } from "../src/lib/commerce/environment";
assertOperationAllowed("qa_harness");
const origin = process.env["COMMERCE_OS_URL"] ?? "";
for (const url of [origin, process.env["SUPABASE_URL"] ?? ""]) {
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
    throw new Error("This smoke test requires loopback app and database APIs.");
}
const { getAdmin } = await import("../src/lib/commerce/core.server");
const admin = await getAdmin();
const { data: installation, error: installationError } = await admin
  .from("commerce_installation")
  .select("organization_id, shop_id, storefront_publishable_key")
  .eq("singleton", true)
  .single();
if (installationError || !installation?.organization_id || !installation.shop_id)
  throw new Error("Claim the local installation first.");
const orgId = installation.organization_id as string;
const shopId = installation.shop_id as string;
const key = installation.storefront_publishable_key as string;
const { data: membership } = await admin
  .from("memberships")
  .select("user_id")
  .eq("organization_id", orgId)
  .eq("role", "owner")
  .single();
if (!membership) throw new Error("Local owner missing.");
const suffix = randomUUID().slice(0, 8);
const checks: Array<{ check: string; pass: boolean; detail: string }> = [];
function check(name: string, pass: boolean, detail = "") {
  checks.push({ check: name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!pass) throw new Error(name);
}
function dbResult(result: { error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message);
}
const inventory = await import("../src/lib/commerce/inventory.server");
const pricing = await import("../src/lib/commerce/pricing.server");
const created = await admin
  .from("products")
  .insert({
    organization_id: orgId,
    shop_id: shopId,
    name: "EYIS Testprodukt",
    handle: `eyis-testprodukt-${suffix}`,
    status: "active",
    blueprint_key: "standard",
    blueprint_data: {},
  })
  .select("id")
  .single();
dbResult(created);
if (!created.data) throw new Error("Product missing");
const productId = created.data.id;
const variantId = await inventory.ensureDefaultVariant(orgId, productId);
dbResult(
  await admin
    .from("product_variants")
    .update({ sku: `EYIS-${suffix}`, status: "active" })
    .eq("organization_id", orgId)
    .eq("id", variantId),
);
const priceSet = await pricing.ensurePriceSet(admin as never, {
  organizationId: orgId,
  shopId,
  variantId,
});
dbResult(
  await admin.from("prices").insert({
    organization_id: orgId,
    shop_id: shopId,
    price_set_id: priceSet,
    currency_code: "EUR",
    amount_minor: 4990,
    type: "base",
    status: "active",
  }),
);
const itemId = await inventory.ensureInventoryItem(orgId, variantId, {
  sku: `EYIS-${suffix}`,
  trackInventory: true,
  allowBackorder: false,
});
const locationId = await inventory.ensureDefaultLocation(orgId, shopId);
await inventory.receiveStock(
  { supabase: admin as never, userId: membership.user_id },
  {
    organizationId: orgId,
    shopId,
    inventoryItemId: itemId,
    locationId,
    quantity: 10,
    reference: "LOCAL-SMOKE",
    idempotencyKey: `local-${suffix}`,
  },
);
const shipping = await admin
  .from("shipping_methods")
  .insert({
    organization_id: orgId,
    shop_id: shopId,
    name: "Testversand",
    code: `LOCAL-${suffix}`,
    pricing_type: "fixed",
    amount_minor: 490,
    currency_code: "EUR",
    countries: ["DE"],
    status: "active",
    position: 1,
  })
  .select("id")
  .single();
dbResult(shipping);
const configs = await admin
  .from("payment_provider_configs")
  .select("id")
  .eq("organization_id", orgId)
  .eq("shop_id", shopId)
  .eq("provider", "mock")
  .eq("environment", "test");
if (!configs.data?.length)
  dbResult(
    await admin.from("payment_provider_configs").insert({
      organization_id: orgId,
      shop_id: shopId,
      provider: "mock",
      display_name: "Testzahlung",
      environment: "test",
      status: "active",
      priority: 1,
    }),
  );
let cartToken = "";
async function request(path: string, method = "GET", body?: unknown, token = cartToken) {
  const response = await fetch(`${origin}/api/public/store/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Commerce-Key": key,
      "X-Cart-Token": token,
      Origin: origin,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const payload = (await response.json()) as {
    data: any;
    error?: { code: string; message: string };
  };
  if (!response.ok)
    throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(payload.error)}`);
  return payload.data;
}
try {
  for (const [table, minimum] of [
    ["product_blueprints", 9],
    ["communication_templates", 23],
    ["tax_classes", 7],
  ] as const) {
    let query = admin
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("is_system", true);
    if (table !== "product_blueprints") query = query.is("organization_id", null);
    const result = await query;
    check(
      `Canonical seeds: ${table}`,
      !result.error && (result.count ?? 0) >= minimum,
      String(result.count),
    );
  }
  const product = await request(`/products/eyis-testprodukt-${suffix}`);
  check("Published product through HTTP Store API", product.id === productId);
  const made = await request("/cart", "POST", {});
  cartToken = made.cartToken;
  const cartId = made.cart.id;
  const cart = await request(`/cart/${cartId}/items`, "POST", { variantId, quantity: 1 });
  check(
    "Cart uses server price",
    cart.totals.subtotalMinor === 4990,
    String(cart.totals.subtotalMinor),
  );
  const unauthorized = await fetch(`${origin}/api/public/store/v1/cart/${cartId}`, {
    headers: { "X-Commerce-Key": key },
  });
  check("Cart rejects missing token", unauthorized.status === 401 || unauthorized.status === 403);
  let checkout = await request("/checkout", "POST", { cartId, email: "buyer@example.test" });
  const sessionId = checkout.id;
  checkout = await request(`/checkout/${sessionId}/address`, "POST", {
    type: "shipping",
    billingSameAsShipping: true,
    address: {
      firstName: "Local",
      lastName: "Buyer",
      street: "Teststraße 1",
      postalCode: "10115",
      city: "Berlin",
      countryCode: "DE",
    },
  });
  checkout = await request(`/checkout/${sessionId}/shipping-option`, "POST", {
    shippingMethodId: shipping.data!.id,
  });
  checkout = await request(`/checkout/${sessionId}/validate`, "POST", {});
  check(
    "Validated checkout total",
    checkout.totals.totalMinor === 5480,
    String(checkout.totals.totalMinor),
  );
  const payment = await request(`/checkout/${sessionId}/payment-session`, "POST", {
    provider: "mock",
    returnUrl: `${origin}/store/bestaetigung`,
    cancelUrl: `${origin}/store/checkout`,
  });
  check("Mock payment created", payment.amountMinor === 5480 && Boolean(payment.id));
  await request(`/payments/${payment.id}/mock-confirm`, "POST", {});
  const paid = await request(`/payments/${payment.id}/status`);
  check("Payment settled through API", paid.status === "paid" && Boolean(paid.confirmationToken));
  await request(`/payments/${payment.id}/mock-confirm`, "POST", {});
  const order = await request(`/orders/confirmation/${paid.confirmationToken}`);
  check("Order confirmation via one-time token", order.totalMinor === 5480, order.orderNumber);
  const redeemedAgain = await fetch(
    `${origin}/api/public/store/v1/orders/confirmation/${paid.confirmationToken}`,
    { headers: { "X-Commerce-Key": key } },
  );
  check(
    "Confirmation token cannot be replayed",
    redeemedAgain.status === 401 || redeemedAgain.status === 403 || redeemedAgain.status === 404,
  );
  const level = await admin
    .from("inventory_levels")
    .select("on_hand,reserved")
    .eq("organization_id", orgId)
    .eq("inventory_item_id", itemId)
    .eq("location_id", locationId)
    .single();
  check(
    "Exactly one stock commit",
    Number(level.data?.on_hand) === 9 && Number(level.data?.reserved) === 0,
    JSON.stringify(level.data),
  );
  dbResult(
    await admin
      .from("commerce_installation")
      .update({ maintenance_state: "updating" })
      .eq("singleton", true)
      .eq("organization_id", orgId),
  );
  try {
    const maintenance = await fetch(`${origin}/api/public/store/v1/products`, {
      headers: { "X-Commerce-Key": key },
    });
    check(
      "Update maintenance blocks Store API",
      maintenance.status === 503 && maintenance.headers.get("retry-after") === "30",
    );
  } finally {
    dbResult(
      await admin
        .from("commerce_installation")
        .update({ maintenance_state: "off" })
        .eq("singleton", true)
        .eq("organization_id", orgId),
    );
  }
  for (const job of ["expiration", "communications", "automation", "merchant-sync"]) {
    const response = await fetch(`${origin}/api/public/jobs/${job}`, { method: "POST" });
    check(`Cron ${job} rejects missing authentication`, response.status === 401);
  }
  const { getUpdateOverview, assertInstallationOrganization } =
    await import("../src/lib/commerce/updates/update-center.server");
  await assertInstallationOrganization(orgId);
  let denied = false;
  try {
    await assertInstallationOrganization(randomUUID());
  } catch {
    denied = true;
  }
  check("Other tenant cannot administer updates", denied);
  const overview = await getUpdateOverview();
  check(
    "Update overview reads persisted state",
    overview.maintenanceState === "off" && overview.installedVersion === "0.0.0-dev",
  );
  console.log("LOCAL COMMERCE SMOKE PASS");
} finally {
  writeFileSync(
    "../local-smoke-results.json",
    JSON.stringify({ at: new Date().toISOString(), origin, checks }, null, 2),
  );
}
