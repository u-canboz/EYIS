/**
 * Server-side tax orchestration: loads shop tax settings, tax classes and
 * rates, resolves the tax class per line (variant > product > shop default)
 * and runs the pure engine. Also writes immutable tax snapshots.
 */
import { getAdmin } from "../core.server";
import { calculateTax } from "./tax.engine";
import {
  TAX_ENGINE_VERSION,
  type ShippingTaxStrategy,
  type TaxCalculationMode,
  type TaxClassRef,
  type TaxContext,
  type TaxRateRule,
  type TaxResult,
} from "./tax.types";

export type TaxSettings = {
  id: string | null;
  organizationId: string;
  shopId: string;
  calculationMode: TaxCalculationMode;
  homeCountryCode: string;
  defaultTaxClassId: string | null;
  pricesIncludeTax: boolean;
  displayPricesIncludingTax: boolean;
  shippingTaxStrategy: ShippingTaxStrategy;
  shippingTaxClassId: string | null;
  b2bEnabled: boolean;
  euOssEnabled: boolean;
  smallBusinessExemptionEnabled: boolean;
  taxNumber: string | null;
  vatId: string | null;
};

export type TaxClassRow = TaxClassRef & { id: string; isSystem: boolean; organizationId: string | null };

const FALLBACK_CLASS: TaxClassRef = { id: null, code: "standard", name: "Standard" };

export async function loadTaxSettings(organizationId: string, shopId: string): Promise<TaxSettings> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("tax_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .maybeSingle();
  const r = data as Record<string, unknown> | null;
  if (!r) {
    return {
      id: null,
      organizationId,
      shopId,
      calculationMode: "gross",
      homeCountryCode: "DE",
      defaultTaxClassId: null,
      pricesIncludeTax: true,
      displayPricesIncludingTax: true,
      shippingTaxStrategy: "fixed_class",
      shippingTaxClassId: null,
      b2bEnabled: false,
      euOssEnabled: false,
      smallBusinessExemptionEnabled: false,
      taxNumber: null,
      vatId: null,
    };
  }
  return {
    id: r['id'] as string,
    organizationId,
    shopId,
    calculationMode: r['calculation_mode'] as TaxCalculationMode,
    homeCountryCode: (r['home_country_code'] as string) ?? "DE",
    defaultTaxClassId: (r['default_tax_class_id'] as string) ?? null,
    pricesIncludeTax: r['prices_include_tax'] as boolean,
    displayPricesIncludingTax: r['display_prices_including_tax'] as boolean,
    shippingTaxStrategy: r['shipping_tax_strategy'] as ShippingTaxStrategy,
    shippingTaxClassId: (r['shipping_tax_class_id'] as string) ?? null,
    b2bEnabled: r['b2b_enabled'] as boolean,
    euOssEnabled: r['eu_oss_enabled'] as boolean,
    smallBusinessExemptionEnabled: r['small_business_exemption_enabled'] as boolean,
    taxNumber: (r['tax_number'] as string) ?? null,
    vatId: (r['vat_id'] as string) ?? null,
  };
}

export async function loadTaxClasses(organizationId: string): Promise<TaxClassRow[]> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("tax_classes")
    .select("id, code, name, is_system, organization_id, status")
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
    .eq("status", "active");
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r['id'] as string,
    code: r['code'] as string,
    name: r['name'] as string,
    isSystem: r['is_system'] as boolean,
    organizationId: (r['organization_id'] as string) ?? null,
  }));
}

export async function loadTaxRates(organizationId: string): Promise<TaxRateRule[]> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("tax_rates")
    .select(
      "id, organization_id, tax_class_id, country_code, region_code, rate_basis_points, customer_type, transaction_type, priority, valid_from, valid_until, status",
    )
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
    .eq("status", "active");
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r['id'] as string,
    organizationId: (r['organization_id'] as string) ?? null,
    taxClassId: r['tax_class_id'] as string,
    countryCode: r['country_code'] as string,
    regionCode: (r['region_code'] as string) ?? null,
    rateBasisPoints: Number(r['rate_basis_points']),
    customerType: r['customer_type'] as TaxRateRule["customerType"],
    transactionType: r['transaction_type'] as string,
    priority: Number(r['priority']),
    validFrom: r['valid_from'] as string,
    validUntil: (r['valid_until'] as string) ?? null,
  }));
}

