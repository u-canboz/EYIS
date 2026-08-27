import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { runHealthChecksFn } from "@/lib/commerce/health/health.functions";
import {
  AREA_LABELS,
  SEVERITY_LABELS,
  type HealthReport,
  type HealthSeverity,
} from "@/lib/commerce/health/health.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel } from "@/components/shell/DetailLayout";
import { PermissionState } from "@/components/data/States";

export const Route = createFileRoute("/_authenticated/app/system/health")({
  head: () => ({
    meta: [
      { title: "System Health – Commerce OS" },
      {
        name: "description",
        content:
          "Read-only Integritätsprüfung über Payments, Orders, Inventory, Tax, Dokumente, Shipping, Returns und Communications.",
      },
      { property: "og:title", content: "System Health – Commerce OS" },
      { property: "og:description", content: "Commerce-Datenintegrität prüfen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SystemHealth,
});

const SEVERITY_ORDER: HealthSeverity[] = ["critical", "high", "medium", "low"];

function severityVariant(severity: HealthSeverity) {
  if (severity === "critical") return "destructive" as const;
  if (severity === "high") return "default" as const;
  return "secondary" as const;
}

function SystemHealth() {
  const { organizationId, organization, isLoading } = useActiveWorkspace();
  const [report, setReport] = useState<HealthReport | null>(null);
  const runChecks = useServerFn(runHealthChecksFn);

  const allowed =
    organization && ["owner", "administrator", "operations"].includes(organization.role);

  const run = useMutation({
    mutationFn: () => runChecks({ data: { organizationId } }),
    onSuccess: (r) => {
      setReport(r);
      if (r.status === "ok") toast.success("Keine Integritätsprobleme gefunden.");
      else toast.warning(`${r.totalFindings} Befund(e) gefunden.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isLoading && !allowed) {
    return <PermissionState what="Integritätsprüfungen" />;
  }

  const areas = report ? Object.keys(AREA_LABELS) : [];

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="System Health"
        description="Read-only Integritätsprüfung. Es werden keine Daten verändert oder repariert."
        actions={
          <Button className="h-11" onClick={() => run.mutate()} disabled={run.isPending || !organizationId}>
            {run.isPending ? "Prüfung läuft…" : "Checks ausführen"}
          </Button>
        }
      />

      {report && (
        <div className="min-w-0 space-y-5">
          <Panel title="Ergebnis">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <Badge
                variant={
                  report.status === "ok"
                    ? "secondary"
                    : report.status === "critical"
                      ? "destructive"
                      : "default"
                }
              >
                {report.status === "ok"
                  ? "Status: OK"
                  : report.status === "critical"
                    ? "Status: Kritisch"
                    : "Status: Warnung"}
              </Badge>
              {SEVERITY_ORDER.map((s) => (
                <span key={s} className="text-sm text-muted-foreground">
                  {SEVERITY_LABELS[s]}: <strong className="tabular-nums">{report.bySeverity[s]}</strong>
                </span>
              ))}
              <span className="text-xs tabular-nums text-muted-foreground">
                Lauf: {new Date(report.runAt).toLocaleString("de-DE")}
              </span>
            </div>
          </Panel>

          {areas.map((area) => {
            const findings = report.findings.filter((f) => f.area === area);
            return (
              <Panel
                key={area}
                title={AREA_LABELS[area]}
                actions={
                  <Badge variant={findings.length ? "default" : "secondary"}>
                    {findings.length ? `${findings.length} Befund(e)` : "OK"}
                  </Badge>
                }
              >
                {findings.length > 0 ? (
                  <ul className="min-w-0 space-y-2">
                    {findings.map((f, i) => (
                      <li key={`${f.code}-${i}`} className="min-w-0 rounded-md border border-border p-3 text-sm">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <Badge variant={severityVariant(f.severity)}>
                            {SEVERITY_LABELS[f.severity]}
                          </Badge>
                          <code className="text-xs text-muted-foreground">{f.code}</code>
                        </div>
                        <p className="mt-2 min-w-0 break-words">{f.message}</p>
                        <p className="mt-1 min-w-0 break-words text-xs text-muted-foreground">
                          {f.entityType}
                          {f.entityId ? ` · ${f.entityId}` : ""}
                          {f.shopId ? ` · Shop ${f.shopId}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Keine Befunde.</p>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
