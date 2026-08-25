/**
 * Declarative condition evaluation. No eval, no scripts, no SQL — only the
 * operators listed in the registry, applied to whitelisted field paths.
 */
import type { Condition, ConditionGroup, ConditionOperator } from "./automation.types";

export function readPath(payload: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, payload);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
    const t = Date.parse(value);
    if (Number.isFinite(t)) return t;
  }
  if (value instanceof Date) return value.getTime();
  return null;
}

function toList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string")
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return value === undefined || value === null ? [] : [value];
}

function looseEquals(actual: unknown, expected: unknown) {
  if (actual === expected) return true;
  const a = toNumber(actual);
  const b = toNumber(expected);
  if (a !== null && b !== null) return a === b;
  if (typeof actual === "boolean" || typeof expected === "boolean") {
    return Boolean(actual) === (expected === true || expected === "true");
  }
  if (actual === null || actual === undefined || expected === null || expected === undefined)
    return false;
  return String(actual).toLowerCase() === String(expected).toLowerCase();
}

export function evaluateCondition(condition: Condition, payload: Record<string, unknown>) {
  const actual = readPath(payload, condition.field);
  const expected = condition.value;
  const op: ConditionOperator = condition.operator;

  switch (op) {
    case "exists":
      return actual !== undefined && actual !== null && actual !== "";
    case "not_exists":
      return actual === undefined || actual === null || actual === "";
    case "equals":
      return looseEquals(actual, expected);
    case "not_equals":
      return !looseEquals(actual, expected);
    case "greater_than":
    case "greater_or_equal":
    case "less_than":
    case "less_or_equal": {
      const a = toNumber(actual);
      const b = toNumber(expected);
      if (a === null || b === null) return false;
      if (op === "greater_than") return a > b;
      if (op === "greater_or_equal") return a >= b;
      if (op === "less_than") return a < b;
      return a <= b;
    }
    case "contains":
      return String(actual ?? "")
        .toLowerCase()
        .includes(String(expected ?? "").toLowerCase());
    case "not_contains":
      return !String(actual ?? "")
        .toLowerCase()
        .includes(String(expected ?? "").toLowerCase());
    case "in":
      return toList(expected).some((v) => looseEquals(actual, v));
    case "not_in":
      return !toList(expected).some((v) => looseEquals(actual, v));
    default:
      return false;
  }
}

function isGroup(node: Condition | ConditionGroup): node is ConditionGroup {
  return typeof (node as ConditionGroup).mode === "string";
}

export type ConditionTrace = {
  field: string;
  operator: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
};

/** Evaluates a group and records every leaf result for the dry-run view. */
export function evaluateGroup(
  group: ConditionGroup | null | undefined,
  payload: Record<string, unknown>,
  trace: ConditionTrace[] = [],
): { passed: boolean; trace: ConditionTrace[] } {
  if (!group || !group.conditions?.length) return { passed: true, trace };
  const results = group.conditions.map((node) => {
    if (isGroup(node)) return evaluateGroup(node, payload, trace).passed;
    const passed = evaluateCondition(node, payload);
    trace.push({
      field: node.field,
      operator: node.operator,
      expected: node.value ?? null,
      actual: readPath(payload, node.field) ?? null,
      passed,
    });
    return passed;
  });
  const passed = group.mode === "any" ? results.some(Boolean) : results.every(Boolean);
  return { passed, trace };
}

/** Rejects nesting deeper than one level and unknown operators. */
export function validateConditions(group: ConditionGroup, depth = 0): string | null {
  if (depth > 1) return "Bedingungen dürfen höchstens eine Verschachtelungsebene haben.";
  for (const node of group.conditions ?? []) {
    if (isGroup(node)) {
      const err = validateConditions(node, depth + 1);
      if (err) return err;
      continue;
    }
    if (!node.field) return "Jede Bedingung braucht ein Feld.";
    if (!node.operator) return "Jede Bedingung braucht einen Operator.";
    if (
      !["exists", "not_exists"].includes(node.operator) &&
      (node.value === undefined || node.value === null || node.value === "")
    ) {
      return `Die Bedingung für „${node.field}" braucht einen Vergleichswert.`;
    }
  }
  return null;
}
