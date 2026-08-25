/** Automation Engine API. Thin wrappers; every call is permission-checked. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ConditionGroup, JsonObject, JsonValue } from "./automation.types";
import type {
  ExecutionDetail,
  ExecutionSummary,
  RuleActionInput,
  RuleDetail,
  RuleSummary,
} from "./rules.server";
import type { TaskRow, TaskStatus } from "./tasks.server";

type Scope = { organizationId: string; shopId: string };

/** Client-facing mirrors: JSON columns are typed as serializable JSON. */
export type RuleSummaryView = Omit<RuleSummary, "triggerConfig"> & { triggerConfig: JsonObject };
export type RuleDetailView = Omit<RuleDetail, "triggerConfig" | "actions"> & {
  triggerConfig: JsonObject;
  actions: (Omit<RuleActionInput, "config"> & { config: JsonObject })[];
};
export type ExecutionDetailView = Omit<ExecutionDetail, "context" | "actions"> & {
  context: JsonObject;
  actions: (Omit<ExecutionDetail["actions"][number], "input" | "output"> & {
    input: JsonObject;
    output: JsonObject;
  })[];
};
export type DryRunView = {
  matched: boolean;
  trace: {
    field: string;
    operator: string;
    expected: JsonValue;
    actual: JsonValue;
    passed: boolean;
  }[];
  actions: {
    position: number;
    actionType: string;
    config: JsonObject;
    delaySeconds: number;
    wouldRun: boolean;
  }[];
};

export const listAutomationsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope) => data)
  .handler(async ({ data, context }): Promise<RuleSummaryView[]> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "automations.read",
    );
    const { listRules } = await import("./rules.server");
    return (await listRules(data.organizationId, data.shopId)) as unknown as RuleSummaryView[];
  });

export const getAutomationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; ruleId: string }) => data)
  .handler(async ({ data, context }): Promise<RuleDetailView> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "automations.read",
    );
    const { loadRule } = await import("./rules.server");
    return (await loadRule(data.organizationId, data.ruleId)) as unknown as RuleDetailView;
  });

export const saveAutomationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Scope & {
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
        templateKey?: string | null;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "automations.manage",
    );
    const { saveRule } = await import("./rules.server");
    return await saveRule({ ...data, actorId: context.userId });
  });

export const publishAutomationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; ruleId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "automations.activate",
    );
    const { publishRule } = await import("./rules.server");
    return await publishRule({ ...data, actorId: context.userId });
  });

export const setAutomationStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { organizationId: string; ruleId: string; status: "active" | "paused" | "archived" }) =>
      data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "automations.activate",
    );
    const { setRuleStatus } = await import("./rules.server");
    return await setRuleStatus({ ...data, actorId: context.userId });
  });

export const resetCircuitFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; ruleId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "automations.activate",
    );
    const { resetCircuitBreaker } = await import("./rules.server");
    return await resetCircuitBreaker({ ...data, actorId: context.userId });
  });

export const dryRunAutomationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { organizationId: string; ruleId: string; payload: Record<string, unknown> }) => data,
  )
  .handler(async ({ data, context }): Promise<DryRunView> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "automations.run",
    );
    const { dryRunRule } = await import("./engine.server");
    return (await dryRunRule(data)) as unknown as DryRunView;
  });

export const listExecutionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: Scope & { ruleId?: string | null; status?: string[] | null; limit?: number }) => data,
  )
  .handler(async ({ data, context }): Promise<ExecutionSummary[]> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "automations.read",
    );
    const { listExecutions } = await import("./rules.server");
    return await listExecutions(data);
  });

export const getExecutionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; executionId: string }) => data)
  .handler(async ({ data, context }): Promise<ExecutionDetailView> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "automations.debug",
    );
    const { loadExecution } = await import("./rules.server");
    return (await loadExecution(
      data.organizationId,
      data.executionId,
    )) as unknown as ExecutionDetailView;
  });

export const retryExecutionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; executionId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "automations.run",
    );
    const { retryExecution } = await import("./rules.server");
    return await retryExecution({ ...data, actorId: context.userId });
  });

/* --------------------------------- tasks ---------------------------------- */

