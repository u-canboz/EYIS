/**
 * Background worker. Claims jobs atomically via SKIP LOCKED so several worker
 * invocations can run in parallel without executing the same job twice.
 */
import { getAdmin } from "../core.server";
import { runExecution } from "./engine.server";

type Row = Record<string, unknown>;

const MAX_ATTEMPTS_FALLBACK = 5;
const BACKOFF_SECONDS = [60, 300, 1_800, 7_200, 21_600];

export async function processAutomationJobs(limit = 20) {
  const admin = await getAdmin();
  const worker = `worker-${crypto.randomUUID().slice(0, 8)}`;
  const { data, error } = await admin.rpc(
    "automation_claim_jobs" as never,
    {
      _limit: limit,
      _worker: worker,
    } as never,
  );
  if (error) throw new Error(error.message);

  const jobs = (data ?? []) as Row[];
  const results: { jobId: string; status: string }[] = [];

  for (const job of jobs) {
    const jobId = job["id"] as string;
    try {
      switch (job["job_type"]) {
        case "resume_execution": {
          const executionId = job["execution_id"] as string;
          const result = await runExecution(executionId);
          await admin
            .from("automation_jobs")
            .update({ status: "completed", last_error: null } as never)
            .eq("id", jobId);
          results.push({ jobId, status: result.status });
          break;
        }
        case "scheduled_rule": {
          const { runScheduledRule } = await import("./schedule.server");
          await runScheduledRule(job["rule_id"] as string);
          await admin
            .from("automation_jobs")
            .update({ status: "completed" } as never)
            .eq("id", jobId);
          results.push({ jobId, status: "completed" });
          break;
        }
        default: {
          await admin
            .from("automation_jobs")
            .update({
              status: "failed",
              last_error_code: "invalid_configuration",
              last_error: "Unbekannter Job-Typ.",
            } as never)
            .eq("id", jobId);
          results.push({ jobId, status: "failed" });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      const attempts = Number(job["attempts"] ?? 1);
      const max = Number(job["max_attempts"] ?? MAX_ATTEMPTS_FALLBACK);
      const exhausted = attempts >= max;
      await admin
        .from("automation_jobs")
        .update({
          status: exhausted ? "failed" : "pending",
          last_error: message,
          last_error_code: exhausted ? "max_attempts" : "temporary_unavailable",
          locked_at: null,
          locked_by: null,
          available_at: exhausted
            ? job["available_at"]
            : new Date(Date.now() + (BACKOFF_SECONDS[attempts - 1] ?? 3_600) * 1000).toISOString(),
        } as never)
        .eq("id", jobId);
      results.push({ jobId, status: exhausted ? "failed" : "retry" });
    }
  }

  return { claimed: jobs.length, results };
}

/** Releases jobs whose worker died mid-run so they can be picked up again. */
export async function reclaimStuckJobs(olderThanMinutes = 15) {
  const admin = await getAdmin();
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();
  const { data } = await admin
    .from("automation_jobs")
    .update({ status: "pending", locked_at: null, locked_by: null } as never)
    .eq("status", "running")
    .lt("locked_at", cutoff)
    .select("id");
  return { reclaimed: (data ?? []).length };
}
