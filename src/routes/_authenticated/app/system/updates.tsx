import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Circle,
  Clock3,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  abandonUpdateRunFn,
  checkForUpdatesFn,
  getUpdateOverviewFn,
  getUpdatePreflightFn,
  pollUpdateRunFn,
  setUpdateChannelFn,
  startUpdateFn,
} from "@/lib/commerce/updates/updates.functions";
import {
  UPDATE_STEP_LABELS,
  type CapabilityProof,
  type UpdateChannel,
  type UpdateRunView,
  type UpdateStep,
} from "@/lib/commerce/updates/types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/eyis/shell/PageHeader";
import { Panel } from "@/eyis/shell/DetailLayout";
import { EmptyState, ErrorState, ListSkeleton, PermissionState } from "@/eyis/data/States";

export const Route = createFileRoute("/_authenticated/app/system/updates")({
  head: () => ({
    meta: [
      { title: "Update Center – EYIS" },
      {
        name: "description",
        content:
          "Signierte Releases prüfen und die eigene EYIS-Installation kontrolliert aktualisieren.",
      },
    ],
  }),
  component: UpdateCenterPage,
});

const STATUS: Record<string, string> = {
  completed: "Abgeschlossen",
  failed: "Fehlgeschlagen",
  manual_attention: "Prüfung erforderlich",
  deploying: "Update läuft",
  preflight: "Vorprüfung",
  ready: "Vorbereitet",
  backup_check: "Backup-Prüfung",
  maintenance: "Wartung aktiv",
  migrating: "Datenbank wird aktualisiert",
  verifying: "Systemprüfung",
  rolling_back: "Wiederherstellung läuft",
  rolled_back: "Wiederhergestellt",
  seeding: "Systemdaten",
  passed: "Bestanden",
  running: "Läuft",
  pending: "Ausstehend",
  skipped: "Nicht erforderlich",
  blocked: "Blockiert",
};
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })
    : "Noch nicht geprüft";

function CapabilityRow({ label, proof }: { label: string; proof: CapabilityProof }) {
  const ready = proof.status === "SUPPORTED";
  return (
    <div className="border-b py-3 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          {ready ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
          ) : (
            <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          {label}
        </span>
        <Badge variant={ready ? "outline" : "secondary"}>
          {ready ? "Bereit" : "Einrichtung fehlt"}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{proof.detail}</p>
      {proof.remediation && (
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer py-1 font-medium text-foreground">
            Einrichtungshinweise
          </summary>
          <p className="mt-1 break-words leading-relaxed">{proof.remediation}</p>
        </details>
      )}
    </div>
  );
}