export const listTasksFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope & { status?: TaskStatus[] | null; assignedToMe?: boolean }) => data)
  .handler(async ({ data, context }): Promise<TaskRow[]> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "tasks.read");
    const { listTasks } = await import("./tasks.server");
    return await listTasks({
      organizationId: data.organizationId,
      shopId: data.shopId,
      status: data.status ?? null,
      assignedTo: data.assignedToMe ? context.userId : null,
    });
  });

export const createTaskFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Scope & {
        title: string;
        description?: string | null;
        priority?: "low" | "normal" | "high" | "urgent";
        dueAt?: string | null;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "tasks.manage");
    const { createTask } = await import("./tasks.server");
    return await createTask({ ...data, source: "manual", createdBy: context.userId });
  });

export const updateTaskStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; taskId: string; status: TaskStatus }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "tasks.manage");
    const { updateTaskStatus } = await import("./tasks.server");
    return await updateTaskStatus({ ...data, actorId: context.userId });
  });

/* -------------------------------- webhooks -------------------------------- */

export const listWebhookEndpointsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "automations.read",
    );
    const { listWebhookEndpoints } = await import("./rules.server");
    return await listWebhookEndpoints(data.organizationId, data.shopId);
  });

export const saveWebhookEndpointFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Scope & {
        endpointId?: string | null;
        name: string;
        url: string;
        secretReference?: string | null;
        status?: "active" | "inactive";
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "automations.manage",
    );
    const { saveWebhookEndpoint } = await import("./rules.server");
    return await saveWebhookEndpoint({ ...data, actorId: context.userId });
  });

export const deleteWebhookEndpointFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; endpointId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "automations.manage",
    );
    const { deleteWebhookEndpoint } = await import("./rules.server");
    return await deleteWebhookEndpoint(data);
  });

/* ------------------------------- inbox/stats ------------------------------ */

export const automationInboxFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "automations.read",
    );
    const { listExecutions, listRules } = await import("./rules.server");
    const { listTasks } = await import("./tasks.server");
    const [failures, tasks, rules] = await Promise.all([
      listExecutions({ ...data, status: ["failed", "partially_completed"], limit: 25 }),
      listTasks({
        organizationId: data.organizationId,
        shopId: data.shopId,
        status: ["open", "in_progress"],
        limit: 25,
      }),
      listRules(data.organizationId, data.shopId),
    ]);
    return {
      failures,
      tasks,
      pausedRules: rules.filter((r) => r.autoPausedAt) as unknown as RuleSummaryView[],
      activeCount: rules.filter((r) => r.status === "active").length,
      runs24h: rules.reduce((sum, r) => sum + r.runs24h, 0),
    };
  });

/* ------------------------------- templates -------------------------------- */

export const installAutomationTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope & { templateKey: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "automations.manage",
    );
    const { findTemplate } = await import("./templates");
    const template = findTemplate(data.templateKey);
    if (!template) throw new Error("Vorlage nicht gefunden.");

    // Invoice templates must never bypass the shop's invoicing strategy.
    let actions = template.actions;
    let note: string | null = null;
    if (template.requiresManualInvoicing) {
      const { getAdmin } = await import("../core.server");
      const admin = await getAdmin();
      const { data: settings } = await admin
        .from("invoice_settings")
        .select("invoice_creation_strategy")
        .eq("shop_id", data.shopId)
        .maybeSingle();
      const strategy =
        (settings as unknown as { invoice_creation_strategy?: string } | null)
          ?.invoice_creation_strategy ?? "manual";
      if (strategy !== "manual") {
        actions = [];
        note =
          "Dieser Shop erstellt Rechnungen bereits automatisch. Die Rechnungs-Aktionen wurden deshalb nicht übernommen.";
      }
    }

    const { saveRule } = await import("./rules.server");
    const result = await saveRule({
      organizationId: data.organizationId,
      shopId: data.shopId,
      name: template.name,
      description: template.description,
      triggerType: template.triggerType,
      triggerConfig: template.triggerConfig,
      conditions: template.conditions,
      actions: actions.map((a, i) => ({
        position: i + 1,
        actionType: a.actionType,
        config: a.config,
        delaySeconds: a.delaySeconds ?? 0,
        continueOnFailure: false,
      })),
      templateKey: template.key,
      actorId: context.userId,
    });
    return { ...result, note };
  });
