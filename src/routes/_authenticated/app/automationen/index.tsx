import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listAutomationsFn,
  automationInboxFn,
  setAutomationStatusFn,
  resetCircuitFn,
  installAutomationTemplateFn,
} from "@/lib/commerce/automation/automation.functions";
import {
  AUTOMATION_STATUS_LABELS,
  EXECUTION_STATUS_LABELS,
} from "@/lib/commerce/automation/automation.types";
import { AUTOMATION_TEMPLATES } from "@/lib/commerce/automation/templates";
import { describeTrigger } from "@/lib/commerce/automation/summary";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/app/automationen/")({
  head: () => ({
    meta: [
      { title: "Automationen – Commerce OS" },
      {
        name: "description",
        content:
          "Automation Engine: wiederkehrende Abläufe als Regeln abbilden, Aufgaben verteilen und jeden Lauf nachvollziehen.",
      },
      { property: "og:title", content: "Automationen – Commerce OS" },
      {
        property: "og:description",
        content: "Regeln, Aufgaben und Hintergrundläufe für den Shop-Betrieb an einem Ort.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AutomationOverview,
});

const STATUS_TONE: Record<string, string> = {
  active: "bg-primary/15 text-primary",
  paused: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  draft: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground",
};

function AutomationOverview() {
  const { organizationId, shopId } = useActiveWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const scope = { organizationId, shopId };
  const enabled = !!organizationId && !!shopId;

  const fetchRules = useServerFn(listAutomationsFn);
  const fetchInbox = useServerFn(automationInboxFn);
  const setStatus = useServerFn(setAutomationStatusFn);
  const resetCircuit = useServerFn(resetCircuitFn);
  const installTemplate = useServerFn(installAutomationTemplateFn);

  const rules = useQuery({
    queryKey: ["automations", organizationId, shopId],
    enabled,
    queryFn: () => fetchRules({ data: scope }),
  });
  const inbox = useQuery({
    queryKey: ["automation-inbox", organizationId, shopId],
    enabled,
    queryFn: () => fetchInbox({ data: scope }),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["automations"] });
    void qc.invalidateQueries({ queryKey: ["automation-inbox"] });
  };

  const statusMutation = useMutation({
    mutationFn: (v: { ruleId: string; status: "active" | "paused" | "archived" }) =>
      setStatus({ data: { organizationId, ...v } }),
    onSuccess: () => {
      toast.success("Status aktualisiert.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMutation = useMutation({
    mutationFn: (ruleId: string) => resetCircuit({ data: { organizationId, ruleId } }),
    onSuccess: () => {
      toast.success("Automation wieder freigegeben.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const installMutation = useMutation({
    mutationFn: (templateKey: string) => installTemplate({ data: { ...scope, templateKey } }),
    onSuccess: (res: { ruleId: string; note: string | null }) => {
      toast.success(res.note ?? "Vorlage übernommen. Jetzt prüfen und aktivieren.");
      invalidate();
      void navigate({ to: "/app/automationen/regel/$ruleId", params: { ruleId: res.ruleId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = rules.data ?? [];
  const data = inbox.data;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Automationen</h1>
          <p className="text-sm text-muted-foreground">
            Wiederkehrende Abläufe einmal festlegen — das System erledigt sie danach zuverlässig und
            nachvollziehbar.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/app/automationen/aufgaben">Aufgaben</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/app/automationen/verlauf">Verlauf</Link>
          </Button>
          <Button asChild>
            <Link to="/app/automationen/regel/$ruleId" params={{ ruleId: "neu" }}>
              Neue Automation
            </Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Aktive Automationen"
          value={data?.activeCount ?? 0}
          loading={inbox.isLoading}
        />
        <StatCard label="Läufe (24 h)" value={data?.runs24h ?? 0} loading={inbox.isLoading} />
        <StatCard
          label="Offene Aufgaben"
          value={data?.tasks.length ?? 0}
          loading={inbox.isLoading}
        />
        <StatCard
          label="Fehlgeschlagene Läufe"
          value={data?.failures.length ?? 0}
          loading={inbox.isLoading}
          tone={data && data.failures.length > 0 ? "warn" : undefined}
        />
      </section>

      {!!data?.pausedRules.length && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-base">Automatisch pausiert</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.pausedRules.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-muted-foreground">
                    {r.autoPauseReason ?? "Zu viele Fehler in kurzer Zeit."}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => resetMutation.mutate(r.id)}>
                  Wieder freigeben
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Ihre Automationen</h2>
        {rules.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : list.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Noch keine Automation. Starten Sie unten mit einer fertigen Vorlage.
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((rule) => (
              <li key={rule.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        to="/app/automationen/regel/$ruleId"
                        params={{ ruleId: rule.id }}
                        className="font-medium hover:underline"
                      >
                        {rule.name}
                      </Link>
                      <Badge className={STATUS_TONE[rule.status] ?? ""} variant="secondary">
                        {AUTOMATION_STATUS_LABELS[
                          rule.status as keyof typeof AUTOMATION_STATUS_LABELS
                        ] ?? rule.status}
                      </Badge>
                      {rule.autoPausedAt && <Badge variant="destructive">Notbremse</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {describeTrigger(rule.triggerType, rule.triggerConfig)} · {rule.actionCount}{" "}
                      Aktion
                      {rule.actionCount === 1 ? "" : "en"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {rule.runs24h} Läufe / 24 h · {rule.failures24h} Fehler
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {rule.status === "active" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => statusMutation.mutate({ ruleId: rule.id, status: "paused" })}
                      >
                        Pausieren
                      </Button>
                    ) : rule.status !== "archived" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!rule.activeVersion}
                        onClick={() => statusMutation.mutate({ ruleId: rule.id, status: "active" })}
                      >
                        Aktivieren
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" asChild>
                      <Link to="/app/automationen/regel/$ruleId" params={{ ruleId: rule.id }}>
                        Bearbeiten
                      </Link>
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Fertige Vorlagen</h2>
          <p className="text-sm text-muted-foreground">
            Ein Klick erstellt einen Entwurf, den Sie vor der Aktivierung noch anpassen können.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {AUTOMATION_TEMPLATES.map((t) => (
            <Card key={t.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{t.description}</p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={installMutation.isPending}
                  onClick={() => installMutation.mutate(t.key)}
                >
                  Vorlage verwenden
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {!!data?.failures.length && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Zuletzt fehlgeschlagen</h2>
          <ul className="divide-y rounded-lg border bg-card text-sm">
            {data.failures.slice(0, 8).map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="font-medium">{f.ruleName}</p>
                  <p className="text-muted-foreground">
                    {EXECUTION_STATUS_LABELS[f.status as keyof typeof EXECUTION_STATUS_LABELS] ??
                      f.status}
                    {f.error ? ` · ${f.error}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/app/automationen/verlauf" search={{ executionId: f.id }}>
                    Details
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  tone,
}: {
  label: string;
  value: number;
  loading: boolean;
  tone?: "warn" | undefined;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <p
          className={`mt-1 font-display text-2xl font-semibold ${
            tone === "warn" ? "text-destructive" : ""
          }`}
        >
          {value}
        </p>
      )}
    </div>
  );
}
