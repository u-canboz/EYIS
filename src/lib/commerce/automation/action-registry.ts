/**
 * Catalogue of the actions an automation may perform. Every entry maps to a
 * real adapter in actions.server.ts — nothing here is aspirational.
 *
 * The `capability` values double as the allowlist for the internal
 * `system_automation` runtime actor. Anything not listed here is rejected.
 */

export type ActionParamType =
  "text" | "textarea" | "number" | "select" | "template" | "group" | "endpoint" | "priority";

export type ActionParam = {
  key: string;
  label: string;
  type: ActionParamType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  help?: string;
};

export type ActionDefinition = {
  type: string;
  label: string;
  category: string;
  description: string;
  capability: string;
  params: ActionParam[];
  /** Which engine phase owns the underlying logic — shown in the UI. */
  engine: string;
};

export const ACTION_REGISTRY: ActionDefinition[] = [
  {
    type: "communication.send",
    label: "E-Mail senden",
    category: "Kommunikation",
    engine: "Communication Studio",
    description: "Versendet eine bestehende Vorlage über die Kommunikations-Engine.",
    capability: "communication.send",
    params: [
      { key: "templateKey", label: "Vorlage", type: "template", required: true },
      { key: "locale", label: "Sprache", type: "text", placeholder: "de-DE" },
    ],
  },
  {
    type: "invoice.create",
    label: "Rechnung erstellen",
    category: "Dokumente",
    engine: "Invoicing",
    description:
      "Erstellt einen Rechnungsentwurf zur Bestellung. Wird übersprungen, wenn der Shop Rechnungen bereits automatisch erzeugt.",
    capability: "invoice.create",
    params: [],
  },
  {
    type: "invoice.issue",
    label: "Rechnung festschreiben",
    category: "Dokumente",
    engine: "Invoicing",
    description:
      "Vergibt die Rechnungsnummer und erzeugt das PDF. Nur möglich, wenn die Rechnungseinstellungen das automatische Festschreiben erlauben.",
    capability: "invoice.issue",
    params: [],
  },
  {
    type: "fulfillment.create",
    label: "Versandauftrag anlegen",
    category: "Versand",
    engine: "Fulfillment",
    description: "Legt einen Versandauftrag über alle offenen Positionen der Bestellung an.",
    capability: "fulfillment.create",
    params: [],
  },
  {
    type: "customer.add_to_group",
    label: "Kunde zu Gruppe hinzufügen",
    category: "Kunden",
    engine: "Customers",
    description: "Ordnet den Kunden einer Kundengruppe zu.",
    capability: "customer.add_to_group",
    params: [{ key: "groupId", label: "Kundengruppe", type: "group", required: true }],
  },
  {
    type: "customer.remove_from_group",
    label: "Kunde aus Gruppe entfernen",
    category: "Kunden",
    engine: "Customers",
    description: "Entfernt den Kunden aus einer Kundengruppe.",
    capability: "customer.remove_from_group",
    params: [{ key: "groupId", label: "Kundengruppe", type: "group", required: true }],
  },
  {
    type: "inventory.create_alert",
    label: "Bestandswarnung erstellen",
    category: "Lager",
    engine: "Inventory",
    description: "Erzeugt eine Aufgabe mit Bestandsdetails für das Lagerteam.",
    capability: "inventory.create_alert",
    params: [{ key: "assignedTo", label: "Zuweisen an (Benutzer-ID)", type: "text" }],
  },
  {
    type: "return.notify_internal",
    label: "Team über Retoure informieren",
    category: "Retouren",
    engine: "Returns",
    description: "Erstellt eine interne Aufgabe zur Retoure.",
    capability: "return.notify_internal",
    params: [{ key: "assignedTo", label: "Zuweisen an (Benutzer-ID)", type: "text" }],
  },
  {
    type: "order.add_note",
    label: "Notiz zur Bestellung",
    category: "Bestellungen",
    engine: "Orders",
    description: "Hängt eine interne Notiz an die Bestellung.",
    capability: "order.add_note",
    params: [{ key: "note", label: "Notiz", type: "textarea", required: true }],
  },
  {
    type: "task.create",
    label: "Aufgabe erstellen",
    category: "Aufgaben",
    engine: "Tasks",
    description: "Legt eine Aufgabe in der Aufgaben-Inbox an.",
    capability: "task.create",
    params: [
      { key: "title", label: "Titel", type: "text", required: true },
      { key: "description", label: "Beschreibung", type: "textarea" },
      { key: "priority", label: "Priorität", type: "priority" },
      { key: "dueInHours", label: "Fällig in Stunden", type: "number" },
      { key: "assignedTo", label: "Zuweisen an (Benutzer-ID)", type: "text" },
    ],
  },
  {
    type: "webhook.send",
    label: "Webhook senden",
    category: "Integration",
    engine: "Webhooks",
    description: "Sendet die Ereignisdaten signiert an eine eigene HTTPS-Adresse.",
    capability: "webhook.send",
    params: [{ key: "endpointId", label: "Webhook-Ziel", type: "endpoint", required: true }],
  },
];

/** Capability allowlist of the internal `system_automation` runtime actor. */
export const SYSTEM_AUTOMATION_CAPABILITIES: ReadonlySet<string> = new Set(
  ACTION_REGISTRY.map((a) => a.capability),
);

export const SYSTEM_AUTOMATION_ACTOR = "system_automation" as const;

export function findAction(type: string) {
  return ACTION_REGISTRY.find((a) => a.type === type) ?? null;
}

export function actionLabel(type: string) {
  return findAction(type)?.label ?? type;
}

/** Actions that only make sense once the shop leaves automatic invoicing. */
export const INVOICE_ACTIONS = new Set(["invoice.create", "invoice.issue"]);
