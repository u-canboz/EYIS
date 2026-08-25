/** Ready-made automations a merchant can install with one click. */
import type { ConditionGroup } from "./automation.types";

export type AutomationTemplate = {
  key: string;
  name: string;
  description: string;
  triggerType: "domain_event" | "schedule";
  triggerConfig: Record<string, unknown>;
  conditions: ConditionGroup;
  actions: { actionType: string; config: Record<string, unknown>; delaySeconds?: number }[];
  /** Set when the template touches invoicing and depends on shop settings. */
  requiresManualInvoicing?: boolean;
};

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    key: "order_paid_invoice",
    name: "Bestellung bezahlt → Rechnung",
    description:
      "Erstellt und schreibt die Rechnung fest, sobald eine Bestellung bezahlt ist. Wird übersprungen, wenn der Shop Rechnungen ohnehin automatisch erzeugt.",
    triggerType: "domain_event",
    triggerConfig: { eventType: "order.paid" },
    conditions: { mode: "all", conditions: [] },
    requiresManualInvoicing: true,
    actions: [
      { actionType: "invoice.create", config: {} },
      { actionType: "invoice.issue", config: {} },
    ],
  },
  {
    key: "order_paid_fulfillment",
    name: "Bestellung bezahlt → Versandauftrag",
    description: "Legt direkt nach dem Zahlungseingang einen Versandauftrag für das Lager an.",
    triggerType: "domain_event",
    triggerConfig: { eventType: "order.paid" },
    conditions: { mode: "all", conditions: [] },
    actions: [{ actionType: "fulfillment.create", config: {} }],
  },
  {
    key: "high_value_review",
    name: "Große Bestellung prüfen",
    description: "Erstellt eine Aufgabe, wenn eine Bestellung über 500 € eingeht.",
    triggerType: "domain_event",
    triggerConfig: { eventType: "order.created" },
    conditions: {
      mode: "all",
      conditions: [{ field: "total_minor", operator: "greater_than", value: 50000 }],
    },
    actions: [
      {
        actionType: "task.create",
        config: { title: "Große Bestellung prüfen", priority: "high", dueInHours: 8 },
      },
    ],
  },
  {
    key: "shipment_exception",
    name: "Versandproblem melden",
    description: "Meldet Sendungen mit Zustellproblem sofort als Aufgabe an den Support.",
    triggerType: "domain_event",
    triggerConfig: { eventType: "shipment.exception" },
    conditions: { mode: "all", conditions: [] },
    actions: [
      {
        actionType: "task.create",
        config: { title: "Zustellproblem klären", priority: "urgent", dueInHours: 4 },
      },
    ],
  },
  {
    key: "return_requested",
    name: "Retoure angemeldet → Team informieren",
    description: "Erstellt eine Aufgabe, sobald eine Retoure angemeldet wird.",
    triggerType: "domain_event",
    triggerConfig: { eventType: "return.requested" },
    conditions: { mode: "all", conditions: [] },
    actions: [{ actionType: "return.notify_internal", config: {} }],
  },
  {
    key: "abandoned_cart",
    name: "Liegengebliebene Warenkörbe erinnern",
    description: "Schickt nach 24 Stunden eine Erinnerung an Kundinnen mit einem offenen Warenkorb.",
    triggerType: "schedule",
    triggerConfig: { scheduleKind: "abandoned_carts", olderThanHours: 24, everyMinutes: 60 },
    conditions: { mode: "all", conditions: [] },
    actions: [{ actionType: "communication.send", config: { templateKey: "cart_abandoned" } }],
  },
  {
    key: "unfulfilled_orders",
    name: "Nicht versandte Bestellungen aufspüren",
    description: "Erstellt täglich Aufgaben für bezahlte Bestellungen, die seit 48 Stunden liegen.",
    triggerType: "schedule",
    triggerConfig: { scheduleKind: "unfulfilled_orders", olderThanHours: 48, everyMinutes: 720 },
    conditions: { mode: "all", conditions: [] },
    actions: [
      {
        actionType: "task.create",
        config: { title: "Bestellung wartet auf Versand", priority: "high", dueInHours: 12 },
      },
    ],
  },
  {
    key: "low_stock",
    name: "Niedriger Bestand melden",
    description: "Prüft stündlich alle Bestände und erstellt Aufgaben für Artikel unter der Meldegrenze.",
    triggerType: "schedule",
    triggerConfig: { scheduleKind: "low_stock", everyMinutes: 60 },
    conditions: { mode: "all", conditions: [] },
    actions: [{ actionType: "inventory.create_alert", config: {} }],
  },
];

export function findTemplate(key: string) {
  return AUTOMATION_TEMPLATES.find((t) => t.key === key) ?? null;
}
