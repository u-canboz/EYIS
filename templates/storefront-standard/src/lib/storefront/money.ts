/**
 * Beträge kommen ausschließlich als Ganzzahl in der kleinsten Währungseinheit
 * vom Server. Hier wird nur formatiert, nie gerechnet.
 */
export function formatMoney(amountMinor: number, currencyCode = "EUR", locale = "de-DE") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode || "EUR",
  }).format(amountMinor / 100);
}

export function formatDate(value: string | null | undefined, locale = "de-DE") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}
