import { STORE_SDK_VERSION } from "../../store-sdk/config";
/**
 * Update Center — Orchestrierung (server-only).
 *
 * Ablauf eines Updates:
 *   preflight → backup → code → database → deployment → doctor
 *
 * Der eigentliche Transport läuft im Kunden-Repository (GitHub Actions).
 * Diese Datei startet ihn, verfolgt den echten Workflow-Lauf und schreibt
 * jeden Schritt nachvollziehbar in `update_runs` / `update_run_steps`.
 * Es gibt keinen Schritt, der ohne echten Nachweis auf "passed" geht.
 */
import { getAdmin } from "../core.server";
import { runDoctor } from "../system/installation.server";
import { resolveDeploymentMode, resolveEnvironment } from "../environment";
import {
  cancelWorkflowRun,
  dispatchRepositoryEvent,
  findWorkflowRun,
  getWorkflowJobs,
  getWorkflowRun,
  resolveGithubAuth,
} from "./github.server";
import {
  resolveUpdateConfig,
  probeCapabilities,
  type CapabilityReport,
} from "./providers.server";
import { fetchSignedReleases } from "./registry.server";
import { EYIS_OWNED_PATHS, CUSTOMER_OWNED_PATHS } from "./ownership";
import {
  ACTIVE_RUN_STATUSES,
  UPDATE_STEPS,
  UpdateError,
  canTransition,
  type ReleaseManifest,
  type UpdateChannel,
  type UpdateRunStatus,
  type UpdateRunView,
  type UpdateStep,
  type UpdateStepStatus,
} from "./types";
import {
  compareVersions,
  isAutoUpdateAllowed,
  isNewer,
  selectCandidate,
  upgradeType,
} from "./versions";

import { missingWorkflowEvidence } from "./workflow-evidence";

type Row = Record<string, unknown>;

const str = (v: unknown) => (v == null ? null : String(v));

// ---------------------------------------------------------------------------
// Installation / Zustand
// ---------------------------------------------------------------------------

/** Permissions in a tenant never grant control over another installation. */
export async function assertInstallationOrganization(organizationId: string) {
  if (resolveDeploymentMode() !== "dedicated")
    throw new UpdateError(
      "DEDICATED_REQUIRED",
      "Updates werden vom Betreiber der Dedicated-Installation verwaltet.",
    );
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("commerce_installation")
    .select("installation_id")
    .eq("singleton", true)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !data)
    throw new UpdateError(
      "INSTALLATION_ACCESS_DENIED",
      "Diese Organisation verwaltet die Installation nicht.",
    );
}

async function requireInstallation() {
  // The general installation reader deliberately projects bootstrap columns only.
  // Update state must be loaded explicitly; otherwise available_release and the
  // selected channel disappear on every request.
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("commerce_installation")
    .select(
      "installation_id, core_version, update_channel, auto_update_policy, maintenance_state, last_update_check_at, last_successful_update_at, available_release, update_config",
    )
    .eq("singleton", true)
    .maybeSingle();
  if (error)
    throw new UpdateError(
      "INSTALLATION_READ_FAILED",
      "Installationsstatus konnte nicht geladen werden.",
    );
  const row = data as Row | null;
  if (!row) {
    throw new UpdateError("INSTALLATION_NOT_FOUND", "Keine Installation registriert.");
  }
  return row;
}

export type UpdateOverview = {
  installedVersion: string;
  channel: UpdateChannel;
  autoUpdatePolicy: string;
  maintenanceState: string;
  lastCheckAt: string | null;
  lastSuccessfulUpdateAt: string | null;
  deploymentMode: string;
  environment: string;
  capabilities: CapabilityReport;
  available: ReleaseManifest | null;
  blockedByChain: string | null;
  activeRun: UpdateRunView | null;
  history: UpdateRunView[];
  ownership: { eyis: string[]; customer: string[] };
  rejectedReleases: Array<{ tag: string; reason: string }>;
};

