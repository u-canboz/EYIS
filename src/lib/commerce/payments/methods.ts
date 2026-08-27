/**
 * Client-sichere Beschreibung der Zahlungsarten je Anbieter.
 *
 * Die Storefront rendert ausschließlich das, was die Discovery liefert. Hier
 * stehen nur Anzeige-Metadaten — keine Zugangsdaten, keine Endpunkte, keine
 * anbieterspezifische Logik.
 */

export type PaymentMethodDefinition = {
  /** Stabiler Methodenschlüssel, anbieterübergreifend eindeutig lesbar. */
  method: string;
  label: string;
  /** ISO-3166-Länder; leer bedeutet keine Einschränkung. */
  countries: string[];
  /** ISO-4217-Währungen; leer bedeutet keine Einschränkung. */
  currencies: string[];
  /** Ablauf im Checkout: Weiterleitung zum Anbieter oder direkte Bestätigung. */
  flow: "redirect" | "direct";
};

export const PROVIDER_METHODS: Record<string, PaymentMethodDefinition[]> = {
  stripe: [
    { method: "card", label: "Kredit- und Debitkarte", countries: [], currencies: [], flow: "redirect" },
    { method: "sepa_debit", label: "SEPA-Lastschrift", countries: [], currencies: ["EUR"], flow: "redirect" },
    { method: "sofort", label: "Sofortüberweisung", countries: ["DE", "AT", "BE", "NL"], currencies: ["EUR"], flow: "redirect" },
  ],
  paypal: [
    { method: "paypal", label: "PayPal", countries: [], currencies: [], flow: "redirect" },
  ],
  mollie: [
    { method: "card", label: "Kredit- und Debitkarte", countries: [], currencies: [], flow: "redirect" },
    { method: "ideal", label: "iDEAL", countries: ["NL"], currencies: ["EUR"], flow: "redirect" },
    { method: "bancontact", label: "Bancontact", countries: ["BE"], currencies: ["EUR"], flow: "redirect" },
    { method: "sofort", label: "Sofortüberweisung", countries: ["DE", "AT", "BE", "NL"], currencies: ["EUR"], flow: "redirect" },
    { method: "banktransfer", label: "Überweisung", countries: [], currencies: ["EUR"], flow: "redirect" },
    { method: "paypal", label: "PayPal über Mollie", countries: [], currencies: [], flow: "redirect" },
  ],
  mock: [
    { method: "test", label: "Testzahlung", countries: [], currencies: [], flow: "direct" },
  ],
};

/** Anzeigename einer Mollie-Methoden-ID, falls das Konto sie freigeschaltet hat. */
export function methodsForProvider(
  provider: string,
  enabledMethods: string[] | null,
): PaymentMethodDefinition[] {
  const all = PROVIDER_METHODS[provider] ?? [];
  if (!enabledMethods || enabledMethods.length === 0) return all;
  const allowed = new Set(enabledMethods);
  const filtered = all.filter((m) => allowed.has(m.method));
  return filtered.length > 0 ? filtered : all;
}

export function methodMatchesContext(
  definition: PaymentMethodDefinition,
  context: { country?: string | null; currency?: string | null },
): boolean {
  const country = context.country?.toUpperCase() ?? null;
  const currency = context.currency?.toUpperCase() ?? null;
  if (country && definition.countries.length > 0 && !definition.countries.includes(country))
    return false;
  if (currency && definition.currencies.length > 0 && !definition.currencies.includes(currency))
    return false;
  return true;
}
