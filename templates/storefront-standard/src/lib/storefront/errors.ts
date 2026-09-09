import { isCommerceError } from "@/lib/store-sdk";

const MESSAGES: Record<string, string> = {
  NOT_FOUND: "Das haben wir leider nicht gefunden.",
  VALIDATION_ERROR: "Bitte prüfe deine Eingaben.",
  UNAUTHORIZED: "Bitte melde dich an, um fortzufahren.",
  FORBIDDEN: "Dafür fehlt die Berechtigung.",
  RATE_LIMITED: "Zu viele Anfragen. Bitte kurz warten.",
  CART_EXPIRED: "Dein Warenkorb ist abgelaufen. Bitte lege die Artikel erneut hinein.",
  CUSTOMER_SESSION_EXPIRED: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
  OUT_OF_STOCK: "Dieser Artikel ist nicht mehr in der gewünschten Menge verfügbar.",
  PRICE_CHANGED: "Der Preis hat sich geändert. Bitte prüfe deinen Warenkorb.",
  PAYMENT_FAILED: "Die Zahlung konnte nicht abgeschlossen werden.",
  CONFLICT: "Das hat so nicht funktioniert. Bitte versuche es erneut.",
  INTERNAL_ERROR: "Es gab ein technisches Problem. Bitte versuche es erneut.",
};

export function errorMessage(error: unknown): string {
  if (isCommerceError(error)) return error.message || MESSAGES[error.code] || MESSAGES["INTERNAL_ERROR"]!;
  if (error instanceof Error && error.message) return error.message;
  return MESSAGES["INTERNAL_ERROR"]!;
}

export function errorCode(error: unknown): string | null {
  return isCommerceError(error) ? error.code : null;
}

export function fieldErrors(error: unknown): Record<string, string> {
  return isCommerceError(error) ? (error.fieldErrors ?? {}) : {};
}