/** variant tax class > product tax class > shop default > system standard */
export async function resolveLineTaxClasses(
  organizationId: string,
  shopId: string,
  refs: { lineId: string; productId: string; variantId: string | null }[],
  settings?: TaxSettings,
): Promise<Map<string, TaxClassRef>> {
  const admin = await getAdmin();
  const cfg = settings ?? (await loadTaxSettings(organizationId, shopId));
  const classes = await loadTaxClasses(organizationId);
  const byId = new Map(classes.map((c) => [c.id, { id: c.id, code: c.code, name: c.name } as TaxClassRef]));
  const fallback =
    (cfg.defaultTaxClassId ? byId.get(cfg.defaultTaxClassId) : undefined) ??
    classes.filter((c) => c.code === "standard").map((c) => ({ id: c.id, code: c.code, name: c.name }))[0] ??
    FALLBACK_CLASS;

  const productIds = [...new Set(refs.map((r) => r.productId))];
  const variantIds = [...new Set(refs.map((r) => r.variantId).filter((v): v is string => !!v))];

  const productClass = new Map<string, string | null>();
  const variantClass = new Map<string, string | null>();
  if (productIds.length) {
    const { data } = await admin.from("products").select("id, tax_class_id").in("id", productIds);
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      productClass.set(r['id'] as string, (r['tax_class_id'] as string) ?? null);
    }
  }
  if (variantIds.length) {
    const { data } = await admin.from("product_variants").select("id, tax_class_id").in("id", variantIds);
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      variantClass.set(r['id'] as string, (r['tax_class_id'] as string) ?? null);
    }
  }

  const out = new Map<string, TaxClassRef>();
  for (const ref of refs) {
    const id =
      (ref.variantId ? variantClass.get(ref.variantId) : null) ?? productClass.get(ref.productId) ?? null;
    out.set(ref.lineId, (id ? byId.get(id) : undefined) ?? fallback);
  }
  return out;
}

export type CartTaxInput = {
  organizationId: string;
  shopId: string;
  currencyCode: string;
  destinationCountryCode: string | null;
  destinationRegionCode: string | null;
  customerType: "consumer" | "business";
  vatIdValid: boolean;
  shippingMinor: number;
  lines: { lineId: string; productId: string; variantId: string; quantity: number; lineTotalMinor: number }[];
};

/** Loads everything the engine needs and calculates the tax for a cart. */
export async function computeCartTax(input: CartTaxInput): Promise<{ result: TaxResult; settings: TaxSettings }> {
  const settings = await loadTaxSettings(input.organizationId, input.shopId);
  const [rates, classes, classByLine] = await Promise.all([
    loadTaxRates(input.organizationId),
    loadTaxClasses(input.organizationId),
    resolveLineTaxClasses(
      input.organizationId,
      input.shopId,
      input.lines.map((l) => ({ lineId: l.lineId, productId: l.productId, variantId: l.variantId })),
      settings,
    ),
  ]);

  const shippingClass =
    (settings.shippingTaxClassId
      ? classes.find((c) => c.id === settings.shippingTaxClassId)
      : classes.find((c) => c.code === "shipping")) ?? null;

  const context: TaxContext = {
    organizationId: input.organizationId,
    shopId: input.shopId,
    currencyCode: input.currencyCode,
    calculationMode: settings.calculationMode,
    homeCountryCode: settings.homeCountryCode,
    destinationCountryCode: input.destinationCountryCode,
    destinationRegionCode: input.destinationRegionCode,
    customerType: settings.b2bEnabled ? input.customerType : "consumer",
    vatIdValid: settings.b2bEnabled && input.vatIdValid,
    ossEnabled: settings.euOssEnabled,
    smallBusinessExemption: settings.smallBusinessExemptionEnabled,
    shippingMinor: input.shippingMinor,
    shippingTaxStrategy: settings.shippingTaxStrategy,
    shippingTaxClass: shippingClass ? { id: shippingClass.id, code: shippingClass.code, name: shippingClass.name } : null,
    lines: input.lines.map((l) => ({
      lineId: l.lineId,
      variantId: l.variantId,
      quantity: l.quantity,
      lineTotalMinor: l.lineTotalMinor,
      taxClass: classByLine.get(l.lineId) ?? FALLBACK_CLASS,
    })),
    rates,
    now: new Date().toISOString(),
  };

  return { result: calculateTax(context), settings };
}

/** Immutable tax snapshot for a checkout session. */
export async function writeTaxSnapshot(params: {
  organizationId: string;
  shopId: string;
  cartId: string | null;
  checkoutSessionId: string | null;
  result: TaxResult;
}) {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("tax_snapshots")
    .insert({
      organization_id: params.organizationId,
      shop_id: params.shopId,
      cart_id: params.cartId,
      checkout_session_id: params.checkoutSessionId,
      calculation_mode: params.result.calculationMode,
      jurisdiction: params.result.jurisdiction,
      customer_type: params.result.customerType,
      result: params.result as never,
      engine_version: TAX_ENGINE_VERSION,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}
