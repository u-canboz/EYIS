import { describe, expect, it } from "vitest";
import { calculateTax, netFromGross, taxFromNet } from "../tax.engine";
import type { TaxClassRef, TaxContext, TaxRateRule } from "../tax.types";

const standardClass: TaxClassRef = { id: "tc-std", code: "standard", name: "Standard 19 %" };
const reducedClass: TaxClassRef = { id: "tc-red", code: "reduced", name: "Ermäßigt 7 %" };

function rate(over: Partial<TaxRateRule> & { taxClassId: string; countryCode: string; rateBasisPoints: number }): TaxRateRule {
  return {
    id: `${over.taxClassId}-${over.countryCode}-${over.rateBasisPoints}`,
    regionCode: null,
    customerType: "any",
    transactionType: "goods",
    priority: 100,
    validFrom: "2020-01-01T00:00:00.000Z",
    validUntil: null,
    organizationId: null,
    ...over,
  };
}

const rates: TaxRateRule[] = [
  rate({ taxClassId: "tc-std", countryCode: "DE", rateBasisPoints: 1900 }),
  rate({ taxClassId: "tc-red", countryCode: "DE", rateBasisPoints: 700 }),
  rate({ taxClassId: "tc-std", countryCode: "AT", rateBasisPoints: 2000 }),
  rate({ taxClassId: "tc-red", countryCode: "AT", rateBasisPoints: 1000 }),
];

