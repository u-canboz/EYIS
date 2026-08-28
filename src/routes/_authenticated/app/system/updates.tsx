import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  abandonUpdateRunFn,
  checkForUpdatesFn,
  getUpdateOverviewFn,
  pollUpdateRunFn,
  startUpdateFn,
} from "@/lib/commerce/updates/updates.functions";
import { UPDATE_STEP_LABELS, type UpdateStep } from "@/lib/commerce/updates/types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel, DataRow } from "@/components/shell/DetailLayout";
import { ListSkeleton } from "@/components/data/States";

export const Route = createFileRoute("/_authenticated/app/system/updates")({
  head: () => ({
    meta: [
      { title: "Update Center – EYIS" },
      {
        name: "description",
        content:
          "Signierte EYIS-Releases prüfen, Transportwege nachweisen und Updates kontrolliert einspielen.",
      },
      { property: "og:title", content: "Update Center – EYIS" },
      {
        property: "og:description",
        content: "Version, Release-Kanal, Fähigkeitsnachweise und Update-Verlauf einer Installation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UpdateCenterPage,
});

const CAP_VARIANT = {
  SUPPORTED: "default",
  SETUP_REQUIRED: "secondary",
  NOT_SUPPORTED: "destructive",
} as const;

function CapabilityRow({
  label,
  proof,
}: {
  label: string;
  proof: { status: keyof typeof CAP_VARIANT; provider: string; detail: string; remediation?: string };
}) {
  return (
    <div className="border-b py-3 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant={CAP_VARIANT[proof.status]}>{proof.status}</Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {proof.provider} — {proof.detail}
      </p>
      {proof.remediation && (
        <p className="mt-1 text-xs text-muted-foreground">Nächster Schritt: {proof.remediation}</p>
      )}
    </div>
  );
}

const STEP_ICON: Record<string, string> = {
  passed: "✓",
  failed: "✕",
  running: "…",
  pending: "·",
  skipped: "–",
  blocked: "!",
};

function UpdateCenterPage() {
  const { organizationId } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getUpdateOverviewFn);
  const checkUpdates = useServerFn(checkForUpdatesFn);
  const startUpdate = useServerFn(startUpdateFn);
  const pollRun = useServerFn(pollUpdateRunFn);
  const abandonRun = useServerFn(abandonUpdateRunFn);

  const { data, isLoading, error } = useQuery({
    queryKey: ["update-center", organizationId],
    queryFn: () => fetchOverview({ data: { organizationId } }),
    enabled: Boolean(organizationId),
  });

  const activeRunId = data?.activeRun?.id ?? null;

  useQuery({
    queryKey: ["update-run-poll", activeRunId],
    queryFn: async () => {
      const run = await pollRun({ data: { organizationId, runId: activeRunId as string } });
      await queryClient.invalidateQueries({ queryKey: ["update-center", organizationId] });
      return run;
    },
    enabled: Boolean(activeRunId && organizationId),
    refetchInterval: 8_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["update-center", organizationId] });

  const check = useMutation({
    mutationFn: () => checkUpdates({ data: { organizationId } }),
    onSuccess: (res) => {
      toast.success(
        res.available
          ? `EYIS ${res.available.version} verfügbar.`
          : "Keine neue Version im gewählten Kanal.",
      );
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const install = useMutation({
    mutationFn: (releaseId: string) => startUpdate({ data: { organizationId, releaseId } }),
    onSuccess: () => {
      toast.success("Update gestartet.");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const abandon = useMutation({
    mutationFn: (runId: string) =>
      abandonRun({ data: { organizationId, runId, reason: "Manuell im Update Center beendet." } }),
    onSuccess: () => {
      toast.success("Lauf beendet, Wartungsmodus aus.");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Update Center" />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <PageHeader title="Update Center" />
        <Panel title="Nicht verfügbar">
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Update-Status konnte nicht geladen werden."}
          </p>
        </Panel>
      </div>
    );
  }

  const caps = data.capabilities;
  const run = data.activeRun;
  const schemaChanging = (data.available?.migrations.length ?? 0) > 0;
  const blocked =
    !caps.fullyAutomatic || (schemaChanging && !caps.schemaChangesAllowed) || data.maintenanceState !== "off";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Update Center"
        description={`Installiert: EYIS ${data.installedVersion} · Kanal ${data.channel} · ${data.deploymentMode}`}
        actions={
          <>
            <Badge variant={data.maintenanceState === "off" ? "secondary" : "destructive"}>
              Wartung: {data.maintenanceState}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => check.mutate()}
              disabled={check.isPending || Boolean(run)}
            >
              Auf Updates prüfen
            </Button>
          </>
        }
      />

      <Panel title={data.available ? `EYIS ${data.available.version} verfügbar` : "Keine neue Version"}>
        {data.available ? (
          <div className="space-y-3">
            <DataRow label="Release">{data.available.releaseId}</DataRow>
            <DataRow label="Veröffentlicht">
              {new Date(data.available.publishedAt).toLocaleString("de-DE")}
            </DataRow>
            <DataRow label="Schemaänderungen">
              {schemaChanging ? `${data.available.migrations.length} Migration(en)` : "keine"}
            </DataRow>
            {data.available.notes && (
              <p className="text-sm text-muted-foreground">{data.available.notes}</p>
            )}
            <Button
              onClick={() => install.mutate(data.available!.releaseId)}
              disabled={blocked || install.isPending || Boolean(run)}
            >
              Jetzt aktualisieren
            </Button>
            {blocked && (
              <p className="text-xs text-muted-foreground">
                SETUP REQUIRED: Solange Code-Transport, Deployment oder — bei Schemaänderungen — der
                Migrationsadapter nicht nachgewiesen sind, wird kein Update gestartet.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Letzte Prüfung:{" "}
            {data.lastCheckAt ? new Date(data.lastCheckAt).toLocaleString("de-DE") : "noch nie"}
            {data.blockedByChain
              ? ` · ${data.blockedByChain} erfordert ein Zwischenupdate.`
              : ""}
          </p>
        )}
      </Panel>

      {run && (
        <Panel title={`Update läuft: ${run.fromVersion} → ${run.toVersion}`}>
          <ul className="space-y-2">
            {run.steps.map((step) => (
              <li key={step.step} className="flex items-start justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-4 text-center tabular-nums">{STEP_ICON[step.status] ?? "·"}</span>
                  {UPDATE_STEP_LABELS[step.step as UpdateStep] ?? step.step}
                </span>
                <span className="text-right text-xs text-muted-foreground">
                  {step.outputSummary ?? step.status}
                </span>
              </li>
            ))}
          </ul>
          {run.safeErrorMessage && (
            <p className="mt-3 text-sm text-destructive">{run.safeErrorMessage}</p>
          )}
          <div className="mt-3 flex items-center gap-2">
            {run.deploymentReference && (
              <span className="text-xs text-muted-foreground">
                Workflow-Lauf {run.deploymentReference}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => abandon.mutate(run.id)}>
              Lauf beenden
            </Button>
          </div>
        </Panel>
      )}

      <Panel title="Transportnachweise">
        <CapabilityRow label="GitHub-Zugang" proof={caps.auth} />
        <CapabilityRow label="Release-Registry (signiert)" proof={caps.registry} />
        <CapabilityRow label="Code-Update im Kunden-Repository" proof={caps.code} />
        <CapabilityRow label="Production Deployment" proof={caps.deployment} />
        <CapabilityRow label="Datenbank-Migrationen" proof={caps.migration} />
        <p className="pt-3 text-xs text-muted-foreground">
          Vollautomatisch: {caps.fullyAutomatic ? "ja" : "nein"} · Schemaändernde Updates:{" "}
          {caps.schemaChangesAllowed ? "erlaubt" : "gesperrt (SETUP REQUIRED)"}
        </p>
      </Panel>

      <Panel title="Verlauf">
        {data.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Update-Läufe.</p>
        ) : (
          <ul className="divide-y">
            {data.history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {h.fromVersion} → {h.toVersion}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {new Date(h.startedAt).toLocaleString("de-DE")}
                  </span>
                </span>
                <Badge variant={h.status === "completed" ? "default" : "secondary"}>{h.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Ownership-Grenze">
        <DataRow label="EYIS ersetzt">{data.ownership.eyis.join(", ")}</DataRow>
        <DataRow label="Nie überschrieben">{data.ownership.customer.join(", ")}</DataRow>
      </Panel>
    </div>
  );
}
