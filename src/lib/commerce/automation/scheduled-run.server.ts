/** Creates and runs one execution for a scheduled-rule target row. */
import { getAdmin } from "../core.server";
import { runExecution } from "./engine.server";

type Row = Record<string, unknown>;

function targetKey(payload: Record<string, unknown>) {
  for (const key of ["cart_id", "order_id", "inventory_item_id"]) {
    const v = payload[key];
    if (typeof v === "string" && v) return `${key}:${v}`;
  }
  return JSON.stringify(payload).slice(0, 120);
}

export async function dispatchScheduledExecution(rule: Row, payload: Record<string, unknown>) {
  const admin = await getAdmin();
  const ruleId = rule["id"] as string;

  const { data: verdict } = await admin.rpc("automation_check_limits" as never, {
    _rule_id: ruleId,
    _entity_key: targetKey(payload),
  } as never);
  if (verdict !== "allow") return null;

  const { data: version } = await admin
    .from("automation_rule_versions")
    .select("id")
    .eq("rule_id", ruleId)
    .eq("version", rule["active_version"] as number)
    .maybeSingle();

  const { data, error } = await admin
    .from("automation_executions")
    .insert({
      organization_id: rule["organization_id"],
      shop_id: rule["shop_id"],
      rule_id: ruleId,
      rule_version: rule["active_version"],
      rule_version_id: (version as { id: string } | null)?.id ?? null,
      trigger_type: "schedule",
      source_event_type: `schedule.${(rule["trigger_config"] as Row)?.["scheduleKind"] ?? "custom"}`,
      status: "queued",
      context_snapshot: payload as never,
      correlation_id: crypto.randomUUID(),
      chain_depth: 0,
      idempotency_key: `${ruleId}:${targetKey(payload)}`,
    } as never)
    .select("id")
    .maybeSingle();
  if (error) return null;
  const executionId = (data as { id: string } | null)?.id;
  if (!executionId) return null;
  await runExecution(executionId);
  return executionId;
}
