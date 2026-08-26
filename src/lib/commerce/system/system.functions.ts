import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Read-only job queue / outbox / communications overview. Roles enforced server-side. */
export const getJobsOverviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { getJobsOverview } = await import("./system.server");
    return getJobsOverview(context.supabase as never, context.userId, data.organizationId);
  });

/** Read-only system status: DB latency, entity counts, provider modes, cron endpoints. */
export const getSystemStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { getSystemStatus } = await import("./system.server");
    return getSystemStatus(context.supabase as never, context.userId, data.organizationId);
  });

/** Unified read-only error feed across jobs, communications, payments, store API, outbox. */
export const getSystemErrorsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { getSystemErrors } = await import("./system.server");
    return getSystemErrors(context.supabase as never, context.userId, data.organizationId);
  });
