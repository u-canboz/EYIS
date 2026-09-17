/** Local scheduler. It never calls a remote application endpoint. */
const base = process.env["APP_BASE_URL"] ?? "";
if (
  process.env["APP_ENV"] !== "development" ||
  !["127.0.0.1", "localhost"].includes(new URL(base).hostname)
)
  throw new Error("Local development URL required.");
const secret = process.env["LOVABLE_CRON_SECRET"];
if (!secret) throw new Error("Local scheduler configuration missing.");
let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/api/public/jobs/communications`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      console.error(`Local mail scheduler: HTTP ${response.status}`);
      return;
    }
    const result = (await response.json()) as {
      processed?: number;
      sent?: number;
      failed?: number;
      newsletters?: { queued: number; errors: string[] };
    };
    if (result.processed || result.newsletters?.queued || result.newsletters?.errors.length)
      console.log(
        JSON.stringify({
          time: new Date().toISOString(),
          processed: result.processed,
          sent: result.sent,
          failed: result.failed,
          newslettersQueued: result.newsletters?.queued,
          errors: result.newsletters?.errors,
        }),
      );
  } catch {
    console.error("Local mail scheduler: application unavailable. Retrying in 30 seconds.");
  } finally {
    busy = false;
  }
}
const timer = setInterval(() => void tick(), 30000);
void tick();
process.on("SIGTERM", () => {
  clearInterval(timer);
  process.exit(0);
});
