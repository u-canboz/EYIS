/**
 * Scheduler endpoint: sends due and retryable communications.
 * Protected by a shared secret so it can be triggered by pg_cron or an
 * external scheduler without exposing the queue.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/jobs/communications")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["COMMUNICATION_JOB_SECRET"];
        const provided = request.headers.get("x-job-secret") ?? "";
        if (!secret || provided.length !== secret.length || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { processQueue } = await import("@/lib/commerce/communications/communication.server");
        const result = await processQueue(50);
        return Response.json(result);
      },
    },
  },
});
