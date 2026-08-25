/**
 * Automation execution engine.
 *
 * Event -> matching rules -> limits -> execution record -> actions in order.
 * Everything is recorded: the version snapshot used, the condition trace, every
 * action attempt with its input and output. Nothing runs twice for the same
 * (rule, event) pair thanks to the unique idempotency key on executions.
 */
import { getAdmin, writeAudit } from "../core.server";
import { evaluateGroup, type ConditionTrace } from "./conditions";
import { runAction, type ActionContext } from "./actions.server";
import type { ConditionGroup } from "./automation.types";

export const MAX_CHAIN_DEPTH = 5;
const RETRY_BACKOFF_SECONDS = [60, 300, 1_800, 7_200, 21_600];

type Row = Record<string, unknown>;

export type AutomationEvent = {
  organizationId: string;
  shopId: string;
  eventType: string;
  eventId?: string | null;
  payload: Record<string, unknown>;
  correlationId?: string | null;
  causationId?: string | null;
  chainDepth?: number;
  /** Set when the event itself was produced by an automation action. */
  originExecutionId?: string | null;
};

function entityKey(payload: Record<string, unknown>) {
  for (const key of ["order_id", "return_id", "customer_id", "shipment_id", "inventory_item_id"]) {
    const v = payload[key];
    if (typeof v === "string" && v) return `${key}:${v}`;
  }
  return null;
}

async function loadActiveVersion(admin: Awaited<ReturnType<typeof getAdmin>>, rule: Row) {
  const { data } = await admin
    .from("automation_rule_versions")
    .select("*")
    .eq("rule_id", rule["id"] as string)
    .eq("version", rule["active_version"] as number)
    .maybeSingle();
  return (data as Row) ?? null;
}

/** Entry point for every domain event. Never throws into the caller. */
export async function triggerAutomations(event: AutomationEvent) {
  try {
    return await dispatchAutomations(event);
  } catch (error) {
    console.error("[automation] dispatch failed", event.eventType, error);
    return [];
  }
}

export async function dispatchAutomations(event: AutomationEvent) {
  const admin = await getAdmin();
  const correlationId = event.correlationId ?? crypto.randomUUID();
  const chainDepth = event.chainDepth ?? 0;

  const { data } = await admin
    .from("automation_rules")
    .select("*")
    .eq("organization_id", event.organizationId)
    .eq("shop_id", event.shopId)
    .eq("status", "active")
    .eq("trigger_type", "domain_event")
    .order("priority", { ascending: true });

  const rules = ((data ?? []) as Row[]).filter(
    (r) => ((r["trigger_config"] as Row)?.["eventType"] ?? null) === event.eventType,
  );

  const started: { ruleId: string; executionId: string | null; outcome: string }[] = [];

  for (const rule of rules) {
    const ruleId = rule["id"] as string;

    if (chainDepth >= MAX_CHAIN_DEPTH) {
      const executionId = await insertExecution({
        rule,
        event,
        correlationId,
        chainDepth,
        status: "failed",
        errorCode: "blocked_loop",
        error: `Kettenlänge ${chainDepth} überschritten — Ausführung gestoppt.`,
      });
      started.push({ ruleId, executionId, outcome: "blocked_loop" });
      continue;
    }

    // Atomic, server-side counting: circuit breaker + rate limits in one call.
    const { data: verdict } = await admin.rpc(
      "automation_check_limits" as never,
      {
        _rule_id: ruleId,
        _entity_key: entityKey(event.payload),
      } as never,
    );
    if (verdict !== "allow") {
      started.push({ ruleId, executionId: null, outcome: String(verdict) });
      continue;
    }

    const executionId = await insertExecution({
      rule,
      event,
      correlationId,
      chainDepth,
      status: "queued",
    });
    if (!executionId) {
      started.push({ ruleId, executionId: null, outcome: "duplicate" });
      continue;
    }
    const result = await runExecution(executionId);
    started.push({ ruleId, executionId, outcome: result.status });
  }

  return started;
}

async function insertExecution(input: {
  rule: Row;
  event: AutomationEvent;
  correlationId: string;
  chainDepth: number;
  status: "queued" | "failed";
  errorCode?: string;
  error?: string;
}): Promise<string | null> {
  const admin = await getAdmin();
  const rule = input.rule;
  const version = await loadActiveVersion(admin, rule);
  const key = `${rule["id"]}:${input.event.eventId ?? input.event.eventType}:${JSON.stringify(
    input.event.payload["order_id"] ?? input.event.payload["return_id"] ?? "",
  )}`;
  const { data, error } = await admin
    .from("automation_executions")
    .insert({
      organization_id: input.event.organizationId,
      shop_id: input.event.shopId,
      rule_id: rule["id"],
      rule_version: rule["active_version"],
      rule_version_id: version?.["id"] ?? null,
      trigger_type: "domain_event",
      source_event_id: input.event.eventId ?? null,
      source_event_type: input.event.eventType,
      status: input.status,
      error_code: input.errorCode ?? null,
      error: input.error ?? null,
      context_snapshot: input.event.payload as never,
      correlation_id: input.correlationId,
      causation_id: input.event.causationId ?? null,
      chain_depth: input.chainDepth,
      idempotency_key: key,
      finished_at: input.status === "failed" ? new Date().toISOString() : null,
    } as never)
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return null; // already executed for this event
    throw new Error(error.message);
  }
  return (data as { id: string } | null)?.id ?? null;
}

