import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Runs the read-only health checks. Roles owner/administrator/operations only (enforced in DB). */
export const runHealthChecksFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { runHealthChecks } = await import("./health.server");
    return runHealthChecks(context.supabase as never, data.organizationId);
  });
