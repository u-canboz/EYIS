/**
 * Server-only cart engine data access.
 *
 * Guest carts are addressed by cart id + raw anonymous token; only the SHA-256
 * hash is stored. There is no anonymous database access anywhere — every guest
 * read/write goes through these checked helpers using the service client.
 */
import { calculateCart } from "./cart-engine";
import { computeCartTax } from "./tax/tax.server";
import { TAX_ENGINE_VERSION, type TaxResult } from "./tax/tax.types";
import { resolvePricing } from "./pricing-engine";
import { loadSnapshot } from "./pricing.server";
import { generateToken, hashToken, getAdmin, writeAudit, emitEvent } from "./core.server";
import type { PromotionRow } from "./pricing-types";
import {
  PRICING_ENGINE_VERSION,
  type CartCalculation,
  type CartEngineLine,
  type CartView,
  type CartItemView,
} from "./cart-types";

export type CartRow = {
  id: string;
  organization_id: string;
  shop_id: string;
  customer_id: string | null;
  anonymous_token_hash: string | null;
  status: "active" | "checkout" | "completed" | "abandoned" | "expired";
  currency_code: string;
  customer_email: string | null;
  region_code: string | null;
  locale: string;
  expires_at: string;
};

export type ItemRow = {
  id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  title_snapshot: string;
  variant_title_snapshot: string;
  sku_snapshot: string | null;
  image_snapshot: string | null;
};

const CART_TTL_DAYS = 30;

export { generateToken, hashToken };

