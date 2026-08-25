/** CRUD, versioning and observability for automation rules. */
import { getAdmin, writeAudit } from "../core.server";
import { validateConditions } from "./conditions";
import { findAction, INVOICE_ACTIONS } from "./action-registry";
import type { ConditionGroup } from "./automation.types";

type Row = Record<string, unknown>;

export type RuleActionInput = {
  position: number;
  actionType: string;
  config: Record<string, unknown>;
  delaySeconds?: number;
  continueOnFailure?: boolean;
};

export type RuleSummary = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  priority: number;
  activeVersion: number | null;
  draftVersion: number | null;
  autoPausedAt: string | null;
  autoPauseReason: string | null;
  lastExecutedAt: string | null;
  actionCount: number;
  runs24h: number;
  failures24h: number;
};

export type RuleDetail = RuleSummary & {
  conditions: ConditionGroup | null;
  stopOnError: boolean;
  maxPerHour: number | null;
  maxPerEntity: number | null;
  errorThreshold: number;
  errorWindowMinutes: number;
  actions: RuleActionInput[];
};

function mapSummary(r: Row, counts: { runs: number; failures: number }, actionCount: number): RuleSummary {
  return {
    id: r["id"] as string,
    name: r["name"] as string,
    description: (r["description"] as string) ?? null,
    status: r["status"] as string,
    triggerType: r["trigger_type"] as string,
    triggerConfig: (r["trigger_config"] as Record<string, unknown>) ?? {},
    priority: Number(r["priority"] ?? 100),
    activeVersion: (r["active_version"] as number) ?? null,
    draftVersion: (r["draft_version"] as number) ?? null,
    autoPausedAt: (r["auto_paused_at"] as string) ?? null,
    autoPauseReason: (r["auto_pause_reason"] as string) ?? null,
    lastExecutedAt: (r["last_executed_at"] as string) ?? null,
    actionCount,
    runs24h: counts.runs,
    failures24h: counts.failures,
  };
}

export async function listRules(organizationId: string, shopId: string): Promise<RuleSummary[]> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("automation_rules")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .neq("status", "archived")
    .order("priority")
    .order("created_at", { ascending: false });
  const rules = (data ?? []) as Row[];
  if (!rules.length) return [];

  const ids = rules.map((r) => r["id"] as string);
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const [{ data: execs }, { data: actions }] = await Promise.all([
    admin.from("automation_executions").select("rule_id, status").in("rule_id", ids).gte("created_at", since),
    admin.from("automation_actions").select("rule_id").in("rule_id", ids),
  ]);

  const stats = new Map<string, { runs: number; failures: number }>();
  for (const e of (execs ?? []) as Row[]) {
    const key = e["rule_id"] as string;
    const s = stats.get(key) ?? { runs: 0, failures: 0 };
    s.runs += 1;
    if (["failed", "partially_completed"].includes(e["status"] as string)) s.failures += 1;
    stats.set(key, s);
  }
  const actionCounts = new Map<string, number>();
  for (const a of (actions ?? []) as Row[]) {
    const key = a["rule_id"] as string;
    actionCounts.set(key, (actionCounts.get(key) ?? 0) + 1);
  }

  return rules.map((r) =>
    mapSummary(r, stats.get(r["id"] as string) ?? { runs: 0, failures: 0 }, actionCounts.get(r["id"] as string) ?? 0),
  );
}

export async function loadRule(organizationId: string, ruleId: string): Promise<RuleDetail> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("automation_rules")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", ruleId)
    .maybeSingle();
  const rule = data as Row | null;
  if (!rule) throw new Error("Automation nicht gefunden.");
  const { data: actionsData } = await admin
    .from("automation_actions")
    .select("*")
    .eq("rule_id", ruleId)
    .order("position");
  const actions = ((actionsData ?? []) as Row[]).map((a) => ({
    position: Number(a["position"]),
    actionType: a["action_type"] as string,
    config: (a["config"] as Record<string, unknown>) ?? {},
    delaySeconds: Number(a["delay_seconds"] ?? 0),
    continueOnFailure: a["continue_on_failure"] === true,
  }));
  return {
    ...mapSummary(rule, { runs: 0, failures: 0 }, actions.length),
    conditions: (rule["conditions"] as ConditionGroup) ?? null,
    stopOnError: rule["stop_on_error"] !== false,
    maxPerHour: (rule["max_per_hour"] as number) ?? null,
    maxPerEntity: (rule["max_per_entity"] as number) ?? null,
    errorThreshold: Number(rule["error_threshold"] ?? 5),
    errorWindowMinutes: Number(rule["error_window_minutes"] ?? 60),
    actions,
  };
}

