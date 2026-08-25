/**
 * Pure tax resolution. Deterministic, integer-only, no IO.
 *
 * Order of decisions per line:
 *   1. Small business exemption (§ 19 UStG)  -> 0 %, reason small_business_exemption
 *   2. Reverse charge (EU B2B, valid VAT id, cross border) -> 0 %
 *   3. Export outside the EU -> 0 %
 *   4. Destination country rate (OSS) or home country rate
 *   5. No matching rate -> 0 %, reason no_rate_found
 */
import {
  TAX_ENGINE_VERSION,
  isEuCountry,
  type TaxBreakdownEntry,
  type TaxContext,
  type TaxLineResult,
  type TaxRateRule,
  type TaxReasonCode,
  type TaxResult,
  type TaxShippingResult,
} from "./tax.types";

/** Half-up rounding on non-negative integers. */
function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

export function netFromGross(grossMinor: number, bp: number): number {
  if (bp <= 0) return grossMinor;
  return roundHalfUp((grossMinor * 10000) / (10000 + bp));
}

export function taxFromNet(netMinor: number, bp: number): number {
  if (bp <= 0) return 0;
  return roundHalfUp((netMinor * bp) / 10000);
}

function ratesFor(
  context: TaxContext,
  taxClassId: string | null,
  countryCode: string,
): TaxRateRule[] {
  const now = Date.parse(context.now);
  return context.rates
    .filter((r) => {
      if (taxClassId && r.taxClassId !== taxClassId) return false;
      if (r.countryCode.toUpperCase() !== countryCode.toUpperCase()) return false;
      if (r.customerType !== "any" && r.customerType !== context.customerType) return false;
      if (
        r.regionCode &&
        context.destinationRegionCode &&
        r.regionCode !== context.destinationRegionCode
      )
        return false;
      if (Date.parse(r.validFrom) > now) return false;
      if (r.validUntil && Date.parse(r.validUntil) <= now) return false;
      return true;
    })
    .sort((a, b) => {
      // Organisation-specific overrides beat system presets, then priority, then id.
      const orgRank = (a.organizationId ? 0 : 1) - (b.organizationId ? 0 : 1);
      if (orgRank !== 0) return orgRank;
      const region = (a.regionCode ? 0 : 1) - (b.regionCode ? 0 : 1);
      if (region !== 0) return region;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.id.localeCompare(b.id);
    });
}

type Resolution = { bp: number; reason: TaxReasonCode; countryCode: string | null };

/** Resolves the applicable rate for one tax class under the given context. */
export function resolveRate(context: TaxContext, taxClassId: string | null): Resolution {
  const home = context.homeCountryCode.toUpperCase();
  const destination = (context.destinationCountryCode ?? home).toUpperCase();

  if (context.smallBusinessExemption) {
    return { bp: 0, reason: "small_business_exemption", countryCode: destination };
  }
  if (
    context.customerType === "business" &&
    context.vatIdValid &&
    isEuCountry(destination) &&
    destination !== home
  ) {
    return { bp: 0, reason: "reverse_charge", countryCode: destination };
  }
  if (!isEuCountry(destination)) {
    return { bp: 0, reason: "zero_rate", countryCode: destination };
  }

  const useDestination = context.ossEnabled && destination !== home;
  const country = useDestination ? destination : home;
  const match = ratesFor(context, taxClassId, country)[0] ?? ratesFor(context, taxClassId, home)[0];
  if (!match) return { bp: 0, reason: "no_rate_found", countryCode: country };

  const reason: TaxReasonCode =
    match.rateBasisPoints === 0
      ? "zero_rate"
      : useDestination
        ? "oss_destination_rate"
        : match.rateBasisPoints >= 1900
          ? "standard_rate"
          : "reduced_rate";
  return { bp: match.rateBasisPoints, reason, countryCode: country };
}

function split(amountMinor: number, bp: number, mode: "gross" | "net") {
  if (mode === "gross") {
    const net = netFromGross(amountMinor, bp);
    return { netMinor: net, taxMinor: amountMinor - net, grossMinor: amountMinor };
  }
  const tax = taxFromNet(amountMinor, bp);
  return { netMinor: amountMinor, taxMinor: tax, grossMinor: amountMinor + tax };
}