function RunSteps({ run }: { run: UpdateRunView }) {
  return (
    <ol className="space-y-3" aria-label="Update-Fortschritt">
      {run.steps.map((step) => {
        const Icon =
          step.status === "passed"
            ? CheckCircle2
            : step.status === "running"
              ? Loader2
              : ["failed", "blocked"].includes(step.status)
                ? TriangleAlert
                : Circle;
        return (
          <li key={step.step} className="flex min-w-0 gap-3 text-sm">
            <Icon
              className={`mt-0.5 size-4 shrink-0 ${step.status === "running" ? "animate-spin" : step.status === "passed" ? "text-emerald-600" : "text-muted-foreground"}`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">
                  {UPDATE_STEP_LABELS[step.step as UpdateStep] ?? step.step}
                </span>
                <span className="text-xs text-muted-foreground">
                  {STATUS[step.status] ?? step.status}
                </span>
              </div>
              {step.outputSummary && (
                <p className="mt-1 break-words text-xs text-muted-foreground">
                  {step.outputSummary}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function UpdateCenterPage() {
  const { organizationId, can, isLoading: workspaceLoading } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getUpdateOverviewFn);
  const checkUpdates = useServerFn(checkForUpdatesFn);
  const startUpdate = useServerFn(startUpdateFn);
  const pollRun = useServerFn(pollUpdateRunFn);
  const cancelRun = useServerFn(abandonUpdateRunFn);
  const setChannel = useServerFn(setUpdateChannelFn);
  const fetchPreflight = useServerFn(getUpdatePreflightFn);
  const overview = useQuery({
    queryKey: ["update-center", organizationId],
    queryFn: () => fetchOverview({ data: { organizationId } }),
    enabled: Boolean(organizationId) && can("system_updates.read"),
  });
  const { data } = overview;
  const activeRunId = data?.activeRun?.id ?? null;
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["update-center", organizationId] });
  const poll = useQuery({
    queryKey: ["update-run-poll", organizationId, activeRunId],
    queryFn: async () => {
      const run = await pollRun({ data: { organizationId, runId: activeRunId! } });
      await invalidate();
      return run;
    },
    enabled: Boolean(activeRunId && organizationId),
    refetchInterval: 8_000,
  });
  const preflight = useMutation({
    mutationFn: () => fetchPreflight({ data: { organizationId } }),
    onError: (e: Error) => toast.error(e.message),
  });
  const check = useMutation({
    mutationFn: () => checkUpdates({ data: { organizationId } }),
    onSuccess: (res) => {
      preflight.reset();
      if (res.available) toast.success(`EYIS ${res.available.version} verfügbar.`);
      else if (res.blockedByChain) toast.warning("Ein Zwischenupdate ist erforderlich.");
      else if (res.rejected.length)
        toast.warning("Prüfung beendet. Einige Releases konnten nicht verifiziert werden.");
      else toast.success("Keine neuere Version in diesem Kanal verfügbar.");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const channel = useMutation({
    mutationFn: (value: UpdateChannel) =>
      setChannel({ data: { organizationId, channel: value, policy: "manual" } }),
    onSuccess: () => {
      preflight.reset();
      void invalidate();
      toast.success("Kanal gespeichert. Bitte erneut auf Updates prüfen.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const install = useMutation({
    mutationFn: (releaseId: string) => startUpdate({ data: { organizationId, releaseId } }),
    onSuccess: (run) => {
      if (run.status === "failed" || run.status === "manual_attention")
        toast.error(run.safeErrorMessage ?? "Update konnte nicht gestartet werden.");
      else toast.success("Update gestartet. Der Fortschritt wird automatisch aktualisiert.");
      void invalidate();
      preflight.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancel = useMutation({
    mutationFn: (runId: string) =>
      cancelRun({ data: { organizationId, runId, reason: "Im Update Center angefordert." } }),
    onSuccess: () => {
      toast.info("Abbruch angefordert. EYIS wartet auf die Bestätigung des Workflows.");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (workspaceLoading || overview.isLoading)
    return (
      <div>
        <PageHeader title="Update Center" />
        <ListSkeleton rows={4} />
      </div>
    );
  if (!can("system_updates.read")) return <PermissionState what="das Update Center" />;
  if (overview.error || !data)
    return (
      <div className="space-y-4">
        <PageHeader title="Update Center" />
        <ErrorState
          title="Update-Status nicht verfügbar"
          description={
            overview.error instanceof Error ? overview.error.message : "Bitte erneut versuchen."
          }
          action={
            <Button variant="outline" onClick={() => void overview.refetch()}>
              Erneut versuchen
            </Button>
          }
        />
      </div>
    );

  const caps = data.capabilities;
  const release = data.available;
  const run = data.activeRun;
  const schemaChanging = (release?.migrations.length ?? 0) > 0;
  const blocked =
    !can("system_updates.install") ||
    !caps.fullyAutomatic ||
    (schemaChanging && !caps.schemaChangesAllowed) ||
    data.maintenanceState !== "off" ||
    Boolean(release?.requiresManualStep) ||
    !preflight.data?.ok;
  const proofs = [
    { label: "GitHub-Zugang", proof: caps.auth },
    { label: "Signierte Releases", proof: caps.registry },
    { label: "Kunden-Repository", proof: caps.code },
    { label: "Veröffentlichung", proof: caps.deployment },
    { label: "Datenbank", proof: caps.migration },
  ];
  const readyCount = proofs.filter((p) => p.proof.status === "SUPPORTED").length;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Update Center"
        description="Neue Versionen prüfen und deine Installation kontrolliert aktualisieren."
        actions={
          <Button
            variant="outline"
            onClick={() => check.mutate()}
            disabled={
              check.isPending || channel.isPending || Boolean(run) || !can("system_updates.manage")
            }
          >
            <RefreshCw
              className={`mr-2 size-4 ${check.isPending ? "animate-spin" : ""}`}
              aria-hidden
            />
            {check.isPending ? "Releases werden geprüft …" : "Auf Updates prüfen"}
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Panel>
          <p className="text-xs text-muted-foreground">Installierte Version</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-tight">
            {data.installedVersion}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.environment === "development"
              ? "Entwicklung"
              : data.environment === "staging"
                ? "Staging"
                : data.environment === "production"
                  ? "Produktion"
                  : "Umgebung unbekannt"}{" "}
            · Dedicated
          </p>
        </Panel>
        <Panel>
          <label htmlFor="update-channel" className="text-xs text-muted-foreground">
            Release-Kanal
          </label>
          <select
            id="update-channel"
            value={data.channel}
            onChange={(e) => channel.mutate(e.target.value as UpdateChannel)}
            disabled={channel.isPending || Boolean(run) || !can("system_updates.channel")}
            className="mt-2 block h-11 w-full rounded-md border bg-background px-3 text-sm font-medium"
          >
            <option value="stable">Stable · stabile Releases</option>
            <option value="beta">Beta · Release Candidates</option>
            <option value="development">Development · alle Releases</option>
          </select>
          <p className="mt-2 text-xs text-muted-foreground">Updates werden manuell gestartet.</p>
        </Panel>
        <Panel>
          <p className="text-xs text-muted-foreground">Letzte Release-Prüfung</p>
          <p className="mt-2 text-sm font-medium">{date(data.lastCheckAt)}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Letztes erfolgreiches Update:{" "}
            {data.lastSuccessfulUpdateAt ? date(data.lastSuccessfulUpdateAt) : "noch keines"}
          </p>
        </Panel>
      </div>
      {data.maintenanceState !== "off" && (
        <ErrorState
          title={
            data.maintenanceState === "updating"
              ? "Shop wird aktualisiert"
              : "Installation muss geprüft werden"
          }
          description="Die Store API pausiert während der Wartung. Prüfe den Update-Lauf und den tatsächlichen Systemzustand vor der Freigabe."
        />
      )}
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,1fr)]">
        <div className="min-w-0 space-y-5">
          <Panel
            title={
              release
                ? `EYIS ${release.version} ist verfügbar`
                : data.lastCheckAt
                  ? "Release-Prüfung"
                  : "Bereit für die erste Prüfung"
            }
          >
            {release ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    <ShieldCheck className="mr-1 size-3" aria-hidden />
                    Signatur geprüft
                  </Badge>
                  <Badge variant="secondary">
                    {schemaChanging
                      ? `${release.migrations.length} Migrationen im Paket`
                      : "Ohne Schemaänderung"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Veröffentlicht am {date(release.publishedAt)}. Update von {data.installedVersion}{" "}
                  auf {release.version}.
                </p>
                {release.notes && (
                  <p className="whitespace-pre-line text-sm leading-relaxed">{release.notes}</p>
                )}
                {release.requiresManualStep && (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                    Dieses Release benötigt ein betreutes Update. Die automatische Installation
                    bleibt gesperrt.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => preflight.mutate()}
                    disabled={preflight.isPending || Boolean(run)}
                  >
                    {preflight.isPending && (
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    )}
                    Voraussetzungen prüfen
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={blocked || install.isPending || Boolean(run)}>
                        <Download className="mr-2 size-4" aria-hidden />
                        Jetzt aktualisieren
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          EYIS auf {release.version} aktualisieren?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Während des Updates pausiert die Store API. EYIS prüft das Backup,
                          übernimmt die signierten Dateien und kontrolliert Datenbank und
                          Veröffentlichung. Deine Shop-Inhalte und dein Design bleiben erhalten.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Zurück</AlertDialogCancel>
                        <AlertDialogAction onClick={() => install.mutate(release.releaseId)}>
                          Update starten
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                {preflight.data && (
                  <div className="space-y-2 border-t pt-3" aria-live="polite">
                    {preflight.data.checks.map((c) => (
                      <div key={c.check} className="flex items-start gap-2 text-sm">
                        {c.status === "PASS" ? (
                          <CheckCircle2
                            className="mt-0.5 size-4 shrink-0 text-emerald-600"
                            aria-hidden
                          />
                        ) : (
                          <TriangleAlert
                            className="mt-0.5 size-4 shrink-0 text-amber-600"
                            aria-hidden
                          />
                        )}
                        <div>
                          <p className="font-medium">
                            {c.check} · {c.status === "PASS" ? "bereit" : "offen"}
                          </p>
                          <p className="text-xs text-muted-foreground">{c.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                icon={ShieldCheck}
                title={
                  data.blockedByChain
                    ? "Zwischenupdate erforderlich"
                    : data.lastCheckAt
                      ? "Kein installierbares Update in diesem Kanal"
                      : "Releases noch nicht geprüft"
                }
                description={
                  data.blockedByChain
                    ? `Version ${data.blockedByChain} benötigt einen neueren Ausgangsstand.`
                    : data.lastCheckAt
                      ? "Für Vorabversionen kannst du den Beta-Kanal wählen. Beachte gegebenenfalls abgelehnte Releases unten."
                      : "Starte die Prüfung. EYIS berücksichtigt den gewählten Kanal und verifiziert die Release-Signaturen."
                }
              />
            )}
          </Panel>
          {run && (
            <Panel
              title={`${STATUS[run.status] ?? run.status}: ${run.fromVersion} → ${run.toVersion}`}
            >
              <RunSteps run={run} />
              {poll.error && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  Fortschritt konnte nicht aktualisiert werden. EYIS versucht es erneut; der Lauf
                  bleibt aktiv.
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  Gestartet {date(run.startedAt)}
                </span>
                {can("system_updates.install") && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate(run.id)}
                  >
                    Workflow abbrechen
                  </Button>
                )}
              </div>
            </Panel>
          )}
          <Panel title="Update-Verlauf">
            {data.history.length ? (
              <div className="divide-y">
                {data.history.map((h) => (
                  <details key={h.id} className="py-3 first:pt-0">
                    <summary className="cursor-pointer text-sm">
                      <span className="font-medium">
                        {h.fromVersion} → {h.toVersion}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {STATUS[h.status] ?? h.status}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {date(h.startedAt)}
                      </span>
                    </summary>
                    <div className="mt-4 space-y-3">
                      {h.safeErrorMessage && (
                        <p role="alert" className="text-sm text-destructive">
                          {h.safeErrorMessage}
                        </p>
                      )}
                      <RunSteps run={h} />
                      <p className="text-xs text-muted-foreground">
                        {h.backupReference
                          ? `Backup: ${h.backupReference}`
                          : "Kein Backup-Nachweis gespeichert."}
                      </p>
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Clock3}
                title="Noch keine Updates durchgeführt"
                description="Hier findest du später jeden Lauf mit Fortschritt, Ergebnis und Fehlerdetails."
              />
            )}
          </Panel>
        </div>
        <Panel
          title="Einrichtung für Updates"
          description={`${readyCount} von ${proofs.length} Verbindungen vorbereitet`}
        >
          <div
            className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Update-Einrichtung"
            aria-valuemin={0}
            aria-valuemax={5}
            aria-valuenow={readyCount}
          >
            <div className="h-full bg-primary" style={{ width: `${readyCount * 20}%` }} />
          </div>
          {proofs.map((p) => (
            <CapabilityRow key={p.label} {...p} />
          ))}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Vor jedem Start werden zusätzlich Versionskette, Backup und laufende Updates geprüft.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/app/system/updates-einrichtung">
              {readyCount === proofs.length ? "Einrichtung prüfen" : "Einrichtung starten"}
            </Link>
          </Button>
        </Panel>
      </div>
      {data.rejectedReleases.length > 0 && (
        <Panel title="Nicht verifizierbare Releases">
          <p className="mb-3 text-sm text-muted-foreground">
            Diese Releases wurden ausgeschlossen. Ein fehlender Nachweis wird nicht als
            erfolgreiches Update behandelt.
          </p>
          <ul className="space-y-2">
            {data.rejectedReleases.map((r, i) => (
              <li key={`${r.tag}-${i}`} className="text-sm">
                <span className="font-medium">{r.tag}</span>
                <span className="ml-2 text-muted-foreground">{r.reason}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <details className="rounded-xl border p-4 text-sm">
        <summary className="cursor-pointer font-medium">Welche Dateien verändert EYIS?</summary>
        <p className="mt-3 text-muted-foreground">
          Engine, Backoffice und Installationspaket werden aktualisiert. Kundeneigene Inhalte,
          Storefronts, Umgebungsdateien und Projektkonfiguration werden geschützt.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="font-medium">EYIS-Dateien</p>
            <p className="mt-1 break-words text-xs text-muted-foreground">
              {data.ownership.eyis.join(", ")}
            </p>
          </div>
          <div>
            <p className="font-medium">Geschützte Kundendateien</p>
            <p className="mt-1 break-words text-xs text-muted-foreground">
              {data.ownership.customer.join(", ")}
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
