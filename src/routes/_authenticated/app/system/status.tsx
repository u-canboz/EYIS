import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSystemStatusFn } from "@/lib/commerce/system/system.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/system/status")({
  head: () => ({
    meta: [
      { title: "Systemstatus – Commerce OS" },
      {
        name: "description",
        content:
          "Betriebsstatus: Datenbank-Latenz, Mengengerüst, Provider-Modi und Cron-Endpunkte.",
      },
      { property: "og:title", content: "Systemstatus – Commerce OS" },
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
        <h1 className="font-display text-2xl font-semibold">Systemstatus</h1>
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Systemstatus</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Read-only Betriebsübersicht. Zuletzt aktualisiert:{" "}
        {new Date(dataUpdatedAt).toLocaleTimeString("de-DE")}
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-md border p-4">
          <h2 className="text-sm font-semibold">Datenbank</h2>
          <p className="mt-2 text-sm">
            Latenz: <span className="font-mono">{data.dbLatencyMs} ms</span>{" "}
            <Badge variant={data.dbLatencyMs < 1000 ? "secondary" : "destructive"}>
              {data.dbLatencyMs < 1000 ? "erreichbar" : "langsam"}
            </Badge>
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            <li className="flex justify-between"><span>Produkte</span><span className="font-mono">{data.counts.products}</span></li>
            <li className="flex justify-between"><span>Bestellungen</span><span className="font-mono">{data.counts.orders}</span></li>
            <li className="flex justify-between"><span>Kunden</span><span className="font-mono">{data.counts.customers}</span></li>
            <li className="flex justify-between"><span>Offene Aufgaben</span><span className="font-mono">{data.counts.openTasks}</span></li>
          </ul>
        </section>

        <section className="rounded-md border p-4">
          <h2 className="text-sm font-semibold">Provider-Modi</h2>
          {data.providers.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Keine Provider konfiguriert.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {data.providers.map((p, i) => (
                <li key={`${p.area}-${p.provider}-${i}`} className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">{AREA_LABELS[p.area]}</span>
                  <code className="text-xs">{p.provider}</code>
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
        </section>
      </div>

      <Separator className="my-6" />

      <section>
        <h2 className="text-base font-semibold">Cron-Endpunkte</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Alle Endpunkte verlangen das plattformverwaltete Cron-Secret (Bearer-Token).
        </p>
        <ul className="mt-3 space-y-2">
          {data.cronEndpoints.map((ep) => (
            <li key={ep.path} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-xs">{ep.path}</code>
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
