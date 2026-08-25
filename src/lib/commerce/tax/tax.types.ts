/**
 * Phase 6 — Tax Engine (Deutschland / EU).
 *
 * Money is always integer minor units. Rates are basis points (1900 = 19 %).
 * Everything here is pure data — no IO, no framework imports.
 */

export const TAX_ENGINE_VERSION = "tax-engine-1.0.0";

export type TaxCalculationMode = "gross" | "net";
export type TaxCustomerType = "consumer" | "business" | "any";
export type ShippingTaxStrategy = "fixed_class" | "proportional" | "highest_rate";

export type TaxReasonCode =
  | "standard_rate"
  | "reduced_rate"
  | "zero_rate"
  | "reverse_charge"
  | "small_business_exemption"
  | "oss_destination_rate"
  | "domestic_rate"
  | "no_rate_found"
  | "unknown";

export type TaxClassRef = {
  id: string | null;
  code: string;
  name: string;
};

export type TaxRateRule = {
  id: string;
  taxClassId: string;
  countryCode: string;
  regionCode: string | null;
  rateBasisPoints: number;
  customerType: TaxCustomerType;
  transactionType: string;
  priority: number;
  validFrom: string;
  validUntil: string | null;
  organizationId: string | null;
};

export type TaxLineInput = {
  lineId: string;
  variantId: string;
  quantity: number;
  /** Discounted line total in the shop's calculation mode (gross or net). */
  lineTotalMinor: number;
  taxClass: TaxClassRef;
};

export type TaxContext = {
  organizationId: string;
  shopId: string;
  currencyCode: string;
  calculationMode: TaxCalculationMode;
  /** Merchant home country, e.g. "DE". */
  homeCountryCode: string;
  /** Destination country of the delivery / service. */
  destinationCountryCode: string | null;
  destinationRegionCode: string | null;
  customerType: Exclude<TaxCustomerType, "any">;
  /** Only relevant for business customers inside the EU. */
  vatIdValid: boolean;
  ossEnabled: boolean;
  smallBusinessExemption: boolean;
  shippingMinor: number;
  shippingTaxStrategy: ShippingTaxStrategy;
  shippingTaxClass: TaxClassRef | null;
  lines: TaxLineInput[];
  rates: TaxRateRule[];
  now: string;
};

export type TaxLineResult = {
  lineId: string;
  netMinor: number;
  taxMinor: number;
  grossMinor: number;
  rateBasisPoints: number;
  taxClass: TaxClassRef;
  reasonCode: TaxReasonCode;
  countryCode: string | null;
};

export type TaxBreakdownEntry = {
  rateBasisPoints: number;
  label: string;
  netMinor: number;
  taxMinor: number;
  grossMinor: number;
  reasonCode: TaxReasonCode;
  countryCode: string | null;
};

export type TaxShippingResult = {
  netMinor: number;
  taxMinor: number;
  grossMinor: number;
  rateBasisPoints: number;
  reasonCode: TaxReasonCode;
};

export type TaxResult = {
  engineVersion: string;
  calculationMode: TaxCalculationMode;
  jurisdiction: string;
  customerType: Exclude<TaxCustomerType, "any">;
  reverseCharge: boolean;
  netTotalMinor: number;
  taxMinor: number;
  grossTotalMinor: number;
  lines: TaxLineResult[];
  shipping: TaxShippingResult;
  breakdown: TaxBreakdownEntry[];
  notes: string[];
};

/** EU member states (ISO 3166-1 alpha-2), used for OSS and reverse charge. */
export const EU_COUNTRIES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
] as const;

export function isEuCountry(code: string | null | undefined): boolean {
  return !!code && (EU_COUNTRIES as readonly string[]).includes(code.toUpperCase());
}
