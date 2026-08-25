/**
 * Tax architecture only (Phase 4). No tax is calculated yet — every provider
 * returns 0 so that later phases can plug in real tax logic without touching
 * the cart engine.
 */

export type TaxLineInput = {
  lineId: string;
  variantId: string;
  quantity: number;
  lineTotalMinor: number;
};

export type TaxContext = {
  organizationId: string;
  shopId: string;
  currencyCode: string;
  countryCode: string | null;
  regionCode: string | null;
  lines: TaxLineInput[];
  shippingMinor: number;
};

export type TaxResult = {
  taxMinor: number;
  lines: { lineId: string; taxMinor: number }[];
  provider: string;
};

export interface TaxProvider {
  readonly name: string;
  calculate(context: TaxContext): Promise<TaxResult> | TaxResult;
}

/** The only provider in Phase 4: everything is tax free / net = gross. */
export const zeroTaxProvider: TaxProvider = {
  name: "zero",
  calculate(context) {
    return {
      taxMinor: 0,
      lines: context.lines.map((l) => ({ lineId: l.lineId, taxMinor: 0 })),
      provider: "zero",
    };
  },
};

export function getTaxProvider(): TaxProvider {
  return zeroTaxProvider;
}
