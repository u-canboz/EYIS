/**
 * System monitoring (Phase 14 / Gate A8). Read-only aggregates over job queues,
 * outbox, communications and provider configurations.
 *
 * Access model: the caller is verified with their own (RLS-bound) client via
 * has_org_role — owner/administrator/operations only. Only then are reads
 * executed with the privileged client, always scoped to the caller's
 * organization. Nothing here writes.
 */
import { getAdmin } from "../core.server";
import {
  CRON_ENDPOINTS,
  type ExecutionRow,
  type JobRow,
  type JobsOverview,
  type ProviderStatus,
  type SystemError,
  type SystemStatus,
} from "./system.types";

type UserClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

const MONITORING_ROLES = ["owner", "administrator", "operations"] as const;

async function assertMonitoringRole(supabase: UserClient, userId: string, orgId: string) {
  for (const role of MONITORING_ROLES) {
    const { data, error } = await supabase.rpc("has_org_role", {
      _user_id: userId,
      _org_id: orgId,
      _role: role,
    });
    if (error) throw new Error(error.message);
    if (data === true) return;
  }
  throw new Error("Keine Berechtigung für System-Monitoring.");
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? null : String(v));
const num = (v: unknown) => (v == null ? 0 : Number(v));

function countBy(rows: Row[], key: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = String(r[key] ?? "unknown");
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export async function getJobsOverview(
  supabase: UserClient,
  userId: string,
  organizationId: string,
): Promise<JobsOverview> {
  await assertMonitoringRole(supabase, userId, organizationId);
  const admin = await getAdmin();
  const now = Date.now();
  const stuckCutoff = new Date(now - 15 * 60_000).toISOString();

  const [jobsRes, executionsRes, outboxRes, commsRes] = await Promise.all([
    admin
      .from("automation_jobs")
      .select(
        "id, job_type, status, attempts, max_attempts, available_at, locked_at, locked_by, last_error, last_error_code, created_at, updated_at",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(300),
    admin
      .from("automation_executions")
      .select("id, rule_id, trigger_type, status, error, started_at, finished_at, duration_ms")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("outbox_events")
      .select("id, status, available_at, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1000),
    admin
      .from("communications")
      .select("id, status")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);
  for (const res of [jobsRes, executionsRes, outboxRes, commsRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const jobs = (jobsRes.data ?? []) as Row[];
  const outbox = (outboxRes.data ?? []) as Row[];
  const pendingOutbox = outbox
    .filter((r) => r["status"] === "pending")
    .map((r) => String(r["created_at"]))
    .sort();

  return {
    generatedAt: new Date().toISOString(),
    jobsByStatus: countBy(jobs, "status"),
    duePending: jobs.filter(
      (r) => r["status"] === "pending" && String(r["available_at"] ?? "") <= new Date().toISOString(),
    ).length,
    stuckRunning: jobs.filter(
      (r) => r["status"] === "running" && String(r["locked_at"] ?? "") < stuckCutoff,
    ).length,
    recentJobs: jobs.slice(0, 50).map(
      (r): JobRow => ({
        id: String(r["id"]),
        jobType: String(r["job_type"]),
        status: String(r["status"]),
        attempts: num(r["attempts"]),
        maxAttempts: num(r["max_attempts"]),
        availableAt: str(r["available_at"]),
        lockedAt: str(r["locked_at"]),
        lockedBy: str(r["locked_by"]),
        lastError: str(r["last_error"]),
        lastErrorCode: str(r["last_error_code"]),
        createdAt: String(r["created_at"]),
        updatedAt: String(r["updated_at"]),
      }),
    ),
    recentExecutions: ((executionsRes.data ?? []) as Row[]).map(
      (r): ExecutionRow => ({
        id: String(r["id"]),
        ruleId: str(r["rule_id"]),
        triggerType: String(r["trigger_type"]),
        status: String(r["status"]),
        error: str(r["error"]),
        startedAt: str(r["started_at"]),
        finishedAt: str(r["finished_at"]),
        durationMs: r["duration_ms"] == null ? null : num(r["duration_ms"]),
      }),
    ),
    outboxByStatus: countBy(outbox, "status"),
    outboxOldestPendingAt: pendingOutbox[0] ?? null,
    communicationsByStatus: countBy((commsRes.data ?? []) as Row[], "status"),
  };
}

export async function getSystemStatus(
  supabase: UserClient,
  userId: string,
  organizationId: string,
): Promise<SystemStatus> {
  await assertMonitoringRole(supabase, userId, organizationId);
  const admin = await getAdmin();

  const started = Date.now();
  const { error: pingError } = await admin.from("shops").select("id").limit(1);
  if (pingError) throw new Error(pingError.message);
  const dbLatencyMs = Date.now() - started;

  const count = async (table: string, filter?: Record<string, string>) => {
    let q = admin
      .from(table as never)
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId);
    for (const [k, v] of Object.entries(filter ?? {})) q = q.eq(k, v);
    const { count: c, error } = await q;
    if (error) throw new Error(error.message);
    return c ?? 0;
  };

  const [products, orders, customers, openTasks, paymentCfg, shippingCfg, commCfg] =
    await Promise.all([
      count("products"),
      count("orders"),
      count("customers"),
      count("tasks", { status: "open" }),
      admin
        .from("payment_provider_configs")
        .select("provider, display_name, environment, status")
        .eq("organization_id", organizationId),
      admin
        .from("shipping_provider_configs")
        .select("provider, display_name, test_mode, status")
        .eq("organization_id", organizationId),
      admin
        .from("communication_provider_configs")
        .select("provider, display_name, test_mode, status")
        .eq("organization_id", organizationId),
    ]);
  for (const res of [paymentCfg, shippingCfg, commCfg]) {
    if (res.error) throw new Error(res.error.message);
  }

  const providers: ProviderStatus[] = [
    ...((paymentCfg.data ?? []) as Row[]).map(
      (r): ProviderStatus => ({
        area: "payments",
        provider: String(r["provider"]),
        displayName: str(r["display_name"]),
        environment: str(r["environment"]),
        status: String(r["status"]),
      }),
    ),
    ...((shippingCfg.data ?? []) as Row[]).map(
      (r): ProviderStatus => ({
        area: "shipping",
        provider: String(r["provider"]),
        displayName: str(r["display_name"]),
        environment: r["test_mode"] === false ? "live" : "test",
        status: String(r["status"]),
      }),
    ),
    ...((commCfg.data ?? []) as Row[]).map(
      (r): ProviderStatus => ({
        area: "communications",
        provider: String(r["provider"]),
        displayName: str(r["display_name"]),
        environment: r["test_mode"] === false ? "live" : "test",
        status: String(r["status"]),
      }),
    ),
  ];

  return {
    generatedAt: new Date().toISOString(),
    dbLatencyMs,
    counts: { products, orders, customers, openTasks },
    providers,
    cronEndpoints: CRON_ENDPOINTS,
  };
}

export async function getSystemErrors(
  supabase: UserClient,
  userId: string,
  organizationId: string,
): Promise<SystemError[]> {
  await assertMonitoringRole(supabase, userId, organizationId);
  const admin = await getAdmin();

  const [failedJobs, failedExecutions, failedComms, failedPayments, apiErrors, failedOutbox] =
    await Promise.all([
      admin
        .from("automation_jobs")
        .select("id, last_error, last_error_code, updated_at")
        .eq("organization_id", organizationId)
        .eq("status", "failed")
        .order("updated_at", { ascending: false })
        .limit(50),
      admin
        .from("automation_executions")
        .select("id, error, error_code, finished_at")
        .eq("organization_id", organizationId)
        .eq("status", "failed")
        .order("finished_at", { ascending: false })
        .limit(50),
      admin
        .from("communication_attempts")
        .select("id, communication_id, error_code, error_message, completed_at")
        .eq("organization_id", organizationId)
        .in("status", ["hard_bounce", "rejected", "complained"])
        .order("started_at", { ascending: false })
        .limit(50),
      admin
        .from("payment_attempts")
        .select("id, payment_session_id, error_code, error_message, created_at")
        .eq("organization_id", organizationId)
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("store_api_request_logs")
        .select("id, route, status_code, error_code, created_at")
        .eq("organization_id", organizationId)
        .gte("status_code", 400)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("outbox_events")
        .select("id, event_type, last_error, created_at")
        .eq("organization_id", organizationId)
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
  for (const res of [failedJobs, failedExecutions, failedComms, failedPayments, apiErrors, failedOutbox]) {
    if (res.error) throw new Error(res.error.message);
  }

  const errors: SystemError[] = [
    ...((failedJobs.data ?? []) as Row[]).map(
      (r): SystemError => ({
        source: "automation_job",
        at: String(r["updated_at"]),
        code: str(r["last_error_code"]),
        message: str(r["last_error"]) ?? "Job fehlgeschlagen",
        entityId: str(r["id"]),
      }),
    ),
    ...((failedExecutions.data ?? []) as Row[]).map(
      (r): SystemError => ({
        source: "automation_execution",
        at: str(r["finished_at"]) ?? new Date().toISOString(),
        code: str(r["error_code"]),
        message: str(r["error"]) ?? "Execution fehlgeschlagen",
        entityId: str(r["id"]),
      }),
    ),
    ...((failedComms.data ?? []) as Row[]).map(
      (r): SystemError => ({
        source: "communication",
        at: str(r["completed_at"]) ?? new Date().toISOString(),
        code: str(r["error_code"]),
        message: str(r["error_message"]) ?? "Kommunikation fehlgeschlagen",
        entityId: str(r["communication_id"]),
      }),
    ),
    ...((failedPayments.data ?? []) as Row[]).map(
      (r): SystemError => ({
        source: "payment",
        at: String(r["created_at"]),
        code: str(r["error_code"]),
        message: str(r["error_message"]) ?? "Zahlungsversuch fehlgeschlagen",
        entityId: str(r["payment_session_id"]),
      }),
    ),
    ...((apiErrors.data ?? []) as Row[]).map(
      (r): SystemError => ({
        source: "store_api",
        at: String(r["created_at"]),
        code: str(r["error_code"]) ?? String(r["status_code"]),
        message: `Store API ${String(r["route"])} → ${String(r["status_code"])}`,
        entityId: str(r["id"]),
      }),
    ),
    ...((failedOutbox.data ?? []) as Row[]).map(
      (r): SystemError => ({
        source: "outbox",
        at: String(r["created_at"]),
        code: str(r["event_type"]),
        message: str(r["last_error"]) ?? "Outbox-Event fehlgeschlagen",
        entityId: str(r["id"]),
      }),
    ),
  ];

  return errors.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100);
}
