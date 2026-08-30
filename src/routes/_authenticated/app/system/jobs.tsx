import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getJobsOverviewFn } from "@/lib/commerce/system/system.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/eyis/shell/PageHeader";
import { Panel } from "@/eyis/shell/DetailLayout";
import { EmptyState, ListSkeleton } from "@/eyis/data/States";

export const Route = createFileRoute("/_authenticated/app/system/jobs")({
  head: () => ({
    meta: [
      { title: "Jobs & Queues – EYIS" },
      {
        name: "description",
        content:
          "Live-Übersicht über Automation-Jobs, Outbox-Events und die Kommunikations-Queue.",
      },
      { property: "og:title", content: "Jobs & Queues – EYIS" },
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
        <PageHeader title="Jobs & Queues" />
        <ListSkeleton rows={3} />
      </div>
    );
  }

  const jobStatuses = Object.entries(data.jobsByStatus);
  const outboxStatuses = Object.entries(data.outboxByStatus);
  const commStatuses = Object.entries(data.communicationsByStatus);

  return (
    <div>
      <PageHeader
        title="Jobs & Queues"
        description={
          <>
            Read-only Live-Ansicht. Aktualisiert alle 15 Sekunden. Zuletzt:{" "}
            {new Date(dataUpdatedAt).toLocaleTimeString("de-DE")}
          </>
        }
        actions={
          <>
            <Badge variant={data.stuckRunning ? "destructive" : "secondary"}>
              {data.stuckRunning} hängend
            </Badge>
            <Badge variant={data.duePending ? "default" : "secondary"}>
              {data.duePending} fällig
            </Badge>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="Automation-Jobs">
          <ul className="space-y-1 text-sm">
            {jobStatuses.length === 0 && <li className="text-muted-foreground">keine Jobs</li>}
            {jobStatuses.map(([status, count]) => (
              <li key={status} className="flex items-center justify-between gap-2">
                <Badge variant={statusVariant(status)}>{status}</Badge>
                <span className="tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Outbox-Events">
          <ul className="space-y-1 text-sm">
            {outboxStatuses.length === 0 && <li className="text-muted-foreground">keine Events</li>}
            {outboxStatuses.map(([status, count]) => (
              <li key={status} className="flex items-center justify-between gap-2">
                <Badge variant={statusVariant(status)}>{status}</Badge>
                <span className="tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
          {data.outboxOldestPendingAt && (
            <p className="mt-2 text-xs text-muted-foreground">
              Ältestes offenes Event: {new Date(data.outboxOldestPendingAt).toLocaleString("de-DE")}
            </p>
          )}
        </Panel>
        <Panel title="Kommunikations-Queue">
          <ul className="space-y-1 text-sm">
            {commStatuses.length === 0 && <li className="text-muted-foreground">keine Nachrichten</li>}
            {commStatuses.map(([status, count]) => (
              <li key={status} className="flex items-center justify-between gap-2">
                <Badge variant={statusVariant(status)}>{status}</Badge>
                <span className="tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 font-display text-base font-semibold">Letzte Jobs</h2>
        {data.recentJobs.length === 0 ? (
          <EmptyState title="Noch keine Jobs vorhanden." />
        ) : (
          <ul className="space-y-2">
            {data.recentJobs.slice(0, 20).map((job) => (
              <li key={job.id} className="min-w-0 rounded-xl border border-border bg-card p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                  <code className="min-w-0 break-words text-xs">{job.jobType}</code>
                  <span className="text-xs text-muted-foreground">
                    Versuch {job.attempts}/{job.maxAttempts}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {new Date(job.updatedAt).toLocaleString("de-DE")}
                  </span>
                </div>
                {job.lastError && (
                  <p className="mt-2 break-words text-xs text-destructive">
                    {job.lastErrorCode ? `[${job.lastErrorCode}] ` : ""}
                    {job.lastError}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 font-display text-base font-semibold">Letzte Automation-Ausführungen</h2>
        {data.recentExecutions.length === 0 ? (
          <EmptyState title="Noch keine Ausführungen vorhanden." />
        ) : (
          <ul className="space-y-2">
            {data.recentExecutions.map((ex) => (
              <li
                key={ex.id}
                className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm"
              >
                <Badge variant={statusVariant(ex.status)}>{ex.status}</Badge>
                <code className="min-w-0 break-words text-xs">{ex.triggerType}</code>
                {ex.durationMs != null && (
                  <span className="text-xs text-muted-foreground tabular-nums">{ex.durationMs} ms</span>
                )}
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {ex.startedAt ? new Date(ex.startedAt).toLocaleString("de-DE") : "—"}
                </span>
                {ex.error && <p className="w-full break-words text-xs text-destructive">{ex.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
