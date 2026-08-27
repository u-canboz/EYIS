/**
 * Umrechnung zwischen Minor Units (Integer) und der Dezimaldarstellung, die
 * PayPal und Mollie in ihren APIs erwarten. Kein Fließkomma-Rechnen mit
 * Beträgen: die Umwandlung läuft rein über Ganzzahlen und Zeichenketten.
 */

/** Währungen ohne Nachkommastellen (ISO 4217 Exponent 0). */
const ZERO_DECIMAL = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG",
  "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

/** Währungen mit drei Nachkommastellen. */
const THREE_DECIMAL = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

export function currencyExponent(currencyCode: string): number {
  const code = currencyCode.toUpperCase();
  if (ZERO_DECIMAL.has(code)) return 0;
  if (THREE_DECIMAL.has(code)) return 3;
  return 2;
}

/** 1999, "EUR" → "19.99" */
export function minorToDecimalString(amountMinor: number, currencyCode: string): string {
  const exponent = currencyExponent(currencyCode);
  const negative = amountMinor < 0;
  const digits = String(Math.abs(Math.trunc(amountMinor))).padStart(exponent + 1, "0");
  const whole = digits.slice(0, digits.length - exponent) || "0";
  const fraction = exponent > 0 ? `.${digits.slice(digits.length - exponent)}` : "";
  return `${negative ? "-" : ""}${whole}${fraction}`;
}

/** "19.99", "EUR" → 1999 */
export function decimalStringToMinor(value: string, currencyCode: string): number {
  const exponent = currencyExponent(currencyCode);
  const trimmed = value.trim();
  const negative = trimmed.startsWith("-");
  const [whole = "0", fraction = ""] = trimmed.replace(/^[-+]/, "").split(".");
  const padded = (fraction + "0".repeat(exponent)).slice(0, exponent);
  const minor = Number(`${whole}${padded}`);
  if (!Number.isFinite(minor)) throw new Error(`Ungültiger Betrag: ${value}`);
  return negative ? -minor : minor;
}