/** Validates a draft before it can be saved or published. */
export async function validateRule(input: {
  organizationId: string;
  shopId: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  conditions: ConditionGroup | null;
  actions: RuleActionInput[];
}) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (input.triggerType === "domain_event" && !input.triggerConfig["eventType"])
    errors.push("Es ist kein Auslöser-Ereignis gewählt.");
  if (input.triggerType === "schedule" && !input.triggerConfig["scheduleKind"])
    errors.push("Es ist kein Zeitplan-Typ gewählt.");
  if (input.conditions) {
    const err = validateConditions(input.conditions);
    if (err) errors.push(err);
  }
  if (!input.actions.length) errors.push("Mindestens eine Aktion ist erforderlich.");

  for (const action of input.actions) {
    const def = findAction(action.actionType);
    if (!def) {
      errors.push(`Unbekannte Aktion: ${action.actionType}`);
      continue;
    }
    for (const param of def.params) {
      if (param.required && !action.config[param.key])
        errors.push(`„${def.label}": ${param.label} fehlt.`);
    }
  }

  // Invoice actions must not undercut the shop's invoicing strategy (phase 8).
  if (input.actions.some((a) => INVOICE_ACTIONS.has(a.actionType))) {
    const admin = await getAdmin();
    const { data } = await admin
      .from("invoice_settings")
      .select("invoice_creation_strategy, automatically_issue_invoice")
      .eq("organization_id", input.organizationId)
      .eq("shop_id", input.shopId)
      .maybeSingle();
    const settings = (data as unknown as Row) ?? {};
    const strategy = (settings["invoice_creation_strategy"] as string) ?? "manual";
    if (strategy !== "manual")
      warnings.push(
        `Der Shop erstellt Rechnungen bereits automatisch (${strategy}). Die Rechnungs-Aktionen werden bei der Ausführung übersprungen.`,
      );
    if (settings["automatically_issue_invoice"] && input.actions.some((a) => a.actionType === "invoice.issue"))
      warnings.push("Rechnungen werden bereits automatisch festgeschrieben. Die Aktion wird übersprungen.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

export async function saveRule(input: {
  organizationId: string;
  shopId: string;
  actorId: string;
  ruleId?: string | null;
  name: string;
  description?: string | null;
  triggerType: "domain_event" | "schedule" | "manual";
  triggerConfig: Record<string, unknown>;
  conditions: ConditionGroup | null;
  actions: RuleActionInput[];
  priority?: number;
  stopOnError?: boolean;
  maxPerHour?: number | null;
  maxPerEntity?: number | null;
  errorThreshold?: number;
  errorWindowMinutes?: number;
  templateKey?: string | null;
}) {
  const admin = await getAdmin();
  const validation = await validateRule(input);
  if (!validation.valid) throw new Error(validation.errors.join(" "));

  const base = {
    organization_id: input.organizationId,
    shop_id: input.shopId,
    name: input.name.trim().slice(0, 120),
    description: input.description ?? null,
    trigger_type: input.triggerType,
    trigger_config: input.triggerConfig as never,
    conditions: (input.conditions ?? { mode: "all", conditions: [] }) as never,
    priority: input.priority ?? 100,
    stop_on_error: input.stopOnError ?? true,
    max_per_hour: input.maxPerHour ?? null,
    max_per_entity: input.maxPerEntity ?? null,
    error_threshold: input.errorThreshold ?? 5,
    error_window_minutes: input.errorWindowMinutes ?? 60,
    template_key: input.templateKey ?? null,
  };

  let ruleId = input.ruleId ?? null;
  if (ruleId) {
    const { error } = await admin.from("automation_rules").update(base as never).eq("id", ruleId).eq("organization_id", input.organizationId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await admin
      .from("automation_rules")
      .insert({ ...base, status: "draft", created_by: input.actorId } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    ruleId = (data as { id: string }).id;
  }

  await admin.from("automation_actions").delete().eq("rule_id", ruleId);
  if (input.actions.length) {
    const { error } = await admin.from("automation_actions").insert(
      input.actions.map((a, index) => ({
        rule_id: ruleId,
        organization_id: input.organizationId,
        position: index,
        action_type: a.actionType,
        config: a.config as never,
        delay_seconds: a.delaySeconds ?? 0,
        continue_on_failure: a.continueOnFailure ?? false,
      })) as never,
    );
    if (error) throw new Error(error.message);
  }

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: input.ruleId ? "automation.rule_updated" : "automation.rule_created",
    entityType: "automation_rule",
    entityId: ruleId,
    metadata: { name: base.name },
  });

  return { ruleId, warnings: validation.warnings };
}

/** Freezes the current draft as an immutable version and activates it. */
export async function publishRule(input: { organizationId: string; ruleId: string; actorId: string }) {
  const admin = await getAdmin();
  const detail = await loadRule(input.organizationId, input.ruleId);
  const validation = await validateRule({
    organizationId: input.organizationId,
    shopId: (await shopIdOf(input.ruleId)) ?? "",
    triggerType: detail.triggerType,
    triggerConfig: detail.triggerConfig,
    conditions: detail.conditions,
    actions: detail.actions,
  });
  if (!validation.valid) throw new Error(validation.errors.join(" "));

  const nextVersion = (detail.activeVersion ?? 0) + 1;
  const { error } = await admin.from("automation_rule_versions").insert({
    rule_id: input.ruleId,
    organization_id: input.organizationId,
    version: nextVersion,
    trigger_snapshot: { type: detail.triggerType, config: detail.triggerConfig } as never,
    conditions_snapshot: (detail.conditions ?? { mode: "all", conditions: [] }) as never,
    actions_snapshot: detail.actions.map((a) => ({
      position: a.position,
      action_type: a.actionType,
      config: a.config,
      delay_seconds: a.delaySeconds ?? 0,
      continue_on_failure: a.continueOnFailure ?? false,
    })) as never,
    published_at: new Date().toISOString(),
    published_by: input.actorId,
  } as never);
  if (error) throw new Error(error.message);

  const { error: updateError } = await admin
    .from("automation_rules")
    .update({
      active_version: nextVersion,
      draft_version: nextVersion,
      status: "active",
      auto_paused_at: null,
      auto_pause_reason: null,
    } as never)
    .eq("id", input.ruleId)
    .eq("organization_id", input.organizationId);
  if (updateError) throw new Error(updateError.message);

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "automation.rule_published",
    entityType: "automation_rule",
    entityId: input.ruleId,
    metadata: { version: nextVersion },
  });
  return { version: nextVersion, warnings: validation.warnings };
}

