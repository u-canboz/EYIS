import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getJobsOverviewFn } from "@/lib/commerce/system/system.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/system/jobs")({
  head: () => ({
    meta: [
      { title: "Jobs & Queues – Commerce OS" },
      {
        name: "description",
        content:
          "Live-Übersicht über Automation-Jobs, Outbox-Events und die Kommunikations-Queue.",
      },
      { property: "og:title", content: "Jobs & Queues – Commerce OS" },
      { property: "og:description", content: "Job-Queues und Hintergrundverarbeitung überwachen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SystemJobs,
});

function statusVariant(status: string) {
  if (status === "failed") return "destructive" as const;
  if (status === "running" || status === "pending" || status === "queued") return "default" as const;
  return "secondary" as const;
}

function SystemJobs() {
  const { organizationId } = useActiveWorkspace();
  const fetchOverview = useServerFn(getJobsOverviewFn);

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["system-jobs", organizationId],
    queryFn: () => fetchOverview({ data: { organizationId } }),
    enabled: Boolean(organizationId),
    refetchInterval: 15_000,
  });

  if (isLoading || !data) {
    return (
      <div>
        <h1 className="font-display text-2xl font-semibold">Jobs & Queues</h1>
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    );
  }

  const jobStatuses = Object.entries(data.jobsByStatus);
  const outboxStatuses = Object.entries(data.outboxByStatus);
  const commStatuses = Object.entries(data.communicationsByStatus);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Jobs & Queues</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Read-only Live-Ansicht. Aktualisiert alle 15 Sekunden. Zuletzt:{" "}
            {new Date(dataUpdatedAt).toLocaleTimeString("de-DE")}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={data.stuckRunning ? "destructive" : "secondary"}>
            {data.stuckRunning} hängend
          </Badge>
          <Badge variant={data.duePending ? "default" : "secondary"}>
            {data.duePending} fällig
          </Badge>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <section className="rounded-md border p-4">
          <h2 className="text-sm font-semibold">Automation-Jobs</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {jobStatuses.length === 0 && <li className="text-muted-foreground">keine Jobs</li>}
            {jobStatuses.map(([status, count]) => (
              <li key={status} className="flex items-center justify-between">
                <Badge variant={statusVariant(status)}>{status}</Badge>
                <span className="font-mono">{count}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-md border p-4">
          <h2 className="text-sm font-semibold">Outbox-Events</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {outboxStatuses.length === 0 && <li className="text-muted-foreground">keine Events</li>}
            {outboxStatuses.map(([status, count]) => (
              <li key={status} className="flex items-center justify-between">
                <Badge variant={statusVariant(status)}>{status}</Badge>
                <span className="font-mono">{count}</span>
              </li>
            ))}
          </ul>
          {data.outboxOldestPendingAt && (
            <p className="mt-2 text-xs text-muted-foreground">
              Ältestes offenes Event: {new Date(data.outboxOldestPendingAt).toLocaleString("de-DE")}
            </p>
          )}
        </section>
        <section className="rounded-md border p-4">
          <h2 className="text-sm font-semibold">Kommunikations-Queue</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {commStatuses.length === 0 && <li className="text-muted-foreground">keine Nachrichten</li>}
            {commStatuses.map(([status, count]) => (
              <li key={status} className="flex items-center justify-between">
                <Badge variant={statusVariant(status)}>{status}</Badge>
                <span className="font-mono">{count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Separator className="my-6" />

      <section>
        <h2 className="text-base font-semibold">Letzte Jobs</h2>
        {data.recentJobs.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Noch keine Jobs vorhanden.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.recentJobs.slice(0, 20).map((job) => (
              <li key={job.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                  <code className="text-xs">{job.jobType}</code>
                  <span className="text-xs text-muted-foreground">
                    Versuch {job.attempts}/{job.maxAttempts}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(job.updatedAt).toLocaleString("de-DE")}
                  </span>
                </div>
                {job.lastError && (
                  <p className="mt-2 text-xs text-destructive">
                    {job.lastErrorCode ? `[${job.lastErrorCode}] ` : ""}
                    {job.lastError}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Separator className="my-6" />

      <section>
        <h2 className="text-base font-semibold">Letzte Automation-Ausführungen</h2>
        {data.recentExecutions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Noch keine Ausführungen vorhanden.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.recentExecutions.map((ex) => (
              <li key={ex.id} className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
                <Badge variant={statusVariant(ex.status)}>{ex.status}</Badge>
                <code className="text-xs">{ex.triggerType}</code>
                {ex.durationMs != null && (
                  <span className="text-xs text-muted-foreground">{ex.durationMs} ms</span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {ex.startedAt ? new Date(ex.startedAt).toLocaleString("de-DE") : "—"}
                </span>
                {ex.error && <p className="w-full text-xs text-destructive">{ex.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
