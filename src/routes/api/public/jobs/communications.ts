/**
 * Scheduler endpoint: sends due and retryable communications.
 * Authentication: the platform-managed cron secret (Bearer token), the same
 * mechanism used by every other job endpoint.
 */
import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/communications")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { processQueue } = await import("@/lib/commerce/communications/communication.server");
        const result = await processQueue(50);
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
