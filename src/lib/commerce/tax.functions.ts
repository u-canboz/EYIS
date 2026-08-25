import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TaxSettingsInput = {
  organizationId: string;
  shopId: string;
  calculationMode: "gross" | "net";
  homeCountryCode: string;
  defaultTaxClassId: string | null;
  pricesIncludeTax: boolean;
  displayPricesIncludingTax: boolean;
  shippingTaxStrategy: "fixed_class" | "proportional" | "highest_rate";
  shippingTaxClassId: string | null;
  b2bEnabled: boolean;
  euOssEnabled: boolean;
  smallBusinessExemptionEnabled: boolean;
  taxNumber: string | null;
  vatId: string | null;
};

export type TaxRateInput = {
  id?: string;
  organizationId: string;
  shopId: string | null;
  taxClassId: string;
  countryCode: string;
  regionCode: string | null;
  rateBasisPoints: number;
  customerType: "consumer" | "business" | "any";
  validFrom: string;
  validUntil: string | null;
  status: "active" | "inactive" | "archived";
};

/** Tax classes (system + own), rates and the shop settings in one call. */
export const getTaxConfiguration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; shopId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [classes, rates, settings] = await Promise.all([
      supabase
        .from("tax_classes")
        .select("id, code, name, description, is_system, organization_id, status")
        .or(`organization_id.is.null,organization_id.eq.${data.organizationId}`)
        .order("is_system", { ascending: false })
        .order("name"),
      supabase
        .from("tax_rates")
        .select("*")
        .or(`organization_id.is.null,organization_id.eq.${data.organizationId}`)
        .order("country_code"),
      supabase
        .from("tax_settings")
        .select("*")
        .eq("organization_id", data.organizationId)
        .eq("shop_id", data.shopId)
        .maybeSingle(),
    ]);
    if (classes.error) throw new Error(classes.error.message);
    if (rates.error) throw new Error(rates.error.message);
    if (settings.error) throw new Error(settings.error.message);
    type Row = Record<string, string | number | boolean | null>;
    const asRow = (r: unknown) => JSON.parse(JSON.stringify(r)) as Row;
    return {
      classes: ((classes.data ?? []) as unknown[]).map(asRow),
      rates: ((rates.data ?? []) as unknown[]).map(asRow),
      settings: settings.data ? asRow(settings.data) : null,
    };
  });

export const saveTaxSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: TaxSettingsInput) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload = {
      organization_id: data.organizationId,
      shop_id: data.shopId,
      calculation_mode: data.calculationMode,
      home_country_code: data.homeCountryCode.trim().toUpperCase().slice(0, 2),
      default_tax_class_id: data.defaultTaxClassId,
      prices_include_tax: data.pricesIncludeTax,
      display_prices_including_tax: data.displayPricesIncludingTax,
      shipping_tax_strategy: data.shippingTaxStrategy,
      shipping_tax_class_id: data.shippingTaxClassId,
      b2b_enabled: data.b2bEnabled,
      eu_oss_enabled: data.euOssEnabled,
      small_business_exemption_enabled: data.smallBusinessExemptionEnabled,
      tax_number: data.taxNumber,
      vat_id: data.vatId,
    };
    const { error } = await supabase
      .from("tax_settings")
      .upsert(payload as never, { onConflict: "shop_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveTaxClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id?: string;
      organizationId: string;
      shopId: string | null;
      name: string;
      code: string;
      description: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload = {
      organization_id: data.organizationId,
      shop_id: data.shopId,
      name: data.name.trim(),
      code: data.code
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-"),
      description: data.description,
    };
    const query = data.id
      ? supabase
          .from("tax_classes")
          .update(payload as never)
          .eq("id", data.id)
      : supabase.from("tax_classes").insert(payload as never);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveTaxRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: TaxRateInput) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.rateBasisPoints < 0 || data.rateBasisPoints > 10000) {
      throw new Error("Der Steuersatz muss zwischen 0 % und 100 % liegen.");
    }
    const payload = {
      organization_id: data.organizationId,
      shop_id: data.shopId,
      tax_class_id: data.taxClassId,
      country_code: data.countryCode.trim().toUpperCase().slice(0, 2),
      region_code: data.regionCode,
      rate_basis_points: Math.round(data.rateBasisPoints),
      customer_type: data.customerType,
      valid_from: data.validFrom,
      valid_until: data.validUntil,
      status: data.status,
      source: "manual",
    };
    const query = data.id
      ? supabase
          .from("tax_rates")
          .update(payload as never)
          .eq("id", data.id)
      : supabase.from("tax_rates").insert(payload as never);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTaxRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tax_rates")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** What-if calculation without touching a cart. */
export const previewTax = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      organizationId: string;
      shopId: string;
      destinationCountryCode: string;
      customerType: "consumer" | "business";
      vatIdValid: boolean;
      shippingMinor: number;
      lines: { taxClassId: string | null; amountMinor: number; quantity: number }[];
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { previewTaxCalculation } = await import("./tax/tax.preview.server");
    return previewTaxCalculation({ ...data, actorId: userId });
  });

export const validateVatId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; vatId: string }) => data)
  .handler(async ({ data }) => {
    const { validateAndRecordVatId } = await import("./tax/vat.server");
    return validateAndRecordVatId({ organizationId: data.organizationId, vatId: data.vatId });
  });
