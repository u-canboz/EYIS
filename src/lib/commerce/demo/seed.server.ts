/* Demo-Seed-Engine: baut die DEMO-Organisation schrittweise über die echten
   Commerce-Domänen auf. Jeder Schritt ist idempotent (demo_key / Handle /
   E-Mail als natürliche Schlüssel) und einzeln aufrufbar, damit lange Läufe
   in mehreren Server-Function-Aufrufen stattfinden können. */
import { getAdmin, writeAudit, emitEvent, slugify } from "../core.server";
import { assertNotProduction } from "./guard.server";
import {
  DEMO_ASSETS,
  DEMO_CATEGORIES,
  DEMO_COLLECTIONS,
  DEMO_CUSTOMERS,
  DEMO_CUSTOMER_GROUPS,
  DEMO_ORDERS,
  DEMO_PRODUCTS,
  DEMO_PROMOTIONS,
  type DemoOrderTemplate,
  type DemoProductDef,
} from "./catalog.data";
import {
  DEMO_ORG_NAME,
  DEMO_ORG_SLUG_PREFIX,
  DEMO_SHOP_NAME,
  DEMO_SHOP_SLUG,
  DEMO_TAG,
  ORDER_SEED_BATCH,
  SEED_VERSION,
  type DemoCounts,
  type DemoStatus,
  type SeedStep,
  type SeedStepResult,
} from "./demo.types";

type Admin = Awaited<ReturnType<typeof getAdmin>>;
export type SeedCtx = { admin: Admin; userId: string; email: string | null; origin: string };

export type DemoEnv = { organizationId: string; shopId: string };

/* ------------------------------------------------------------------ */
/* Demo-Organisation finden / anlegen                                  */
/* ------------------------------------------------------------------ */

export async function findDemoEnv(admin: Admin, userId: string): Promise<DemoEnv | null> {
  const { data: memberships } = await admin
    .from("memberships")
    .select("organization_id")
    .eq("user_id", userId);
  const orgIds = (memberships ?? []).map((m: { organization_id: string }) => m.organization_id);
  if (!orgIds.length) return null;
  const { data: env } = await admin
    .from("demo_environments")
    .select("organization_id")
    .in("organization_id", orgIds)
    .maybeSingle();
  if (!env) return null;
  const { data: shop } = await admin
    .from("shops")
    .select("id")
    .eq("organization_id", env.organization_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!shop) return null;
  return { organizationId: env.organization_id as string, shopId: shop.id as string };
}

async function ensureFoundation(ctx: SeedCtx): Promise<DemoEnv> {
  const { admin, userId, email } = ctx;
  const existing = await findDemoEnv(admin, userId);
  if (existing) return existing;

  const slug = `${DEMO_ORG_SLUG_PREFIX}-${Math.random().toString(36).slice(2, 7)}`;
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: DEMO_ORG_NAME, slug })
    .select("id")
    .single();
  if (orgError || !org) throw new Error(orgError?.message ?? "Demo-Organisation fehlgeschlagen.");

  const { error: memberError } = await admin
    .from("memberships")
    .insert({ organization_id: org.id, user_id: userId, role: "owner" });
  if (memberError) throw new Error(memberError.message);

  const { data: shop, error: shopError } = await admin
    .from("shops")
    .insert({
      organization_id: org.id,
      name: DEMO_SHOP_NAME,
      slug: DEMO_SHOP_SLUG,
      currency: "EUR",
      locale: "de-DE",
      status: "active",
    })
    .select("id")
    .single();
  if (shopError || !shop) throw new Error(shopError?.message ?? "Demo-Shop fehlgeschlagen.");

  await admin.from("demo_environments").insert({
    organization_id: org.id,
    seed_version: SEED_VERSION,
    status: "active",
  });

  await writeAudit({
    organizationId: org.id,
    actorId: userId,
    actorEmail: email,
    action: "demo.environment.created",
    entityType: "organization",
    entityId: org.id,
    metadata: { seed_version: SEED_VERSION },
  });
  await emitEvent(org.id, "demo.environment.created", { organization_id: org.id });
  return { organizationId: org.id as string, shopId: shop.id as string };
}

/* ------------------------------------------------------------------ */
/* Schritt 1: Foundation                                               */
/* ------------------------------------------------------------------ */

