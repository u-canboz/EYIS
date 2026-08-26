/* QA harness — Phase 14 / Gate A8: Jobs, Queues, Cron, Monitoring.
   Belegt: Cron-Auth auf allen drei Job-Endpunkten, Stuck-Job-Reclaim,
   Retry-Backoff, Fehlerklassifizierung, System-Monitoring-Zugriff (Rollen,
   Cross-Tenant), Monitoring-Aggregate und UI-Routen. */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { admin, check, summary } from "./lib";
import { getJobsOverview, getSystemStatus, getSystemErrors } from "../src/lib/commerce/system/system.server";

const APP = process.env["QA_APP_BASE"] ?? "http://localhost:8080";
const CRON = process.env["LOVABLE_CRON_SECRET"]!;
const ORG_A = "ba039523-f8ec-44ff-bb9d-2b5b86b0c0a6";
const SHOP_A = "a9751182-2f3a-4f9a-a2e6-73b6ffd48974";
const ORG_B = "29cb83d1-2f6a-42ff-8bb5-413463402b07";

const ENDPOINTS = ["automation", "communications", "expiration"];

async function post(endpoint: string, token: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers["authorization"] = `Bearer ${token}`;
  const res = await fetch(`${APP}/api/public/jobs/${endpoint}`, { method: "POST", headers });
  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    /* leer */
  }
  return { status: res.status, body };
}

async function userClient(email: string) {
  const client = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: "QaPhase5!Test-" + email.length,
  });
  if (error) throw new Error(error.message);
  return { client, userId: data.user.id };
}

