/**
 * Background worker endpoint for the automation engine.
 * Authentication: the platform-managed cron secret (Bearer token).
 */
import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

async function run() {
  const { processAutomationJobs, reclaimStuckJobs } = await import(
    "@/lib/commerce/automation/queue.server"
  );
  const { enqueueDueSchedules } = await import("@/lib/commerce/automation/schedule.server");
  const reclaimed = await reclaimStuckJobs();
  const scheduled = await enqueueDueSchedules();
  const processed = await processAutomationJobs(25);
  return { ...reclaimed, ...scheduled, ...processed };
}

export const Route = createFileRoute("/api/public/jobs/automation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        try {
          const result = await run();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "content-type": "application/json" },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown";
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