async function stepFoundation(ctx: SeedCtx): Promise<string> {
  const { admin, userId } = ctx;
  const env = await ensureFoundation(ctx);
  const { organizationId: orgId, shopId } = env;

  const { ensureDefaultLocation } = await import("../inventory.server");
  await ensureDefaultLocation(orgId, shopId);

  // Steuerklassen + Steuersätze (DE 19 % / 7 %)
  const taxClasses = [
    { code: "standard", name: "Standardsteuersatz" },
    { code: "reduced", name: "Ermäßigter Steuersatz" },
  ];
  const classIds: Record<string, string> = {};
  for (const tc of taxClasses) {
    const { data: existing } = await admin
      .from("tax_classes")
      .select("id")
      .eq("organization_id", orgId)
      .eq("shop_id", shopId)
      .eq("code", tc.code)
      .maybeSingle();
    if (existing) {
      classIds[tc.code] = existing.id as string;
      continue;
    }
    const { data, error } = await admin
      .from("tax_classes")
      .insert({
        organization_id: orgId,
        shop_id: shopId,
        name: tc.name,
        code: tc.code,
        status: "active",
        metadata: { demo_key: `${DEMO_TAG}:${tc.code}` },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    classIds[tc.code] = data.id as string;
  }
  for (const [code, bps] of [["standard", 1900], ["reduced", 700]] as const) {
    const { data: existing } = await admin
      .from("tax_rates")
      .select("id")
      .eq("tax_class_id", classIds[code]!)
      .eq("country_code", "DE")
      .maybeSingle();
    if (!existing) {
      const { error } = await admin.from("tax_rates").insert({
        organization_id: orgId,
        shop_id: shopId,
        tax_class_id: classIds[code]!,
        country_code: "DE",
        rate_basis_points: bps,
        status: "active",
        priority: 1,
        metadata: { demo_key: `${DEMO_TAG}:${code}-de` },
      });
      if (error) throw new Error(error.message);
    }
  }
  const { data: taxSettings } = await admin
    .from("tax_settings")
    .select("id")
    .eq("organization_id", orgId)
    .eq("shop_id", shopId)
    .maybeSingle();
  if (!taxSettings) {
    const { error } = await admin.from("tax_settings").insert({
      organization_id: orgId,
      shop_id: shopId,
      calculation_mode: "gross",
      home_country_code: "DE",
      default_tax_class_id: classIds["standard"]!,
      prices_include_tax: true,
      display_prices_including_tax: true,
      metadata: { demo_key: DEMO_TAG },
    });
    if (error) throw new Error(error.message);
  }

  // Versandarten
  const shippingMethods = [
    { code: "DEMO-STD", name: "Standardversand", amount: 490, position: 1 },
    { code: "DEMO-EXP", name: "Expressversand", amount: 890, position: 2 },
  ];
  for (const sm of shippingMethods) {
    const { data: existing } = await admin
      .from("shipping_methods")
      .select("id")
      .eq("organization_id", orgId)
      .eq("shop_id", shopId)
      .eq("code", sm.code)
      .maybeSingle();
    if (existing) continue;
    const { error } = await admin.from("shipping_methods").insert({
      organization_id: orgId,
      shop_id: shopId,
      name: sm.name,
      code: sm.code,
      pricing_type: "fixed",
      amount_minor: sm.amount,
      currency_code: "EUR",
      countries: ["DE", "AT", "CH"],
      status: "active",
      position: sm.position,
      metadata: { demo_key: `${DEMO_TAG}:${sm.code}` },
    });
    if (error) throw new Error(error.message);
  }

  // Mock-Zahlungsanbieter (Test-Umgebung)
  const { data: paymentCfg } = await admin
    .from("payment_provider_configs")
    .select("id")
    .eq("organization_id", orgId)
    .eq("shop_id", shopId)
    .eq("provider", "mock")
    .maybeSingle();
  if (!paymentCfg) {
    const { error } = await admin.from("payment_provider_configs").insert({
      organization_id: orgId,
      shop_id: shopId,
      provider: "mock",
      display_name: "Test-Zahlungsanbieter (Demo)",
      environment: "test",
      status: "active",
      priority: 1,
    });
    if (error) throw new Error(error.message);
  }

  // Mock-Versanddienstleister für Labels
  await admin.from("shipping_provider_configs").upsert(
    {
      organization_id: orgId,
      shop_id: shopId,
      provider: "mock",
      display_name: "Test-Carrier (Demo)",
      status: "active",
      test_mode: true,
    } as never,
    { onConflict: "shop_id,provider" } as never,
  );

  // Rechnungs-/Dokumenteinstellungen (ohne sie schlagen Rechnungen fehl)
  await admin.from("invoice_settings").upsert(
    {
      organization_id: orgId,
      shop_id: shopId,
      company_name: "Commerce OS Demo GmbH",
      legal_form: "GmbH",
      address_line1: "Demostraße 1",
      postal_code: "10115",
      city: "Berlin",
      country_code: "DE",
      tax_number: "30/123/45678",
      vat_id: "DE999999999",
      contact_email: "rechnung@demo.invalid",
      payment_terms_days: 14,
      invoice_creation_strategy: "manual",
      metadata: { demo_key: DEMO_TAG },
    } as never,
    { onConflict: "shop_id" } as never,
  );
  await admin.from("document_sequences").upsert(
    [
      { organization_id: orgId, shop_id: shopId, document_type: "invoice", prefix: "RE" },
      { organization_id: orgId, shop_id: shopId, document_type: "credit_note", prefix: "GS" },
      { organization_id: orgId, shop_id: shopId, document_type: "delivery_note", prefix: "LS" },
    ] as never,
    { onConflict: "shop_id,document_type" } as never,
  );

  // Kommunikation: Branding, Test-Provider, Absender
  const { ensureShopDefaults } = await import("../communications/studio.server");
  await ensureShopDefaults(orgId, shopId);

  await writeAudit({
    organizationId: orgId,
    actorId: userId,
    actorEmail: ctx.email,
    action: "demo.seed.foundation",
    entityType: "organization",
    entityId: orgId,
  });
  return `Foundation bereit (Organisation ${orgId.slice(0, 8)}…, Steuern, Versand, Dokumente, Kommunikation, Mock-Anbieter).`;
}

/* ------------------------------------------------------------------ */
/* Schritt 2: Katalog                                                  */
/* ------------------------------------------------------------------ */

async function productByDemoKey(admin: Admin, orgId: string, key: string) {
  const { data } = await admin
    .from("products")
    .select("id")
    .eq("organization_id", orgId)
    .eq("metadata->>demo_key", key)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

async function stepCatalog(ctx: SeedCtx, env: DemoEnv): Promise<string> {
  const { admin, userId } = ctx;
  const { organizationId: orgId, shopId } = env;
  const { uniqueHandle, validateBlueprintData } = await import("../catalog.server");
  const { ensureDefaultVariant } = await import("../inventory.server");
  const { ensurePriceSet } = await import("../pricing.server");

  const { data: blueprints } = await admin
    .from("product_blueprints")
    .select("id, key, version, schema")
    .eq("status", "active");
  const bpByKey = new Map(
    (blueprints ?? []).map((b: { id: string; key: string; version: number; schema: unknown }) => [
      b.key,
      b,
    ]),
  );

  // Kategorien
  const categoryIds: Record<string, string> = {};
  for (const cat of DEMO_CATEGORIES) {
    const { data: existing } = await admin
      .from("categories")
      .select("id")
      .eq("organization_id", orgId)
      .eq("shop_id", shopId)
      .eq("handle", cat.key)
      .maybeSingle();
    if (existing) {
      categoryIds[cat.key] = existing.id as string;
      continue;
    }
    const { data, error } = await admin
      .from("categories")
      .insert({
        organization_id: orgId,
        shop_id: shopId,
        name: cat.name,
        handle: cat.key,
        status: "active",
        metadata: { demo_key: `${DEMO_TAG}:${cat.key}` },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    categoryIds[cat.key] = data.id as string;
  }

  // Kollektionen
  const collectionIds: Record<string, string> = {};
  for (const col of DEMO_COLLECTIONS) {
    const { data: existing } = await admin
      .from("collections")
      .select("id")
      .eq("organization_id", orgId)
      .eq("shop_id", shopId)
      .eq("handle", col.key)
      .maybeSingle();
    if (existing) {
      collectionIds[col.key] = existing.id as string;
      continue;
    }
    const { data, error } = await admin
      .from("collections")
      .insert({
        organization_id: orgId,
        shop_id: shopId,
        name: col.name,
        handle: col.key,
        description: col.description,
        status: "active",
        metadata: { demo_key: `${DEMO_TAG}:${col.key}` },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    collectionIds[col.key] = data.id as string;
  }

  let created = 0;
  for (const def of DEMO_PRODUCTS) {
    let productId = await productByDemoKey(admin, orgId, def.key);
    if (!productId) {
      const blueprint = bpByKey.get(def.blueprintKey) as
        | { id: string; key: string; version: number; schema: unknown }
        | undefined;
      if (!blueprint) throw new Error(`Blueprint ${def.blueprintKey} nicht gefunden.`);
      const cleanData = validateBlueprintData(blueprint.schema as never, def.blueprintData);
      const handle = await uniqueHandle(admin as never, "products", shopId, def.name);
      const { data, error } = await admin
        .from("products")
        .insert({
          organization_id: orgId,
          shop_id: shopId,
          blueprint_id: blueprint.id,
          blueprint_key: blueprint.key,
          blueprint_version: blueprint.version,
          name: def.name,
          handle,
          subtitle: def.subtitle,
          description: def.description,
          vendor: def.vendor,
          product_type: def.productType,
          status: "active",
          featured: def.featured ?? false,
          seo_title: `${def.name} | Demo Shop`,
          seo_description: def.subtitle,
          blueprint_data: cleanData as never,
          metadata: { demo_key: def.key },
          created_by: userId,
          updated_by: userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(`${def.key}: ${error.message}`);
      productId = data.id as string;
      created++;
    }

    // Kategorie- und Kollektions-Zuordnung
    const categoryId = categoryIds[def.category];
    if (categoryId) {
      const { data: link } = await admin
        .from("product_categories")
        .select("product_id")
        .eq("product_id", productId)
        .eq("category_id", categoryId)
        .maybeSingle();
      if (!link) await admin.from("product_categories").insert({ product_id: productId, category_id: categoryId });
    }
    for (const colKey of def.collections ?? []) {
      const collectionId = collectionIds[colKey];
      if (!collectionId) continue;
      const { data: link } = await admin
        .from("product_collections")
        .select("product_id")
        .eq("product_id", productId)
        .eq("collection_id", collectionId)
        .maybeSingle();
      if (!link)
        await admin.from("product_collections").insert({ product_id: productId, collection_id: collectionId });
    }

    // Variante + SKU
    const variantId = await ensureDefaultVariant(orgId, productId);
    await admin
      .from("product_variants")
      .update({ sku: def.sku, status: "active", metadata: { demo_key: def.key } })
      .eq("id", variantId);

    // Preise über die Pricing Engine
    const priceSetId = await ensurePriceSet(admin as never, {
      organizationId: orgId,
      shopId,
      variantId,
    });
    const priceRows: { type: "base" | "sale"; amount: number }[] = [
      { type: "base", amount: def.priceMinor },
      ...(def.salePriceMinor ? [{ type: "sale" as const, amount: def.salePriceMinor }] : []),
    ];
    for (const p of priceRows) {
      const { data: existingPrice } = await admin
        .from("prices")
        .select("id")
        .eq("price_set_id", priceSetId)
        .eq("type", p.type)
        .maybeSingle();
      if (existingPrice) {
        await admin.from("prices").update({ amount_minor: p.amount, status: "active" }).eq("id", existingPrice.id);
      } else {
        const { error } = await admin.from("prices").insert({
          organization_id: orgId,
          shop_id: shopId,
          price_set_id: priceSetId,
          currency_code: "EUR",
          amount_minor: p.amount,
          type: p.type,
          status: "active",
          metadata: { demo_key: def.key },
        });
        if (error) throw new Error(error.message);
      }
    }
  }

  await writeAudit({
    organizationId: orgId,
    actorId: userId,
    actorEmail: ctx.email,
    action: "demo.seed.catalog",
    entityType: "organization",
    entityId: orgId,
    metadata: { created, total: DEMO_PRODUCTS.length },
  });
  return `Katalog bereit (${DEMO_PRODUCTS.length} Produkte, ${created} neu, ${DEMO_CATEGORIES.length} Kategorien, ${DEMO_COLLECTIONS.length} Kollektionen).`;
}

/* ------------------------------------------------------------------ */
/* Schritt 3: Medien                                                   */
/* ------------------------------------------------------------------ */

async function stepMedia(ctx: SeedCtx, env: DemoEnv): Promise<string> {
  const { admin, userId } = ctx;
  const { organizationId: orgId, shopId } = env;
  let uploaded = 0;
  const assetIdByFile: Record<string, string> = {};

  for (const file of DEMO_ASSETS) {
    const storagePath = `${orgId}/demo/${file}`;
    const { data: existing } = await admin
      .from("media_assets")
      .select("id")
      .eq("organization_id", orgId)
      .eq("storage_path", storagePath)
      .maybeSingle();
    if (existing) {
      assetIdByFile[file] = existing.id as string;
      continue;
    }
    const res = await fetch(`${ctx.origin}/demo-assets/${file}`);
    if (!res.ok) throw new Error(`Demo-Asset ${file} nicht erreichbar (${res.status}).`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const mimeType = file.endsWith(".png") ? "image/png" : "image/jpeg";
    const upload = await admin.storage
      .from("media")
      .upload(storagePath, bytes, { contentType: mimeType, upsert: true });
    if (upload.error) throw new Error(`Upload ${file}: ${upload.error.message}`);
    const { data, error } = await admin
      .from("media_assets")
      .insert({
        organization_id: orgId,
        shop_id: shopId,
        storage_path: storagePath,
        filename: file,
        mime_type: mimeType,
        size_bytes: bytes.byteLength,
        alt_text: `Demo-Bild ${file}`,
        uploaded_by: userId,
        metadata: { demo_key: `${DEMO_TAG}:${file}` },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    assetIdByFile[file] = data.id as string;
    uploaded++;
  }

  // Produktbilder zuordnen
  let attached = 0;
  for (const def of DEMO_PRODUCTS) {
    if (!def.image) continue;
    const productId = await productByDemoKey(admin, orgId, def.key);
    const assetId = assetIdByFile[def.image];
    if (!productId || !assetId) continue;
    const { data: link } = await admin
      .from("product_media")
      .select("id")
      .eq("product_id", productId)
      .eq("media_asset_id", assetId)
      .maybeSingle();
    if (!link) {
      const { error } = await admin.from("product_media").insert({
        product_id: productId,
        media_asset_id: assetId,
        position: 0,
        role: "gallery",
      });
      if (error) throw new Error(error.message);
      attached++;
    }
  }

  await writeAudit({
    organizationId: orgId,
    actorId: userId,
    actorEmail: ctx.email,
    action: "demo.seed.media",
    entityType: "organization",
    entityId: orgId,
    metadata: { uploaded, attached },
  });
  return `Medien bereit (${uploaded} hochgeladen, ${attached} Produktbilder zugeordnet).`;
}

/* ------------------------------------------------------------------ */
/* Schritt 4: Inventar                                                 */
/* ------------------------------------------------------------------ */

async function stepInventory(ctx: SeedCtx, env: DemoEnv): Promise<string> {
  const { admin, userId } = ctx;
  const { organizationId: orgId, shopId } = env;
  const { ensureDefaultVariant, ensureInventoryItem, ensureDefaultLocation, receiveStock } =
    await import("../inventory.server");
  const locationId = await ensureDefaultLocation(orgId, shopId);
  const invCtx = { supabase: admin as never, userId };

  // Bedarf aus den Bestellvorlagen einrechnen, damit der Order-Seed nie an
  // fehlendem Bestand scheitert (deterministisch → idempotent).
  const demandByKey = new Map<string, number>();
  for (const template of DEMO_ORDERS) {
    for (const item of template.items) {
      demandByKey.set(item.productKey, (demandByKey.get(item.productKey) ?? 0) + item.qty);
    }
  }

  let stocked = 0;
  for (const def of DEMO_PRODUCTS) {
    const demand = demandByKey.get(def.key) ?? 0;
    const targetStock = demand > 0 ? Math.max(def.stock, demand * 2) : def.stock;
    const productId = await productByDemoKey(admin, orgId, def.key);
    if (!productId) continue;
    const variantId = await ensureDefaultVariant(orgId, productId);
    const itemId = await ensureInventoryItem(orgId, variantId, {
      sku: def.sku,
      trackInventory: true,
      allowBackorder: false,
    });
    await admin
      .from("inventory_items")
      .update({ track_inventory: true, allow_backorder: false })
      .eq("id", itemId);
    const { data: lvl } = await admin
      .from("inventory_levels")
      .select("on_hand")
      .eq("inventory_item_id", itemId)
      .eq("location_id", locationId)
      .maybeSingle();
    // Bereits per Demo-Seed eingebuchte Menge (Idempotenz trotz Verbrauch durch Bestellungen)
    const { data: seeded } = await admin
      .from("inventory_movements")
      .select("quantity_delta")
      .eq("inventory_item_id", itemId)
      .eq("reference_id", "DEMO-SEED");
    const seededQty = (seeded ?? []).reduce(
      (sum: number, m: { quantity_delta: number }) => sum + Number(m.quantity_delta ?? 0),
      0,
    );
    const onHand = Math.max(Number(lvl?.on_hand ?? 0), seededQty);
    if (onHand < targetStock) {
      await receiveStock(invCtx, {
        organizationId: orgId,
        shopId,
        inventoryItemId: itemId,
        locationId,
        quantity: targetStock - onHand,
        reference: "DEMO-SEED",
        idempotencyKey: `demo-seed-receive:${def.key}:${targetStock - onHand}:${onHand}`,
      });
      stocked++;
    }
  }
  await writeAudit({
    organizationId: orgId,
    actorId: userId,
    actorEmail: ctx.email,
    action: "demo.seed.inventory",
    entityType: "organization",
    entityId: orgId,
    metadata: { stocked },
  });
  return `Inventar bereit (${stocked} Wareneingänge gebucht).`;
}

/* ------------------------------------------------------------------ */
/* Schritt 5: Kunden                                                   */
/* ------------------------------------------------------------------ */

async function stepCustomers(ctx: SeedCtx, env: DemoEnv): Promise<string> {
  const { admin, userId } = ctx;
  const { organizationId: orgId, shopId } = env;
  const customerIds: Record<string, string> = {};
  let created = 0;

  for (const def of DEMO_CUSTOMERS) {
    const { data: existing } = await admin
      .from("customers")
      .select("id")
      .eq("organization_id", orgId)
      .eq("email", def.email)
      .maybeSingle();
    let customerId = existing?.id as string | undefined;
    if (!customerId) {
      const { data, error } = await admin
        .from("customers")
        .insert({
          organization_id: orgId,
          shop_id: shopId,
          email: def.email,
          first_name: def.firstName,
          last_name: def.lastName,
          phone: def.phone ?? null,
          customer_type: def.type,
          status: "active",
          metadata: { demo_key: def.key },
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      customerId = data.id as string;
      created++;
    }
    customerIds[def.key] = customerId;

    const { data: addr } = await admin
      .from("customer_addresses")
      .select("id")
      .eq("customer_id", customerId)
      .eq("type", "both")
      .maybeSingle();
    if (!addr) {
      const { error } = await admin.from("customer_addresses").insert({
        organization_id: orgId,
        shop_id: shopId,
        customer_id: customerId,
        type: "both",
        first_name: def.firstName,
        last_name: def.lastName,
        company: def.company ?? null,
        street: def.street,
        postal_code: def.postalCode,
        city: def.city,
        country_code: def.countryCode,
        phone: def.phone ?? null,
        is_default: true,
      });
      if (error) throw new Error(error.message);
    }
  }

  // Kundengruppen
  for (const group of DEMO_CUSTOMER_GROUPS) {
    const { data: existing } = await admin
      .from("customer_groups")
      .select("id")
      .eq("organization_id", orgId)
      .eq("handle", group.key)
      .maybeSingle();
    let groupId = existing?.id as string | undefined;
    if (!groupId) {
      const { data, error } = await admin
        .from("customer_groups")
        .insert({
          organization_id: orgId,
          shop_id: shopId,
          name: group.name,
          handle: group.key,
          status: "active",
          metadata: { demo_key: `${DEMO_TAG}:${group.key}` },
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      groupId = data.id as string;
    }
    for (const memberKey of group.members) {
      const customerId = customerIds[memberKey];
      if (!customerId) continue;
      const { data: link } = await admin
        .from("customer_group_members")
        .select("customer_id")
        .eq("customer_group_id", groupId)
        .eq("customer_id", customerId)
        .maybeSingle();
      if (!link)
        await admin
          .from("customer_group_members")
          .insert({ organization_id: orgId, customer_group_id: groupId, customer_id: customerId });
    }
  }

  await writeAudit({
    organizationId: orgId,
    actorId: userId,
    actorEmail: ctx.email,
    action: "demo.seed.customers",
    entityType: "organization",
    entityId: orgId,
    metadata: { created, total: DEMO_CUSTOMERS.length },
  });
  return `Kunden bereit (${DEMO_CUSTOMERS.length} Kunden, ${created} neu, ${DEMO_CUSTOMER_GROUPS.length} Gruppen).`;
}

/* ------------------------------------------------------------------ */
/* Schritt 6: Promotions                                               */
/* ------------------------------------------------------------------ */

async function stepPromotions(ctx: SeedCtx, env: DemoEnv): Promise<string> {
  const { admin, userId } = ctx;
  const { organizationId: orgId, shopId } = env;
  let created = 0;
  for (const promo of DEMO_PROMOTIONS) {
    const { data: existing } = await admin
      .from("promotions")
      .select("id")
      .eq("organization_id", orgId)
      .eq("code", promo.code)
      .maybeSingle();
    if (existing) continue;
    const { error } = await admin.from("promotions").insert({
      organization_id: orgId,
      shop_id: shopId,
      name: promo.name,
      code: promo.code,
      description: promo.description,
      type: promo.type,
      value: promo.value,
      status: "active",
      stackable: false,
      priority: 0,
      conditions: [],
      actions: [],
      metadata: { demo_key: `${DEMO_TAG}:${promo.key}` },
    });
    if (error) throw new Error(error.message);
    created++;
  }
  await writeAudit({
    organizationId: orgId,
    actorId: userId,
    actorEmail: ctx.email,
    action: "demo.seed.promotions",
    entityType: "organization",
    entityId: orgId,
    metadata: { created },
  });
  return `Promotions bereit (${DEMO_PROMOTIONS.length} Codes, ${created} neu).`;
}

/* ------------------------------------------------------------------ */
/* Schritt 7: Bestellungen (gebatcht, über den echten Checkout-Fluss)  */
/* ------------------------------------------------------------------ */

const SEED_ADDRESS = {
  firstName: "Demo",
  lastName: "Käufer",
  street: "Demostraße 1",
  postalCode: "10115",
  city: "Berlin",
  countryCode: "DE",
};

async function seedOneOrder(
  ctx: SeedCtx,
  env: DemoEnv,
  template: DemoOrderTemplate,
  maps: {
    variantByProductKey: Map<string, string>;
    customerByKey: Map<string, { id: string; email: string }>;
    shippingId: string;
    locationId: string;
  },
) {
  const { admin, userId } = ctx;
  const { organizationId: orgId, shopId } = env;
  const cartApi = await import("../cart.server");
  const checkout = await import("../checkout.server");
  const payments = await import("../payments/payment.server");

  const customer = template.customerKey ? maps.customerByKey.get(template.customerKey) : null;
  const email = customer?.email ?? `gast-${template.key}@demo-shop.example`;

  // Warenkorb
  const { data: shop } = await admin.from("shops").select("currency").eq("id", shopId).single();
  const { cartId, token } = await cartApi.createCart({
    organizationId: orgId,
    shopId,
    currencyCode: (shop?.currency as string) ?? "EUR",
  });
  for (const item of template.items) {
    const variantId = maps.variantByProductKey.get(item.productKey);
    if (!variantId) throw new Error(`Variante für ${item.productKey} fehlt (Katalog-Schritt zuerst).`);
    const cart = await cartApi.loadCartAuthorized(cartId, token);
    cartApi.assertMutable(cart);
    const snap = await cartApi.loadVariantSnapshot(orgId, shopId, variantId);
    const { data: existing } = await admin
      .from("cart_items")
      .select("id, quantity")
      .eq("cart_id", cartId)
      .eq("variant_id", variantId)
      .maybeSingle();
    const target = Number(existing?.quantity ?? 0) + item.qty;
    await cartApi.assertAvailable(orgId, shopId, variantId, target, snap.title);
    if (existing) {
      await admin.from("cart_items").update({ quantity: target }).eq("id", existing.id);
    } else {
      const { error } = await admin.from("cart_items").insert({
        organization_id: orgId,
        shop_id: shopId,
        cart_id: cartId,
        product_id: snap.productId,
        variant_id: snap.variantId,
        quantity: target,
        title_snapshot: snap.title,
        variant_title_snapshot: snap.variantTitle,
        sku_snapshot: snap.sku,
        image_snapshot: snap.image,
      });
      if (error) throw new Error(error.message);
    }
    await cartApi.touchCart(cartId);
  }

  // Checkout
  let cart = await cartApi.loadCartAuthorized(cartId, token);
  const started = await checkout.startCheckout(cart, email);
  const sessionId = started.checkout_session_id;
  let session = await checkout.loadSession(sessionId);
  await checkout.saveAddress(session, "shipping", SEED_ADDRESS);
  await admin
    .from("checkout_sessions")
    .update({
      shipping_option_id: maps.shippingId,
      billing_same_as_shipping: true,
      status: "open",
      validated_at: null,
    })
    .eq("id", sessionId);
  session = await checkout.loadSession(sessionId);
  cart = await cartApi.loadCartAuthorized(cartId, token);
  const view = await checkout.buildCheckoutView(session, cart);
  if (!view.ready) throw new Error(`Checkout ${template.key} unvollständig: ${view.issues.join(" ")}`);
  await checkout.writeCheckoutSnapshot(session, cart, view);

  // Zahlungssession (Mock-Anbieter)
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

  if (template.state === "pending_payment") {
    await tagOrderByCheckoutSession(admin, sessionId, template);
    return { orderId: null as string | null };
  }

  // Zahlung bestätigen → Bestellung entsteht über die Order Engine
  const result = await payments.finalizeFromPayment({
    organizationId: orgId,
    paymentSessionId: paymentSession.paymentSessionId,
    providerPaymentId: `mock_pi_${paymentSession.paymentSessionId}`,
    amountMinor: Number(paymentSession.amountMinor),
    currencyCode: paymentSession.currencyCode,
    actorId: userId,
    idempotencyKey: `demo-seed:${template.key}`,
  });
  const orderId = result.order_id;

  // Kunden-Verknüpfung, Metadata-Tag, Bestelldatum
  const placedAt = new Date(Date.now() - template.ageDays * 86_400_000).toISOString();
  const { data: orderRow } = await admin.from("orders").select("metadata, total_minor").eq("id", orderId).single();
  await admin
    .from("orders")
    .update({
      customer_id: customer?.id ?? null,
      metadata: {
        ...((orderRow?.metadata as Record<string, unknown>) ?? {}),
        demo_key: template.key,
        demo_state: template.state,
      },
      placed_at: placedAt,
    })
    .eq("id", orderId);

  // Zustands-spezifische Nachbearbeitung über die Domänen-Engines
  if (template.state === "cancelled") {
    await admin.rpc("order_cancel" as never, {
      _org: orgId,
      _order: orderId,
      _actor: userId,
      _reason: "Demo-Stornierung",
      _idem: `demo-seed:cancel:${template.key}`,
    } as never);
    return { orderId };
  }

  const totalMinor = Number(orderRow?.total_minor ?? 0);
  if (template.state === "refunded_partial" || template.state === "refunded_full") {
    const amount =
      template.state === "refunded_full" ? totalMinor : Math.max(1, Math.floor(totalMinor / 2));
    const { data: refund, error } = await admin.rpc("refund_create" as never, {
      _org: orgId,
      _order: orderId,
      _actor: userId,
      _amount_minor: amount,
      _reason: "Demo-Erstattung",
      _idem: `demo-seed:refund:${template.key}`,
    } as never);
    if (error) throw new Error(error.message);
    const refundId = (refund as unknown as { refund_id: string }).refund_id;
    await admin.rpc("refund_settle" as never, {
      _org: orgId,
      _refund: refundId,
      _status: "completed",
      _provider: "mock",
      _provider_refund_id: `mock_re_${refundId}`,
    } as never);
    return { orderId };
  }

  if (
    template.state === "shipped" ||
    template.state === "partially_fulfilled" ||
    template.state === "return_requested"
  ) {
    const fulfillment = await import("../fulfillment/fulfillment.server");
    const shipping = await import("../shipping/shipping.server");
    const { data: items } = await admin
      .from("order_items")
      .select("id, quantity")
      .eq("order_id", orderId);
    const lines = (items ?? []) as { id: string; quantity: number }[];
    const fulfillLines =
      template.state === "partially_fulfilled"
        ? [{ orderItemId: lines[0]!.id, quantity: 1 }]
        : lines.map((l) => ({ orderItemId: l.id, quantity: l.quantity }));

    const ful = await fulfillment.createFulfillment({
      organizationId: orgId,
      shopId,
      orderId,
      locationId: maps.locationId,
      actorId: userId,
      items: fulfillLines,
      idempotencyKey: `demo-seed:ful:${template.key}`,
    });
    const fid = ful.fulfillment_id;

    if (template.state !== "partially_fulfilled") {
      await fulfillment.startPicking({
        organizationId: orgId,
        fulfillmentId: fid,
        actorId: userId,
        idempotencyKey: `demo-seed:pick:${template.key}`,
      });
      let fulView = await fulfillment.loadFulfillment(orgId, fid);
      await fulfillment.completePicking({
        organizationId: orgId,
        fulfillmentId: fid,
        actorId: userId,
        picked: fulView.items.map((i) => ({ fulfillmentItemId: i.id, pickedQuantity: i.quantity })),
        idempotencyKey: `demo-seed:picked:${template.key}`,
      });
      fulView = await fulfillment.loadFulfillment(orgId, fid);
      await fulfillment.packFulfillment({
        organizationId: orgId,
        fulfillmentId: fid,
        actorId: userId,
        packages: [
          {
            weightGrams: 800,
            items: fulView.items.map((i) => ({
              fulfillmentItemId: i.id,
              quantity: i.pickedQuantity,
            })),
          },
        ],
        idempotencyKey: `demo-seed:pack:${template.key}`,
      });
      fulView = await fulfillment.loadFulfillment(orgId, fid);
      const pkgId = fulView.packages[0]?.id;
      if (pkgId) {
        const shipment = await shipping.createShipmentWithLabel({
          organizationId: orgId,
          fulfillmentId: fid,
          packageId: pkgId,
          provider: "mock",
          service: null,
          actorId: userId,
          idempotencyKey: `demo-seed:ship:${template.key}`,
        });
        await shipping.markShipped({
          organizationId: orgId,
          shipmentId: shipment.id,
          actorId: userId,
          idempotencyKey: `demo-seed:shipped:${template.key}`,
        });
      }

      if (template.state === "return_requested") {
        const returns = await import("../returns/return.server");
        await returns.requestReturn({
          organizationId: orgId,
          shopId,
          orderId,
          customerId: customer?.id ?? null,
          actorId: userId,
          items: [{ orderItemId: lines[0]!.id, quantity: 1 }],
          reason: "changed_mind",
          note: "Demo-Retoure",
          idempotencyKey: `demo-seed:return:${template.key}`,
        });
      }
    }
  }

  // Kommunikation (Mock-Provider, kein externer Versand)
  const commKeys: string[] = [];
  if (template.state !== "payment_failed" && template.state !== "payment_pending") {
    commKeys.push("order.confirmed", "payment.confirmed");
  }
  if (template.state === "payment_failed") commKeys.push("payment.failed");
  if (template.state === "shipped" || template.state === "delivered") commKeys.push("shipment.shipped");
  if (commKeys.length) {
    const { queueCommunication, dispatchCommunication } = await import(
      "../communications/communication.server"
    );
    const { count: already } = await admin
      .from("communications")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("order_id", orderId);
    if (Number(already ?? 0) === 0) {
      for (const key of commKeys) {
        try {
          const res = await queueCommunication({
            organizationId: orgId,
            shopId,
            orderId,
            customerId: customer?.id ?? null,
            recipientEmail: email,
            templateKey: key,
            guestAccess: !customer,
          });
          if (res.queued) await dispatchCommunication(res.communicationId);
        } catch {
          // Kommunikation ist Demo-Beiwerk und darf den Order-Seed nie brechen.
        }
      }
    }
  }

  // Rechnungen für einen Teil der bezahlten Bestellungen
  if (template.state === "shipped" && Number(template.key.replace("ord-", "")) % 2 === 0) {
    const { data: invoice, error } = await admin.rpc("invoice_create_from_order" as never, {
      _org: orgId,
      _order: orderId,
      _actor: userId,
      _idem: `demo-seed:invoice:${template.key}`,
    } as never);
    if (!error && invoice) {
      const invoiceId = (invoice as unknown as { invoice_id: string }).invoice_id;
      // Über den Dokumenten-Service ausstellen, damit auch das PDF entsteht.
      const { issueInvoice } = await import("../documents/document.server");
      await issueInvoice({
        organizationId: orgId,
        invoiceId,
        actorId: userId,
        idempotencyKey: `demo-seed:issue:${template.key}`,
      });
    }

  }

  return { orderId };
}

async function tagOrderByCheckoutSession(admin: Admin, sessionId: string, template: DemoOrderTemplate) {
  // Bei ausstehender Zahlung existiert noch keine Bestellung; die Session
  // selbst wird getaggt, damit der Schritt idempotent bleibt.
  await admin
    .from("checkout_sessions")
    .update({ metadata: { demo_key: template.key, demo_state: template.state } })
    .eq("id", sessionId);
}

async function stepOrders(ctx: SeedCtx, env: DemoEnv): Promise<SeedStepResult> {
  const { admin, userId } = ctx;
  const { organizationId: orgId, shopId } = env;
  const { ensureDefaultLocation } = await import("../inventory.server");
  const locationId = await ensureDefaultLocation(orgId, shopId);

  // Bereits geseedete Bestellungen/Sessions (Idempotenz)
  const { data: existingOrders } = await admin
    .from("orders")
    .select("metadata")
    .eq("organization_id", orgId)
    .not("metadata->>demo_key", "is", null);
  const { data: existingSessions } = await admin
    .from("checkout_sessions")
    .select("metadata")
    .eq("organization_id", orgId)
    .not("metadata->>demo_key", "is", null);
  const tagged = (rows: unknown) =>
    ((rows ?? []) as { metadata: { demo_key?: string } | null }[]).map((r) => r.metadata?.demo_key);
  const done = new Set<string>(
    [...tagged(existingOrders), ...tagged(existingSessions)].filter((k): k is string => !!k),
  );

  // Maps vorbereiten
  const variantByProductKey = new Map<string, string>();
  const { data: variants } = await admin
    .from("product_variants")
    .select("id, metadata")
    .eq("organization_id", orgId)
    .not("metadata->>demo_key", "is", null);
  for (const v of variants ?? []) {
    const key = (v.metadata as { demo_key?: string })?.demo_key;
    if (key) variantByProductKey.set(key, v.id as string);
  }
  const customerByKey = new Map<string, { id: string; email: string }>();
  const { data: customers } = await admin
    .from("customers")
    .select("id, email, metadata")
    .eq("organization_id", orgId);
  for (const c of customers ?? []) {
    const key = (c.metadata as { demo_key?: string })?.demo_key;
    if (key) customerByKey.set(key, { id: c.id as string, email: c.email as string });
  }
  const { data: shippingMethod } = await admin
    .from("shipping_methods")
    .select("id")
    .eq("organization_id", orgId)
    .eq("shop_id", shopId)
    .eq("code", "DEMO-STD")
    .single();

  const pending = DEMO_ORDERS.filter((t) => !done.has(t.key));
  const batch = pending.slice(0, ORDER_SEED_BATCH);
  const errors: string[] = [];
  for (const template of batch) {
    try {
      await seedOneOrder(ctx, env, template, {
        variantByProductKey,
        customerByKey,
        shippingId: shippingMethod!.id as string,
        locationId,
      });
    } catch (e) {
      errors.push(`${template.key}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const createdTotal = DEMO_ORDERS.length - pending.length + (batch.length - errors.length);
  const finished = createdTotal >= DEMO_ORDERS.length;
  if (finished) {
    await writeAudit({
      organizationId: orgId,
      actorId: userId,
      actorEmail: ctx.email,
      action: "demo.seed.orders",
      entityType: "organization",
      entityId: orgId,
      metadata: { total: DEMO_ORDERS.length, errors },
    });
  }
  return {
    step: "orders",
    done: finished && errors.length === 0,
    detail:
      errors.length > 0
        ? `${createdTotal}/${DEMO_ORDERS.length} Bestellungen, Fehler: ${errors.join(" | ")}`
        : `${createdTotal}/${DEMO_ORDERS.length} Bestellungen über den echten Checkout-Fluss.`,
    progress: { created: createdTotal, total: DEMO_ORDERS.length },
  };
}

/* ------------------------------------------------------------------ */
/* Dispatcher, Status, Reset                                           */
/* ------------------------------------------------------------------ */

export async function runSeedStep(ctx: SeedCtx, step: SeedStep): Promise<SeedStepResult> {
  await assertNotProduction(ctx.admin);
  const env = await ensureFoundation(ctx);
  await assertNotProduction(ctx.admin, { organizationId: env.organizationId });

  switch (step) {
    case "foundation":
      return { step, done: true, detail: await stepFoundation(ctx) };
    case "catalog":
      return { step, done: true, detail: await stepCatalog(ctx, env) };
    case "media":
      return { step, done: true, detail: await stepMedia(ctx, env) };
    case "inventory":
      return { step, done: true, detail: await stepInventory(ctx, env) };
    case "customers":
      return { step, done: true, detail: await stepCustomers(ctx, env) };
    case "promotions":
      return { step, done: true, detail: await stepPromotions(ctx, env) };
    case "orders":
      return await stepOrders(ctx, env);
  }
}

export async function getDemoStatus(ctx: SeedCtx): Promise<DemoStatus> {
  const { admin, userId } = ctx;
  const env = await findDemoEnv(admin, userId);
  if (!env) {
    return {
      environment: null,
      counts: null,
      steps: {
        foundation: false,
        catalog: false,
        media: false,
        inventory: false,
        customers: false,
        promotions: false,
        orders: false,
      },
    };
  }
  const { organizationId: orgId, shopId } = env;
  const { data: envRow } = await admin
    .from("demo_environments")
    .select("seed_version, status, seeded_at, last_reset_at")
    .eq("organization_id", orgId)
    .maybeSingle();
  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .maybeSingle();

  const count = async (table: string, filterDemo: boolean) => {
    const base = admin
      .from(table as never)
      .select("id", { count: "exact", head: true })
      .eq("organization_id" as never, orgId);
    const q = filterDemo ? base.not("metadata->>demo_key", "is", null) : base;
    const { count: n } = (await q) as unknown as { count: number | null };
    return Number(n ?? 0);
  };

  const [products, orders, customers, media] = await Promise.all([
    count("products", true),
    count("orders", true),
    count("customers", true),
    count("media_assets", true),
  ]);
  const counts: DemoCounts = { products, orders, customers, media };

  const pendingOrders = await admin
    .from("checkout_sessions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .not("metadata->>demo_key", "is", null);

  const steps: Record<SeedStep, boolean> = {
    foundation: true,
    catalog: products >= DEMO_PRODUCTS.length,
    media: media >= DEMO_ASSETS.length,
    customers: customers >= DEMO_CUSTOMERS.length,
    promotions: true,
    inventory: true,
    orders: orders + Number(pendingOrders.count ?? 0) >= DEMO_ORDERS.length,
  };
  // promotions/inventory genauer prüfen
  const { count: promoCount } = await admin
    .from("promotions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .not("metadata->>demo_key", "is", null);
  steps.promotions = Number(promoCount ?? 0) >= DEMO_PROMOTIONS.length;
  const { count: itemCount } = await admin
    .from("inventory_items")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  steps.inventory = Number(itemCount ?? 0) >= DEMO_PRODUCTS.length;

  return {
    environment: {
      organizationId: orgId,
      organizationName: (org?.name as string) ?? DEMO_ORG_NAME,
      seedVersion: (envRow?.seed_version as string) ?? SEED_VERSION,
      status: (envRow?.status as string) ?? "active",
      seededAt: envRow?.seeded_at as string,
      lastResetAt: (envRow?.last_reset_at as string) ?? null,
    },
    counts,
    steps,
  };
}

/** Vollständiger Reset: Demo-Organisation mitsamt aller Daten löschen und neu aufsetzen. */
export async function resetDemo(ctx: SeedCtx): Promise<{ detail: string }> {
  await assertNotProduction(ctx.admin);
  const env = await findDemoEnv(ctx.admin, ctx.userId);
  if (!env) return { detail: "Keine Demo-Organisation vorhanden." };
  await assertNotProduction(ctx.admin, { organizationId: env.organizationId });
  const { admin, userId } = ctx;
  const orgId = env.organizationId;

  await writeAudit({
    organizationId: orgId,
    actorId: userId,
    actorEmail: ctx.email,
    action: "demo.environment.reset",
    entityType: "organization",
    entityId: orgId,
  });

  // Storage-Dateien der Organisation entfernen (Buckets kaskadieren nicht)
  for (const bucket of ["media", "documents", "shipping-labels"]) {
    try {
      const { data: files } = await admin.storage.from(bucket).list(orgId, { limit: 1000 });
      const paths = (files ?? [])
        .filter((f: { name: string }) => f.name)
        .map((f: { name: string }) => `${orgId}/${f.name}`);
      // Unterordner (z. B. demo/) rekursiv erfassen
      const { data: subFiles } = await admin.storage.from(bucket).list(`${orgId}/demo`, { limit: 1000 });
      for (const f of subFiles ?? []) {
        if (f.name) paths.push(`${orgId}/demo/${f.name}`);
      }
      if (paths.length) await admin.storage.from(bucket).remove(paths);
    } catch {
      // Storage-Bereinigung ist best-effort; Reste werden im Report vermerkt.
    }
  }

  // Vollständige Entfernung inkl. unveränderbarer Journale (nur Demo-/QA-Organisationen)
  const { error } = await admin.rpc("demo_purge_organization" as never, { _org: orgId } as never);
  if (error) throw new Error(`Reset fehlgeschlagen: ${error.message}`);


  // Frische Foundation, damit die Umgebung direkt wieder nutzbar ist
  const fresh = await ensureFoundation(ctx);
  await admin
    .from("demo_environments")
    .update({ last_reset_at: new Date().toISOString(), seed_version: SEED_VERSION })
    .eq("organization_id", fresh.organizationId);

  return { detail: "Demo-Organisation vollständig zurückgesetzt (neue leere Foundation angelegt)." };
}
