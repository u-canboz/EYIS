/**
 * Server-only pricing data access. Loads the snapshot and delegates to the one
 * pricing engine — there is no second pricing logic anywhere.
 */
import { resolvePricing } from "./pricing-engine";
import type { PriceRow, PricingContext, PricingSnapshot, PromotionRow } from "./pricing-types";

type Client = { from: (table: string) => any };

export type LoadArgs = {
  organizationId: string;
  shopId: string;
  productId: string;
  variantId?: string | null;
};

export async function loadSnapshot(
  supabase: Client,
  args: LoadArgs,
  shopCurrency: string,
): Promise<PricingSnapshot> {
  const setQuery = supabase
    .from("price_sets")
    .select("id, product_id, variant_id")
    .eq("organization_id", args.organizationId)
    .eq("shop_id", args.shopId);

  const { data: sets, error: setErr } = args.variantId
    ? await setQuery.or(`product_id.eq.${args.productId},variant_id.eq.${args.variantId}`)
    : await setQuery.eq("product_id", args.productId);
  if (setErr) throw new Error(setErr.message);

  const setRows = (sets ?? []) as { id: string; product_id: string | null; variant_id: string | null }[];
  const scopeById = new Map(setRows.map((s) => [s.id, s.variant_id ? "variant" : "product"] as const));

  let prices: PriceRow[] = [];
  if (setRows.length) {
    const { data, error } = await supabase
      .from("prices")
      .select("*")
      .in(
        "price_set_id",
        setRows.map((s) => s.id),
      );
    if (error) throw new Error(error.message);
    prices = ((data ?? []) as any[]).map((row) => ({
      ...row,
      amount_minor: Number(row.amount_minor),
      scope: scopeById.get(row.price_set_id) ?? "product",
      conditions: (row.conditions ?? {}) as Record<string, unknown>,
    })) as PriceRow[];
  }

  const [{ data: promoRows, error: promoErr }, { data: cats }, { data: cols }] = await Promise.all([
    supabase
      .from("promotions")
      .select("*")
      .eq("organization_id", args.organizationId)
      .eq("shop_id", args.shopId)
      .eq("status", "active"),
    supabase.from("product_categories").select("category_id").eq("product_id", args.productId),
    supabase.from("product_collections").select("collection_id").eq("product_id", args.productId),
  ]);
  if (promoErr) throw new Error(promoErr.message);

  const promotions = ((promoRows ?? []) as any[]).map((p) => ({
    ...p,
    value: Number(p.value),
    conditions: Array.isArray(p.conditions) ? p.conditions : [],
    actions: Array.isArray(p.actions) ? p.actions : [],
  })) as PromotionRow[];

  return {
    organizationId: args.organizationId,
    shopId: args.shopId,
    shopCurrency,
    prices,
    promotions,
    productCategoryIds: ((cats ?? []) as { category_id: string }[]).map((c) => c.category_id),
    productCollectionIds: ((cols ?? []) as { collection_id: string }[]).map((c) => c.collection_id),
  };
}

export async function resolveFromDatabase(
  supabase: Client,
  organizationId: string,
  ctx: PricingContext,
) {
  const { data: shop, error } = await supabase
    .from("shops")
    .select("id, currency, organization_id")
    .eq("id", ctx.shopId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!shop) throw new Error("Shop gehört nicht zu dieser Organisation.");

  const snapshot = await loadSnapshot(
    supabase,
    {
      organizationId,
      shopId: ctx.shopId,
      productId: ctx.productId,
      variantId: ctx.variantId ?? null,
    },
    (shop as { currency: string }).currency,
  );

  // Customer group must belong to the same organization and shop.
  let customerGroupId = ctx.customerGroupId ?? null;
  if (customerGroupId) {
    const { data: group } = await supabase
      .from("customer_groups")
      .select("id")
      .eq("id", customerGroupId)
      .eq("organization_id", organizationId)
      .eq("shop_id", ctx.shopId)
      .maybeSingle();
    if (!group) customerGroupId = null;
  }

  return resolvePricing(snapshot, { ...ctx, customerGroupId });
}

/** Ensures a price set exists for a product or variant and returns its id. */
export async function ensurePriceSet(
  supabase: Client,
  args: { organizationId: string; shopId: string; productId?: string | null; variantId?: string | null },
) {
  const column = args.variantId ? "variant_id" : "product_id";
  const value = args.variantId ?? args.productId;
  if (!value) throw new Error("Produkt oder Variante erforderlich.");

  const { data: existing } = await supabase
    .from("price_sets")
    .select("id")
    .eq("organization_id", args.organizationId)
    .eq(column, value)
    .maybeSingle();
  if (existing) return (existing as { id: string }).id;

  const { data, error } = await supabase
    .from("price_sets")
    .insert({
      organization_id: args.organizationId,
      shop_id: args.shopId,
      product_id: args.variantId ? null : args.productId,
      variant_id: args.variantId ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export function validatePriceInput(input: {
  amountMinor: number;
  currencyCode: string;
  type: string;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  customerGroupId?: string | null;
}) {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor < 0)
    throw new Error("Der Betrag muss eine ganze Zahl ≥ 0 sein.");
  if (!/^[A-Z]{3}$/.test(input.currencyCode)) throw new Error("Ungültiger Währungscode.");
  if (input.startsAt && input.endsAt && Date.parse(input.startsAt) >= Date.parse(input.endsAt))
    throw new Error("Der Startzeitpunkt muss vor dem Endzeitpunkt liegen.");
  if (input.minQuantity !== null && input.minQuantity !== undefined && input.minQuantity <= 0)
    throw new Error("Die Mindestmenge muss größer als 0 sein.");
  if (
    input.maxQuantity !== null &&
    input.maxQuantity !== undefined &&
    (input.minQuantity === null || input.minQuantity === undefined || input.maxQuantity < input.minQuantity)
  )
    throw new Error("Die Höchstmenge muss größer oder gleich der Mindestmenge sein.");
  if (input.type === "tier" && !input.minQuantity) throw new Error("Eine Mengenstaffel braucht eine Mindestmenge.");
  if (input.type === "customer_group" && !input.customerGroupId)
    throw new Error("Ein Kundengruppenpreis braucht eine Kundengruppe.");
}
