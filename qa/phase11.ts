/* QA harness — phase 11 automation engine. */
import { admin, check, summary } from "./lib";
import { publishOrderEvent } from "../src/lib/commerce/event-payloads.server";
import { processAutomationJobs } from "../src/lib/commerce/automation/queue.server";

const ORDER = "0da70596-d520-4305-9554-c1e708f20f34";
const ORG = "ba039523-f8ec-44ff-bb9d-2b5b86b0c0a6";
const SHOP = "a9751182-2f3a-4f9a-a2e6-73b6ffd48974";

async function main() {
  // reinstall the template so the rule uses the corrected payload field
  await admin.from("automation_rules").delete().eq("organization_id", ORG).eq("name", "Große Bestellung prüfen");
  const { saveRule } = await import("../src/lib/commerce/automation/rules.server");
  const { findTemplate } = await import("../src/lib/commerce/automation/templates");
  const t = findTemplate("high_value_review")!;
  const { data: owner } = await admin.from("memberships").select("user_id").eq("organization_id", ORG).limit(1);
  const actorId = (owner as { user_id: string }[])[0]!.user_id;
  const saved = await saveRule({
    organizationId: ORG,
    shopId: SHOP,
    name: t.name,
    description: t.description,
    triggerType: t.triggerType,
    triggerConfig: t.triggerConfig,
    conditions: t.conditions,
    actions: t.actions.map((a, i) => ({
      position: i + 1,
      actionType: a.actionType,
      config: a.config,
      delaySeconds: a.delaySeconds ?? 0,
      continueOnFailure: false,
    })),
    templateKey: t.key,
    actorId,
  });
  const { publishRule, setRuleStatus } = await import("../src/lib/commerce/automation/rules.server");
  await publishRule({ organizationId: ORG, ruleId: saved.ruleId, actorId });
  await setRuleStatus({ organizationId: ORG, ruleId: saved.ruleId, status: "active", actorId });

  // condition is total_gross_minor > 50000; order is 5480 -> must not create a task
  await publishOrderEvent(ORDER, "order.created");
  await processAutomationJobs(25);
  const { data: skipped } = await admin
    .from("automation_executions")
    .select("id, status, error_code, created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  check("Event erzeugt Execution", (skipped ?? []).length > 0, JSON.stringify(skipped?.[0] ?? {}));
  const first = (skipped as { status: string; error_code?: string | null }[] | null)?.[0];
  check(
    "Bedingung nicht erfüllt -> keine Aktion",
    first?.error_code === "conditions_not_met",
    String(first?.error_code),
  );

  // raise the order above the threshold and re-run
  await admin.from("orders").update({ gross_total_minor: 90000 }).eq("id", ORDER);
  await publishOrderEvent(ORDER, "order.created");
  await processAutomationJobs(25);
  const { data: runs } = await admin
    .from("automation_executions")
    .select("id, status, error_code")
    .order("created_at", { ascending: false })
    .limit(1);
  const run = (runs as { status: string; error_code: string | null }[] | null)?.[0];
  check("Bedingung erfüllt -> completed", run?.status === "completed" && !run?.error_code, JSON.stringify(run ?? {}));
  const { data: tasks } = await admin
    .from("tasks")
    .select("id, title, entity_id, status")
    .eq("entity_id", ORDER)
    .order("created_at", { ascending: false })
    .limit(1);
  check("Aufgabe erstellt", (tasks ?? []).length > 0, JSON.stringify(tasks?.[0] ?? {}));
  await admin.from("orders").update({ gross_total_minor: 0 }).eq("id", ORDER);
  summary();
}
void main();
