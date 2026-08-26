import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSystemErrorsFn } from "@/lib/commerce/system/system.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/system/errors")({
  head: () => ({
    meta: [
      { title: "Systemfehler – Commerce OS" },
      {
        name: "description",
        content:
          "Zusammengeführter Fehler-Feed aus Jobs, Kommunikation, Zahlungen, Store API und Outbox.",
      },
      { property: "og:title", content: "Systemfehler – Commerce OS" },
      { property: "og:description", content: "Fehler aller Subsysteme an einem Ort." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SystemErrors,
});

const SOURCE_LABELS: Record<string, string> = {
  automation_job: "Automation-Job",
  automation_execution: "Automation",
  communication: "Kommunikation",
  payment: "Zahlung",
  store_api: "Store API",
  outbox: "Outbox",
};

function SystemErrors() {
  const { organizationId } = useActiveWorkspace();
  const fetchErrors = useServerFn(getSystemErrorsFn);

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["system-errors", organizationId],
    queryFn: () => fetchErrors({ data: { organizationId } }),
    enabled: Boolean(organizationId),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div>
        <h1 className="font-display text-2xl font-semibold">Systemfehler</h1>
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Systemfehler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Read-only Fehler-Feed aller Subsysteme. Zuletzt:{" "}
            {new Date(dataUpdatedAt).toLocaleTimeString("de-DE")}
          </p>
        </div>
        <Badge variant={data.length ? "destructive" : "secondary"}>
          {data.length ? `${data.length} Fehler` : "keine Fehler"}
        </Badge>
      </div>

      {data.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Aktuell liegen keine fehlgeschlagenen Jobs, Nachrichten, Zahlungen oder API-Aufrufe vor.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {data.map((err, i) => (
            <li key={`${err.source}-${err.entityId}-${i}`} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="destructive">{SOURCE_LABELS[err.source] ?? err.source}</Badge>
                {err.code && <code className="text-xs text-muted-foreground">{err.code}</code>}
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(err.at).toLocaleString("de-DE")}
                </span>
              </div>
              <p className="mt-2">{err.message}</p>
              {err.entityId && (
                <p className="mt-1 font-mono text-xs text-muted-foreground">{err.entityId}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
