/**
 * Background worker endpoint for the automation engine.
 * Called by the scheduler; authenticated with the project's publishable key.
 */
import { createFileRoute } from "@tanstack/react-router";

async function run() {
  const { processAutomationJobs, reclaimStuckJobs } =
    await import("@/lib/commerce/automation/queue.server");
  const { enqueueDueSchedules } = await import("@/lib/commerce/automation/schedule.server");
  const reclaimed = await reclaimStuckJobs();
  const scheduled = await enqueueDueSchedules();
  const processed = await processAutomationJobs(25);
  return { ...reclaimed, ...scheduled, ...processed };
}

function unauthorized() {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

function authorized(request: Request) {
  const expected = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const provided =
    request.headers.get("apikey") ?? request.headers.get("authorization")?.replace(/^Bearer /, "");
  return Boolean(expected) && provided === expected;
}

export const Route = createFileRoute("/api/public/jobs/automation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return unauthorized();
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
