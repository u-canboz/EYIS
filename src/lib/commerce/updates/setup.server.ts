/**
 * Update-Setup-Assistent (server-only).
 *
 * Ziel: Die fünf Nachweise des Update Centers werden erkannt, gesetzt und
 * belegt — ohne dass der Kunde Rechte, Pfade oder Schlüssel selbst hinterlegt.
 *
 * Grundsätze:
 *  - Es wird nie ein Nachweis "erfüllt" gemeldet, der nicht real geprüft wurde.
 *  - Zugangsdaten werden nie geloggt, nie zurückgegeben, nie persistiert.
 *  - Schreibende Eingriffe im Kunden-Repository sind idempotent: identische
 *    Inhalte werden nicht erneut committet.
 */
import workflowTemplate from "../../../../templates/customer-repo/.github/workflows/eyis-update.yml?raw";
import updateCliSource from "../../eyis/update-cli.ts?raw";
import installedReleaseSource from "../../eyis/installed-release.json?raw";
import {
  getFileContent,
  getRepo,
  listRepoSecretNames,
  listWritableRepos,
  putFileContent,
  putRepoSecret,
  resolveGithubAuth,
} from "./github.server";
import { probeCapabilities, resolveUpdateConfig, type CapabilityReport } from "./providers.server";
import { readUpdateSetupSettings, writeUpdateSetupSettings } from "./setup-settings.server";
import { UpdateError } from "./types";

const WORKFLOW_MESSAGE = "EYIS: Update-Workflow einrichten";
const CLI_PATH = "src/lib/eyis/update-cli.ts";
const IDENTITY_PATH = "src/lib/eyis/installed-release.json";

export type SetupStepId = "auth" | "registry" | "code" | "deployment" | "migration";

export type SetupStepView = {
  id: SetupStepId;
  title: string;
  status: "SUPPORTED" | "SETUP_REQUIRED";
  detail: string;
  remediation?: string | undefined;
  evidence: string[];
};

export type SetupStateView = {
  repo: string;
  repoCandidates: string[];
  hosting: string;
  healthUrl: string;
  publishAcknowledgedAt: string | null;
  databaseSecrets: {
    /** Zugang liegt in der Installation vor und kann übertragen werden. */
    availableFromInstallation: boolean;
    /** Im Kunden-Repository bereits hinterlegt. */
    presentInRepository: boolean;
    syncedAt: string | null;
  };
  steps: SetupStepView[];
  ready: boolean;
  lastSetupAt: string | null;
};

const TITLES: Record<SetupStepId, string> = {
  auth: "GitHub-Zugang",
  registry: "Signierte Releases",
  code: "Kunden-Repository",
  deployment: "Veröffentlichung",
  migration: "Datenbank",
};

function toSteps(report: CapabilityReport): SetupStepView[] {
  const map: Array<[SetupStepId, (typeof report)["auth"]]> = [
    ["auth", report.auth],
    ["registry", report.registry],
    ["code", report.code],
    ["deployment", report.deployment],
    ["migration", report.migration],
  ];
  return map.map(([id, proof]) => ({
    id,
    title: TITLES[id],
    status: proof.status === "SUPPORTED" ? "SUPPORTED" : "SETUP_REQUIRED",
    detail: proof.detail,
    remediation: proof.remediation,
    evidence: proof.evidence ?? [],
  }));
}

function databaseCredentials(): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];
  const dbUrl = (process.env["SUPABASE_DB_URL"] ?? "").trim();
  const accessToken = (process.env["SUPABASE_ACCESS_TOKEN"] ?? "").trim();
  if (dbUrl) out.push({ name: "SUPABASE_DB_URL", value: dbUrl });
  if (accessToken) out.push({ name: "SUPABASE_ACCESS_TOKEN", value: accessToken });
  return out;
}

/** Nur lesen: aktueller Stand der Einrichtung. */
export async function detectUpdateSetup(): Promise<SetupStateView> {
  const config = await resolveUpdateConfig();
  const stored = await readUpdateSetupSettings();
  const auth = await resolveGithubAuth(config.customerRepo);
  const capabilities = await probeCapabilities(config);

  let candidates: string[] = [];
  if (!config.customerRepo && auth.token) {
    candidates = (await listWritableRepos(auth.token)).map((r) => r.fullName).slice(0, 50);
  }

  let presentInRepository = false;
  if (config.customerRepo && auth.token) {
    try {
      const names = await listRepoSecretNames(config.customerRepo, auth.token);
      presentInRepository = names.includes("SUPABASE_DB_URL");
    } catch {
      presentInRepository = false;
    }
  }

  const steps = toSteps(capabilities);
  return {
    repo: config.customerRepo,
    repoCandidates: candidates,
    hosting: config.hosting,
    healthUrl: config.deploymentHealthUrl,
    publishAcknowledgedAt: config.publishAcknowledgedAt,
    databaseSecrets: {
      availableFromInstallation: databaseCredentials().length > 0,
      presentInRepository,
      syncedAt: stored?.dbSecretSyncedAt ?? null,
    },
    steps,
    ready: steps.every((s) => s.status === "SUPPORTED"),
    lastSetupAt: stored?.lastSetupAt ?? null,
  };
}

export type SetupRunAction = {
  action: string;
  status: "done" | "skipped" | "failed";
  detail: string;
};

export type SetupRunResult = {
  actions: SetupRunAction[];
  state: SetupStateView;
};