export type ExecutionResult = { status: string; actions: number; failed: number };

/** Runs (or resumes) an execution from its stored position. Never throws. */
export async function runExecution(executionId: string): Promise<ExecutionResult> {
  const admin = await getAdmin();
  const { data: execData } = await admin
    .from("automation_executions")
    .select("*")
    .eq("id", executionId)
    .maybeSingle();
  const execution = execData as Row | null;
  if (!execution) return { status: "missing", actions: 0, failed: 0 };
  if (
    ["completed", "failed", "cancelled", "partially_completed"].includes(
      execution["status"] as string,
    )
  )
    return { status: execution["status"] as string, actions: 0, failed: 0 };

  const ruleId = execution["rule_id"] as string;
  const { data: ruleData } = await admin
    .from("automation_rules")
    .select("*")
    .eq("id", ruleId)
    .maybeSingle();
  const rule = (ruleData as Row) ?? {};
  const { data: versionData } = await admin
    .from("automation_rule_versions")
    .select("*")
    .eq("id", (execution["rule_version_id"] as string) ?? "00000000-0000-0000-0000-000000000000")
    .maybeSingle();
  const version = versionData as Row | null;

  const payload = (execution["context_snapshot"] as Record<string, unknown>) ?? {};
  const conditions = (version?.["conditions_snapshot"] ??
    rule["conditions"]) as ConditionGroup | null;
  const actions = ((version?.["actions_snapshot"] as Row[]) ?? [])
    .slice()
    .sort((a, b) => Number(a["position"] ?? 0) - Number(b["position"] ?? 0));

  const startedAt = Date.now();
  await admin
    .from("automation_executions")
    .update({
      status: "running",
      started_at: execution["started_at"] ?? new Date().toISOString(),
    } as never)
    .eq("id", executionId);

  // Conditions are evaluated once, at the start of the (first) run.
  if (Number(execution["current_action_position"] ?? 0) === 0) {
    const { passed } = evaluateGroup(conditions, payload);
    if (!passed) {
      await finish(
        executionId,
        "completed",
        "conditions_not_met",
        "Bedingungen nicht erfüllt.",
        startedAt,
      );
      return { status: "skipped_conditions", actions: 0, failed: 0 };
    }
  }

  const ctxBase = {
    organizationId: execution["organization_id"] as string,
    shopId: execution["shop_id"] as string,
    executionId,
    ruleId,
    eventType: execution["source_event_type"] as string,
    eventId: (execution["source_event_id"] as string) ?? null,
    correlationId: execution["correlation_id"] as string,
    payload,
    dryRun: false,
  } satisfies ActionContext;

  let failed = 0;
  let ran = 0;
  const stopOnError = rule["stop_on_error"] !== false;

  for (const action of actions) {
    const position = Number(action["position"] ?? 0);
    if (position < Number(execution["current_action_position"] ?? 0)) continue;

    const delay = Number(action["delay_seconds"] ?? 0);
    if (delay > 0) {
      const already = await actionAlreadyDone(executionId, position);
      if (!already) {
        await scheduleResume(execution, executionId, position, delay);
        return { status: "waiting", actions: ran, failed };
      }
    }

    const attemptId = await beginAction(execution, executionId, position, action);
    const outcome = await runAction(
      {
        position,
        actionType: action["action_type"] as string,
        config: (action["config"] as Record<string, unknown>) ?? {},
      },
      ctxBase,
    );
    ran += 1;
    await completeAction(attemptId, outcome);

    if (outcome.status === "failed") {
      failed += 1;
      const continueOnFailure = action["continue_on_failure"] === true;
      if (outcome.retryable) {
        const attempts = await attemptCount(executionId, position);
        if (attempts < RETRY_BACKOFF_SECONDS.length) {
          await scheduleResume(
            execution,
            executionId,
            position,
            RETRY_BACKOFF_SECONDS[attempts - 1] ?? 3_600,
          );
          return { status: "retry_scheduled", actions: ran, failed };
        }
      }
      await admin.rpc("automation_record_error" as never, { _rule_id: ruleId } as never);
      if (!continueOnFailure && stopOnError) {
        await finish(
          executionId,
          "failed",
          outcome.errorCode ?? "engine_error",
          outcome.errorMessage ?? null,
          startedAt,
        );
        return { status: "failed", actions: ran, failed };
      }
    }
    await admin
      .from("automation_executions")
      .update({ current_action_position: position + 1 } as never)
      .eq("id", executionId);
  }

  const status = failed > 0 ? "partially_completed" : "completed";
  await finish(executionId, status, null, null, startedAt);
  await admin
    .from("automation_rules")
    .update({ last_executed_at: new Date().toISOString() } as never)
    .eq("id", ruleId);
  return { status, actions: ran, failed };
}

