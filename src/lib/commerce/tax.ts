/**
 * Public tax entry point.
 *
 * Phase 6 replaced the zero-tax shim with the real German/EU tax engine.
 * Pure types and calculation live in ./tax/tax.types and ./tax/tax.engine;
 * database access lives in ./tax/tax.server (server-only).
 */
export {
  TAX_ENGINE_VERSION,
  EU_COUNTRIES,
  isEuCountry,
  type TaxBreakdownEntry,
  type TaxCalculationMode,
  type TaxClassRef,
  type TaxContext,
  type TaxCustomerType,
  type TaxLineInput,
  type TaxLineResult,
  type TaxRateRule,
  type TaxReasonCode,
  type TaxResult,
  type TaxShippingResult,
  type ShippingTaxStrategy,
} from "./tax/tax.types";

export { calculateTax, netFromGross, resolveRate, taxFromNet } from "./tax/tax.engine";

export const TAX_REASON_LABELS: Record<string, string> = {
  standard_rate: "Regelsteuersatz",
  reduced_rate: "Ermäßigter Steuersatz",
  zero_rate: "Steuerfrei",
  reverse_charge: "Reverse Charge",
  small_business_exemption: "Kleinunternehmerregelung (§ 19 UStG)",
  oss_destination_rate: "OSS — Bestimmungslandprinzip",
  domestic_rate: "Inlandssteuersatz",
  no_rate_found: "Kein Steuersatz hinterlegt",
  unknown: "Unbekannt",
};