async function shopIdOf(ruleId: string) {
  const admin = await getAdmin();
  const { data } = await admin.from("automation_rules").select("shop_id").eq("id", ruleId).maybeSingle();
  return (data as { shop_id: string } | null)?.shop_id ?? null;
}

export async function setRuleStatus(input: {
  organizationId: string;
  ruleId: string;
  status: "active" | "paused" | "archived";
  actorId: string;
}) {
  const admin = await getAdmin();
  if (input.status === "active") {
    const detail = await loadRule(input.organizationId, input.ruleId);
    if (!detail.activeVersion) return await publishRule(input);
  }
  const { error } = await admin
    .from("automation_rules")
    .update({
      status: input.status,
      ...(input.status === "active" ? { auto_paused_at: null, auto_pause_reason: null } : {}),
    } as never)
    .eq("id", input.ruleId)
    .eq("organization_id", input.organizationId);
  if (error) throw new Error(error.message);
  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: `automation.rule_${input.status}`,
    entityType: "automation_rule",
    entityId: input.ruleId,
  });
  return { ok: true };
}

export async function deleteRule(input: { organizationId: string; ruleId: string; actorId: string }) {
  return await setRuleStatus({ ...input, status: "archived" });
}

/* ------------------------------ observability ----------------------------- */

export type ExecutionSummary = {
  id: string;
  ruleId: string;
  ruleName: string;
  status: string;
  errorCode: string | null;
  error: string | null;
  eventType: string | null;
  triggerType: string;
  createdAt: string;
  durationMs: number | null;
  chainDepth: number;
};

