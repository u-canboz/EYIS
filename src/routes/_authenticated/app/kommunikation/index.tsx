import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight } from "lucide-react";
import {
  listCommunicationsFn,
  listTemplatesFn,
} from "@/lib/commerce/communications/communication.functions";
import { STATUS_LABELS } from "@/lib/commerce/communications/communication.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel } from "@/components/shell/DetailLayout";
import { EmptyState, ListSkeleton } from "@/components/data/States";

export const Route = createFileRoute("/_authenticated/app/kommunikation/")({
  head: () => ({
    meta: [
      { title: "Kommunikation – EYIS" },
      {
        name: "description",
        content:
          "Communication Studio: transaktionale E-Mails, Vorlagen, Branding, Regeln und Versandprotokoll an einem Ort.",
      },
      { property: "og:title", content: "Kommunikation – EYIS" },
      {
        property: "og:description",
        content: "Transaktionale Kundenkommunikation zentral steuern und nachvollziehen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunicationOverview,
});

const SECTIONS = [
  {
    to: "/app/kommunikation/vorlagen",
    title: "Vorlagen",
    text: "Systemvorlagen anpassen, eigene Fassungen veröffentlichen und Testmails senden.",
  },
  {
    to: "/app/kommunikation/branding",
    title: "Branding",
    text: "Logo, Farben, Schrift und Footer für alle E-Mails dieses Shops.",
  },
  {
    to: "/app/kommunikation/regeln",
    title: "Regeln & Anbieter",
    text: "Welches Ereignis welche Mail auslöst, Absenderadressen und Sperrliste.",
  },
  {
    to: "/app/kommunikation/verlauf",
    title: "Versandprotokoll",
    text: "Jede erzeugte Nachricht mit Snapshot, Zustellstatus und Versuchen.",
  },
] as const;

function CommunicationOverview() {
  const { organizationId, shopId } = useActiveWorkspace();
  const fetchLogs = useServerFn(listCommunicationsFn);
  const fetchTemplates = useServerFn(listTemplatesFn);

  const logs = useQuery({
    queryKey: ["communications", "recent", organizationId, shopId],
    enabled: !!organizationId && !!shopId,
    queryFn: () => fetchLogs({ data: { organizationId, shopId, limit: 8 } }),
  });
  const templates = useQuery({
    queryKey: ["communication-templates", organizationId, shopId],
    enabled: !!organizationId && !!shopId,
    queryFn: () => fetchTemplates({ data: { organizationId, shopId } }),
  });

  const failed = (logs.data ?? []).filter((l) => l.status === "failed").length;

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Kommunikation"
        description="Alle transaktionalen Nachrichten laufen über eine Engine: Ereignis, Regel, Vorlage, Branding, Versand und Protokoll."
      />

      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.to} to={s.to} className="min-w-0">
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-raised transition-colors hover:border-primary/50 hover:bg-accent/5">
              <div className="min-w-0">
                <p className="truncate font-medium">{s.title}</p>
                <p className="mt-1 text-sm text-pretty text-muted-foreground">{s.text}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </div>
          </Link>
        ))}
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-raised">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Vorlagen</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{templates.data?.length ?? "–"}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-raised">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Zuletzt erzeugt</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{logs.data?.length ?? "–"}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-raised">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Fehlgeschlagen</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{failed}</p>
        </div>
      </div>

      <Panel
        title="Letzte Nachrichten"
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/kommunikation/verlauf">Alle ansehen</Link>
          </Button>
        }
        bodyClassName="p-0"
      >
        {logs.isLoading ? (
          <div className="p-4">
            <ListSkeleton rows={3} />
          </div>
        ) : !logs.data?.length ? (
          <div className="p-4">
            <EmptyState
              title="Noch keine Nachrichten"
              description="Sende eine Testmail aus einer Vorlage."
            />
          </div>
        ) : (
          <ul className="min-w-0 divide-y divide-border">
            {logs.data.map((l) => (
              <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link
                    to="/app/kommunikation/verlauf/$communicationId"
                    params={{ communicationId: l.id }}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {l.subject || l.templateKey}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.recipient} · {new Date(l.createdAt).toLocaleString("de-DE")}
                  </p>
                </div>
                <Badge variant={l.status === "failed" ? "destructive" : "secondary"} className="shrink-0">
                  {STATUS_LABELS[l.status] ?? l.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
