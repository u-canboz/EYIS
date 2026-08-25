/** Shared, client-safe types for the automation engine. */

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type AutomationStatus = "draft" | "active" | "paused" | "archived";
export type TriggerType = "domain_event" | "schedule" | "manual";
export type ExecutionStatus =
  "queued" | "running" | "completed" | "partially_completed" | "failed" | "cancelled";
export type ActionStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "greater_or_equal"
  | "less_than"
  | "less_or_equal"
  | "contains"
  | "not_contains"
  | "in"
  | "not_in"
  | "exists"
  | "not_exists";

export type Condition = {
  field: string;
  operator: ConditionOperator;
  value?: JsonValue;
};

export type ConditionGroup = {
  mode: "all" | "any";
  conditions: (Condition | ConditionGroup)[];
};

export type ScheduleConfig = {
  frequency: "daily" | "weekly" | "monthly" | "once";
  hour: number;
  minute: number;
  weekday?: number;
  dayOfMonth?: number;
  runAt?: string | null;
};

export type TriggerConfig = {
  eventType?: string;
  schedule?: ScheduleConfig;
};

export type AutomationAction = {
  id?: string;
  position: number;
  actionType: string;
  config: JsonObject;
  continueOnFailure: boolean;
  delaySeconds: number;
};

export type AutomationRule = {
  id: string;
  organizationId: string;
  shopId: string;
  name: string;
  description: string | null;
  status: AutomationStatus;
  triggerType: TriggerType;
  triggerConfig: TriggerConfig;
  conditions: ConditionGroup;
  priority: number;
  stopOnError: boolean;
  maxPerHour: number | null;
  maxPerEntity: number | null;
  autoPausedAt: string | null;
  autoPauseReason: string | null;
  activeVersion: number | null;
  draftVersion: number;
  templateKey: string | null;
  lastExecutedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AutomationRuleDetail = AutomationRule & {
  actions: AutomationAction[];
  stats: { total: number; succeeded: number; failed: number; avgDurationMs: number };
};

export type AutomationListItem = AutomationRule & {
  actionCount: number;
  stats: { total: number; succeeded: number; failed: number };
};

export type ActionExecutionView = {
  id: string;
  position: number;
  actionType: string;
  attempt: number;
  status: ActionStatus;
  errorCode: string | null;
  errorMessage: string | null;
  skippedReason: string | null;
  output: JsonObject;
  startedAt: string | null;
  finishedAt: string | null;
};

export type ExecutionView = {
  id: string;
  ruleId: string;
  ruleName: string;
  ruleVersion: number;
  triggerType: TriggerType;
  sourceEventType: string | null;
  sourceEventId: string | null;
  status: ExecutionStatus;
  errorCode: string | null;
  error: string | null;
  contextSnapshot: JsonObject;
  correlationId: string;
  chainDepth: number;
  retryOfExecutionId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  createdAt: string;
  actions: ActionExecutionView[];
};

export type DryRunResult = {
  triggerMatched: boolean;
  conditionResults: {
    field: string;
    operator: string;
    expected: JsonValue;
    actual: JsonValue;
    passed: boolean;
  }[];
  conditionsPassed: boolean;
  plannedActions: {
    position: number;
    actionType: string;
    summary: string;
    delaySeconds: number;
    blocked?: string | null;
  }[];
};

/* --------------------------------- tasks --------------------------------- */

export type TaskStatus = "open" | "in_progress" | "completed" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type TaskView = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  entityType: string | null;
  entityId: string | null;
  assignedTo: string | null;
  dueAt: string | null;
  source: "manual" | "automation" | "system";
  sourceAutomationExecutionId: string | null;
  createdAt: string;
  completedAt: string | null;
};

/* ------------------------------ attention -------------------------------- */

export type AttentionSeverity = "info" | "warning" | "critical";

export type AttentionItem = {
  type: string;
  severity: AttentionSeverity;
  title: string;
  description: string;
  entityType: string | null;
  entityId: string | null;
  primaryAction: { label: string; to: string } | null;
  createdAt: string;
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Niedrig",
  normal: "Normal",
  high: "Hoch",
  urgent: "Dringend",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Offen",
  in_progress: "In Arbeit",
  completed: "Erledigt",
  cancelled: "Abgebrochen",
};

export const AUTOMATION_STATUS_LABELS: Record<AutomationStatus, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  paused: "Pausiert",
  archived: "Archiviert",
};

export const EXECUTION_STATUS_LABELS: Record<ExecutionStatus, string> = {
  queued: "In Warteschlange",
  running: "Läuft",
  completed: "Erfolgreich",
  partially_completed: "Teilweise erfolgreich",
  failed: "Fehlgeschlagen",
  cancelled: "Abgebrochen",
};

export const ERROR_CODE_LABELS: Record<string, string> = {
  blocked_loop: "Schleifenschutz ausgelöst",
  rate_limited: "Limit erreicht",
  circuit_open: "Automation automatisch pausiert",
  permission_denied: "Keine Berechtigung",
  invalid_configuration: "Ungültige Konfiguration",
  entity_not_found: "Datensatz nicht gefunden",
  unsupported_action: "Aktion nicht unterstützt",
  provider_timeout: "Zeitüberschreitung",
  temporary_unavailable: "Vorübergehend nicht verfügbar",
};
