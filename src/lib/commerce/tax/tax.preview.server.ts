/** Server-only "what-if" tax preview used by the tax test tool. */
import { calculateTax } from "./tax.engine";
import { loadTaxClasses, loadTaxRates, loadTaxSettings } from "./tax.server";
import type { TaxClassRef, TaxContext } from "./tax.types";

export async function previewTaxCalculation(input: {
  organizationId: string;
  shopId: string;
  destinationCountryCode: string;
  customerType: "consumer" | "business";
  vatIdValid: boolean;
  shippingMinor: number;
  lines: { taxClassId: string | null; amountMinor: number; quantity: number }[];
  actorId?: string;
}) {
  const settings = await loadTaxSettings(input.organizationId, input.shopId);
  const [rates, classes] = await Promise.all([
    loadTaxRates(input.organizationId),
    loadTaxClasses(input.organizationId),
  ]);
  const fallback: TaxClassRef =
    classes.find((c) => c.id === settings.defaultTaxClassId) ??
    classes.find((c) => c.code === "standard") ?? { id: null, code: "standard", name: "Standard" };
  const shippingClass =
    (settings.shippingTaxClassId
      ? classes.find((c) => c.id === settings.shippingTaxClassId)
      : classes.find((c) => c.code === "shipping")) ?? null;

  const context: TaxContext = {
    organizationId: input.organizationId,
    shopId: input.shopId,
    currencyCode: "EUR",
    calculationMode: settings.calculationMode,
    homeCountryCode: settings.homeCountryCode,
    destinationCountryCode: input.destinationCountryCode,
    destinationRegionCode: null,
    customerType: settings.b2bEnabled ? input.customerType : "consumer",
    vatIdValid: settings.b2bEnabled && input.vatIdValid,
    ossEnabled: settings.euOssEnabled,
    smallBusinessExemption: settings.smallBusinessExemptionEnabled,
    shippingMinor: input.shippingMinor,
    shippingTaxStrategy: settings.shippingTaxStrategy,
    shippingTaxClass: shippingClass
      ? { id: shippingClass.id, code: shippingClass.code, name: shippingClass.name }
      : null,
    lines: input.lines.map((l, index) => {
      const cls = classes.find((c) => c.id === l.taxClassId);
      return {
        lineId: `preview-${index}`,
        variantId: `preview-${index}`,
        quantity: l.quantity,
        lineTotalMinor: l.amountMinor * l.quantity,
        taxClass: cls ? { id: cls.id, code: cls.code, name: cls.name } : fallback,
      };
    }),
    rates,
    now: new Date().toISOString(),
  };

  return { result: calculateTax(context), settings };
}