function mapRun(run: Row, steps: Row[]): UpdateRunView {
  return {
    id: String(run["id"]),
    fromVersion: String(run["from_version"]),
    toVersion: String(run["to_version"]),
    releaseId: String(run["release_id"]),
    channel: String(run["channel"]),
    status: String(run["status"]) as UpdateRunStatus,
    currentStep: str(run["current_step"]),
    startedAt: String(run["started_at"]),
    completedAt: str(run["completed_at"]),
    deploymentProvider: str(run["deployment_provider"]),
    deploymentReference: str(run["deployment_reference"]),
    migrationProvider: str(run["migration_provider"]),
    backupReference: str(run["backup_reference"]),
    errorCode: str(run["error_code"]),
    safeErrorMessage: str(run["safe_error_message"]),
    rollbackStatus: String(run["rollback_status"] ?? "none"),
    initiatedByEmail: str(run["initiated_by_email"]),
    steps: steps
      .filter((s) => String(s["update_run_id"]) === String(run["id"]))
      .sort((a, b) => Number(a["position"]) - Number(b["position"]))
      .map((s) => ({
        step: String(s["step"]),
        position: Number(s["position"]),
        status: String(s["status"]) as UpdateStepStatus,
        outputSummary: str(s["output_summary"]),
        errorCode: str(s["error_code"]),
        startedAt: str(s["started_at"]),
        completedAt: str(s["completed_at"]),
      })),
  };
}

