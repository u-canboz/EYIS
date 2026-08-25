/**
 * Formatting only. The client never computes prices — it formats minor units
 * that the server already resolved.
 */

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK"]);

export function fractionDigits(currency: string) {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2;
}

export function formatMoney(amountMinor: number | null | undefined, currency = "EUR", locale = "de-DE") {
  if (amountMinor === null || amountMinor === undefined) return "—";
  const digits = fractionDigits(currency);
  const value = amountMinor / 10 ** digits;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Parses user input like "29,90" into minor units. Input only, no pricing logic. */
export function parseMoneyToMinor(input: string, currency = "EUR"): number | null {
  const normalized = input.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!normalized || !/^-?\d*(\.\d*)?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10 ** fractionDigits(currency));
}

export function minorToInput(amountMinor: number, currency = "EUR") {
  const digits = fractionDigits(currency);
  return (amountMinor / 10 ** digits).toFixed(digits).replace(".", ",");
}

/** Basis points (1000 = 10 %) for percentage promotions. */
export function formatPercentBp(bp: number) {
  return `${(bp / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;
}

export const PRICE_TYPE_LABELS: Record<string, string> = {
  base: "Normalpreis",
  sale: "Aktionspreis",
  tier: "Mengenstaffel",
  customer_group: "Kundengruppenpreis",
  override: "Sonderpreis",
};

export const PROMOTION_TYPE_LABELS: Record<string, string> = {
  percentage: "Prozent-Rabatt",
  fixed_amount: "Fester Rabatt",
  fixed_price: "Festpreis",
  buy_x_get_y: "Buy X Get Y",
  free_shipping: "Gratisversand",
};
