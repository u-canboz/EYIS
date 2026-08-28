import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSystemStatusFn } from "@/lib/commerce/system/system.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel, DataRow } from "@/components/shell/DetailLayout";
import { EmptyState, ListSkeleton } from "@/components/data/States";

export const Route = createFileRoute("/_authenticated/app/system/status")({
  head: () => ({
    meta: [
      { title: "Systemstatus – EYIS" },
      {
        name: "description",
        content:
          "Betriebsstatus: Datenbank-Latenz, Mengengerüst, Provider-Modi und Cron-Endpunkte.",
      },
      { property: "og:title", content: "Systemstatus – EYIS" },
      { property: "og:description", content: "Betriebsstatus der Commerce-Plattform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SystemStatusPage,
});

const AREA_LABELS = { payments: "Zahlungen", shipping: "Versand", communications: "Kommunikation" } as const;

function SystemStatusPage() {
  const { organizationId } = useActiveWorkspace();
  const fetchStatus = useServerFn(getSystemStatusFn);

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["system-status", organizationId],
    queryFn: () => fetchStatus({ data: { organizationId } }),
    enabled: Boolean(organizationId),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title="Systemstatus" />
        <ListSkeleton rows={3} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Systemstatus"
        description={
          <>
            Read-only Betriebsübersicht. Zuletzt aktualisiert:{" "}
            {new Date(dataUpdatedAt).toLocaleTimeString("de-DE")}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Datenbank">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            Latenz: <span className="tabular-nums">{data.dbLatencyMs} ms</span>
            <Badge variant={data.dbLatencyMs < 1000 ? "secondary" : "destructive"}>
              {data.dbLatencyMs < 1000 ? "erreichbar" : "langsam"}
            </Badge>
          </p>
          <dl className="mt-2">
            <DataRow label="Produkte" value={data.counts.products} />
            <DataRow label="Bestellungen" value={data.counts.orders} />
            <DataRow label="Kunden" value={data.counts.customers} />
            <DataRow label="Offene Aufgaben" value={data.counts.openTasks} />
          </dl>
        </Panel>

        <Panel title="Provider-Modi">
          {data.providers.length === 0 ? (
            <EmptyState title="Keine Provider konfiguriert." />
          ) : (
            <ul className="space-y-2 text-sm">
              {data.providers.map((p, i) => (
                <li key={`${p.area}-${p.provider}-${i}`} className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">{AREA_LABELS[p.area]}</span>
                  <code className="break-words text-xs">{p.provider}</code>
                  <Badge variant={p.environment === "live" ? "default" : "secondary"}>
                    {p.environment ?? "—"}
                  </Badge>
                  <Badge variant={p.status === "active" ? "secondary" : "destructive"}>
                    {p.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Live-Provider (Stripe, E-Mail, Carrier) sind im aktuellen Stand bewusst nicht gesetzt
            (BLOCKED, siehe ENVIRONMENT_MATRIX.md).
          </p>
        </Panel>
      </div>

      <section className="mt-6">
        <h2 className="mb-1 font-display text-base font-semibold">Cron-Endpunkte</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Alle Endpunkte verlangen das plattformverwaltete Cron-Secret (Bearer-Token).
        </p>
        <ul className="space-y-2">
          {data.cronEndpoints.map((ep) => (
            <li key={ep.path} className="min-w-0 rounded-xl border border-border bg-card p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 break-words text-xs">{ep.path}</code>
                <Badge variant="secondary">{ep.schedule}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{ep.purpose}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