function ctx(over: Partial<TaxContext> = {}): TaxContext {
  return {
    organizationId: "org",
    shopId: "shop",
    currencyCode: "EUR",
    calculationMode: "gross",
    homeCountryCode: "DE",
    destinationCountryCode: "DE",
    destinationRegionCode: null,
    customerType: "consumer",
    vatIdValid: false,
    ossEnabled: false,
    smallBusinessExemption: false,
    shippingMinor: 0,
    shippingTaxStrategy: "highest_rate",
    shippingTaxClass: null,
    lines: [
      { lineId: "l1", variantId: "v1", quantity: 1, lineTotalMinor: 11900, taxClass: standardClass },
    ],
    rates,
    now: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("tax helpers", () => {
  it("extracts net from gross with half-up rounding", () => {
    expect(netFromGross(11900, 1900)).toBe(10000);
    expect(netFromGross(999, 1900)).toBe(840);
    expect(netFromGross(500, 0)).toBe(500);
  });

  it("computes tax from net", () => {
    expect(taxFromNet(10000, 1900)).toBe(1900);
    expect(taxFromNet(10000, 700)).toBe(700);
    expect(taxFromNet(10000, 0)).toBe(0);
  });
});

describe("calculateTax — domestic", () => {
  it("splits a gross price into net and 19 % tax", () => {
    const r = calculateTax(ctx());
    expect(r.netTotalMinor).toBe(10000);
    expect(r.taxMinor).toBe(1900);
    expect(r.grossTotalMinor).toBe(11900);
    expect(r.lines[0]!.rateBasisPoints).toBe(1900);
    expect(r.reverseCharge).toBe(false);
  });

  it("adds tax on top in net mode", () => {
    const r = calculateTax(ctx({ calculationMode: "net", lines: [
      { lineId: "l1", variantId: "v1", quantity: 1, lineTotalMinor: 10000, taxClass: standardClass },
    ] }));
    expect(r.netTotalMinor).toBe(10000);
    expect(r.taxMinor).toBe(1900);
    expect(r.grossTotalMinor).toBe(11900);
  });

  it("uses the reduced rate for a reduced tax class", () => {
    const r = calculateTax(ctx({ lines: [
      { lineId: "l1", variantId: "v1", quantity: 2, lineTotalMinor: 10700, taxClass: reducedClass },
    ] }));
    expect(r.taxMinor).toBe(700);
    expect(r.netTotalMinor).toBe(10000);
  });

  it("groups mixed rates into one breakdown entry per rate", () => {
    const r = calculateTax(ctx({ lines: [
      { lineId: "l1", variantId: "v1", quantity: 1, lineTotalMinor: 11900, taxClass: standardClass },
      { lineId: "l2", variantId: "v2", quantity: 1, lineTotalMinor: 10700, taxClass: reducedClass },
      { lineId: "l3", variantId: "v3", quantity: 1, lineTotalMinor: 11900, taxClass: standardClass },
    ] }));
    expect(r.breakdown).toHaveLength(2);
    const std = r.breakdown.find((b) => b.rateBasisPoints === 1900)!;
    expect(std.taxMinor).toBe(3800);
    expect(r.taxMinor).toBe(4500);
  });
});

describe("calculateTax — cross border", () => {
  it("applies the destination rate when OSS is enabled", () => {
    const r = calculateTax(ctx({ ossEnabled: true, destinationCountryCode: "AT" }));
    expect(r.lines[0]!.rateBasisPoints).toBe(2000);
    expect(r.lines[0]!.reasonCode).toBe("oss_destination_rate");
    expect(r.jurisdiction).toBe("AT");
  });

  it("keeps the home rate when OSS is disabled", () => {
    const r = calculateTax(ctx({ ossEnabled: false, destinationCountryCode: "AT" }));
    expect(r.lines[0]!.rateBasisPoints).toBe(1900);
  });

  it("applies reverse charge for EU B2B with a valid VAT id", () => {
    const r = calculateTax(ctx({
      destinationCountryCode: "AT",
      customerType: "business",
      vatIdValid: true,
    }));
    expect(r.reverseCharge).toBe(true);
    expect(r.taxMinor).toBe(0);
    expect(r.lines[0]!.reasonCode).toBe("reverse_charge");
  });

  it("does not reverse charge without a valid VAT id", () => {
    const r = calculateTax(ctx({
      destinationCountryCode: "AT",
      customerType: "business",
      vatIdValid: false,
    }));
    expect(r.reverseCharge).toBe(false);
    expect(r.taxMinor).toBeGreaterThan(0);
  });

  it("does not reverse charge for domestic B2B", () => {
    const r = calculateTax(ctx({ customerType: "business", vatIdValid: true }));
    expect(r.reverseCharge).toBe(false);
    expect(r.lines[0]!.rateBasisPoints).toBe(1900);
  });

  it("zero-rates exports outside the EU", () => {
    const r = calculateTax(ctx({ destinationCountryCode: "US" }));
    expect(r.taxMinor).toBe(0);
  });
});

describe("calculateTax — exemptions and shipping", () => {
  it("charges no tax under the small business exemption", () => {
    const r = calculateTax(ctx({ smallBusinessExemption: true }));
    expect(r.taxMinor).toBe(0);
    expect(r.lines[0]!.reasonCode).toBe("small_business_exemption");
    expect(r.netTotalMinor).toBe(11900);
  });

  it("falls back to zero tax when no rate matches", () => {
    const r = calculateTax(ctx({ rates: [] }));
    expect(r.taxMinor).toBe(0);
    expect(r.lines[0]!.reasonCode).toBe("no_rate_found");
  });

  it("taxes shipping with the highest line rate", () => {
    const r = calculateTax(ctx({
      shippingMinor: 595,
      shippingTaxStrategy: "highest_rate",
      lines: [
        { lineId: "l1", variantId: "v1", quantity: 1, lineTotalMinor: 11900, taxClass: standardClass },
        { lineId: "l2", variantId: "v2", quantity: 1, lineTotalMinor: 10700, taxClass: reducedClass },
      ],
    }));
    expect(r.shipping.rateBasisPoints).toBe(1900);
    expect(r.shipping.grossMinor).toBe(595);
    expect(r.shipping.taxMinor).toBe(95);
  });

  it("splits shipping tax proportionally across rates", () => {
    const r = calculateTax(ctx({
      shippingMinor: 1000,
      shippingTaxStrategy: "proportional",
      lines: [
        { lineId: "l1", variantId: "v1", quantity: 1, lineTotalMinor: 11900, taxClass: standardClass },
        { lineId: "l2", variantId: "v2", quantity: 1, lineTotalMinor: 10700, taxClass: reducedClass },
      ],
    }));
    expect(r.shipping.taxMinor).toBeGreaterThan(0);
    expect(r.shipping.grossMinor).toBe(1000);
    expect(r.grossTotalMinor).toBe(11900 + 10700 + 1000);
  });

  it("keeps gross totals equal to net plus tax", () => {
    const r = calculateTax(ctx({
      shippingMinor: 495,
      lines: [
        { lineId: "l1", variantId: "v1", quantity: 3, lineTotalMinor: 3597, taxClass: standardClass },
        { lineId: "l2", variantId: "v2", quantity: 1, lineTotalMinor: 999, taxClass: reducedClass },
      ],
    }));
    expect(r.netTotalMinor + r.taxMinor).toBe(r.grossTotalMinor);
    expect(r.engineVersion).toMatch(/^tax-engine-/);
  });
});