async function actionAlreadyDone(executionId: string, position: number) {
  const admin = await getAdmin();
  const { data } = await admin
    .from("automation_action_executions")
    .select("id")
    .eq("execution_id", executionId)
    .eq("position", position)
    .in("status", ["succeeded", "skipped"])
    .maybeSingle();
  return Boolean(data);
}

async function attemptCount(executionId: string, position: number) {
  const admin = await getAdmin();
  const { count } = await admin
    .from("automation_action_executions")
    .select("id", { count: "exact", head: true })
    .eq("execution_id", executionId)
    .eq("position", position);
  return count ?? 1;
}

async function beginAction(execution: Row, executionId: string, position: number, action: Row) {
  const admin = await getAdmin();
  const attempts = await attemptCount(executionId, position);
  const { data } = await admin
    .from("automation_action_executions")
    .insert({
      execution_id: executionId,
      organization_id: execution["organization_id"],
      position,
      action_type: action["action_type"],
      attempt: attempts + 1,
      status: "running",
      input_snapshot: (action["config"] ?? {}) as never,
      started_at: new Date().toISOString(),
    } as never)
    .select("id")
    .single();
  return (data as { id: string }).id;
}

async function completeAction(id: string, outcome: Awaited<ReturnType<typeof runAction>>) {
  const admin = await getAdmin();
  await admin
    .from("automation_action_executions")
    .update({
      status: outcome.status,
      output_snapshot: (outcome.output ?? {}) as never,
      error_code: outcome.errorCode ?? null,
      error_message: outcome.errorMessage ?? null,
      skipped_reason: outcome.reason ?? null,
      finished_at: new Date().toISOString(),
    } as never)
    .eq("id", id);
}

async function scheduleResume(
  execution: Row,
  executionId: string,
  position: number,
  delaySeconds: number,
) {
  const admin = await getAdmin();
  await admin.from("automation_jobs").insert({
    organization_id: execution["organization_id"],
    shop_id: execution["shop_id"],
    execution_id: executionId,
    rule_id: execution["rule_id"],
    job_type: "resume_execution",
    payload: { position } as never,
    status: "pending",
    available_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
    dedupe_key: `resume:${executionId}:${position}:${Date.now()}`,
  } as never);
  await admin
    .from("automation_executions")
    .update({ status: "queued", current_action_position: position } as never)
    .eq("id", executionId);
}

async function finish(
  executionId: string,
  status: string,
  errorCode: string | null,
  error: string | null,
  startedAt: number,
) {
  const admin = await getAdmin();
  const { data } = await admin
    .from("automation_executions")
    .update({
      status,
      error_code: errorCode,
      error,
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
    } as never)
    .eq("id", executionId)
    .select("organization_id, rule_id")
    .maybeSingle();
  const row = (data as Row) ?? {};
  if (status === "failed") {
    await writeAudit({
      organizationId: (row["organization_id"] as string) ?? null,
      actorId: null,
      action: "automation.execution_failed",
      entityType: "automation_execution",
      entityId: executionId,
      metadata: { error_code: errorCode, error },
    });
  }
}

/** Dry run: evaluates conditions and lists the actions without side effects. */
export async function dryRunRule(input: {
  organizationId: string;
  ruleId: string;
  payload: Record<string, unknown>;
}) {
  const admin = await getAdmin();
  const { data } = await admin
    .from("automation_rules")
    .select("*")
    .eq("id", input.ruleId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  const rule = data as Row | null;
  if (!rule) throw new Error("Automation nicht gefunden.");
  const { data: actionsData } = await admin
    .from("automation_actions")
    .select("*")
    .eq("rule_id", input.ruleId)
    .order("position");

  const trace: ConditionTrace[] = [];
  const { passed } = evaluateGroup(
    (rule["conditions"] as ConditionGroup) ?? null,
    input.payload,
    trace,
  );
  return {
    matched: passed,
    trace,
    actions: ((actionsData ?? []) as Row[]).map((a) => ({
      position: Number(a["position"]),
      actionType: a["action_type"] as string,
      config: (a["config"] as Record<string, unknown>) ?? {},
      delaySeconds: Number(a["delay_seconds"] ?? 0),
      wouldRun: passed,
    })),
  };
}
