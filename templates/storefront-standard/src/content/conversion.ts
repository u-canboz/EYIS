/**
 * Conversion-Inhalte der Storefront.
 *
 * Diese Datei enthält ausschließlich redaktionelle Standardtexte. Sie enthält
 * bewusst keine erfundenen Bewertungen und keine Versprechen, die eine
 * Installation nicht halten kann. Alle Angaben hier vor dem Livegang prüfen
 * und an das eigene Angebot anpassen. Preise, Steuern, Bestände und Versand kommen weiterhin
 * ausschließlich vom Shopsystem.
 */
import type { StoreReview } from "@/components/store/Reviews";

/** Schwelle für versandkostenfreie Lieferung (Beispielwert, in Cent). */
export const FREE_SHIPPING_THRESHOLD_MINOR = 4900;

/**
 * Laufband im Kopfbereich. Standard: leer — jede Aussage hier muss stimmen.
 * Beispiel: ["Versandkostenfrei ab 49 EUR innerhalb Deutschlands"]
 */
export const promoMessages: string[] = [];

/** Vertrauenspunkte. Nur Aussagen, die die Installation wirklich einhält. */
export const guarantees = [
  {
    title: "Sichere Bezahlung",
    text: "Bezahlung über geprüfte Anbieter, verschlüsselt übertragen.",
  },
  {
    title: "14 Tage Widerrufsrecht",
    text: "Rückgabe innerhalb der gesetzlichen Frist, ohne Begründung.",
  },
  {
    title: "Nachvollziehbarer Versand",
    text: "Zu jeder Sendung erhältst du eine Bestätigung per E-Mail.",
  },
  {
    title: "Persönlicher Kontakt",
    text: "Fragen beantworten wir direkt per E-Mail.",
  },
] as const;

/** Fallback-Zahlarten, falls das Shopsystem noch keine Anbieter meldet. */
export const paymentLabels = [
  "PayPal",
  "Klarna",
  "Kreditkarte",
  "Apple Pay",
  "Google Pay",
  "Kauf auf Rechnung",
  "SEPA-Lastschrift",
] as const;

/**
 * Bewertungen sind in der Standardvorlage bewusst leer.
 *
 * Es werden niemals erfundene Kundenstimmen ausgeliefert. Sobald echte,
 * belegbare Bewertungen vorliegen, werden sie hier (oder später über das
 * Shopsystem) eingetragen; die Abschnitte blenden sich dann automatisch ein.
 */
export const reviewSummary: { average: number; count: number; source: string } | null = null;

export const reviews: StoreReview[] = [];

/**
 * Häufige Fragen auf der Produktseite. Bewusst ohne Liefer- und
 * Fristversprechen — diese Angaben gehören in die eigenen Rechtstexte und
 * Versandbedingungen.
 */
export const productFaq = [
  {
    question: "Wie läuft der Versand ab?",
    answer:
      "Nach dem Bestellabschluss erhältst du eine Bestätigung per E-Mail. Sobald die Sendung unser Lager verlässt, informieren wir dich erneut. Die Versandbedingungen findest du auf der Seite Versand.",
  },
  {
    question: "Was kostet der Versand?",
    answer:
      "Die Versandkosten werden dir vor dem Bestellabschluss vollständig angezeigt und richten sich nach Zielland und Warenkorb.",
  },
  {
    question: "Kann ich zurückgeben, wenn mir etwas nicht gefällt?",
    answer:
      "Ja. Es gilt das gesetzliche Widerrufsrecht von 14 Tagen. Die Einzelheiten stehen in der Widerrufsbelehrung.",
  },
  {
    question: "Welche Zahlarten kann ich nutzen?",
    answer:
      "Welche Zahlarten verfügbar sind, siehst du im Bestellabschluss. Dort werden nur die tatsächlich freigeschalteten Anbieter angeboten.",
  },
] as const;

/**
 * Hinweis beim Verlassen der Seite. `enabled: false` liefert die Vorlage ohne
 * Rabattversprechen aus; ein Gutschein muss im Shopsystem wirklich existieren.
 */
export const exitIntent = {
  enabled: false,
  eyebrow: "Bevor du gehst",
  title: "Neues aus dem Sortiment per E-Mail",
  text: "Melde dich zum Newsletter an und erfahre, wenn neue Produkte eintreffen.",
  dismiss: "Nein danke",
} as const;
