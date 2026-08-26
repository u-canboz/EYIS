/** Shared types and pure helpers for the Commerce Health Engine (client-safe). */

export type HealthSeverity = "critical" | "high" | "medium" | "low";

export type HealthArea =
  | "payments_orders"
  | "inventory"
  | "tax"
  | "documents"
  | "shipping"
  | "returns"
  | "communications_automations";

export type HealthFinding = {
  code: string;
  area: HealthArea;
  severity: HealthSeverity;
  entityType: string;
  entityId: string | null;
  shopId: string | null;
  message: string;
};

export type HealthReport = {
  organizationId: string;
  runAt: string;
  status: "ok" | "warning" | "critical";
  totalFindings: number;
  bySeverity: Record<HealthSeverity, number>;
  byArea: Record<string, number>;
  findings: HealthFinding[];
};

export const AREA_LABELS: Record<string, string> = {
  payments_orders: "Payments & Orders",
  inventory: "Inventory",
  tax: "Tax",
  documents: "Dokumente",
  shipping: "Shipping & Fulfillment",
  returns: "Returns",
  communications_automations: "Communications & Automations",
};

export const SEVERITY_LABELS: Record<HealthSeverity, string> = {
  critical: "Kritisch",
  high: "Hoch",
  medium: "Mittel",
  low: "Niedrig",
};

export function buildReport(organizationId: string, findings: HealthFinding[]): HealthReport {
  const bySeverity: Record<HealthSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const byArea: Record<string, number> = {};
  for (const finding of findings) {
    bySeverity[finding.severity] = (bySeverity[finding.severity] ?? 0) + 1;
    byArea[finding.area] = (byArea[finding.area] ?? 0) + 1;
  }
  const status =
    bySeverity.critical > 0 ? "critical" : findings.length > 0 ? "warning" : ("ok" as const);
  return {
    organizationId,
    runAt: new Date().toISOString(),
    status,
    totalFindings: findings.length,
    bySeverity,
    byArea,
    findings,
  };
}
