import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  createQaFixtureFn,
  destroyQaFixtureFn,
  getDemoStatusFn,
  listQaFixturesFn,
  resetDemoEnvironmentFn,
  runDemoSeedStepFn,
} from "@/lib/commerce/demo/demo.functions";
import {
  QA_SCENARIOS,
  QA_SCENARIO_LABELS,
  SEED_STEPS,
  SEED_STEP_LABELS,
  type QaScenario,
  type SeedStep,
} from "@/lib/commerce/demo/demo.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel } from "@/components/shell/DetailLayout";
import { EmptyState, PermissionState } from "@/components/data/States";

export const Route = createFileRoute("/_authenticated/app/system/demo-daten")({
  head: () => ({
    meta: [
      { title: "Demo & QA Daten – Commerce OS" },
      {
        name: "description",
        content:
          "Dauerhafte Demo-Organisation seeden und zurücksetzen sowie zerstörbare QA-Fixtures für 22 Testszenarien erzeugen.",
      },
      { property: "og:title", content: "Demo & QA Daten – Commerce OS" },
      { property: "og:description", content: "Demo- und QA-Datensystem verwalten." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DemoDaten,
});

function DemoDaten() {
  const { organization, isLoading } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const [scenario, setScenario] = useState<QaScenario>("catalog_full");

  const fetchStatus = useServerFn(getDemoStatusFn);
  const runStep = useServerFn(runDemoSeedStepFn);
  const resetDemo = useServerFn(resetDemoEnvironmentFn);
  const fetchFixtures = useServerFn(listQaFixturesFn);
  const createFixture = useServerFn(createQaFixtureFn);
  const destroyFixture = useServerFn(destroyQaFixtureFn);

  const allowed = organization && ["owner", "administrator"].includes(organization.role);

  const statusQuery = useQuery({
    queryKey: ["demo-status"],
    queryFn: () => fetchStatus(),
    enabled: !!allowed,
  });

  const fixturesQuery = useQuery({
    queryKey: ["qa-fixtures"],
    queryFn: () => fetchFixtures(),
    enabled: !!allowed,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["demo-status"] });
    queryClient.invalidateQueries({ queryKey: ["qa-fixtures"] });
    queryClient.invalidateQueries({ queryKey: ["workspace"] });
  };

  const seedMutation = useMutation({
    mutationFn: async () => {
      // Schritte sequentiell; Orders-Schritt läuft in Batches bis fertig.
      const details: string[] = [];
      for (const step of SEED_STEPS) {
        for (;;) {
          const result = await runStep({ data: { step } });
          details.push(`${SEED_STEP_LABELS[step]}: ${result.detail}`);
          if (result.done) break;
        }
      }
      return details;
    },
    onSuccess: (details) => {
      toast.success("Demo-Umgebung vollständig geseedet.");
      console.info(details.join("\n"));
      invalidate();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      invalidate();
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetDemo(),
    onSuccess: (r) => {
      toast.success(r.detail);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: (s: QaScenario) => createFixture({ data: { scenario: s } }),
    onSuccess: (f) => {
      toast.success(`Fixture „${f.organizationName}" erstellt.`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const destroyMutation = useMutation({
    mutationFn: (fixtureId: string) => destroyFixture({ data: { fixtureId } }),
    onSuccess: (r) => {
      if (r.residual.length) toast.warning(r.detail);
      else toast.success(r.detail);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isLoading && !allowed) {
    return (
      <div>
        <PageHeader title="Demo & QA Daten" />
        <PermissionState what="Demo- und QA-Daten" />
      </div>
    );
  }

  const status = statusQuery.data;
  const busy =
    seedMutation.isPending || resetMutation.isPending || createMutation.isPending || destroyMutation.isPending;

  return (
    <div>
      <PageHeader
        title="Demo & QA Daten"
        description="Zwei getrennte Welten: eine dauerhafte, realistische Demo-Organisation und beliebig oft erzeug- und zerstörbare QA-Fixtures. Der Seed ist idempotent und in Production blockiert."
      />

      {/* ---------------- Demo-Organisation ---------------- */}
      <Panel
        title="Demo-Organisation"
        description={
          <>
            Dauerhafte Welt „Commerce OS Demo" mit Katalog, Medien, Kunden, Promotions und 40
            Bestellungen in realistischen Zuständen.
          </>
        }
        className="mt-6"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button className="h-11 w-full sm:w-auto" onClick={() => seedMutation.mutate()} disabled={busy}>
            {seedMutation.isPending ? "Seed läuft …" : status?.environment ? "Seed fortsetzen / ergänzen" : "Demo seeden"}
          </Button>
          {status?.environment && (
            <Button
              className="h-11 w-full sm:w-auto"
              variant="destructive"
              onClick={() => {
                if (window.confirm("Demo-Organisation wirklich komplett löschen und neu aufbauen?"))
                  resetMutation.mutate();
              }}
              disabled={busy}
            >
              {resetMutation.isPending ? "Reset läuft …" : "Zurücksetzen"}
            </Button>
          )}
        </div>

        {statusQuery.isLoading ? (
          <Skeleton className="mt-4 h-24 w-full" />
        ) : status?.environment ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="default">{status.environment.status}</Badge>
              <span className="min-w-0 break-words text-muted-foreground">
                {status.environment.organizationName} · Seed v{status.environment.seedVersion} ·
                geseedet {new Date(status.environment.seededAt).toLocaleString("de-DE")}
              </span>
            </div>
            {status.counts && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    ["Produkte", status.counts.products],
                    ["Bestellungen", status.counts.orders],
                    ["Kunden", status.counts.customers],
                    ["Medien", status.counts.media],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-md border border-border p-3">
                    <p className="text-2xl font-semibold tabular-nums">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {SEED_STEPS.map((step: SeedStep) => (
                <Badge key={step} variant={status.steps[step] ? "default" : "secondary"}>
                  {status.steps[step] ? "✓" : "○"} {SEED_STEP_LABELS[step].split(",")[0]}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Noch keine Demo-Organisation vorhanden. Der erste Seed dauert einige Minuten, weil
            Bestellungen über den echten Checkout-Fluss erzeugt werden.
          </p>
        )}
      </Panel>

      {/* ---------------- QA-Fixtures ---------------- */}
      <Panel
        title="QA-Fixtures"
        description="Isolierte, zerstörbare Testorganisationen pro Szenario. Jede Fixture dokumentiert ihren Inhalt im Manifest und wird beim Zerstören vollständig entfernt."
        className="mt-6"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={scenario} onValueChange={(v) => setScenario(v as QaScenario)}>
            <SelectTrigger className="h-11 w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QA_SCENARIOS.map((s) => (
                <SelectItem key={s} value={s}>
                  {QA_SCENARIO_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="h-11 w-full sm:w-auto" onClick={() => createMutation.mutate(scenario)} disabled={busy}>
            {createMutation.isPending ? "Erzeuge …" : "Fixture erzeugen"}
          </Button>
        </div>

        {fixturesQuery.isLoading ? (
          <Skeleton className="mt-4 h-24 w-full" />
        ) : (fixturesQuery.data ?? []).length === 0 ? (
          <EmptyState className="mt-4" title="Keine QA-Fixtures vorhanden." />
        ) : (
          <div className="mt-4 space-y-3">
            {(fixturesQuery.data ?? []).map((f) => (
              <div
                key={f.id}
                className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{QA_SCENARIO_LABELS[f.scenario]}</span>
                    <Badge variant={f.status === "active" ? "default" : "secondary"}>{f.status}</Badge>
                  </div>
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {f.organizationName} · Run {f.runRef} · erstellt{" "}
                    {new Date(f.createdAt).toLocaleString("de-DE")}
                    {f.residualNotes ? ` · Reste: ${f.residualNotes}` : ""}
                  </p>
                </div>
                {f.status === "active" && (
                  <Button
                    className="h-11 w-full shrink-0 sm:w-auto"
                    variant="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Fixture „${f.organizationName}" vollständig zerstören?`))
                        destroyMutation.mutate(f.id);
                    }}
                  >
                    Zerstören
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
