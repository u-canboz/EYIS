/**
 * Release-Readiness-Matrix (Gate C, Punkt 16).
 *
 * Diese Datei ist die einzige Quelle für das Dashboard unter
 * `/app/system/release-readiness`. Jeder Eintrag trägt einen konkreten
 * Nachweis (Berichtspfad oder Harness-Lauf), ein Datum und eine
 * verantwortliche Rolle. Ein Status ohne Nachweis ist nicht zulässig.
 *
 * Pflege: ausschließlich zusammen mit dem zugehörigen QA-Bericht.
 */

export type ReadinessStatus = "PASS" | "FAIL" | "OFFEN" | "BLOCKED" | "NOT REQUIRED";

export type ReadinessItem = {
  area: string;
  status: ReadinessStatus;
  /** Konkreter Nachweis: Berichtspfad, Harness-Lauf oder Migrationsdatei. */
  evidence: string;
  /** Datum der letzten Prüfung (ISO). */
  checkedAt: string;
  /** Offene Aktion, leer wenn keine. */
  action: string;
  /** Verantwortliche Rolle. */
  owner: "Agent" | "Betreiber" | "Owner" | "Fachlich/Rechtlich";
  reference: string;
};

export const RELEASE_VERSION = "1.0.0-rc.2";
export const RELEASE_SCHEMA_MIGRATION = "20260827143513_c0ae8993-af5a-43ac-b8ff-f64ccf818793.sql";
export const RELEASE_STORE_API_VERSION = "v1";
export const RELEASE_SDK_VERSION = "1.0.0 (in-repo, src/lib/store-sdk)";

