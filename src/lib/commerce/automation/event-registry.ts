/**
 * Declarative catalogue of the domain events an automation may listen to.
 * The UI never invents event names or field paths — everything comes from here.
 */
import type { ConditionOperator } from "./automation.types";

export type FieldType = "string" | "number" | "money" | "boolean" | "date" | "enum";

export type EventField = {
  path: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
};

export type EventCategory =
  | "order"
  | "payment"
  | "shipping"
  | "document"
  | "return"
  | "customer"
  | "inventory";

export type EventDefinition = {
  type: string;
  label: string;
  category: EventCategory;
  description: string;
  entityKeyField: string | null;
  fields: EventField[];
  recommendedActions: string[];
};

export const CATEGORY_LABELS: Record<EventCategory | "schedule" | "manual", string> = {
  order: "Bestellung",
  payment: "Zahlung",
  shipping: "Versand",
  document: "Dokument",
  return: "Retoure",
  customer: "Kunde",
  inventory: "Lager",
  schedule: "Zeitplan",
  manual: "Manuell",
};

const NUMERIC_OPS: ConditionOperator[] = [
  "equals",
  "not_equals",
  "greater_than",
  "greater_or_equal",
  "less_than",
  "less_or_equal",
];
const STRING_OPS: ConditionOperator[] = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "in",
  "not_in",
  "exists",
  "not_exists",
];
const BOOL_OPS: ConditionOperator[] = ["equals", "not_equals"];

export function operatorsFor(type: FieldType): ConditionOperator[] {
  if (type === "number" || type === "money" || type === "date") return NUMERIC_OPS;
  if (type === "boolean") return BOOL_OPS;
  return STRING_OPS;
}

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "ist gleich",
  not_equals: "ist nicht gleich",
  greater_than: "ist größer als",
  greater_or_equal: "ist mindestens",
  less_than: "ist kleiner als",
  less_or_equal: "ist höchstens",
  contains: "enthält",
  not_contains: "enthält nicht",
  in: "ist eine von",
  not_in: "ist keine von",
  exists: "ist vorhanden",
  not_exists: "ist nicht vorhanden",
};

const ORDER_FIELDS: EventField[] = [
  { path: "order_number", label: "Bestellnummer", type: "string" },
  { path: "total_gross_minor", label: "Bestellwert (Brutto, Cent)", type: "money" },
  { path: "currency", label: "Währung", type: "string" },
  { path: "item_count", label: "Anzahl Positionen", type: "number" },
  { path: "customer_email", label: "E-Mail des Kunden", type: "string" },
  { path: "customer_kind", label: "Kundentyp", type: "enum", options: [
    { value: "b2c", label: "Privatkunde" },
    { value: "b2b", label: "Geschäftskunde" },
  ] },
  { path: "shipping_country", label: "Lieferland", type: "string" },
  { path: "payment_status", label: "Zahlungsstatus", type: "string" },
];