/** Führt die Einrichtung aus: erkennen, hinterlegen, schreiben, nachweisen. */
export async function runUpdateSetup(input: {
  repo?: string | undefined;
  acknowledgePublish?: boolean | undefined;
  actorEmail?: string | null | undefined;
}): Promise<SetupRunResult> {
  const actions: SetupRunAction[] = [];
  let config = await resolveUpdateConfig();

  // 1. Kunden-Repository festlegen (Vorgabe > gespeichert > eindeutiger Fund).
  const requested = (input.repo ?? "").trim();
  if (requested && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(requested))
    throw new UpdateError("INVALID_REPO", "Repository muss im Format owner/repo angegeben werden.");

  const auth = await resolveGithubAuth(requested || config.customerRepo);
  if (!auth.token) {
    actions.push({
      action: "GitHub-Zugang",
      status: "failed",
      detail: auth.detail,
    });
    return { actions, state: await detectUpdateSetup() };
  }
  actions.push({ action: "GitHub-Zugang", status: "done", detail: auth.detail });

  let repo = requested || config.customerRepo;
  if (!repo) {
    const writable = await listWritableRepos(auth.token);
    if (writable.length === 1) repo = writable[0]!.fullName;
  }
  if (!repo) {
    actions.push({
      action: "Kunden-Repository",
      status: "failed",
      detail: "Repository konnte nicht eindeutig erkannt werden — bitte einmalig auswählen.",
    });
    return { actions, state: await detectUpdateSetup() };
  }
  if (repo !== config.customerRepo) {
    await writeUpdateSetupSettings({ customerRepo: repo });
    actions.push({ action: "Kunden-Repository", status: "done", detail: `${repo} hinterlegt.` });
  }

  // 2. Health-URL und Hosting festhalten, damit der Nachweis überprüfbar ist.
  config = await resolveUpdateConfig();
  if (config.deploymentHealthUrl && !(await readUpdateSetupSettings())?.healthUrl) {
    await writeUpdateSetupSettings({ healthUrl: config.deploymentHealthUrl });
  }

  // 3. Repository provisionieren (idempotent).
  const info = await getRepo(repo, auth.token);
  const files: Array<{ path: string; content: string; label: string }> = [
    { path: config.workflowPath, content: workflowTemplate, label: "Update-Workflow" },
    { path: CLI_PATH, content: updateCliSource, label: "Update-Verifier" },
    { path: IDENTITY_PATH, content: installedReleaseSource, label: "Release-Identität" },
  ];
  for (const file of files) {
    try {
      const current = await getFileContent(repo, file.path, info.defaultBranch, auth.token);
      if (current !== null && current.trim() === file.content.trim()) {
        actions.push({
          action: file.label,
          status: "skipped",
          detail: "Bereits aktuell — keine Änderung nötig.",
        });
        continue;
      }
      const result = await putFileContent(
        repo,
        file.path,
        info.defaultBranch,
        file.content,
        `${WORKFLOW_MESSAGE}: ${file.label}`,
        auth.token,
      );
      actions.push({
        action: file.label,
        status: "done",
        detail: `${result === "created" ? "Angelegt" : "Aktualisiert"} auf ${info.defaultBranch}.`,
      });
    } catch (e) {
      actions.push({
        action: file.label,
        status: "failed",
        detail: e instanceof Error ? e.message : "Schreiben fehlgeschlagen.",
      });
    }
  }

  // 4. Datenbank-Zugang aus der Installation als Repository-Secret hinterlegen.
  const credentials = databaseCredentials();
  if (credentials.length === 0) {
    actions.push({
      action: "Datenbank-Zugang",
      status: "skipped",
      detail:
        "In der Installation ist kein Datenbank-Zugang hinterlegt. Schemaändernde Updates bleiben bis dahin gesperrt.",
    });
  } else {
    let failed = false;
    for (const credential of credentials) {
      try {
        await putRepoSecret(repo, credential.name, credential.value, auth.token);
      } catch (e) {
        failed = true;
        actions.push({
          action: `Datenbank-Zugang (${credential.name})`,
          status: "failed",
          detail: e instanceof Error ? e.message : "Secret konnte nicht gesetzt werden.",
        });
      }
    }
    if (!failed) {
      await writeUpdateSetupSettings({ dbSecretSyncedAt: new Date().toISOString() });
      actions.push({
        action: "Datenbank-Zugang",
        status: "done",
        detail: `${credentials.length} Repository-Secret(s) übertragen (Werte bleiben verschlüsselt).`,
      });
    }
  }

  // 5. Veröffentlichung: Lovable veröffentlicht nicht automatisch.
  if (input.acknowledgePublish) {
    await writeUpdateSetupSettings({
      publishAckAt: new Date().toISOString(),
      publishAckBy: input.actorEmail ?? null,
    });
    actions.push({
      action: "Veröffentlichung",
      status: "done",
      detail: "Publish-Handschritt bestätigt; das Update Center erinnert nach jedem Lauf daran.",
    });
  }

  // 6. Abschluss: erneut prüfen und Ergebnis festhalten.
  const state = await detectUpdateSetup();
  await writeUpdateSetupSettings({
    lastSetupAt: new Date().toISOString(),
    lastSetupReport: state.steps.map((s) => ({ id: s.id, status: s.status, detail: s.detail })),
  });
  return { actions, state };
}

/** Nur den Publish-Handschritt bestätigen oder zurückziehen. */
export async function acknowledgePublishStep(
  acknowledged: boolean,
  actorEmail: string | null,
): Promise<SetupStateView> {
  await writeUpdateSetupSettings({
    publishAckAt: acknowledged ? new Date().toISOString() : null,
    publishAckBy: acknowledged ? actorEmail : null,
  });
  return detectUpdateSetup();
}
