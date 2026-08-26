/* QA-Fixtures: automatisch erzeugbare, vollständig zerstörbare Testwelten.
   Jede Fixture ist eine eigene Organisation (QA Fixture <Szenario> <Run-Ref>),
   deren kompletter Lebenszyklus über qa_fixtures.manifest dokumentiert wird. */
import { getAdmin, writeAudit } from "../core.server";
import { assertNotProduction } from "./guard.server";
import { QA_ORG_PREFIX, QA_SLUG_PREFIX, QA_TAG, type QaFixtureInfo, type QaScenario } from "./demo.types";

type Admin = Awaited<ReturnType<typeof getAdmin>>;
export type FixtureCtx = { admin: Admin; userId: string; email: string | null };

type FixtureBase = {
  organizationId: string;
  shopId: string;
  locationId: string;
  shippingId: string;
  variants: { key: string; productId: string; variantId: string; priceMinor: number }[];
  customerId: string | null;
  manifest: Record<string, unknown>;
};

const FIXTURE_ADDRESS = {
  firstName: "Qa",
  lastName: "Fixture",
  street: "Testweg 1",
  postalCode: "10115",
  city: "Berlin",
  countryCode: "DE",
};

/* ------------------------------------------------------------------ */
/* Basis-Aufbau                                                        */
/* ------------------------------------------------------------------ */

async function createBaseOrg(ctx: FixtureCtx, scenario: QaScenario, runRef: string): Promise<FixtureBase> {
  const { admin, userId } = ctx;
  const slug = `${QA_SLUG_PREFIX}${scenario}-${runRef}`.slice(0, 60);
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: `${QA_ORG_PREFIX}${scenario} ${runRef}`, slug })
    .select("id")
    .single();
  if (orgError || !org) throw new Error(orgError?.message ?? "QA-Organisation fehlgeschlagen.");
  const orgId = org.id as string;

  await admin.from("memberships").insert({ organization_id: orgId, user_id: userId, role: "owner" });
  const { data: shop, error: shopError } = await admin
    .from("shops")
    .insert({
      organization_id: orgId,
      name: `QA Shop ${scenario}`,
      slug: "qa-shop",
      currency: "EUR",
      locale: "de",
      status: "active",
    })
    .select("id")
    .single();
  if (shopError || !shop) throw new Error(shopError?.message ?? "QA-Shop fehlgeschlagen.");
  const shopId = shop.id as string;

  const { ensureDefaultLocation } = await import("../inventory.server");
  const locationId = await ensureDefaultLocation(orgId, shopId);

  const { data: shipping, error: shipError } = await admin
    .from("shipping_methods")
    .insert({
      organization_id: orgId,
      shop_id: shopId,
      name: "Standardversand",
      code: "QA-STD",
      pricing_type: "fixed",
      amount_minor: 490,
      currency_code: "EUR",
      countries: ["DE"],
      status: "active",
      position: 1,
      metadata: { qa: QA_TAG },
    })
    .select("id")
    .single();
  if (shipError) throw new Error(shipError.message);

  await admin.from("payment_provider_configs").insert({
    organization_id: orgId,
    shop_id: shopId,
    provider: "mock",
    display_name: "Test-Anbieter (QA)",
    environment: "test",
    status: "active",
    priority: 1,
  });
  await admin.from("shipping_provider_configs").upsert(
    {
      organization_id: orgId,
      shop_id: shopId,
      provider: "mock",
      display_name: "Test-Carrier (QA)",
      status: "active",
      test_mode: true,
    } as never,
    { onConflict: "shop_id,provider" } as never,
  );

  return {
    organizationId: orgId,
    shopId,
    locationId,
    shippingId: shipping.id as string,
    variants: [],
    customerId: null,
    manifest: { scenario, run_ref: runRef, organization_id: orgId, shop_id: shopId },
  };
}