export const READINESS: ReadinessItem[] = [
  {
    area: "Build",
    status: "PASS",
    evidence: "bun run build (Client + SSR + Nitro) grün",
    checkedAt: "2026-08-27",
    action: "",
    owner: "Agent",
    reference: "qa/PHASE19-GATE-C-FINAL-REPORT.md",
  },
  {
    area: "Typecheck",
    status: "PASS",
    evidence: "bun run typecheck ohne Fehler",
    checkedAt: "2026-08-27",
    action: "",
    owner: "Agent",
    reference: "qa/PHASE19-GATE-C-FINAL-REPORT.md",
  },
  {
    area: "Tests",
    status: "PASS",
    evidence: "vitest, inkl. neuer Production-Guard-Negativtests",
    checkedAt: "2026-08-27",
    action: "",
    owner: "Agent",
    reference: "src/lib/commerce/__tests__/environment.test.ts",
  },
  {
    area: "Security",
    status: "PASS",
    evidence: "qa:security 32/32",
    checkedAt: "2026-08-27",
    action: "",
    owner: "Agent",
    reference: "qa/PHASE14-SECURITY-REPORT.md",
  },
  {
    area: "RLS",
    status: "PASS",
    evidence: "qa:rls 52/52",
    checkedAt: "2026-08-27",
    action: "",
    owner: "Agent",
    reference: "qa/PHASE14-RLS-REPORT.md",
  },
  {
    area: "Data Integrity",
    status: "PASS",
    evidence: "Datenintegritätsprüfungen Gate A",
    checkedAt: "2026-08-26",
    action: "",
    owner: "Agent",
    reference: "qa/PHASE14-DATA-INTEGRITY-REPORT.md",
  },
  {
    area: "Backup/Restore",
    status: "OFFEN",
    evidence: "Restore-Drill nur gegen Dev durchgeführt",
    checkedAt: "2026-08-26",
    action: "Restore-Drill gegen getrenntes Staging wiederholen",
    owner: "Betreiber",
    reference: "qa/PHASE14-RESTORE-REPORT.md",
  },
  {
    area: "Migrationen",
    status: "PASS",
    evidence: "qa:migrations 10/10, kein Drift",
    checkedAt: "2026-08-27",
    action: "",
    owner: "Agent",
    reference: "qa/PHASE14-MIGRATION-REPORT.md",
  },
  {
    area: "Jobs",
    status: "PASS",
    evidence: "qa:jobs 21/21",
    checkedAt: "2026-08-27",
    action: "",
    owner: "Agent",
    reference: "qa/PHASE14-JOBS-REPORT.md",
  },
  {
    area: "Monitoring",
    status: "OFFEN",
    evidence: "Systemstatus und Health vorhanden, keine externe Alarmierung",
    checkedAt: "2026-08-27",
    action: "Alarmierungsziel und Eskalationsweg festlegen",
    owner: "Betreiber",
    reference: "docs/production/OPERATIONS_RUNBOOK.md",
  },
  {
    area: "Performance",
    status: "OFFEN",
    evidence: "Dev-Messungen 15/15; Production-Budgets nicht abgeleitet",
    checkedAt: "2026-08-27",
    action: "Budgets nach echtem Staging-Lauf festlegen",
    owner: "Betreiber",
    reference: "docs/production/PERFORMANCE_BUDGETS.md",
  },
  {
    area: "Accessibility",
    status: "OFFEN",
    evidence: "automatisiert 9/9; Screenreader-Stichprobe fehlt",
    checkedAt: "2026-08-27",
    action: "Manuellen Screenreader-Prüfplan abarbeiten",
    owner: "Betreiber",
    reference: "qa/PHASE14-ACCESSIBILITY-REPORT.md",
  },
  {
    area: "CSP",
    status: "OFFEN",
    evidence: "Report-Only aktiv, keine Verstoßauswertung aus echter Nutzung",
    checkedAt: "2026-08-27",
    action: "Report-Only-Verstöße aus Staging auswerten, dann durchsetzen",
    owner: "Betreiber",
    reference: "qa/PHASE14-SECURITY-HEADERS.md",
  },
  {
    area: "Staging",
    status: "BLOCKED",
    evidence: "nur ein Cloud-Projekt vorhanden",
    checkedAt: "2026-08-27",
    action: "STAGING_SETUP_RUNBOOK abarbeiten",
    owner: "Betreiber",
    reference: "docs/production/STAGING_SETUP_RUNBOOK.md",
  },
  {
    area: "Stripe",
    status: "BLOCKED",
    evidence: "kein STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET gesetzt; Adapter vorhanden",
    checkedAt: "2026-08-27",
    action: "Test-Keys im Secret Store hinterlegen",
    owner: "Betreiber",
    reference: "docs/production/PROVIDER_READINESS_MATRIX.md",
  },
  {
    area: "E-Mail",
    status: "BLOCKED",
    evidence: "kein API-Adapter mit Domain-Verifikation; SMTP nicht implementierbar",
    checkedAt: "2026-08-27",
    action: "Provider-Vertrag und Absenderdomain bereitstellen",
    owner: "Betreiber",
    reference: "docs/production/INTEGRATION_CONNECT_GAPS.md",
  },
  {
    area: "Carrier",
    status: "BLOCKED",
    evidence: "nur Mock-Carrier aktiv; manueller Versandprozess nicht abgenommen",
    checkedAt: "2026-08-27",
    action: "Carrier-Vertrag oder manuellen Prozess abnehmen",
    owner: "Betreiber",
    reference: "docs/production/PROVIDER_READINESS_MATRIX.md",
  },
  {
    area: "Storage",
    status: "OFFEN",
    evidence: "Storage-Sicherheit 35/35; kein Virenscan verfügbar",
    checkedAt: "2026-08-27",
    action: "Scan-Lösung bewerten oder Restrisiko akzeptieren",
    owner: "Betreiber",
    reference: "qa/PHASE14-STORAGE-SECURITY.md",
  },
  {
    area: "Datenschutz",
    status: "OFFEN",
    evidence: "Privacy 26/26; Löschjobs und Fristen fachlich offen",
    checkedAt: "2026-08-27",
    action: "Aufbewahrungsfristen fachlich bestätigen",
    owner: "Fachlich/Rechtlich",
    reference: "docs/production/DATA_RETENTION_POLICY.md",
  },
  {
    area: "Legal",
    status: "OFFEN",
    evidence: "Checkliste erstellt, keine Punkte bestätigt",
    checkedAt: "2026-08-27",
    action: "Rechtliche Freigabematrix bestätigen",
    owner: "Fachlich/Rechtlich",
    reference: "docs/production/LEGAL_GO_LIVE_CHECKLIST.md",
  },
  {
    area: "Domains",
    status: "OFFEN",
    evidence: "Runbook erstellt, keine Domain verbunden",
    checkedAt: "2026-08-27",
    action: "Domains verbinden und DNS setzen",
    owner: "Betreiber",
    reference: "docs/production/DOMAIN_AND_DNS_RUNBOOK.md",
  },
  {
    area: "Staging-E2E",
    status: "BLOCKED",
    evidence: "keine getrennte Umgebung",
    checkedAt: "2026-08-27",
    action: "Nach Staging-Einrichtung ausführen",
    owner: "Betreiber",
    reference: "qa/PHASE19-STAGING-E2E-REPORT.md",
  },
  {
    area: "Rollback",
    status: "BLOCKED",
    evidence: "Forward-Fix-Test benötigt getrennte Umgebung",
    checkedAt: "2026-08-27",
    action: "Rollback-Test in Staging durchführen",
    owner: "Betreiber",
    reference: "qa/PHASE19-ROLLBACK-REPORT.md",
  },
  {
    area: "Incident Runbooks",
    status: "PASS",
    evidence: "20 Szenarien dokumentiert",
    checkedAt: "2026-08-27",
    action: "",
    owner: "Agent",
    reference: "docs/production/INCIDENT_RESPONSE.md",
  },
  {
    area: "Agent Readiness",
    status: "PASS",
    evidence: "Phase 17 abgenommen",
    checkedAt: "2026-08-26",
    action: "",
    owner: "Agent",
    reference: "qa/PHASE17-AGENT-READINESS.md",
  },
];

export const READINESS_SUMMARY = {
  softwareReady: true,
  stagingReady: false,
  providerReady: false,
  legalReady: false,
  productionReady: false,
};
