/**
 * Commerce Health Engine (Phase 14 / Gate A5).
 * Read-only integrity checks. The heavy lifting happens in the database
 * function `health_run_checks` (tenant-scoped, role-guarded); this module
 * only shapes the result. No silent repairs — findings are reported, never
 * fixed automatically.
 */
import { buildReport, type HealthFinding, type HealthReport } from "./health.types";

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/** Runs all health checks for one organization as the calling user (role check in DB). */
export async function runHealthChecks(
  supabase: RpcClient,
  organizationId: string,
): Promise<HealthReport> {
  const { data, error } = await supabase.rpc("health_run_checks", { _org_id: organizationId });
  if (error) throw new Error(error.message);
  return buildReport(organizationId, (data ?? []) as HealthFinding[]);
}