export async function listExecutions(input: {
  organizationId: string;
  shopId: string;
  ruleId?: string | null;
  status?: string[] | null;
  limit?: number;
}): Promise<ExecutionSummary[]> {
  const admin = await getAdmin();
  let q = admin
    .from("automation_executions")
    .select("*, automation_rules(name)")
    .eq("organization_id", input.organizationId)
    .eq("shop_id", input.shopId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 100);
  if (input.ruleId) q = q.eq("rule_id", input.ruleId);
  if (input.status?.length) q = q.in("status", input.status as never[]);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((r) => ({
    id: r["id"] as string,
    ruleId: r["rule_id"] as string,
    ruleName: ((r["automation_rules"] as Row) ?? {})["name"] as string,
    status: r["status"] as string,
    errorCode: (r["error_code"] as string) ?? null,
    error: (r["error"] as string) ?? null,
    eventType: (r["source_event_type"] as string) ?? null,
    triggerType: r["trigger_type"] as string,
    createdAt: r["created_at"] as string,
    durationMs: (r["duration_ms"] as number) ?? null,
    chainDepth: Number(r["chain_depth"] ?? 0),
  }));
}

export async function loadExecution(organizationId: string, executionId: string) {
  const admin = await getAdmin();
  const { data } = await admin
    .from("automation_executions")
    .select("*, automation_rules(name)")
    .eq("organization_id", organizationId)
    .eq("id", executionId)
    .maybeSingle();
  const execution = data as Row | null;
  if (!execution) throw new Error("Ausführung nicht gefunden.");
  const { data: actions } = await admin
    .from("automation_action_executions")
    .select("*")
    .eq("execution_id", executionId)
    .order("position")
    .order("attempt");
  return {
    id: execution["id"] as string,
    ruleId: execution["rule_id"] as string,
    ruleName: ((execution["automation_rules"] as Row) ?? {})["name"] as string,
    status: execution["status"] as string,
    errorCode: (execution["error_code"] as string) ?? null,
    error: (execution["error"] as string) ?? null,
    eventType: (execution["source_event_type"] as string) ?? null,
    triggerType: execution["trigger_type"] as string,
    version: (execution["rule_version"] as number) ?? null,
    createdAt: execution["created_at"] as string,
    finishedAt: (execution["finished_at"] as string) ?? null,
    durationMs: (execution["duration_ms"] as number) ?? null,
    correlationId: (execution["correlation_id"] as string) ?? null,
    chainDepth: Number(execution["chain_depth"] ?? 0),
    context: (execution["context_snapshot"] as Record<string, unknown>) ?? {},
    actions: ((actions ?? []) as Row[]).map((a) => ({
      id: a["id"] as string,
      position: Number(a["position"]),
      actionType: a["action_type"] as string,
      attempt: Number(a["attempt"] ?? 1),
      status: a["status"] as string,
      input: (a["input_snapshot"] as Record<string, unknown>) ?? {},
      output: (a["output_snapshot"] as Record<string, unknown>) ?? {},
      errorCode: (a["error_code"] as string) ?? null,
      errorMessage: (a["error_message"] as string) ?? null,
      skippedReason: (a["skipped_reason"] as string) ?? null,
      startedAt: (a["started_at"] as string) ?? null,
      finishedAt: (a["finished_at"] as string) ?? null,
    })),
  };
}

export type ExecutionDetail = Awaited<ReturnType<typeof loadExecution>>;

