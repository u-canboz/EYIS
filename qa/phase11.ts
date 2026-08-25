/* QA harness — phase 11 automation engine. */
import { admin, check, summary } from "./lib";
import { publishOrderEvent } from "../src/lib/commerce/event-payloads.server";
import { processAutomationJobs } from "../src/lib/commerce/automation/queue.server";

const ORDER = "0da70596-d520-4305-9554-c1e708f20f34";

async function main() {
  // condition is total_gross_minor > 50000; order is 5480 -> must not create a task
  await publishOrderEvent(ORDER, "order.created");
  await processAutomationJobs(25);
  const { data: skipped } = await admin
    .from("automation_executions")
    .select("id, status, created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  check("Event erzeugt Execution", (skipped ?? []).length > 0, JSON.stringify(skipped?.[0] ?? {}));
  check(
    "Bedingung nicht erfüllt -> skipped",
    (skipped as { status: string }[] | null)?.[0]?.status === "skipped",
    String((skipped as { status: string }[] | null)?.[0]?.status),
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
  check("Bedingung erfüllt -> succeeded", run?.status === "succeeded", JSON.stringify(run ?? {}));
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