export const EVENT_REGISTRY: EventDefinition[] = [
  {
    type: "order.created",
    label: "Bestellung wurde erstellt",
    category: "order",
    description: "Eine neue Bestellung ist entstanden.",
    entityKeyField: "order_id",
    fields: ORDER_FIELDS,
    recommendedActions: ["communication.send", "task.create"],
  },
  {
    type: "order.cancelled",
    label: "Bestellung wurde storniert",
    category: "order",
    description: "Eine Bestellung wurde storniert.",
    entityKeyField: "order_id",
    fields: ORDER_FIELDS,
    recommendedActions: ["communication.send", "task.create"],
  },
  {
    type: "payment.succeeded",
    label: "Zahlung war erfolgreich",
    category: "payment",
    description: "Eine Bestellung wurde vollständig bezahlt.",
    entityKeyField: "order_id",
    fields: [
      ...ORDER_FIELDS,
      { path: "payment_provider", label: "Zahlungsanbieter", type: "string" },
      { path: "amount_minor", label: "Zahlbetrag (Cent)", type: "money" },
    ],
    recommendedActions: ["invoice.create", "invoice.issue", "communication.send", "fulfillment.create"],
  },
  {
    type: "payment.failed",
    label: "Zahlung ist fehlgeschlagen",
    category: "payment",
    description: "Ein Zahlungsversuch wurde abgelehnt.",
    entityKeyField: "order_id",
    fields: [
      { path: "order_id", label: "Bestellung", type: "string" },
      { path: "payment_provider", label: "Zahlungsanbieter", type: "string" },
      { path: "error_code", label: "Fehlercode", type: "string" },
      { path: "amount_minor", label: "Betrag (Cent)", type: "money" },
    ],
    recommendedActions: ["task.create", "communication.send"],
  },
  {
    type: "refund.completed",
    label: "Rückerstattung abgeschlossen",
    category: "payment",
    description: "Eine Rückerstattung wurde erfolgreich ausgeführt.",
    entityKeyField: "refund_id",
    fields: [
      { path: "order_id", label: "Bestellung", type: "string" },
      { path: "amount_minor", label: "Erstatteter Betrag (Cent)", type: "money" },
      { path: "reason", label: "Grund", type: "string" },
    ],
    recommendedActions: ["communication.send"],
  },
  {
    type: "shipment.shipped",
    label: "Sendung wurde versendet",
    category: "shipping",
    description: "Ein Paket hat das Lager verlassen.",
    entityKeyField: "shipment_id",
    fields: [
      { path: "order_id", label: "Bestellung", type: "string" },
      { path: "carrier", label: "Versanddienstleister", type: "string" },
      { path: "tracking_number", label: "Sendungsnummer", type: "string" },
    ],
    recommendedActions: ["communication.send"],
  },
  {
    type: "shipment.delivered",
    label: "Sendung wurde zugestellt",
    category: "shipping",
    description: "Eine Sendung ist beim Kunden angekommen.",
    entityKeyField: "shipment_id",
    fields: [
      { path: "order_id", label: "Bestellung", type: "string" },
      { path: "carrier", label: "Versanddienstleister", type: "string" },
    ],
    recommendedActions: ["communication.send", "task.create"],
  },
  {
    type: "shipment.exception",
    label: "Versandproblem gemeldet",
    category: "shipping",
    description: "Der Dienstleister meldet ein Problem bei der Zustellung.",
    entityKeyField: "shipment_id",
    fields: [
      { path: "order_id", label: "Bestellung", type: "string" },
      { path: "carrier", label: "Versanddienstleister", type: "string" },
      { path: "status", label: "Status", type: "string" },
      { path: "message", label: "Meldung", type: "string" },
    ],
    recommendedActions: ["task.create", "communication.send"],
  },
  {
    type: "invoice.issued",
    label: "Rechnung wurde festgeschrieben",
    category: "document",
    description: "Eine Rechnung hat eine Nummer erhalten.",
    entityKeyField: "invoice_id",
    fields: [
      { path: "order_id", label: "Bestellung", type: "string" },
      { path: "invoice_number", label: "Rechnungsnummer", type: "string" },
      { path: "total_gross_minor", label: "Rechnungsbetrag (Cent)", type: "money" },
    ],
    recommendedActions: ["communication.send"],
  },
  {
    type: "return.requested",
    label: "Retoure wurde angemeldet",
    category: "return",
    description: "Ein Kunde meldet eine Rücksendung an.",
    entityKeyField: "return_id",
    fields: [
      { path: "order_id", label: "Bestellung", type: "string" },
      { path: "return_number", label: "Retourennummer", type: "string" },
      { path: "reason_code", label: "Grund", type: "string" },
      { path: "item_count", label: "Anzahl Artikel", type: "number" },
    ],
    recommendedActions: ["communication.send", "task.create"],
  },
  {
    type: "return.received",
    label: "Retoure ist eingegangen",
    category: "return",
    description: "Die Rücksendung ist im Lager angekommen.",
    entityKeyField: "return_id",
    fields: [
      { path: "order_id", label: "Bestellung", type: "string" },
      { path: "return_number", label: "Retourennummer", type: "string" },
    ],
    recommendedActions: ["task.create", "communication.send"],
  },
  {
    type: "customer.created",
    label: "Neuer Kunde angelegt",
    category: "customer",
    description: "Ein Kundenkonto wurde erstellt.",
    entityKeyField: "customer_id",
    fields: [
      { path: "email", label: "E-Mail", type: "string" },
      { path: "customer_kind", label: "Kundentyp", type: "enum", options: [
        { value: "b2c", label: "Privatkunde" },
        { value: "b2b", label: "Geschäftskunde" },
      ] },
    ],
    recommendedActions: ["communication.send", "customer.add_to_group"],
  },
  {
    type: "inventory.low_stock",
    label: "Bestand ist niedrig",
    category: "inventory",
    description: "Der verfügbare Bestand hat die Warnschwelle unterschritten.",
    entityKeyField: "variant_id",
    fields: [
      { path: "sku", label: "SKU", type: "string" },
      { path: "available", label: "Verfügbarer Bestand", type: "number" },
      { path: "threshold", label: "Warnschwelle", type: "number" },
      { path: "location_name", label: "Lagerort", type: "string" },
    ],
    recommendedActions: ["task.create", "inventory.create_alert"],
  },
  {
    type: "inventory.out_of_stock",
    label: "Bestand ist aufgebraucht",
    category: "inventory",
    description: "Ein Artikel ist nicht mehr verfügbar.",
    entityKeyField: "variant_id",
    fields: [
      { path: "sku", label: "SKU", type: "string" },
      { path: "location_name", label: "Lagerort", type: "string" },
    ],
    recommendedActions: ["task.create"],
  },
  {
    type: "cart.abandoned",
    label: "Warenkorb wurde abgebrochen",
    category: "order",
    description:
      "Ein Warenkorb blieb liegen. Marketing-Aktionen dafür benötigen eine gültige Einwilligung des Kunden.",
    entityKeyField: "cart_id",
    fields: [
      { path: "email", label: "E-Mail", type: "string" },
      { path: "total_gross_minor", label: "Warenkorbwert (Cent)", type: "money" },
      { path: "marketing_consent", label: "Marketing-Einwilligung", type: "boolean" },
    ],
    recommendedActions: ["communication.send"],
  },
];

export function findEvent(type: string) {
  return EVENT_REGISTRY.find((e) => e.type === type) ?? null;
}

export function eventLabel(type: string) {
  return findEvent(type)?.label ?? type;
}

export function fieldLabel(eventType: string, path: string) {
  return findEvent(eventType)?.fields.find((f) => f.path === path)?.label ?? path;
}

/** Events that require an explicit marketing consent flag before sending. */
export const MARKETING_EVENTS = new Set(["cart.abandoned"]);