export function calculateTax(context: TaxContext): TaxResult {
  const notes: string[] = [];
  const lines: TaxLineResult[] = [];
  let reverseCharge = false;

  for (const line of context.lines) {
    const res = resolveRate(context, line.taxClass.id);
    if (res.reason === "reverse_charge") reverseCharge = true;
    if (res.reason === "no_rate_found") {
      notes.push(`Für die Steuerklasse „${line.taxClass.name}“ ist kein Steuersatz hinterlegt.`);
    }
    const amounts = split(Math.max(0, line.lineTotalMinor), res.bp, context.calculationMode);
    lines.push({
      lineId: line.lineId,
      ...amounts,
      rateBasisPoints: res.bp,
      taxClass: line.taxClass,
      reasonCode: res.reason,
      countryCode: res.countryCode,
    });
  }

  // ---- Shipping ----
  const shippingAmount = Math.max(0, context.shippingMinor);
  let shippingBp = 0;
  let shippingReason: TaxReasonCode = "zero_rate";
  if (shippingAmount > 0) {
    if (context.shippingTaxStrategy === "highest_rate" && lines.length) {
      const top = lines.reduce((a, b) => (b.rateBasisPoints > a.rateBasisPoints ? b : a));
      shippingBp = top.rateBasisPoints;
      shippingReason = top.reasonCode;
    } else if (context.shippingTaxStrategy === "proportional" && lines.length) {
      const base = lines.reduce((sum, l) => sum + l.netMinor, 0);
      shippingBp =
        base > 0
          ? Math.round(lines.reduce((sum, l) => sum + l.rateBasisPoints * l.netMinor, 0) / base)
          : 0;
      shippingReason = lines[0]!.reasonCode;
    } else {
      const res = resolveRate(context, context.shippingTaxClass?.id ?? null);
      shippingBp = res.bp;
      shippingReason = res.reason;
    }
  }
  const shippingAmounts = split(shippingAmount, shippingBp, context.calculationMode);
  const shipping: TaxShippingResult = {
    ...shippingAmounts,
    rateBasisPoints: shippingBp,
    reasonCode: shippingReason,
  };

  // ---- Breakdown grouped by rate ----
  const groups = new Map<string, TaxBreakdownEntry>();
  const push = (
    bp: number,
    reason: TaxReasonCode,
    countryCode: string | null,
    net: number,
    tax: number,
    gross: number,
  ) => {
    const key = `${bp}:${reason}:${countryCode ?? ""}`;
    const current = groups.get(key) ?? {
      rateBasisPoints: bp,
      label: `${(bp / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`,
      netMinor: 0,
      taxMinor: 0,
      grossMinor: 0,
      reasonCode: reason,
      countryCode,
    };
    current.netMinor += net;
    current.taxMinor += tax;
    current.grossMinor += gross;
    groups.set(key, current);
  };
  for (const l of lines)
    push(l.rateBasisPoints, l.reasonCode, l.countryCode, l.netMinor, l.taxMinor, l.grossMinor);
  if (shippingAmount > 0) {
    push(
      shipping.rateBasisPoints,
      shipping.reasonCode,
      context.destinationCountryCode,
      shipping.netMinor,
      shipping.taxMinor,
      shipping.grossMinor,
    );
  }

  const breakdown = [...groups.values()].sort((a, b) => b.rateBasisPoints - a.rateBasisPoints);
  const taxMinor = breakdown.reduce((s, b) => s + b.taxMinor, 0);
  const netTotalMinor = breakdown.reduce((s, b) => s + b.netMinor, 0);
  const grossTotalMinor = breakdown.reduce((s, b) => s + b.grossMinor, 0);

  if (reverseCharge) {
    notes.push("Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge).");
  }
  if (context.smallBusinessExemption) {
    notes.push("Kein Ausweis von Umsatzsteuer gemäß § 19 UStG.");
  }

  return {
    engineVersion: TAX_ENGINE_VERSION,
    calculationMode: context.calculationMode,
    jurisdiction: (context.destinationCountryCode ?? context.homeCountryCode).toUpperCase(),
    customerType: context.customerType,
    reverseCharge,
    netTotalMinor,
    taxMinor,
    grossTotalMinor,
    lines,
    shipping,
    breakdown,
    notes,
  };
}
