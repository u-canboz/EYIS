/* Phase 5 QA: creates the isolated QA organisations, shop, product, price,
   inventory and shipping through the existing commerce engines. */
import { admin, check, writeState } from "./lib";
import { ensureDefaultVariant, ensureInventoryItem, ensureDefaultLocation, receiveStock } from "@/lib/commerce/inventory.server";
import { ensurePriceSet, validatePriceInput } from "@/lib/commerce/pricing.server";

async function ensureUser(email: string) {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = list.users.find((u) => u.email === email);
  if (found) return found.id;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "QaPhase5!Test-" + email.length,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);
  return data.user!.id;
}

async function ensureOrg(name: string, slug: string, userId: string) {
  const { data: existing } = await admin.from("organizations").select("id").eq("slug", slug).maybeSingle();
  let orgId = existing?.id as string | undefined;
  if (!orgId) {
    const { data, error } = await admin.from("organizations").insert({ name, slug }).select("id").single();
    if (error) throw new Error(error.message);
    orgId = data.id as string;
  }
  await admin.from("memberships").upsert({ organization_id: orgId, user_id: userId, role: "owner" }, { onConflict: "organization_id,user_id" });
  return orgId;
}

async function ensureShop(orgId: string, name: string, slug: string) {
  const { data: existing } = await admin.from("shops").select("id").eq("organization_id", orgId).eq("slug", slug).maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await admin
    .from("shops")
    .insert({ organization_id: orgId, name, slug, currency: "EUR", locale: "de", status: "active" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function main() {
  const userA = await ensureUser("qa-owner-a@commerce-qa.test");
  const userB = await ensureUser("qa-owner-b@commerce-qa.test");
  const orgA = await ensureOrg("QA Organisation A", "qa-org-a", userA);
  const orgB = await ensureOrg("QA Organisation B", "qa-org-b", userB);
  const shopA = await ensureShop(orgA, "QA Shop A", "qa-shop-a");
  const shopB = await ensureShop(orgB, "QA Shop B", "qa-shop-b");

  // ---- Produkt + Variante ----
  let productId: string;
  const { data: existingProduct } = await admin
    .from("products")
    .select("id")
    .eq("organization_id", orgA)
    .eq("handle", "qa-testprodukt")
    .maybeSingle();
  if (existingProduct) productId = existingProduct.id as string;
  else {
    const { data, error } = await admin
      .from("products")
      .insert({
        organization_id: orgA,
        shop_id: shopA,
        name: "QA Testprodukt",
        handle: "qa-testprodukt",
        status: "active",
        blueprint_key: "simple",
        blueprint_data: {},
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    productId = data.id as string;
  }
  const variantId = await ensureDefaultVariant(orgA, productId);
  await admin.from("product_variants").update({ sku: "QA-E2E-001", status: "active" }).eq("id", variantId);

  // ---- Pricing über die Pricing Engine ----
  const priceSetId = await ensurePriceSet(admin as never, { organizationId: orgA, shopId: shopA, variantId });
  validatePriceInput({ amountMinor: 4990, currencyCode: "EUR", type: "base" });
  const { data: existingPrice } = await admin
    .from("prices")
    .select("id")
    .eq("price_set_id", priceSetId)
    .eq("type", "base")
    .maybeSingle();
  if (existingPrice) {
    await admin.from("prices").update({ amount_minor: 4990, status: "active" }).eq("id", existingPrice.id);
  } else {
    const { error } = await admin.from("prices").insert({
      organization_id: orgA,
      shop_id: shopA,
      price_set_id: priceSetId,
      currency_code: "EUR",
      amount_minor: 4990,
      type: "base",
      status: "active",
    });
    if (error) throw new Error(error.message);
  }

  // ---- Inventory über die Inventory Engine ----
  const itemId = await ensureInventoryItem(orgA, variantId, { sku: "QA-E2E-001", trackInventory: true, allowBackorder: false });
  await admin.from("inventory_items").update({ track_inventory: true, allow_backorder: false }).eq("id", itemId);
  const locationId = await ensureDefaultLocation(orgA, shopA);
  const ctx = { supabase: admin as never, userId: userA };
  const { data: lvl } = await admin
    .from("inventory_levels")
    .select("on_hand, reserved, damaged")
    .eq("inventory_item_id", itemId)
    .eq("location_id", locationId)
    .maybeSingle();
  const onHand = Number(lvl?.on_hand ?? 0);
  if (onHand < 10) {
    await receiveStock(ctx, {
      organizationId: orgA,
      shopId: shopA,
      inventoryItemId: itemId,
      locationId,
      quantity: 10 - onHand,
      reference: "QA-SETUP",
      idempotencyKey: `qa-setup-receive-${Date.now()}`,
    });
  }

  // ---- Shipping ----
  let shippingId: string;
  const { data: existingShip } = await admin
    .from("shipping_methods")
    .select("id")
    .eq("organization_id", orgA)
    .eq("shop_id", shopA)
    .eq("code", "QA-STD")
    .maybeSingle();
  if (existingShip) {
    shippingId = existingShip.id as string;
    await admin.from("shipping_methods").update({ amount_minor: 490, status: "active" }).eq("id", shippingId);
  } else {
    const { data, error } = await admin
      .from("shipping_methods")
      .insert({
        organization_id: orgA,
        shop_id: shopA,
        name: "Standardversand",
        code: "QA-STD",
        pricing_type: "fixed",
        amount_minor: 490,
        currency_code: "EUR",
        countries: ["DE"],
        status: "active",
        position: 1,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    shippingId = data.id as string;
  }

  // ---- Test-Provider (mock) für Shop A aktivieren ----
  const { data: cfg } = await admin
    .from("payment_provider_configs")
    .select("id")
    .eq("organization_id", orgA)
    .eq("shop_id", shopA)
    .eq("provider", "mock")
    .maybeSingle();
  if (!cfg) {
    const { error } = await admin.from("payment_provider_configs").insert({
      organization_id: orgA,
      shop_id: shopA,
      provider: "mock",
      display_name: "Test-Anbieter (QA)",
      environment: "test",
      status: "active",
      priority: 1,
    });
    if (error) throw new Error(error.message);
  } else {
    await admin.from("payment_provider_configs").update({ status: "active", environment: "test" }).eq("id", cfg.id);
  }

  const state = { userA, userB, orgA, orgB, shopA, shopB, productId, variantId, itemId, locationId, shippingId };
  writeState(state);
  check("QA-Testdaten angelegt", true, JSON.stringify({ productId, variantId, shippingId }));
  console.log(state);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
