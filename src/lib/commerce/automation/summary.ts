/** Turns a rule definition into a plain-German sentence for non-technical users. */
import { eventLabel, fieldLabel, OPERATOR_LABELS } from "./event-registry";
import { actionLabel } from "./action-registry";
import type { Condition, ConditionGroup } from "./automation.types";

function isGroup(node: Condition | ConditionGroup): node is ConditionGroup {
  return (node as ConditionGroup).conditions !== undefined;
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "–";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "ja" : "nein";
  return String(value);
}

export function describeConditions(
  group: ConditionGroup | null | undefined,
  eventType: string,
): string[] {
  if (!group || group.conditions.length === 0) return [];
  return group.conditions.map((node) => {
    if (isGroup(node)) {
      const inner = describeConditions(node, eventType);
      return `(${inner.join(node.mode === "all" ? " und " : " oder ")})`;
    }
    const op = OPERATOR_LABELS[node.operator] ?? node.operator;
    const needsValue = node.operator !== "exists" && node.operator !== "not_exists";
    return `${fieldLabel(eventType, node.field)} ${op}${needsValue ? ` ${formatValue(node.value)}` : ""}`;
  });
}

export function describeTrigger(triggerType: string, config: Record<string, unknown>): string {
  if (triggerType === "manual") return "Wird manuell gestartet";
  if (triggerType === "schedule") {
    const every = Number(config["everyMinutes"] ?? 60);
    const kind = String(config["scheduleKind"] ?? "");
    const kinds: Record<string, string> = {
      abandoned_carts: "liegengebliebene Warenkörbe",
      unfulfilled_orders: "nicht versandte Bestellungen",
      low_stock: "niedrige Bestände",
      overdue_invoices: "überfällige Rechnungen",
      pending_returns: "offene Retouren",
    };
    const label = kinds[kind] ?? "passende Datensätze";
    const rhythm = every % 1440 === 0 ? `alle ${every / 1440} Tage` : every >= 60 ? `alle ${Math.round(every / 60)} Stunden` : `alle ${every} Minuten`;
    return `Prüft ${rhythm} auf ${label}`;
  }
  return `Wenn „${eventLabel(String(config["eventType"] ?? ""))}“ passiert`;
}

export function describeRule(input: {
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  conditions: ConditionGroup | null;
  actions: { actionType: string }[];
}): string {
  const trigger = describeTrigger(input.triggerType, input.triggerConfig);
  const eventType = String(input.triggerConfig["eventType"] ?? "");
  const conds = describeConditions(input.conditions, eventType);
  const condPart = conds.length
    ? ` und ${input.conditions?.mode === "any" ? "mindestens eine Bedingung zutrifft" : "alle Bedingungen zutreffen"} (${conds.join(input.conditions?.mode === "any" ? " oder " : " und ")})`
    : "";
  const actions = input.actions.map((a) => actionLabel(a.actionType));
  const actionPart = actions.length ? actions.join(", dann ") : "noch keine Aktion";
  return `${trigger}${condPart}: ${actionPart}.`;
}