async function addProduct(
  ctx: FixtureCtx,
  base: FixtureBase,
  def: { key: string; name: string; priceMinor: number; stock: number; blueprintKey?: string; blueprintData?: Record<string, unknown>; allowBackorder?: boolean },
) {
  const { admin, userId } = ctx;
  const { organizationId: orgId, shopId } = base;
  const { ensureDefaultVariant, ensureInventoryItem, receiveStock } = await import("../inventory.server");
  const { ensurePriceSet } = await import("../pricing.server");

  const { data: bp } = await admin
    .from("product_blueprints")
    .select("id, key, version")
    .eq("key", def.blueprintKey ?? "standard")
    .maybeSingle();
  const { data: product, error } = await admin
    .from("products")
    .insert({
      organization_id: orgId,
      shop_id: shopId,
      blueprint_id: bp?.id ?? null,
      blueprint_key: bp?.key ?? "standard",
      blueprint_version: bp?.version ?? 1,
      name: def.name,
      handle: `${def.key}-${base.manifest["run_ref"]}`.slice(0, 80),
      status: "active",
      blueprint_data: (def.blueprintData ?? {}) as never,
      metadata: { qa: QA_TAG, key: def.key },
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const productId = product.id as string;

  const variantId = await ensureDefaultVariant(orgId, productId);
  await admin
    .from("product_variants")
    .update({ sku: `QA-${def.key.toUpperCase()}`, status: "active" })
    .eq("id", variantId);
  const priceSetId = await ensurePriceSet(admin as never, { organizationId: orgId, shopId, variantId });
  await admin.from("prices").insert({
    organization_id: orgId,
    shop_id: shopId,
    price_set_id: priceSetId,
    currency_code: "EUR",
    amount_minor: def.priceMinor,
    type: "base",
    status: "active",
  });
  const itemId = await ensureInventoryItem(orgId, variantId, {
    sku: `QA-${def.key.toUpperCase()}`,
    trackInventory: true,
    allowBackorder: def.allowBackorder ?? false,
  });
  await admin
    .from("inventory_items")
    .update({ track_inventory: true, allow_backorder: def.allowBackorder ?? false })
    .eq("id", itemId);
  if (def.stock > 0) {
    await receiveStock(
      { supabase: admin as never, userId },
      {
        organizationId: orgId,
        shopId,
        inventoryItemId: itemId,
        locationId: base.locationId,
        quantity: def.stock,
        reference: "QA-FIXTURE",
        idempotencyKey: `qa-fixture:${base.manifest["run_ref"]}:${def.key}`,
      },
    );
  }
  base.variants.push({ key: def.key, productId, variantId, priceMinor: def.priceMinor });
  return productId;
}

async function addCustomer(ctx: FixtureCtx, base: FixtureBase) {
  const { admin } = ctx;
  const email = `qa-kunde-${base.manifest["run_ref"]}@commerce-qa.test`;
  const { data, error } = await admin
    .from("customers")
    .insert({
      organization_id: base.organizationId,
      shop_id: base.shopId,
      email,
      first_name: "Qa",
      last_name: "Kunde",
      customer_type: "b2c",
      status: "active",
      metadata: { qa: QA_TAG },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  base.customerId = data.id as string;
  await admin.from("customer_addresses").insert({
    organization_id: base.organizationId,
    shop_id: base.shopId,
    customer_id: base.customerId,
    type: "both",
    first_name: "Qa",
    last_name: "Kunde",
    street: FIXTURE_ADDRESS.street,
    postal_code: FIXTURE_ADDRESS.postalCode,
    city: FIXTURE_ADDRESS.city,
    country_code: "DE",
    is_default: true,
  });
  return base.customerId;
}

/** Echter Fluss: Warenkorb → Checkout → Mock-Zahlung → Bestellung. */
async function placeOrder(
  ctx: FixtureCtx,
  base: FixtureBase,
  opts: {
    items?: { variantKey: string; qty: number }[];
    pay?: boolean;
    email?: string;
    idemSuffix: string;
  },
): Promise<{ orderId: string | null; paymentSessionId: string; checkoutSessionId: string }> {
  const { admin, userId } = ctx;
  const { organizationId: orgId, shopId } = base;
  const cartApi = await import("../cart.server");
  const checkout = await import("../checkout.server");
  const payments = await import("../payments/payment.server");

  const { cartId, token } = await cartApi.createCart({ organizationId: orgId, shopId, currencyCode: "EUR" });
  const items = opts.items ?? [{ variantKey: base.variants[0]!.key, qty: 1 }];
  for (const item of items) {
    const variant = base.variants.find((v) => v.key === item.variantKey)!;
    const cart = await cartApi.loadCartAuthorized(cartId, token);
    const snap = await cartApi.loadVariantSnapshot(orgId, shopId, variant.variantId);
    await cartApi.assertAvailable(orgId, shopId, variant.variantId, item.qty, snap.title);
    const { error } = await admin.from("cart_items").insert({
      organization_id: orgId,
      shop_id: shopId,
      cart_id: cartId,
      product_id: snap.productId,
      variant_id: snap.variantId,
      quantity: item.qty,
      title_snapshot: snap.title,
      variant_title_snapshot: snap.variantTitle,
      sku_snapshot: snap.sku,
      image_snapshot: snap.image,
    });
    if (error) throw new Error(error.message);
    await cartApi.touchCart(cartId);
  }

  let cart = await cartApi.loadCartAuthorized(cartId, token);
  const started = await checkout.startCheckout(cart, opts.email ?? `qa-kunde-${base.manifest["run_ref"]}@commerce-qa.test`);
  const sessionId = started.checkout_session_id;
  let session = await checkout.loadSession(sessionId);
  await checkout.saveAddress(session, "shipping", FIXTURE_ADDRESS);
  await admin
    .from("checkout_sessions")
    .update({ shipping_option_id: base.shippingId, billing_same_as_shipping: true, status: "open", validated_at: null })
    .eq("id", sessionId);
  session = await checkout.loadSession(sessionId);
  cart = await cartApi.loadCartAuthorized(cartId, token);
  const view = await checkout.buildCheckoutView(session, cart);
  if (!view.ready) throw new Error(`Fixture-Checkout unvollständig: ${view.issues.join(" ")}`);
  await checkout.writeCheckoutSnapshot(session, cart, view);

  const { session: authedSession } = await checkout.loadSessionAuthorized(sessionId, token);
  const paymentSession = await payments.createPaymentSession({
    organizationId: orgId,
    shopId,
    checkoutSessionId: authedSession.id,
    email: authedSession.email,
    provider: "mock",
    returnUrl: "http://localhost:8080/store/bestaetigung",
    cancelUrl: "http://localhost:8080/store/checkout",
  });

  if (opts.pay === false)
    return { orderId: null, paymentSessionId: paymentSession.paymentSessionId, checkoutSessionId: sessionId };

  const result = await payments.finalizeFromPayment({
    organizationId: orgId,
    paymentSessionId: paymentSession.paymentSessionId,
    providerPaymentId: `mock_pi_${paymentSession.paymentSessionId}`,
    amountMinor: Number(paymentSession.amountMinor),
    currencyCode: paymentSession.currencyCode,
    actorId: userId,
    idempotencyKey: `qa-fixture:${base.manifest["run_ref"]}:${opts.idemSuffix}`,
  });
  if (base.customerId) {
    await admin.from("orders").update({ customer_id: base.customerId }).eq("id", result.order_id);
  }
  return { orderId: result.order_id, paymentSessionId: paymentSession.id, checkoutSessionId: sessionId };
}

async function shipOrder(ctx: FixtureCtx, base: FixtureBase, orderId: string, idem: string) {
  const { admin, userId } = ctx;
  const fulfillment = await import("../fulfillment/fulfillment.server");
  const shipping = await import("../shipping/shipping.server");
  const { data: items } = await admin.from("order_items").select("id, quantity").eq("order_id", orderId);
  const lines = (items ?? []) as { id: string; quantity: number }[];
  const ful = await fulfillment.createFulfillment({
    organizationId: base.organizationId,
    shopId: base.shopId,
    orderId,
    locationId: base.locationId,
    actorId: userId,
    items: lines.map((l) => ({ orderItemId: l.id, quantity: l.quantity })),
    idempotencyKey: `${idem}:ful`,
  });
  await fulfillment.startPicking({ organizationId: base.organizationId, fulfillmentId: ful.fulfillment_id, actorId: userId, idempotencyKey: `${idem}:pick` });
  let view = await fulfillment.loadFulfillment(base.organizationId, ful.fulfillment_id);
  await fulfillment.completePicking({
    organizationId: base.organizationId,
    fulfillmentId: ful.fulfillment_id,
    actorId: userId,
    picked: view.items.map((i) => ({ fulfillmentItemId: i.id, pickedQuantity: i.quantity })),
    idempotencyKey: `${idem}:picked`,
  });
  view = await fulfillment.loadFulfillment(base.organizationId, ful.fulfillment_id);
  await fulfillment.packFulfillment({
    organizationId: base.organizationId,
    fulfillmentId: ful.fulfillment_id,
    actorId: userId,
    packages: [{ weightGrams: 500, items: view.items.map((i) => ({ fulfillmentItemId: i.id, quantity: i.pickedQuantity })) }],
    idempotencyKey: `${idem}:pack`,
  });
  view = await fulfillment.loadFulfillment(base.organizationId, ful.fulfillment_id);
  const pkgId = view.packages[0]?.id;
  if (!pkgId) throw new Error("Kein Paket nach dem Packen.");
  const shipment = await shipping.createShipmentWithLabel({
    organizationId: base.organizationId,
    fulfillmentId: ful.fulfillment_id,
    packageId: pkgId,
    provider: "mock",
    service: null,
    actorId: userId,
    idempotencyKey: `${idem}:ship`,
  });
  await shipping.markShipped({ organizationId: base.organizationId, shipmentId: shipment.id, actorId: userId, idempotencyKey: `${idem}:shipped` });
  return { fulfillmentId: ful.fulfillment_id, shipmentId: shipment.id };
}

/* ------------------------------------------------------------------ */
/* Szenario-Builder                                                    */
/* ------------------------------------------------------------------ */

type Builder = (ctx: FixtureCtx, base: FixtureBase) => Promise<void>;

const builders: Record<QaScenario, Builder> = {
  catalog_full: async (ctx, base) => {
    await addProduct(ctx, base, { key: "textil", name: "QA T-Shirt", priceMinor: 1990, stock: 20, blueprintKey: "textil", blueprintData: { marke: "QA", material: "Baumwolle", passform: "Regular", zielgruppe: "Unisex", saison: "Ganzjährig" } });
    await addProduct(ctx, base, { key: "food", name: "QA Gewürz", priceMinor: 590, stock: 50, blueprintKey: "lebensmittel", blueprintData: { inhalt: 80, einheit: "g", grundpreiseinheit: "100 g", zutaten: "Paprika" } });
    await addProduct(ctx, base, { key: "elec", name: "QA Lautsprecher", priceMinor: 7990, stock: 10, blueprintKey: "elektronik", blueprintData: { hersteller: "QA", modell: "S-1" } });
    await addProduct(ctx, base, { key: "cos", name: "QA Creme", priceMinor: 2490, stock: 15, blueprintKey: "kosmetik", blueprintData: { inhalt: 50, einheit: "ml", grundpreiseinheit: "100 ml" } });
    await addProduct(ctx, base, { key: "furn", name: "QA Stuhl", priceMinor: 14900, stock: 5, blueprintKey: "moebel", blueprintData: { material: "Eiche" } });
    await addProduct(ctx, base, { key: "jewel", name: "QA Kette", priceMinor: 5900, stock: 8, blueprintKey: "schmuck", blueprintData: { schmucktyp: "Kette", material: "Silber" } });
    base.manifest["products"] = base.variants.length;
  },

  pricing_promotions: async (ctx, base) => {
    await addProduct(ctx, base, { key: "promo-item", name: "QA Promo-Produkt", priceMinor: 5000, stock: 30 });
    const { admin } = ctx;
    await admin.from("promotions").insert({
      organization_id: base.organizationId,
      shop_id: base.shopId,
      name: "QA Rabatt",
      code: `QA-${base.manifest["run_ref"]}`.toUpperCase().slice(0, 20),
      type: "percentage",
      value: 1000,
      status: "active",
      stackable: false,
      priority: 0,
      conditions: [],
      actions: [],
      metadata: { qa: QA_TAG },
    });
    base.manifest["promotions"] = 1;
  },

  inventory_concurrency: async (ctx, base) => {
    await addProduct(ctx, base, { key: "scarce", name: "QA Rarität (Bestand 1)", priceMinor: 9990, stock: 1, allowBackorder: false });
    base.manifest["note"] = "Bestand 1, kein Backorder — für Oversell-/Konkurrenztests.";
  },

  cart_checkout: async (ctx, base) => {
    await addProduct(ctx, base, { key: "cart-item", name: "QA Warenkorb-Produkt", priceMinor: 2990, stock: 10 });
    const { admin } = ctx;
    const cartApi = await import("../cart.server");
    const { cartId } = await cartApi.createCart({ organizationId: base.organizationId, shopId: base.shopId, currencyCode: "EUR" });
    const snap = await cartApi.loadVariantSnapshot(base.organizationId, base.shopId, base.variants[0]!.variantId);
    await admin.from("cart_items").insert({
      organization_id: base.organizationId,
      shop_id: base.shopId,
      cart_id: cartId,
      product_id: snap.productId,
      variant_id: snap.variantId,
      quantity: 2,
      title_snapshot: snap.title,
      variant_title_snapshot: snap.variantTitle,
      sku_snapshot: snap.sku,
    });
    base.manifest["cart_id"] = cartId;
  },

  payment_success: async (ctx, base) => {
    await addProduct(ctx, base, { key: "pay-ok", name: "QA Zahlungs-Produkt", priceMinor: 4990, stock: 10 });
    const { orderId } = await placeOrder(ctx, base, { idemSuffix: "pay-ok" });
    base.manifest["order_id"] = orderId;
  },

  payment_failure: async (ctx, base) => {
    await addProduct(ctx, base, { key: "pay-fail", name: "QA Fehler-Produkt", priceMinor: 4990, stock: 10 });
    const { admin, userId } = ctx;
    const { paymentSessionId } = await placeOrder(ctx, base, { pay: false, idemSuffix: "pay-fail" });
    const payments = await import("../payments/payment.server");
    await payments.markPaymentFailed(paymentSessionId, "QA: simulierter Provider-Fehler", false);
    void admin;
    void userId;
    base.manifest["payment_session_id"] = paymentSessionId;
  },

  payment_pending: async (ctx, base) => {
    await addProduct(ctx, base, { key: "pay-pending", name: "QA Pending-Produkt", priceMinor: 4990, stock: 10 });
    const { paymentSessionId } = await placeOrder(ctx, base, { pay: false, idemSuffix: "pay-pending" });
    base.manifest["payment_session_id"] = paymentSessionId;
  },

  order_refund: async (ctx, base) => {
    await addProduct(ctx, base, { key: "refund-item", name: "QA Erstattungs-Produkt", priceMinor: 6000, stock: 10 });
    const { admin, userId } = ctx;
    const { orderId } = await placeOrder(ctx, base, { idemSuffix: "refund" });
    const { data: order } = await admin.from("orders").select("total_minor").eq("id", orderId!).single();
    const amount = Math.floor(Number(order!.total_minor) / 2);
    const { data: refund, error } = await admin.rpc("refund_create" as never, {
      _org: base.organizationId, _order: orderId, _actor: userId, _amount_minor: amount,
      _reason: "QA-Teilerstattung", _idem: `qa-fixture:${base.manifest["run_ref"]}:refund`,
    } as never);
    if (error) throw new Error(error.message);
    await admin.rpc("refund_settle" as never, {
      _org: base.organizationId, _refund: (refund as unknown as { refund_id: string }).refund_id,
      _status: "completed", _provider: "mock",
    } as never);
    base.manifest["order_id"] = orderId;
  },

  mixed_tax_order: async (ctx, base) => {
    const { admin } = ctx;
    // Steuerklassen 19 % / 7 % anlegen und Produkte zuweisen
    const mkClass = async (code: string, name: string, bps: number) => {
      const { data: tc, error } = await admin
        .from("tax_classes")
        .insert({ organization_id: base.organizationId, shop_id: base.shopId, name, code, status: "active", metadata: { qa: QA_TAG } })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await admin.from("tax_rates").insert({
        organization_id: base.organizationId, shop_id: base.shopId, tax_class_id: tc.id,
        country_code: "DE", rate_basis_points: bps, status: "active", priority: 1,
      });
      return tc.id as string;
    };
    const standardId = await mkClass("standard", "Standard", 1900);
    const reducedId = await mkClass("reduced", "Ermäßigt", 700);
    await admin.from("tax_settings").insert({
      organization_id: base.organizationId, shop_id: base.shopId, calculation_mode: "gross",
      home_country_code: "DE", default_tax_class_id: standardId, prices_include_tax: true,
      display_prices_including_tax: true, metadata: { qa: QA_TAG },
    });
    await addProduct(ctx, base, { key: "taxed-19", name: "QA Standardsteuer-Produkt", priceMinor: 11900, stock: 10 });
    await addProduct(ctx, base, { key: "taxed-7", name: "QA Ermäßigt-Produkt (Lebensmittel)", priceMinor: 1070, stock: 10, blueprintKey: "lebensmittel", blueprintData: { inhalt: 500, einheit: "g", grundpreiseinheit: "100 g" } });
    await admin.from("products").update({ tax_class_id: reducedId }).eq("id", base.variants[1]!.productId);
    const { orderId } = await placeOrder(ctx, base, {
      items: [{ variantKey: "taxed-19", qty: 1 }, { variantKey: "taxed-7", qty: 2 }],
      idemSuffix: "mixed-tax",
    });
    base.manifest["order_id"] = orderId;
    base.manifest["note"] = "Bestellung mit 19 %- und 7 %-Positionen.";
  },

  partial_fulfillment: async (ctx, base) => {
    await addProduct(ctx, base, { key: "pf-a", name: "QA Teil-Fulfillment A", priceMinor: 3000, stock: 10 });
    await addProduct(ctx, base, { key: "pf-b", name: "QA Teil-Fulfillment B", priceMinor: 2000, stock: 10 });
    const { admin, userId } = ctx;
    const { orderId } = await placeOrder(ctx, base, {
      items: [{ variantKey: "pf-a", qty: 2 }, { variantKey: "pf-b", qty: 1 }],
      idemSuffix: "partial-ful",
    });
    const fulfillment = await import("../fulfillment/fulfillment.server");
    const { data: items } = await admin.from("order_items").select("id").eq("order_id", orderId!);
    await fulfillment.createFulfillment({
      organizationId: base.organizationId, shopId: base.shopId, orderId: orderId!,
      locationId: base.locationId, actorId: userId,
      items: [{ orderItemId: (items ?? [])[0]!.id as string, quantity: 1 }],
      idempotencyKey: `qa-fixture:${base.manifest["run_ref"]}:pf`,
    });
    base.manifest["order_id"] = orderId;
  },

  shipping_exception: async (ctx, base) => {
    await addProduct(ctx, base, { key: "ship-exc", name: "QA Versand-Produkt", priceMinor: 3990, stock: 10 });
    const { admin, userId } = ctx;
    const { orderId } = await placeOrder(ctx, base, { idemSuffix: "ship-exc" });
    const { shipmentId } = await shipOrder(ctx, base, orderId!, `qa-fixture:${base.manifest["run_ref"]}:se`);
    await admin.rpc("track_record_event" as never, {
      _org: base.organizationId, _shipment: shipmentId, _status: "exception",
      _description: "QA: Zustellung fehlgeschlagen, Empfänger nicht angetroffen.",
      _occurred_at: new Date().toISOString(), _actor: userId,
    } as never);
    base.manifest["order_id"] = orderId;
    base.manifest["shipment_id"] = shipmentId;
  },

  invoice_credit_note: async (ctx, base) => {
    await addProduct(ctx, base, { key: "inv-item", name: "QA Rechnungs-Produkt", priceMinor: 8990, stock: 10 });
    const { admin, userId } = ctx;
    const { orderId } = await placeOrder(ctx, base, { idemSuffix: "invoice" });
    const { data: invoice, error } = await admin.rpc("invoice_create_from_order" as never, {
      _org: base.organizationId, _order: orderId, _actor: userId, _idem: `qa-fixture:${base.manifest["run_ref"]}:inv`,
    } as never);
    if (error) throw new Error(error.message);
    const invoiceId = (invoice as unknown as { invoice_id: string }).invoice_id;
    await admin.rpc("invoice_issue" as never, {
      _org: base.organizationId, _invoice: invoiceId, _actor: userId, _idem: `qa-fixture:${base.manifest["run_ref"]}:issue`,
    } as never);
    const { data: cn, error: cnError } = await admin.rpc("credit_note_create" as never, {
      _org: base.organizationId, _invoice: invoiceId, _actor: userId, _idem: `qa-fixture:${base.manifest["run_ref"]}:cn`,
    } as never);
    if (cnError) throw new Error(cnError.message);
    base.manifest["order_id"] = orderId;
    base.manifest["invoice_id"] = invoiceId;
    base.manifest["credit_note_id"] = (cn as unknown as { credit_note_id?: string }).credit_note_id ?? null;
  },

  customer_portal: async (ctx, base) => {
    await addProduct(ctx, base, { key: "portal-item", name: "QA Portal-Produkt", priceMinor: 4500, stock: 10 });
    await addCustomer(ctx, base);
    const { orderId } = await placeOrder(ctx, base, { idemSuffix: "portal" });
    const customers = await import("../customers/customer.server");
  const token = await customers.issueGuestToken({
      organizationId: base.organizationId,
      shopId: base.shopId,
      orderId: orderId!,
      actorId: ctx.userId,
    });
    base.manifest["order_id"] = orderId;
    base.manifest["customer_id"] = base.customerId;
    base.manifest["guest_token"] = token ? "issued" : "failed";
  },

  return_full: async (ctx, base) => {
    await addProduct(ctx, base, { key: "ret-full", name: "QA Retouren-Produkt", priceMinor: 5500, stock: 10 });
    await addCustomer(ctx, base);
    const { orderId } = await placeOrder(ctx, base, { idemSuffix: "ret-full" });
    await shipOrder(ctx, base, orderId!, `qa-fixture:${base.manifest["run_ref"]}:rf`);
    const { admin, userId } = ctx;
    const { data: items } = await admin.from("order_items").select("id, quantity").eq("order_id", orderId!);
    const returns = await import("../returns/return.server");
    const ret = await returns.requestReturn({
      organizationId: base.organizationId, shopId: base.shopId, orderId: orderId!,
      customerId: base.customerId, actorId: userId,
      items: ((items ?? []) as { id: string; quantity: number }[]).map((i) => ({ orderItemId: i.id, quantity: i.quantity })),
      reason: "changed_mind", note: "QA Vollretoure", idempotencyKey: `qa-fixture:${base.manifest["run_ref"]}:ret-full`,
    });
    base.manifest["order_id"] = orderId;
    base.manifest["return_id"] = ret.return_id;
  },

  return_partial: async (ctx, base) => {
    await addProduct(ctx, base, { key: "ret-part", name: "QA Teilretouren-Produkt", priceMinor: 3500, stock: 10 });
    await addCustomer(ctx, base);
    const { orderId } = await placeOrder(ctx, base, { items: [{ variantKey: "ret-part", qty: 3 }], idemSuffix: "ret-part" });
    await shipOrder(ctx, base, orderId!, `qa-fixture:${base.manifest["run_ref"]}:rp`);
    const { admin, userId } = ctx;
    const { data: items } = await admin.from("order_items").select("id").eq("order_id", orderId!);
    const returns = await import("../returns/return.server");
    const ret = await returns.requestReturn({
      organizationId: base.organizationId, shopId: base.shopId, orderId: orderId!,
      customerId: base.customerId, actorId: userId,
      items: [{ orderItemId: (items ?? [])[0]!.id as string, quantity: 1 }],
      reason: "not_as_expected", note: "QA Teilretoure", idempotencyKey: `qa-fixture:${base.manifest["run_ref"]}:ret-part`,
    });
    base.manifest["order_id"] = orderId;
    base.manifest["return_id"] = ret.return_id;
  },

  communication_retry: async (ctx, base) => {
    await addProduct(ctx, base, { key: "comm-item", name: "QA Kommunikations-Produkt", priceMinor: 1000, stock: 5 });
    const { admin } = ctx;
    const { data, error } = await admin
      .from("communications")
      .insert({
        organization_id: base.organizationId,
        shop_id: base.shopId,
        channel: "email",
        recipient_type: "test",
        recipient_address: `qa-retry-${base.manifest["run_ref"]}@commerce-qa.test`,
        subject_snapshot: "QA Retry-Test",
        status: "failed",
        metadata: { qa: QA_TAG },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    base.manifest["communication_id"] = data.id;
  },

  automation_failure: async (ctx, base) => {
    const { admin } = ctx;
    const { data: rule, error } = await admin
      .from("automation_rules")
      .insert({
        organization_id: base.organizationId,
        shop_id: base.shopId,
        name: "QA Fehler-Regel",
        trigger_type: "manual",
        status: "active",
        trigger_config: { qa: QA_TAG },
        conditions: [],
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const { data: exec, error: execError } = await admin
      .from("automation_executions")
      .insert({
        organization_id: base.organizationId,
        shop_id: base.shopId,
        rule_id: rule.id,
        status: "failed",
        trigger_type: "manual",
        error: "QA: simulierter Ausführungsfehler",
      })
      .select("id")
      .single();
    if (execError) throw new Error(execError.message);
    base.manifest["rule_id"] = rule.id;
    base.manifest["execution_id"] = exec.id;
  },

  cross_tenant: async (ctx, base) => {
    await addProduct(ctx, base, { key: "ct-item", name: "QA Cross-Tenant-Produkt", priceMinor: 1234, stock: 7 });
    base.manifest["note"] = "Isolationstests laufen gegen diese Organisation und die Demo-Organisation.";
  },

  security_tokens: async (ctx, base) => {
    await addProduct(ctx, base, { key: "sec-item", name: "QA Security-Produkt", priceMinor: 100, stock: 3 });
    const { admin } = ctx;
    const { generateToken, hashToken } = await import("../core.server");
    const rawKey = `qa_pk_test_${generateToken().slice(0, 24)}`;
    const { data: keyRow, error } = await admin
      .from("store_api_keys")
      .insert({
        organization_id: base.organizationId,
        shop_id: base.shopId,
        name: "QA Test-Key",
        key_prefix: rawKey.slice(0, 16),
        key_hash: await hashToken(rawKey),
        environment: "test",
        status: "active",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    base.manifest["api_key_id"] = keyRow.id;
    base.manifest["note"] = "Test-API-Key (nur catalog:read, Test-Umgebung).";
  },

  backup_restore: async (ctx, base) => {
    await addProduct(ctx, base, { key: "backup-item", name: "QA Backup-Produkt", priceMinor: 777, stock: 7 });
    await addCustomer(ctx, base);
    const { orderId } = await placeOrder(ctx, base, { idemSuffix: "backup" });
    base.manifest["order_id"] = orderId;
    base.manifest["note"] = "Datensatz für Restore-Drills (Export/Import-Vergleich).";
  },

  large_dataset: async (ctx, base) => {
    for (let i = 1; i <= 20; i++) {
      await addProduct(ctx, base, {
        key: `bulk-${String(i).padStart(2, "0")}`,
        name: `QA Massenprodukt ${i}`,
        priceMinor: 500 + i * 100,
        stock: 20 + i,
      });
    }
    for (let i = 1; i <= 20; i++) {
      const variant = base.variants[(i - 1) % base.variants.length]!;
      await placeOrder(ctx, base, {
        items: [{ variantKey: variant.key, qty: 1 }],
        idemSuffix: `bulk-${i}`,
        email: `qa-bulk-${i}-${base.manifest["run_ref"]}@commerce-qa.test`,
      });
    }
    base.manifest["products"] = 20;
    base.manifest["orders"] = 20;
  },

  mobile_ui_full: async (ctx, base) => {
    await addProduct(ctx, base, {
      key: "long-name",
      name: "QA Produkt mit extrem langem Namen zur Prüfung von Zeilenumbrüchen und abgeschnittenen Texten in der mobilen Ansicht",
      priceMinor: 999999,
      stock: 9999,
    });
    await addProduct(ctx, base, { key: "no-image", name: "QA Produkt ohne Bild", priceMinor: 1, stock: 0 });
    await addProduct(ctx, base, { key: "special-chars", name: "QA Produkt „Sonderzeichen“ & <Emojis> äöü", priceMinor: 50, stock: 5 });
    base.manifest["note"] = "Kantfälle: lange Namen, hohe Preise, kein Bild, Sonderzeichen, Bestand 0.";
  },
};

/* ------------------------------------------------------------------ */
/* Öffentliche API                                                     */
/* ------------------------------------------------------------------ */

export async function createQaFixture(
  ctx: FixtureCtx,
  scenario: QaScenario,
): Promise<QaFixtureInfo> {
  await assertNotProduction(ctx.admin);
  const runRef = Math.random().toString(36).slice(2, 8);
  const base = await createBaseOrg(ctx, scenario, runRef);
  await assertNotProduction(ctx.admin, { organizationId: base.organizationId });

  await builders[scenario](ctx, base);

  const { data: fixture, error } = await ctx.admin
    .from("qa_fixtures")
    .insert({
      organization_id: base.organizationId,
      shop_id: base.shopId,
      scenario,
      run_ref: runRef,
      status: "active",
      manifest: base.manifest as never,
    })
    .select("id, created_at")
    .single();
  if (error) throw new Error(error.message);

  await writeAudit({
    organizationId: base.organizationId,
    actorId: ctx.userId,
    actorEmail: ctx.email,
    action: "qa.fixture.created",
    entityType: "qa_fixture",
    entityId: fixture.id,
    metadata: { scenario, run_ref: runRef },
  });

  return {
    id: fixture.id as string,
    organizationId: base.organizationId,
    organizationName: `${QA_ORG_PREFIX}${scenario} ${runRef}`,
    scenario,
    runRef,
    status: "active",
    manifest: base.manifest,
    residualNotes: null,
    createdAt: fixture.created_at as string,
    destroyedAt: null,
  };
}

export async function listQaFixtures(ctx: FixtureCtx): Promise<QaFixtureInfo[]> {
  const { admin, userId } = ctx;
  const { data: memberships } = await admin
    .from("memberships")
    .select("organization_id")
    .eq("user_id", userId);
  const orgIds = (memberships ?? []).map((m: { organization_id: string }) => m.organization_id);
  if (!orgIds.length) return [];
  const { data } = await admin
    .from("qa_fixtures")
    .select("id, organization_id, scenario, run_ref, status, manifest, residual_notes, created_at, destroyed_at")
    .in("organization_id", orgIds)
    .order("created_at", { ascending: false });
  const { data: orgs } = await admin.from("organizations").select("id, name").in("id", orgIds);
  const nameById = new Map((orgs ?? []).map((o: { id: string; name: string }) => [o.id, o.name]));
  return (data ?? []).map((f: Record<string, unknown>) => ({
    id: f["id"] as string,
    organizationId: f["organization_id"] as string,
    organizationName: nameById.get(f["organization_id"] as string) ?? "QA-Organisation",
    scenario: f["scenario"] as QaScenario,
    runRef: f["run_ref"] as string,
    status: f["status"] as string,
    manifest: (f["manifest"] as Record<string, unknown>) ?? {},
    residualNotes: (f["residual_notes"] as string) ?? null,
    createdAt: f["created_at"] as string,
    destroyedAt: (f["destroyed_at"] as string) ?? null,
  }));
}

export async function destroyQaFixture(
  ctx: FixtureCtx,
  fixtureId: string,
): Promise<{ detail: string; residual: string[] }> {
  const { admin, userId } = ctx;
  const { data: fixture, error } = await admin
    .from("qa_fixtures")
    .select("id, organization_id, scenario, run_ref, status")
    .eq("id", fixtureId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!fixture) throw new Error("Fixture nicht gefunden.");
  if (fixture.status === "destroyed") return { detail: "Fixture war bereits zerstört.", residual: [] };

  // Mitgliedschaft prüfen (zerstören darf nur, wer die Org besitzt)
  const { data: membership } = await admin
    .from("memberships")
    .select("role")
    .eq("organization_id", fixture.organization_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) throw new Error("Keine Berechtigung für diese Fixture.");

  const orgId = fixture.organization_id as string;
  const residual: string[] = [];

  for (const bucket of ["media", "documents", "shipping-labels"]) {
    try {
      const { data: files } = await admin.storage.from(bucket).list(orgId, { limit: 1000 });
      const paths = (files ?? [])
        .filter((f: { name: string }) => f.name)
        .map((f: { name: string }) => `${orgId}/${f.name}`);
      if (paths.length) await admin.storage.from(bucket).remove(paths);
    } catch (e) {
      residual.push(`${bucket}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await admin.from("payment_events").delete().eq("organization_id", orgId);
  const { error: deleteError } = await admin.from("organizations").delete().eq("id", orgId);
  if (deleteError) throw new Error(`Zerstörung fehlgeschlagen: ${deleteError.message}`);

  // Restprüfung: es darf keine Zeile mit dieser organization_id mehr geben
  const restTables = ["shops", "products", "orders", "customers", "carts", "inventory_items"];
  for (const table of restTables) {
    const { count } = (await admin
      .from(table as never)
      .select("id", { count: "exact", head: true })
      .eq("organization_id" as never, orgId)) as unknown as { count: number | null };
    if (Number(count ?? 0) > 0) residual.push(`${table}: ${count} Zeilen verblieben`);
  }

  await admin
    .from("qa_fixtures")
    .update({
      status: "destroyed",
      destroyed_at: new Date().toISOString(),
      residual_notes: residual.length ? residual.join("; ") : null,
    })
    .eq("id", fixtureId);

  return {
    detail: residual.length
      ? `Fixture zerstört, Reste: ${residual.join("; ")}`
      : "Fixture vollständig zerstört (Organisation kaskadiert gelöscht).",
    residual,
  };
}