export async function loadCartAuthorized(cartId: string, token: string | null, customerId?: string | null) {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("carts")
    .select(
      "id, organization_id, shop_id, customer_id, anonymous_token_hash, status, currency_code, customer_email, region_code, locale, expires_at",
    )
    .eq("id", cartId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Warenkorb nicht gefunden.");
  const cart = data as CartRow;

  const byCustomer = !!customerId && cart.customer_id === customerId;
  let byToken = false;
  if (!byCustomer) {
    if (!token || !cart.anonymous_token_hash) throw new Error("Kein Zugriff auf diesen Warenkorb.");
    byToken = (await hashToken(token)) === cart.anonymous_token_hash;
  }
  if (!byCustomer && !byToken) throw new Error("Kein Zugriff auf diesen Warenkorb.");

  if (cart.status === "expired" || (cart.status === "active" && Date.parse(cart.expires_at) <= Date.now())) {
    if (cart.status !== "expired") {
      await admin.from("carts").update({ status: "expired" }).eq("id", cart.id);
      cart.status = "expired";
    }
  }
  return cart;
}

export function assertMutable(cart: CartRow) {
  if (cart.status === "checkout")
    throw new Error("Der Warenkorb ist im Checkout gesperrt. Bitte den Checkout abbrechen, um ihn zu ändern.");
  if (cart.status !== "active") throw new Error(`Der Warenkorb ist nicht änderbar (Status: ${cart.status}).`);
}

export async function createCart(args: {
  organizationId: string;
  shopId: string;
  currencyCode: string;
  locale?: string;
  regionCode?: string | null;
  customerId?: string | null;
  email?: string | null;
}) {
  const admin = await getAdmin();
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const { data, error } = await admin
    .from("carts")
    .insert({
      organization_id: args.organizationId,
      shop_id: args.shopId,
      currency_code: args.currencyCode.toUpperCase(),
      locale: args.locale ?? "de",
      region_code: args.regionCode ?? null,
      customer_id: args.customerId ?? null,
      customer_email: args.email ?? null,
      anonymous_token_hash: tokenHash,
      expires_at: new Date(Date.now() + CART_TTL_DAYS * 86400_000).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const cartId = (data as { id: string }).id;
  await writeAudit({
    organizationId: args.organizationId,
    actorId: args.customerId ?? null,
    action: "cart.created",
    entityType: "cart",
    entityId: cartId,
    metadata: { shop_id: args.shopId },
  });
  return { cartId, token };
}

export async function touchCart(cartId: string) {
  const admin = await getAdmin();
  await admin.from("carts").update({ last_activity_at: new Date().toISOString() }).eq("id", cartId);
}

/** Availability for a variant inside a shop. Never reserves — that is checkout. */
export async function getAvailability(organizationId: string, shopId: string, variantId: string) {
  const admin = await getAdmin();
  const { data: item } = await admin
    .from("inventory_items")
    .select("id, track_inventory, allow_backorder")
    .eq("organization_id", organizationId)
    .eq("variant_id", variantId)
    .maybeSingle();
  if (!item) return { tracked: false, available: Number.POSITIVE_INFINITY, allowBackorder: true };
  const row = item as { id: string; track_inventory: boolean; allow_backorder: boolean };
  if (!row.track_inventory)
    return { tracked: false, available: Number.POSITIVE_INFINITY, allowBackorder: true };

  const { data: levels } = await admin
    .from("inventory_levels")
    .select("on_hand, reserved, damaged")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .eq("inventory_item_id", row.id);
  const available = ((levels ?? []) as { on_hand: number; reserved: number; damaged: number }[]).reduce(
    (sum, l) => sum + (l.on_hand - l.damaged - l.reserved),
    0,
  );
  return { tracked: true, available: Math.max(0, available), allowBackorder: row.allow_backorder };
}

export async function assertAvailable(
  organizationId: string,
  shopId: string,
  variantId: string,
  quantity: number,
  label: string,
) {
  const a = await getAvailability(organizationId, shopId, variantId);
  if (!a.tracked || a.allowBackorder) return;
  if (quantity > a.available)
    throw new Error(`Nicht genügend Bestand für „${label}“ (verfügbar: ${a.available}).`);
}

/** Loads product + variant data and builds the immutable line snapshot fields. */
export async function loadVariantSnapshot(organizationId: string, shopId: string, variantId: string) {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("product_variants")
    .select("id, title, sku, status, product_id, organization_id, products(id, name, shop_id, status)")
    .eq("id", variantId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Variante nicht gefunden.");
  const v = data as unknown as {
    id: string;
    title: string;
    sku: string | null;
    status: string;
    product_id: string;
    products: { id: string; name: string; shop_id: string; status: string } | null;
  };
  if (!v.products || v.products.shop_id !== shopId) throw new Error("Variante gehört nicht zu diesem Shop.");
  if (v.products.status !== "active") throw new Error("Produkt ist nicht verkäuflich.");
  if (v.status !== "active") throw new Error("Variante ist nicht verkäuflich.");

  const { data: media } = await admin
    .from("product_media")
    .select("position, media_assets(storage_path)")
    .eq("product_id", v.product_id)
    .order("position", { ascending: true })
    .limit(1);
  const image =
    ((media ?? [])[0] as unknown as { media_assets: { storage_path: string } | null } | undefined)?.media_assets
      ?.storage_path ?? null;

  return {
    productId: v.product_id,
    variantId: v.id,
    title: v.products.name,
    variantTitle: v.title,
    sku: v.sku,
    image,
  };
}

async function loadPromotions(organizationId: string, shopId: string): Promise<PromotionRow[]> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("promotions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .eq("status", "active");
  return ((data ?? []) as Record<string, unknown>[]).map((p) => ({
    ...(p as object),
    value: Number(p['value']),
    conditions: Array.isArray(p['conditions']) ? p['conditions'] : [],
    actions: Array.isArray(p['actions']) ? p['actions'] : [],
    usageLimit: p['usage_limit'] as number | null,
    usageLimitPerCustomer: p['usage_limit_per_customer'] as number | null,
  })) as unknown as PromotionRow[];
}

export async function loadItems(cartId: string): Promise<ItemRow[]> {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("cart_items")
    .select("id, product_id, variant_id, quantity, title_snapshot, variant_title_snapshot, sku_snapshot, image_snapshot")
    .eq("cart_id", cartId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ItemRow[];
}

export async function loadPromotionCodes(cartId: string) {
  const admin = await getAdmin();
  const { data } = await admin.from("cart_promotion_codes").select("code_snapshot").eq("cart_id", cartId);
  return ((data ?? []) as { code_snapshot: string }[]).map((r) => r.code_snapshot);
}

export type RepriceOptions = {
  shippingMethodId?: string | null;
  countryCode?: string | null;
  persist?: boolean;
  customerType?: "consumer" | "business";
  vatIdValid?: boolean;
};

/**
 * Reprices the whole cart through the single pricing engine (per line) and the
 * cart engine (cart level), then optionally writes an immutable snapshot.
 */
export async function repriceCart(cart: CartRow, options: RepriceOptions = {}) {
  const admin = await getAdmin();
  const items = await loadItems(cart.id);
  const codes = await loadPromotionCodes(cart.id);
  const warnings: string[] = [];
  const nowIso = new Date().toISOString();

  const engineLines: CartEngineLine[] = [];
  for (const item of items) {
    const snapshot = await loadSnapshot(
      admin as never,
      {
        organizationId: cart.organization_id,
        shopId: cart.shop_id,
        productId: item.product_id,
        variantId: item.variant_id,
      },
      cart.currency_code,
    );
    const line = resolvePricing(snapshot, {
      shopId: cart.shop_id,
      productId: item.product_id,
      variantId: item.variant_id,
      quantity: item.quantity,
      currencyCode: cart.currency_code,
      customerGroupId: null,
      promotionCodes: [], // cart-level promotions are applied by the cart engine
      now: nowIso,
    });
    if (line.resolvedUnitAmount <= 0) {
      warnings.push(`Für „${item.title_snapshot}“ ist kein gültiger Preis hinterlegt.`);
    }
    engineLines.push({
      id: item.id,
      productId: item.product_id,
      variantId: item.variant_id,
      quantity: item.quantity,
      unitBaseMinor: line.baseAmount,
      unitResolvedMinor: line.resolvedUnitAmount,
      appliedPriceRules: line.appliedPriceRules,
      categoryIds: snapshot.productCategoryIds,
      collectionIds: snapshot.productCollectionIds,
    });
  }

  let shipping: { methodId: string; amountMinor: number; freeAboveMinor: number | null } | null = null;
  if (options.shippingMethodId) {
    const { data: method } = await admin
      .from("shipping_methods")
      .select("id, amount_minor, pricing_type, free_above_minor, currency_code, status, shop_id")
      .eq("id", options.shippingMethodId)
      .eq("organization_id", cart.organization_id)
      .maybeSingle();
    const m = method as
      | {
          id: string;
          amount_minor: number;
          pricing_type: string;
          free_above_minor: number | null;
          currency_code: string;
          status: string;
          shop_id: string;
        }
      | null;
    if (m && m.shop_id === cart.shop_id && m.status === "active") {
      shipping = {
        methodId: m.id,
        amountMinor: m.pricing_type === "free" ? 0 : Number(m.amount_minor),
        freeAboveMinor: m.free_above_minor === null ? null : Number(m.free_above_minor),
      };
    } else {
      warnings.push("Die gewählte Versandart ist nicht mehr verfügbar.");
    }
  }

  const promotions = await loadPromotions(cart.organization_id, cart.shop_id);

  const preliminary = calculateCart({
    organizationId: cart.organization_id,
    shopId: cart.shop_id,
    currencyCode: cart.currency_code,
    customerGroupId: null,
    promotionCodes: codes,
    lines: engineLines,
    shipping,
    promotions,
    taxMinor: 0,
    now: nowIso,
  });

  const byLineRefs = new Map(items.map((i) => [i.id, i]));
  const { result: tax, settings: taxSettings } = await computeCartTax({
    organizationId: cart.organization_id,
    shopId: cart.shop_id,
    currencyCode: cart.currency_code,
    destinationCountryCode: options.countryCode ?? null,
    destinationRegionCode: cart.region_code,
    customerType: options.customerType ?? "consumer",
    vatIdValid: options.vatIdValid ?? false,
    shippingMinor: preliminary.totals.shippingMinor,
    lines: preliminary.lines.map((l) => ({
      lineId: l.lineId,
      productId: byLineRefs.get(l.lineId)?.product_id ?? "",
      variantId: l.variantId,
      quantity: l.quantity,
      lineTotalMinor: l.lineTotalMinor,
    })),
  });

  const calculation: CartCalculation =
    tax.taxMinor === 0
      ? preliminary
      : calculateCart({
          organizationId: cart.organization_id,
          shopId: cart.shop_id,
          currencyCode: cart.currency_code,
          customerGroupId: null,
          promotionCodes: codes,
          lines: engineLines,
          shipping,
          promotions,
          taxMinor: tax.taxMinor,
          taxIncluded: taxSettings.calculationMode === "gross",
          now: nowIso,
        });

  let version = 0;
  let snapshotId: string | null = null;
  if (options.persist !== false) {
    const written = await writeSnapshot(cart, calculation, codes, options.shippingMethodId ?? null, tax);
    version = written.version;
    snapshotId = written.id;
  }

  return { calculation, items, codes, warnings, version, snapshotId, tax, taxSettings };
}

/** Merges the tax result into snapshot line JSON so orders can copy it 1:1. */
export function mergeTaxIntoLines(calculation: CartCalculation, tax: TaxResult) {
  const byLine = new Map(tax.lines.map((l) => [l.lineId, l]));
  return calculation.lines.map((l) => {
    const t = byLine.get(l.lineId);
    return {
      ...l,
      netMinor: t?.netMinor ?? l.lineTotalMinor,
      taxMinor: t?.taxMinor ?? 0,
      grossMinor: t?.grossMinor ?? l.lineTotalMinor,
      taxRateBasisPoints: t?.rateBasisPoints ?? 0,
      taxClass: t?.taxClass ?? null,
      taxReasonCode: t?.reasonCode ?? "unknown",
      taxCountryCode: t?.countryCode ?? null,
    };
  });
}

/** Immutable, versioned price snapshot including the pricing engine version. */
export async function writeSnapshot(
  cart: CartRow,
  calculation: CartCalculation,
  codes: string[],
  shippingMethodId: string | null,
  tax?: TaxResult,
) {
  const admin = await getAdmin();
  const { data: last } = await admin
    .from("cart_price_snapshots")
    .select("version")
    .eq("cart_id", cart.id)
    .order("version", { ascending: false })
    .limit(1);
  const version = (((last ?? [])[0] as { version: number } | undefined)?.version ?? 0) + 1;

  const { data, error } = await admin
    .from("cart_price_snapshots")
    .insert({
      organization_id: cart.organization_id,
      shop_id: cart.shop_id,
      cart_id: cart.id,
      version,
      currency_code: calculation.currencyCode,
      subtotal_minor: calculation.totals.subtotalMinor,
      discount_minor: calculation.totals.discountMinor,
      shipping_minor: calculation.totals.shippingMinor,
      tax_minor: calculation.totals.taxMinor,
      total_minor: calculation.totals.totalMinor,
      pricing_engine_version: calculation.pricingEngineVersion,
      tax_breakdown: (tax?.breakdown ?? []) as never,
      tax_engine_version: tax?.engineVersion ?? TAX_ENGINE_VERSION,
      pricing_context: {
        promotion_codes: codes,
        shipping_method_id: shippingMethodId,
        customer_group_id: null,
        currency_code: calculation.currencyCode,
      } as never,
      calculation_result: calculation as never,
    })
    .select("id, version")
    .single();
  if (error) throw new Error(error.message);
  const snapshot = data as { id: string; version: number };

  if (calculation.lines.length) {
    await admin.from("cart_item_price_snapshots").insert(
      calculation.lines.map((l) => ({
        organization_id: cart.organization_id,
        snapshot_id: snapshot.id,
        cart_item_id: l.lineId,
        variant_id: l.variantId,
        quantity: l.quantity,
        unit_base_minor: l.unitBaseMinor,
        unit_resolved_minor: l.unitResolvedMinor,
        line_subtotal_minor: l.lineSubtotalMinor,
        line_discount_minor: l.lineDiscountMinor,
        line_total_minor: l.lineTotalMinor,
        applied_rules: l.appliedPriceRules as never,
        applied_promotions: l.appliedPromotions as never,
      })) as never,
    );
  }
  return snapshot;
}

export async function buildCartView(cart: CartRow, options: RepriceOptions = {}): Promise<CartView> {
  const { calculation, items, codes, warnings, version, tax } = await repriceCart(cart, options);
  const byLine = new Map(calculation.lines.map((l) => [l.lineId, l]));
  const viewItems: CartItemView[] = items.map((item) => {
    const l = byLine.get(item.id);
    return {
      id: item.id,
      productId: item.product_id,
      variantId: item.variant_id,
      quantity: item.quantity,
      title: item.title_snapshot,
      variantTitle: item.variant_title_snapshot,
      sku: item.sku_snapshot,
      image: item.image_snapshot,
      unitResolvedMinor: l?.unitResolvedMinor ?? 0,
      lineSubtotalMinor: l?.lineSubtotalMinor ?? 0,
      lineDiscountMinor: l?.lineDiscountMinor ?? 0,
      lineTotalMinor: l?.lineTotalMinor ?? 0,
    };
  });

  return {
    id: cart.id,
    status: cart.status,
    currencyCode: cart.currency_code,
    email: cart.customer_email,
    locale: cart.locale,
    regionCode: cart.region_code,
    expiresAt: cart.expires_at,
    items: viewItems,
    promotionCodes: codes,
    totals: calculation.totals,
    appliedPromotions: calculation.appliedPromotions,
    pendingPromotions: calculation.pendingPromotions,
    rejectedCodes: calculation.rejectedCodes,
    freeShipping: calculation.freeShipping,
    snapshotVersion: version,
    pricingEngineVersion: PRICING_ENGINE_VERSION,
    warnings,
    tax: {
      engineVersion: tax.engineVersion,
      calculationMode: tax.calculationMode,
      netTotalMinor: tax.netTotalMinor,
      taxMinor: tax.taxMinor,
      grossTotalMinor: tax.grossTotalMinor,
      reverseCharge: tax.reverseCharge,
      breakdown: tax.breakdown,
      notes: tax.notes,
    },
  };
}

export async function cartEvent(
  cart: CartRow,
  action: string,
  metadata: Record<string, unknown> = {},
  actorId: string | null = null,
) {
  await writeAudit({
    organizationId: cart.organization_id,
    actorId,
    action,
    entityType: "cart",
    entityId: cart.id,
    metadata,
  });
  await emitEvent(cart.organization_id, action, { cart_id: cart.id, ...metadata });
}
