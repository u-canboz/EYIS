import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel, DataRow } from "@/components/shell/DetailLayout";
import {
  READINESS,
  READINESS_SUMMARY,
  RELEASE_SCHEMA_MIGRATION,
  RELEASE_SDK_VERSION,
  RELEASE_STORE_API_VERSION,
  RELEASE_VERSION,
  type ReadinessStatus,
} from "@/lib/commerce/release/readiness";

export const Route = createFileRoute("/_authenticated/app/system/release-readiness")({
  head: () => ({
    meta: [
      { title: "Release Readiness – EYIS" },
      {
        name: "description",
        content:
          "Nachweisbasierte Freigabematrix für den Go-live: Build, Sicherheit, Provider, Staging, Recht und Betrieb.",
      },
      { property: "og:title", content: "Release Readiness – EYIS" },
      {
        property: "og:description",
        content: "Freigabestatus je Bereich mit Nachweis, Datum und Verantwortlichkeit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReleaseReadinessPage,
});

const STATUS_VARIANT: Record<ReadinessStatus, "default" | "secondary" | "destructive" | "outline"> =
  {
    PASS: "default",
    FAIL: "destructive",
    OFFEN: "secondary",
    BLOCKED: "destructive",
    "NOT REQUIRED": "outline",
  };

function ReadyBadge({ label, ready }: { label: string; ready: boolean }) {
  return (
    <Badge variant={ready ? "default" : "secondary"}>
      {label}: {ready ? "READY" : "NICHT READY"}
    </Badge>
  );
}

function ReleaseReadinessPage() {
  const counts = READINESS.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Release Readiness"
        description="Statuswerte stammen aus den QA-Berichten im Repository. Kein Status ohne Nachweis."
      />

      <Panel title="Release-Stand">
        <DataRow label="Version" value={RELEASE_VERSION} />
        <DataRow label="Letzte Migration" value={RELEASE_SCHEMA_MIGRATION} />
        <DataRow label="Store API" value={RELEASE_STORE_API_VERSION} />
        <DataRow label="SDK" value={RELEASE_SDK_VERSION} />
      </Panel>

      <div className="flex flex-wrap gap-2">
        <ReadyBadge label="Software" ready={READINESS_SUMMARY.softwareReady} />
        <ReadyBadge label="Staging" ready={READINESS_SUMMARY.stagingReady} />
        <ReadyBadge label="Provider" ready={READINESS_SUMMARY.providerReady} />
        <ReadyBadge label="Legal" ready={READINESS_SUMMARY.legalReady} />
        <ReadyBadge label="Production" ready={READINESS_SUMMARY.productionReady} />
      </div>

      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        {Object.entries(counts).map(([status, count]) => (
          <span key={status}>
            {status}: {count}
          </span>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {READINESS.map((item) => (
          <div key={item.area} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-medium">{item.area}</h2>
              <Badge variant={STATUS_VARIANT[item.status]}>{item.status}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground break-words">{item.evidence}</p>
            <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div className="flex gap-2">
                <dt className="shrink-0">Geprüft:</dt>
                <dd>{item.checkedAt}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0">Referenz:</dt>
                <dd className="break-all">{item.reference}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0">Offene Aktion:</dt>
                <dd className="break-words">{item.action || "keine"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0">Verantwortlich:</dt>
                <dd>{item.owner}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <Panel title="Go-live-Freigabe">
        <p className="text-sm text-muted-foreground">
          Production wird niemals automatisch aktiviert. Die Freigabe erfolgt durch den Owner nach
          dem Ablauf in docs/production/GO_LIVE_RUNBOOK.md und wird dort mit Version, Commit,
          Schema-Stand und bestätigter Checkliste festgehalten.
        </p>
      </Panel>
    </div>
  );
}
