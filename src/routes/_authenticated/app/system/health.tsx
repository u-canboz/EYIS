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
import { Separator } from "@/components/ui/separator";

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
    return (
      <div>
        <h1 className="font-display text-2xl font-semibold">System Health</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Nur Inhaber, Administratoren und Operations dürfen Integritätsprüfungen ausführen.
        </p>
      </div>
    );
  }

  const areas = report ? Object.keys(AREA_LABELS) : [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">System Health</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Read-only Integritätsprüfung. Es werden keine Daten verändert oder repariert.
          </p>
        </div>
        <Button onClick={() => run.mutate()} disabled={run.isPending || !organizationId}>
          {run.isPending ? "Prüfung läuft…" : "Checks ausführen"}
        </Button>
      </div>

      {report && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
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
                {SEVERITY_LABELS[s]}: <strong>{report.bySeverity[s]}</strong>
              </span>
            ))}
            <span className="text-xs text-muted-foreground">
              Lauf: {new Date(report.runAt).toLocaleString("de-DE")}
            </span>
          </div>

          <Separator />

          {areas.map((area) => {
            const findings = report.findings.filter((f) => f.area === area);
            return (
              <section key={area}>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold">{AREA_LABELS[area]}</h2>
                  <Badge variant={findings.length ? "default" : "secondary"}>
                    {findings.length ? `${findings.length} Befund(e)` : "OK"}
                  </Badge>
                </div>
                {findings.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {findings.map((f, i) => (
                      <li key={`${f.code}-${i}`} className="rounded-md border p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={severityVariant(f.severity)}>
                            {SEVERITY_LABELS[f.severity]}
                          </Badge>
                          <code className="text-xs text-muted-foreground">{f.code}</code>
                        </div>
                        <p className="mt-2">{f.message}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {f.entityType}
                          {f.entityId ? ` · ${f.entityId}` : ""}
                          {f.shopId ? ` · Shop ${f.shopId}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