/** Re-runs a finished execution with the same context under a new record. */
export async function retryExecution(input: {
  organizationId: string;
  executionId: string;
  actorId: string;
}) {
  const admin = await getAdmin();
  const { data } = await admin
    .from("automation_executions")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("id", input.executionId)
    .maybeSingle();
  const source = data as Row | null;
  if (!source) throw new Error("Ausführung nicht gefunden.");

  const { data: created, error } = await admin
    .from("automation_executions")
    .insert({
      organization_id: source["organization_id"],
      shop_id: source["shop_id"],
      rule_id: source["rule_id"],
      rule_version: source["rule_version"],
      rule_version_id: source["rule_version_id"],
      trigger_type: "manual",
      source_event_type: source["source_event_type"],
      status: "queued",
      context_snapshot: source["context_snapshot"],
      correlation_id: source["correlation_id"],
      causation_id: source["id"],
      chain_depth: Number(source["chain_depth"] ?? 0),
      retry_of_execution_id: source["id"],
      triggered_by: input.actorId,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const executionId = (created as { id: string }).id;

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "automation.execution_retried",
    entityType: "automation_execution",
    entityId: executionId,
    metadata: { retry_of: input.executionId },
  });

  const { runExecution } = await import("./engine.server");
  const result = await runExecution(executionId);
  return { executionId, status: result.status };
}

export async function resetCircuitBreaker(input: {
  organizationId: string;
  ruleId: string;
  actorId: string;
}) {
  const admin = await getAdmin();
  const { error } = await admin
    .from("automation_rules")
    .update({ auto_paused_at: null, auto_pause_reason: null, status: "active" } as never)
    .eq("id", input.ruleId)
    .eq("organization_id", input.organizationId);
  if (error) throw new Error(error.message);
  await admin.from("automation_rule_counters").delete().eq("rule_id", input.ruleId).eq("bucket_kind", "error");
  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "automation.circuit_reset",
    entityType: "automation_rule",
    entityId: input.ruleId,
  });
  return { ok: true };
}

/* ------------------------------- webhooks -------------------------------- */

export async function listWebhookEndpoints(organizationId: string, shopId: string) {
  const admin = await getAdmin();
  const { data } = await admin
    .from("outgoing_webhook_endpoints")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as Row[]).map((r) => ({
    id: r["id"] as string,
    name: r["name"] as string,
    url: r["url"] as string,
    status: r["status"] as string,
    lastStatusCode: (r["last_status_code"] as number) ?? null,
    lastError: (r["last_error"] as string) ?? null,
    lastCalledAt: (r["last_called_at"] as string) ?? null,
  }));
}

export async function saveWebhookEndpoint(input: {
  organizationId: string;
  shopId: string;
  actorId: string;
  endpointId?: string | null;
  name: string;
  url: string;
  secretReference?: string | null;
  status?: "active" | "inactive";
}) {
  const { assertSafeTarget } = await import("./webhook.server");
  await assertSafeTarget(input.url);
  const admin = await getAdmin();
  const payload = {
    organization_id: input.organizationId,
    shop_id: input.shopId,
    name: input.name.trim().slice(0, 120),
    url: input.url.trim(),
    secret_reference: input.secretReference ?? null,
    status: input.status ?? "active",
  };
  if (input.endpointId) {
    const { error } = await admin
      .from("outgoing_webhook_endpoints")
      .update(payload as never)
      .eq("id", input.endpointId)
      .eq("organization_id", input.organizationId);
    if (error) throw new Error(error.message);
    return { endpointId: input.endpointId };
  }
  const { data, error } = await admin
    .from("outgoing_webhook_endpoints")
    .insert(payload as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { endpointId: (data as { id: string }).id };
}

export async function deleteWebhookEndpoint(input: {
  organizationId: string;
  endpointId: string;
}) {
  const admin = await getAdmin();
  const { error } = await admin
    .from("outgoing_webhook_endpoints")
    .delete()
    .eq("id", input.endpointId)
    .eq("organization_id", input.organizationId);
  if (error) throw new Error(error.message);
  return { ok: true };
}
