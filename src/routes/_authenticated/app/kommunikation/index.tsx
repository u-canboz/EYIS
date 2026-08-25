import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCommunicationsFn,
  listTemplatesFn,
} from "@/lib/commerce/communications/communication.functions";
import { STATUS_LABELS } from "@/lib/commerce/communications/communication.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/kommunikation/")({
  head: () => ({
    meta: [
      { title: "Kommunikation – Commerce OS" },
      {
        name: "description",
        content:
          "Communication Studio: transaktionale E-Mails, Vorlagen, Branding, Regeln und Versandprotokoll an einem Ort.",
      },
      { property: "og:title", content: "Kommunikation – Commerce OS" },
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
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Kommunikation</h1>
        <p className="text-sm text-muted-foreground">
          Alle transaktionalen Nachrichten laufen über eine Engine: Ereignis, Regel, Vorlage,
          Branding, Versand und Protokoll.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
          >
            <p className="font-medium">{s.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
          </Link>
        ))}
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Vorlagen</p>
          <p className="mt-1 text-2xl font-semibold">{templates.data?.length ?? "–"}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Zuletzt erzeugt</p>
          <p className="mt-1 text-2xl font-semibold">{logs.data?.length ?? "–"}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Fehlgeschlagen</p>
          <p className="mt-1 text-2xl font-semibold">{failed}</p>
        </div>
      </section>

      <section className="rounded-lg border">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-medium">Letzte Nachrichten</p>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/kommunikation/verlauf">Alle ansehen</Link>
          </Button>
        </div>
        {logs.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : !logs.data?.length ? (
          <p className="p-4 text-sm text-muted-foreground">
            Noch keine Nachrichten. Sende eine Testmail aus einer Vorlage.
          </p>
        ) : (
          <ul className="divide-y">
            {logs.data.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link
                    to="/app/kommunikation/verlauf/$communicationId"
                    params={{ communicationId: l.id }}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {l.subject || l.templateKey}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.recipient} · {new Date(l.createdAt).toLocaleString("de-DE")}
                  </p>
                </div>
                <Badge variant={l.status === "failed" ? "destructive" : "secondary"}>
                  {STATUS_LABELS[l.status] ?? l.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
