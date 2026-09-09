/**
 * Verbindung zur EYIS Store API.
 *
 * Der Publishable Key ist kein Geheimnis und darf im Client-Bundle stehen.
 * Fehlt eine der beiden Angaben, läuft die Storefront im Demo-Modus: gleiche
 * Codepfade, gleiche SDK-Aufrufe, nur mit lokalen Beispieldaten.
 */
export const COMMERCE_API_URL = (import.meta.env["VITE_COMMERCE_API_URL"] as string | undefined) ?? "";
export const COMMERCE_PUBLISHABLE_KEY =
  (import.meta.env["VITE_COMMERCE_PUBLISHABLE_KEY"] as string | undefined) ?? "";

export const isCommerceConnected = Boolean(COMMERCE_API_URL && COMMERCE_PUBLISHABLE_KEY);