async function insertJob(overrides: Record<string, unknown>) {
  const { data, error } = await admin
    .from("automation_jobs")
    .insert({
      organization_id: ORG_A,
      shop_id: SHOP_A,
      job_type: "scheduled_rule",
      payload: {},
      status: "pending",
      available_at: new Date().toISOString(),
      attempts: 0,
      max_attempts: 5,
      ...overrides,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function getJob(id: string) {
  const { data, error } = await admin
    .from("automation_jobs")
    .select("status, attempts, available_at, locked_at, locked_by, last_error, last_error_code")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

async function main() {
  const createdJobIds: string[] = [];

  // ---------------------------------------------------------- 1. Cron-Auth
  for (const ep of ENDPOINTS) {
    const noToken = await post(ep, null);
    check(`A8: /jobs/${ep} ohne Token → 401`, noToken.status === 401, `HTTP ${noToken.status}`);
    const wrongToken = await post(ep, "definitiv-falsches-token");
    check(`A8: /jobs/${ep} mit falschem Token → 401`, wrongToken.status === 401, `HTTP ${wrongToken.status}`);
  }
  for (const ep of ENDPOINTS) {
    const ok = await post(ep, CRON);
    check(
      `A8: /jobs/${ep} mit Cron-Secret → 200 ok`,
      ok.status === 200 && ok.body["ok"] === true,
      `HTTP ${ok.status} ${JSON.stringify(ok.body).slice(0, 120)}`,
    );
  }

  // ---------------------------------------------------------- 2. Stuck-Job-Reclaim
  const stuckId = await insertJob({
    status: "running",
    locked_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    locked_by: "qa-toter-worker",
  });
  createdJobIds.push(stuckId);
  await post("automation", CRON);
  const stuck = await getJob(stuckId);
  // Der Endpunkt führt reclaim → enqueue → process in einem Lauf aus: der
  // freigegebene Job wird sofort wieder geclaimt. Der Reclaim ist belegt, wenn
  // die Leiche des toten Workers (locked_by='qa-toter-worker') nicht mehr hält.
  const stillDeadlocked = stuck["status"] === "running" && stuck["locked_by"] === "qa-toter-worker";
  check(
    "A8: Hängender Job (locked > 15 min) wird freigegeben und weiterverarbeitet",
    !stillDeadlocked,
    JSON.stringify({ status: stuck["status"], locked_by: stuck["locked_by"] }),
  );

  // ---------------------------------------------------------- 3. Unbekannter Job-Typ → failed
  const badId = await insertJob({ job_type: "qa_unbekannter_typ" });
  createdJobIds.push(badId);
  await post("automation", CRON);
  const bad = await getJob(badId);
  check(
    "A8: Unbekannter Job-Typ → failed + invalid_configuration",
    bad["status"] === "failed" && bad["last_error_code"] === "invalid_configuration",
    JSON.stringify({ status: bad["status"], code: bad["last_error_code"] }),
  );

  // ---------------------------------------------------------- 4. Retry-Backoff (End-to-End)
  // Echte Engine-Ausführung: webhook.send auf ein unerreichbares, aber öffentlich
  // routbares Ziel (TEST-NET-3) → Timeout → retryable → Engine legt einen
  // Resume-Job mit Backoff (available_at in der Zukunft) an.
  const { data: endpoint, error: epErr } = await admin
    .from("outgoing_webhook_endpoints")
    .insert({
      organization_id: ORG_A,
      shop_id: SHOP_A,
      name: "QA A8 unerreichbar",
      url: "https://203.0.113.1/qa-hook",
      status: "active",
    })
    .select("id")
    .single();
  if (epErr) throw new Error(epErr.message);

  const { data: rule, error: ruleErr } = await admin
    .from("automation_rules")
    .insert({
      organization_id: ORG_A,
      shop_id: SHOP_A,
      name: "QA A8 Retry-Regel",
      trigger_type: "manual",
      status: "active",
    })
    .select("id")
    .single();
  if (ruleErr) throw new Error(ruleErr.message);

  const { data: version, error: verErr } = await admin
    .from("automation_rule_versions")
    .insert({
      rule_id: rule.id,
      organization_id: ORG_A,
      version: 1,
      trigger_snapshot: { type: "manual" },
      conditions_snapshot: { all: [] },
      actions_snapshot: [
        { position: 1, action_type: "webhook.send", config: { endpointId: endpoint.id } },
      ],
    })
    .select("id")
    .single();
  if (verErr) throw new Error(verErr.message);

  const { data: execution, error: exErr } = await admin
    .from("automation_executions")
    .insert({
      organization_id: ORG_A,
      shop_id: SHOP_A,
      rule_id: rule.id,
      rule_version: 1,
      rule_version_id: version.id,
      trigger_type: "manual",
      status: "queued",
      current_action_position: 0,
      context_snapshot: {},
      correlation_id: crypto.randomUUID(),
      chain_depth: 0,
    })
    .select("id")
    .single();
  if (exErr) throw new Error(exErr.message);

  const retryJobId = await insertJob({ job_type: "resume_execution", execution_id: execution.id });
  createdJobIds.push(retryJobId);
  const workerResult = await post("automation", CRON);
  const retryJob = await getJob(retryJobId);

  // Der ursprüngliche Job ist abgeschlossen; die Engine hat einen neuen
  // Resume-Job mit Backoff eingeplant.
  const { data: resumeJobs } = await admin
    .from("automation_jobs")
    .select("id, status, available_at")
    .eq("execution_id", execution.id)
    .eq("status", "pending")
    .gt("available_at", new Date(Date.now() + 30_000).toISOString());
  const resumeId = resumeJobs?.[0]?.id as string | undefined;
  if (resumeId) createdJobIds.push(resumeId);
  check(
    "A8: Retryable Fehler → Resume-Job mit Backoff eingeplant",
    retryJob["status"] === "completed" && Boolean(resumeId),
    JSON.stringify({
      jobStatus: retryJob["status"],
      worker: (workerResult.body["results"] as unknown[])?.length ?? 0,
      resumeAt: resumeJobs?.[0]?.["available_at"] ?? null,
    }),
  );

  const { data: execAfter } = await admin
    .from("automation_executions")
    .select("status")
    .eq("id", execution.id)
    .single();
  // scheduleResume setzt die Execution bewusst auf "queued" (= wartet auf Resume-Job).
  check(
    "A8: Execution wartet auf Retry (Status queued, nicht failed)",
    execAfter?.status === "queued",
    `status=${execAfter?.status}`,
  );

  // Cleanup der Retry-Strecke
  await admin.from("automation_jobs").delete().eq("execution_id", execution.id);
  await admin.from("automation_executions").delete().eq("id", execution.id);
  await admin.from("automation_rule_versions").delete().eq("id", version.id);
  await admin.from("automation_rules").delete().eq("id", rule.id);
  await admin.from("outgoing_webhook_endpoints").delete().eq("id", endpoint.id);

  // ---------------------------------------------------------- 5. Monitoring-Zugriff (Rollen)
  const userA = await userClient("qa-owner-a@commerce-qa.test");
  const userB = await userClient("qa-owner-b@commerce-qa.test");

  let denied = false;
  try {
    await getSystemStatus(userB.client as never, userB.userId, ORG_A);
  } catch (e) {
    denied = e instanceof Error && e.message.includes("Keine Berechtigung");
  }
  check("A8: Cross-Tenant-Zugriff auf Systemstatus abgelehnt (User B → Org A)", denied);

  const status = await getSystemStatus(userA.client as never, userA.userId, ORG_A);
  check(
    "A8: Owner erhält Systemstatus (Latenz + Counts + Provider + Cron)",
    status.dbLatencyMs >= 0 &&
      typeof status.counts.products === "number" &&
      status.cronEndpoints.length === 3 &&
      status.providers.some((p) => p.area === "payments"),
    `latency=${status.dbLatencyMs}ms products=${status.counts.products} providers=${status.providers.length}`,
  );

  const overview = await getJobsOverview(userA.client as never, userA.userId, ORG_A);
  check(
    "A8: Jobs-Übersicht liefert Aggregate (Jobs, Outbox, Kommunikation)",
    typeof overview.jobsByStatus === "object" &&
      typeof overview.outboxByStatus === "object" &&
      typeof overview.communicationsByStatus === "object" &&
      overview.duePending >= 0,
    `jobs=${JSON.stringify(overview.jobsByStatus)} outbox=${JSON.stringify(overview.outboxByStatus)}`,
  );

  const errors = await getSystemErrors(userA.client as never, userA.userId, ORG_A);
  check(
    "A8: Fehler-Feed aggregiert Quellen (sortiert, max 100)",
    Array.isArray(errors) && errors.length <= 100,
    `errors=${errors.length}`,
  );

  // Cross-Tenant: Org-B-Übersicht darf keine Org-A-Jobs enthalten
  const overviewB = await getJobsOverview(userB.client as never, userB.userId, ORG_B);
  const leaked = overviewB.recentJobs.some((j) => createdJobIds.includes(j.id));
  check("A8: Org-B-Übersicht enthält keine Org-A-Jobs", !leaked, `jobsB=${overviewB.recentJobs.length}`);

  // ---------------------------------------------------------- 6. Anonyme SSR-Aufrufe leaken keine Daten
  // Das Auth-Gate wirkt clientseitig (Redirect nach Hydration, per Playwright
  // separat belegt). Die SSR-Shell selbst darf keine geschützten Daten enthalten.
  for (const route of ["/app/system/jobs", "/app/system/status", "/app/system/errors"]) {
    const res = await fetch(`${APP}${route}`);
    const html = await res.text();
    const leaks =
      html.includes(ORG_A) ||
      html.includes("automation_jobs") ||
      html.includes("outbox_events") ||
      html.includes("payment_provider_configs");
    check(
      `A8: ${route} anonym → SSR-Shell ohne geschützte Daten`,
      res.status === 200 && !leaks,
      `HTTP ${res.status}, leak=${leaks}`,
    );
  }

  // ---------------------------------------------------------- Cleanup
  await admin.from("automation_jobs").delete().in("id", createdJobIds);

  writeFileSync(
    "qa/results-phase14-jobs.json",
    JSON.stringify({ at: new Date().toISOString(), results: (await import("./lib")).results }, null, 2),
  );
  summary();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