async function loadRuns(limit = 10): Promise<UpdateRunView[]> {
  const admin = await getAdmin();
  const { data: runs, error } = await admin
    .from("update_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const rows = (runs ?? []) as unknown as Row[];
  if (rows.length === 0) return [];
  const { data: steps, error: stepsError } = await admin
    .from("update_run_steps")
    .select("*")
    .in(
      "update_run_id",
      rows.map((r) => String(r["id"])),
    );
  if (stepsError)
    throw new UpdateError(
      "UPDATE_STEPS_READ_FAILED",
      "Update-Schritte konnten nicht geladen werden.",
    );
  const stepRows = (steps ?? []) as unknown as Row[];
  return rows.map((r) => mapRun(r, stepRows));
}

/** Cached release info is refreshed automatically when older than this. */
const OVERVIEW_CHECK_MAX_AGE_MS = 15 * 60 * 1000;

export async function getUpdateOverview(): Promise<UpdateOverview> {
  let installation = await requireInstallation();

  const lastCheck = str(installation["last_update_check_at"]);
  const stale =
    !lastCheck || Date.now() - new Date(lastCheck).getTime() > OVERVIEW_CHECK_MAX_AGE_MS;
  if (stale) {
    try {
      await checkForUpdates();
      installation = await requireInstallation();
    } catch {
      // Offline oder Registry nicht erreichbar: zwischengespeicherten Stand zeigen.
    }
  }

  const capabilities = await probeCapabilities();
  const history = await loadRuns(10);
  const activeRun = history.find((r) => ACTIVE_RUN_STATUSES.includes(r.status)) ?? null;
  const availableRaw = installation["available_release"] as ReleaseManifest | null;


  let environment = "unknown";
  try {
    environment = resolveEnvironment(process.env as Record<string, string | undefined>);
  } catch {
    environment = "invalid";
  }

  return {
    installedVersion: String(installation["core_version"] ?? "0.0.0"),
    channel: (String(installation["update_channel"] ?? "stable") as UpdateChannel) ?? "stable",
    autoUpdatePolicy: String(installation["auto_update_policy"] ?? "manual"),
    maintenanceState: String(installation["maintenance_state"] ?? "off"),
    lastCheckAt: str(installation["last_update_check_at"]),
    lastSuccessfulUpdateAt: str(installation["last_successful_update_at"]),
    deploymentMode: resolveDeploymentMode(),
    environment,
    capabilities,
    available: availableRaw && availableRaw.version ? availableRaw : null,
    blockedByChain: str((installation["update_config"] as Row | null)?.["blocked_by_chain"]),
    activeRun,
    history: history.filter((r) => !activeRun || r.id !== activeRun.id),
    rejectedReleases:
      ((installation["update_config"] as Row | null)?.["rejected_releases"] as Array<{
        tag: string;
        reason: string;
      }>) ?? [],
    ownership: { eyis: EYIS_OWNED_PATHS, customer: CUSTOMER_OWNED_PATHS },
  };
}

// ---------------------------------------------------------------------------
// Verfügbarkeitsprüfung
// ---------------------------------------------------------------------------

export async function checkForUpdates(): Promise<{
  available: ReleaseManifest | null;
  blockedByChain: string | null;
  rejected: Array<{ tag: string; reason: string }>;
  autoUpdateEligible: boolean;
}> {
  const installation = await requireInstallation();
  const installedVersion = String(installation["core_version"] ?? "0.0.0");
  const channel = String(installation["update_channel"] ?? "stable") as UpdateChannel;
  const { releases, rejected } = await fetchSignedReleases();
  const { candidate, blockedBy } = selectCandidate(releases, installedVersion, channel);

  const admin = await getAdmin();
  const config = (installation["update_config"] as Row | null) ?? {};
  const { error: saveError } = await admin
    .from("commerce_installation")
    .update({
      last_update_check_at: new Date().toISOString(),
      available_release: candidate ?? null,
      update_config: {
        ...config,
        blocked_by_chain: blockedBy?.version ?? null,
        rejected_releases: rejected,
      },
    } as never)
    .eq("singleton", true);

  if (saveError)
    throw new UpdateError(
      "UPDATE_CHECK_SAVE_FAILED",
      "Release-Prüfung konnte nicht gespeichert werden.",
    );
  return {
    available: candidate,
    blockedByChain: blockedBy?.version ?? null,
    rejected,
    autoUpdateEligible: candidate
      ? isAutoUpdateAllowed(
          String(installation["auto_update_policy"] ?? "manual") as never,
          installedVersion,
          candidate,
        )
      : false,
  };
}

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

export type PreflightCheck = {
  check: string;
  status: "PASS" | "FAIL" | "BLOCKED";
  detail: string;
};

export async function runPreflight(release: ReleaseManifest): Promise<{
  checks: PreflightCheck[];
  ok: boolean;
  capabilities: CapabilityReport;
}> {
  const installation = await requireInstallation();
  const installedVersion = String(installation["core_version"] ?? "0.0.0");
  const capabilities = await probeCapabilities();
  const checks: PreflightCheck[] = [];

  checks.push({
    check: "Deployment Mode",
    status: resolveDeploymentMode() === "dedicated" ? "PASS" : "BLOCKED",
    detail: resolveDeploymentMode(),
  });

  checks.push({
    check: "Versionskette",
    status:
      isNewer(release.version, installedVersion) &&
      compareVersions(installedVersion, release.minFromVersion) >= 0
        ? "PASS"
        : "FAIL",
    detail: `${installedVersion} → ${release.version} (${upgradeTypeSafe(installedVersion, release.version) ?? "ungültig"})`,
  });

  checks.push({
    check: "Manuelle Release-Schritte",
    status: release.requiresManualStep ? "BLOCKED" : "PASS",
    detail: release.requiresManualStep
      ? "Dieses Release erfordert einen betreuten Update-Ablauf."
      : "Keine manuellen Schritte erforderlich.",
  });

  checks.push({
    check: "Code-Transport (Kunden-Repository)",
    status: capabilities.code.status === "SUPPORTED" ? "PASS" : "BLOCKED",
    detail: capabilities.code.detail,
  });

  checks.push({
    check: "Production Deployment",
    status: capabilities.deployment.status === "SUPPORTED" ? "PASS" : "BLOCKED",
    detail: capabilities.deployment.detail,
  });

  const schemaChanging = release.migrations.length > 0;
  checks.push({
    check: "Datenbank-Migrationen",
    status: !schemaChanging ? "PASS" : capabilities.schemaChangesAllowed ? "PASS" : "BLOCKED",
    detail: schemaChanging
      ? `${release.migrations.length} Migration(en); Adapter: ${capabilities.migration.detail}`
      : "Keine Schemaänderungen in diesem Release.",
  });

  checks.push({
    check: "Release-Signatur",
    status: capabilities.registry.status === "SUPPORTED" ? "PASS" : "BLOCKED",
    detail: capabilities.registry.detail,
  });

  const backup = await verifyBackup();
  checks.push({
    check: "Backup-Nachweis",
    status: backup.ok ? "PASS" : "BLOCKED",
    detail: backup.detail,
  });

  // Aktive Läufe
  const runs = await loadRuns(5);
  const active = runs.find((r) => ACTIVE_RUN_STATUSES.includes(r.status));
  checks.push({
    check: "Kein paralleler Update-Lauf",
    status: active ? "BLOCKED" : "PASS",
    detail: active ? `Lauf ${active.id} ist aktiv (${active.status}).` : "keiner aktiv",
  });

  // Datenbank erreichbar
  const admin = await getAdmin();
  const { error: dbError } = await admin.from("organizations").select("id").limit(1);
  checks.push({
    check: "Datenbank erreichbar",
    status: dbError ? "FAIL" : "PASS",
    detail: dbError?.message ?? "ok",
  });

  return { checks, ok: checks.every((c) => c.status === "PASS"), capabilities };
}

function upgradeTypeSafe(from: string, to: string): string | null {
  try {
    return upgradeType(from, to);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Update starten
// ---------------------------------------------------------------------------

async function insertSteps(runId: string, schemaChanging: boolean) {
  const admin = await getAdmin();
  const rows = UPDATE_STEPS.map((step, index) => ({
    update_run_id: runId,
    position: index,
    step,
    status: step === "database" && !schemaChanging ? "skipped" : "pending",
    output_summary: step === "database" && !schemaChanging ? "Keine Schemaänderungen." : null,
  }));
  const { error } = await admin.from("update_run_steps").insert(rows as never);
  if (error) throw new Error(error.message);
}

async function setStep(
  runId: string,
  step: UpdateStep,
  status: UpdateStepStatus,
  summary?: string,
  errorCode?: string,
) {
  const admin = await getAdmin();
  const patch: Row = { status, output_summary: summary ?? null, error_code: errorCode ?? null };
  if (status === "running") patch["started_at"] = new Date().toISOString();
  if (status === "passed" || status === "failed" || status === "blocked") {
    patch["completed_at"] = new Date().toISOString();
  }
  const { error } = await admin
    .from("update_run_steps")
    .update(patch as never)
    .eq("update_run_id", runId)
    .eq("step", step);
  if (error)
    throw new UpdateError(
      "UPDATE_STEP_SAVE_FAILED",
      "Update-Schritt konnte nicht gespeichert werden.",
    );
}

async function setRunStatus(
  runId: string,
  from: UpdateRunStatus,
  to: UpdateRunStatus,
  patch: Row = {},
) {
  if (!canTransition(from, to)) {
    throw new UpdateError("INVALID_TRANSITION", `Übergang ${from} → ${to} ist nicht erlaubt.`);
  }
  const admin = await getAdmin();
  const { error } = await admin
    .from("update_runs")
    .update({ status: to, ...patch } as never)
    .eq("id", runId);
  if (error) throw new Error(error.message);
}

async function setMaintenance(state: "off" | "updating" | "manual") {
  const admin = await getAdmin();
  const { error } = await admin
    .from("commerce_installation")
    .update({ maintenance_state: state } as never)
    .eq("singleton", true);
  if (error)
    throw new UpdateError(
      "MAINTENANCE_SAVE_FAILED",
      "Wartungsstatus konnte nicht gespeichert werden.",
    );
}

export async function startUpdate(input: {
  userId: string;
  userEmail: string | null;
  releaseId: string;
  organizationId: string;
}): Promise<UpdateRunView> {
  const installation = await requireInstallation();
  const installedVersion = String(installation["core_version"] ?? "0.0.0");
  let available = installation["available_release"] as ReleaseManifest | null;
  if (!available || available.releaseId !== input.releaseId) {
    throw new UpdateError(
      "RELEASE_NOT_AVAILABLE",
      "Das gewählte Release ist nicht als verfügbar hinterlegt. Bitte erneut auf Updates prüfen.",
    );
  }

  // Recheck the registry at install time: cached availability must not bypass
  // a withdrawn release, changed channel or a revoked signing key.
  const { releases } = await fetchSignedReleases();
  const selected = selectCandidate(
    releases,
    installedVersion,
    String(installation["update_channel"] ?? "stable") as UpdateChannel,
  ).candidate;
  if (!selected || selected.releaseId !== available.releaseId)
    throw new UpdateError(
      "RELEASE_NOT_AVAILABLE",
      "Release ist nicht mehr installierbar. Bitte erneut prüfen.",
    );
  available = selected;
  if (!available.manifestUrl || !available.signatureUrl)
    throw new UpdateError("RELEASE_ASSETS_MISSING", "Manifest- oder Signatur-Download fehlt.");
  if (installation["maintenance_state"] !== "off")
    throw new UpdateError(
      "MAINTENANCE_ACTIVE",
      "Die Installation befindet sich bereits im Wartungsmodus.",
    );
  const preflight = await runPreflight(available);
  const config = await resolveUpdateConfig();
  const admin = await getAdmin();

  const schemaChanging = available.migrations.length > 0;

  const { data: created, error: insertError } = await admin
    .from("update_runs")
    .insert({
      installation_id: String(installation["installation_id"]),
      from_version: installedVersion,
      to_version: available.version,
      release_id: available.releaseId,
      channel: String(installation["update_channel"] ?? "stable"),
      status: "preflight",
      initiated_by: input.userId,
      initiated_by_email: input.userEmail,
      current_step: "preflight",
      deployment_provider: preflight.capabilities.deployment.provider,
      migration_provider: preflight.capabilities.migration.provider,
      migration_from: installedVersion,
      migration_to: available.version,
      metadata: { migrations: available.migrations, preflight: preflight.checks },
    } as never)
    .select("*")
    .single();
  if (insertError) {
    if (/update_runs_single_active/.test(insertError.message)) {
      throw new UpdateError("UPDATE_ALREADY_RUNNING", "Es läuft bereits ein Update.");
    }
    throw new Error(insertError.message);
  }
  const run = created as unknown as Row;
  const runId = String(run["id"]);
  await insertSteps(runId, schemaChanging);

  const failedChecks = preflight.checks.filter((c) => c.status !== "PASS");
  if (failedChecks.length > 0) {
    await setStep(
      runId,
      "preflight",
      "failed",
      failedChecks.map((c) => `${c.check}: ${c.detail}`).join(" | "),
      "PREFLIGHT_FAILED",
    );
    await setRunStatus(runId, "preflight", "failed", {
      error_code: "PREFLIGHT_FAILED",
      safe_error_message: failedChecks.map((c) => c.check).join(", "),
      completed_at: new Date().toISOString(),
      current_step: "preflight",
    });
    return (await getRun(runId))!;
  }
  await setStep(runId, "preflight", "passed", `${preflight.checks.length} Prüfungen bestanden.`);
  await setRunStatus(runId, "preflight", "ready", { current_step: "backup" });

  // Backup: Nachweis statt Behauptung — ohne belegte Sicherung kein Update.
  await setStep(runId, "backup", "running");
  const backup = await verifyBackup();
  if (!backup.ok) {
    await setStep(runId, "backup", "failed", backup.detail, "BACKUP_UNVERIFIED");
    await setRunStatus(runId, "ready", "backup_check");
    await setRunStatus(runId, "backup_check", "failed", {
      error_code: "BACKUP_UNVERIFIED",
      safe_error_message: backup.detail,
      completed_at: new Date().toISOString(),
    });
    return (await getRun(runId))!;
  }
  await setStep(runId, "backup", "passed", backup.detail);
  await setRunStatus(runId, "ready", "backup_check", { backup_reference: backup.reference });

  // Wartungsmodus
  await setMaintenance("updating");
  await setRunStatus(runId, "backup_check", "maintenance", { current_step: "code" });

  // Code + Deployment: echter repository_dispatch ins Kunden-Repository
  await setStep(runId, "code", "running");
  try {
    const auth = await resolveGithubAuth(config.customerRepo);
    await dispatchRepositoryEvent(
      config.customerRepo,
      config.eventType,
      {
        correlation_id: runId,
        release_id: available.releaseId,
        version: available.version,
        artifact_url: available.artifact.url,
        manifest_url: available.manifestUrl,
        signature_url: available.signatureUrl,
        artifact_sha256: available.artifact.sha256,
        apply_migrations: schemaChanging,
        eyis_owned_paths: EYIS_OWNED_PATHS,
      },
      auth.token,
    );
  } catch (e) {
    await setStep(
      runId,
      "code",
      "failed",
      e instanceof Error ? e.message : "Dispatch fehlgeschlagen.",
      "DISPATCH_FAILED",
    );
    // A network timeout can happen after GitHub accepted the dispatch.
    // Keep writes paused until an operator has reconciled the actual run.
    await setMaintenance("manual");
    await setRunStatus(runId, "maintenance", "failed", {
      error_code: "DISPATCH_FAILED",
      safe_error_message:
        "Workflow-Start konnte nicht bestätigt werden. GitHub-Läufe vor Freigabe der Wartung prüfen.",
      completed_at: new Date().toISOString(),
    });
    return (await getRun(runId))!;
  }

  await setRunStatus(runId, "maintenance", "deploying", { current_step: "code" });
  return (await getRun(runId))!;
}

/**
 * Backup-Nachweis. Auf verwalteter Infrastruktur liegt das Backup ausserhalb
 * der App; es wird nur akzeptiert, wenn der Betreiber es explizit bestätigt
 * (`EYIS_UPDATE_BACKUP_PROOF`), z. B. mit Snapshot-Kennung.
 */
async function verifyBackup(): Promise<{ ok: boolean; detail: string; reference: string | null }> {
  const proof = (process.env["EYIS_UPDATE_BACKUP_PROOF"] ?? "").trim();
  if (!proof) {
    return {
      ok: false,
      detail:
        "Kein Backup-Nachweis hinterlegt. EYIS_UPDATE_BACKUP_PROOF mit Snapshot-Kennung setzen (Point-in-Time-Recovery der Instanz).",
      reference: null,
    };
  }
  return { ok: true, detail: `Backup nachgewiesen: ${proof}`, reference: proof };
}

// ---------------------------------------------------------------------------
// Fortschritt verfolgen
// ---------------------------------------------------------------------------

export async function getRun(runId: string): Promise<UpdateRunView | null> {
  const admin = await getAdmin();
  const { data: run } = await admin.from("update_runs").select("*").eq("id", runId).maybeSingle();
  if (!run) return null;
  const { data: steps } = await admin
    .from("update_run_steps")
    .select("*")
    .eq("update_run_id", runId);
  return mapRun(run as unknown as Row, (steps ?? []) as unknown as Row[]);
}

/**
 * Verfolgt den echten Workflow-Lauf und schliesst das Update ab.
 * Wird von der Oberfläche zyklisch aufgerufen (kein langlaufender Handler).
 */
export async function pollUpdate(runId: string): Promise<UpdateRunView | null> {
  const current = await getRun(runId);
  if (!current) return null;
  if (!ACTIVE_RUN_STATUSES.includes(current.status)) return current;

  const config = await resolveUpdateConfig();
  const auth = await resolveGithubAuth(config.customerRepo);

  let workflowRunId = current.deploymentReference ? Number(current.deploymentReference) : null;
  if (!workflowRunId) {
    const found = await findWorkflowRun(config.customerRepo, runId, auth.token, current.startedAt);
    if (!found) return current;
    workflowRunId = found.id;
    const admin = await getAdmin();
    await admin
      .from("update_runs")
      .update({ deployment_reference: String(found.id) } as never)
      .eq("id", runId);
  }

  const wf = await getWorkflowRun(config.customerRepo, workflowRunId, auth.token);
  if (!wf) return current;
  const jobs = await getWorkflowJobs(config.customerRepo, workflowRunId, auth.token);

  const jobState = (needle: string) => jobs.find((j) => j.name === needle)?.conclusion ?? null;

  // Schritte anhand echter Job-Ergebnisse fortschreiben
  const codeConclusion = jobState("code");
  if (codeConclusion === "success")
    await setStep(runId, "code", "passed", "EYIS-Dateien ersetzt, Tests grün.");
  if (codeConclusion === "failure")
    await setStep(runId, "code", "failed", "Code-Job fehlgeschlagen.", "CODE_FAILED");

  const dbConclusion = jobState("database");
  if (dbConclusion === "success")
    await setStep(runId, "database", "passed", "Migrationen angewendet.");
  if (dbConclusion === "failure")
    await setStep(runId, "database", "failed", "Migrationsjob fehlgeschlagen.", "MIGRATION_FAILED");

  const deployConclusion = jobState("deploy");
  if (deployConclusion === "success")
    await setStep(runId, "deployment", "passed", "Production-Build veröffentlicht.");
  if (deployConclusion === "failure")
    await setStep(runId, "deployment", "failed", "Deployment fehlgeschlagen.", "DEPLOY_FAILED");

  if (wf.status !== "completed") {
    const step: UpdateStep = dbConclusion ? "deployment" : codeConclusion ? "database" : "code";
    const admin = await getAdmin();
    await admin
      .from("update_runs")
      .update({ current_step: step } as never)
      .eq("id", runId);
    return await getRun(runId);
  }

  if (wf.conclusion !== "success") {
    await setMaintenance("manual");
    const admin = await getAdmin();
    await admin
      .from("update_runs")
      .update({
        status: "failed",
        error_code: "WORKFLOW_FAILED",
        safe_error_message: `Update-Workflow endete mit "${wf.conclusion}". Code-, Datenbank- und Deployment-Stand vor Freigabe prüfen.`,
        completed_at: new Date().toISOString(),
        rollback_status: "not_supported",
      } as never)
      .eq("id", runId);
    await setStep(runId, "doctor", "blocked", "Nicht ausgeführt — Workflow fehlgeschlagen.");
    return await getRun(runId);
  }

  const missing = missingWorkflowEvidence(
    jobs,
    current.steps.find((s) => s.step === "database")?.status !== "skipped",
  );
  if (missing.length) {
    const admin = await getAdmin();
    await admin
      .from("update_runs")
      .update({
        status: "manual_attention",
        error_code: "WORKFLOW_EVIDENCE_MISSING",
        safe_error_message: `Nachweise fehlen: ${missing.join(", ")}`,
        completed_at: new Date().toISOString(),
      } as never)
      .eq("id", runId);
    await setMaintenance("manual");
    return getRun(runId);
  }

  // Doctor: echter Systemcheck nach dem Update
  await setStep(runId, "doctor", "running");
  const doctor = await runDoctor();
  const failing = doctor.filter((d) => d.status !== "PASS");
  const admin = await getAdmin();

  if (failing.length > 0) {
    await setStep(
      runId,
      "doctor",
      "failed",
      failing.map((f) => f.check).join(", "),
      "DOCTOR_FAILED",
    );
    await admin
      .from("update_runs")
      .update({
        status: "manual_attention",
        error_code: "DOCTOR_FAILED",
        safe_error_message: `Nach dem Update melden ${failing.length} Systemprüfungen einen Fehler.`,
        completed_at: new Date().toISOString(),
      } as never)
      .eq("id", runId);
    await setMaintenance("manual");
    return await getRun(runId);
  }

  await setStep(runId, "doctor", "passed", `${doctor.length} Systemprüfungen bestanden.`);
  const { error: installationError } = await admin
    .from("commerce_installation")
    .update({
      core_version: current.toVersion,
      sdk_version: STORE_SDK_VERSION,
      installed_release_id: current.releaseId,
      last_successful_update_at: new Date().toISOString(),
      available_release: null,
    } as never)
    .eq("singleton", true);
  if (installationError)
    throw new UpdateError(
      "UPDATE_FINALIZE_FAILED",
      "Release-Identität konnte nicht gespeichert werden. Wartung bleibt aktiv.",
    );
  const { error: completionError } = await admin
    .from("update_runs")
    .update({
      status: "completed",
      current_step: "doctor",
      completed_at: new Date().toISOString(),
    } as never)
    .eq("id", runId);
  if (completionError)
    throw new UpdateError(
      "UPDATE_FINALIZE_FAILED",
      "Update-Ergebnis konnte nicht gespeichert werden. Wartung bleibt aktiv.",
    );
  await setMaintenance("off");
  return await getRun(runId);
}

/** Manuelles Beenden eines hängenden Laufs (nur Owner/Administrator). */
export async function abandonRun(runId: string, reason: string): Promise<UpdateRunView | null> {
  const current = await getRun(runId);
  if (!current || !ACTIVE_RUN_STATUSES.includes(current.status)) return current;
  const config = await resolveUpdateConfig();
  const auth = await resolveGithubAuth(config.customerRepo);
  const workflow = current.deploymentReference
    ? await getWorkflowRun(config.customerRepo, Number(current.deploymentReference), auth.token)
    : await findWorkflowRun(config.customerRepo, runId, auth.token, current.startedAt);
  if (workflow && workflow.status !== "completed") {
    await cancelWorkflowRun(config.customerRepo, workflow.id, auth.token);
    // Keep the installation locked until GitHub confirms cancellation.
    return getRun(runId);
  }
  if (workflow) return pollUpdate(runId);
  throw new UpdateError(
    "CANCELLATION_UNCONFIRMED",
    "Der Workflow ist noch nicht nachweisbar. Der Update-Lauf bleibt gesperrt; bitte erneut prüfen.",
  );
}

export async function setUpdateChannel(channel: UpdateChannel, policy?: string) {
  const admin = await getAdmin();
  const installation = await requireInstallation();
  const runs = await loadRuns(5);
  if (runs.some((r) => ACTIVE_RUN_STATUSES.includes(r.status)))
    throw new UpdateError(
      "UPDATE_ALREADY_RUNNING",
      "Kanal kann während eines Updates nicht gewechselt werden.",
    );
  const patch: Row = {
    update_channel: channel,
    last_update_check_at: null,
    update_config: {
      ...((installation["update_config"] as Row) ?? {}),
      blocked_by_chain: null,
      rejected_releases: [],
    },
  };
  if (policy && policy !== "manual")
    throw new UpdateError(
      "AUTO_UPDATE_UNAVAILABLE",
      "Zeitgesteuerte Updates sind noch nicht eingerichtet. Bitte manuell aktualisieren.",
    );
  if (policy) patch["auto_update_policy"] = policy;
  patch["available_release"] = null;
  const { error } = await admin
    .from("commerce_installation")
    .update(patch as never)
    .eq("singleton", true);
  if (error) throw new Error(error.message);
}
