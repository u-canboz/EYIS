/**
 * Update Center — reine Typen und Konstanten (Phase 22).
 *
 * Diese Datei ist bewusst frei von Server-Importen: sie wird sowohl im
 * Browser (UI) als auch auf dem Server verwendet und ist damit testbar.
 */

export type UpdateChannel = "stable" | "beta" | "development";
export type AutoUpdatePolicy = "manual" | "security_only" | "patch";
export type MaintenanceState = "off" | "updating" | "manual";

/** Ergebnis einer Fähigkeitsprüfung (Capability Proof). */
export type CapabilityStatus = "SUPPORTED" | "SETUP_REQUIRED" | "NOT_SUPPORTED";

export type CapabilityProof = {
  /** Technische Kennung des Adapters, z. B. `github_actions`. */
  provider: string;
  status: CapabilityStatus;
  /** Kurze, sichere Begründung — niemals Secrets. */
  detail: string;
  /** Was der Betreiber tun muss, damit der Adapter SUPPORTED wird. */
  remediation?: string | undefined;
  /** Belege, die zur Laufzeit wirklich geprüft wurden. */
  evidence?: string[] | undefined;
};

export const UPDATE_STEPS = [
  "preflight",
  "backup",
  "code",
  "database",
  "deployment",
  "doctor",
] as const;
export type UpdateStep = (typeof UPDATE_STEPS)[number];

export const UPDATE_STEP_LABELS: Record<UpdateStep, string> = {
  preflight: "Prüfung",
  backup: "Backup",
  code: "Code",
  database: "Datenbank",
  deployment: "Deployment",
  doctor: "Doctor",
};

export type UpdateStepStatus = "pending" | "running" | "passed" | "failed" | "skipped" | "blocked";

export type UpdateRunStatus =
  | "preflight"
  | "ready"
  | "backup_check"
  | "maintenance"
  | "deploying"
  | "migrating"
  | "seeding"
  | "verifying"
  | "completed"
  | "failed"
  | "rolling_back"
  | "rolled_back"
  | "manual_attention";

export const ACTIVE_RUN_STATUSES: UpdateRunStatus[] = [
  "preflight",
  "ready",
  "backup_check",
  "maintenance",
  "deploying",
  "migrating",
  "seeding",
  "verifying",
  "rolling_back",
];

/** Erlaubte Übergänge der Update-Zustandsmaschine. */
export const UPDATE_TRANSITIONS: Record<UpdateRunStatus, UpdateRunStatus[]> = {
  preflight: ["ready", "failed"],
  ready: ["backup_check", "failed"],
  backup_check: ["maintenance", "failed"],
  maintenance: ["deploying", "failed"],
  deploying: ["migrating", "verifying", "failed", "rolling_back"],
  migrating: ["seeding", "verifying", "failed", "rolling_back"],
  seeding: ["verifying", "failed"],
  verifying: ["completed", "failed", "manual_attention"],
  completed: [],
  failed: ["rolling_back", "manual_attention"],
  rolling_back: ["rolled_back", "manual_attention"],
  rolled_back: [],
  manual_attention: [],
};

export function canTransition(from: UpdateRunStatus, to: UpdateRunStatus): boolean {
  return UPDATE_TRANSITIONS[from].includes(to);
}

/** Signiertes Release-Manifest aus der zentralen Registry. */
export type ReleaseManifest = {
  releaseId: string;
  version: string;
  channel: UpdateChannel;
  publishedAt: string;
  /** Mindest-Version, von der aus direkt aktualisiert werden darf. */
  minFromVersion: string;
  /** Schema-Migrationen, die dieses Release mitbringt. */
  migrations: string[];
  /** Erforderliche Seed-Version nach dem Update. */
  seedVersion: number;
  requiresManualStep?: boolean | undefined;
  securityRelease?: boolean | undefined;
  notes?: string | undefined;
  artifact: {
    url: string;
    sha256: string;
    bytes?: number | undefined;
  };
};

export type UpdateRunView = {
  id: string;
  fromVersion: string;
  toVersion: string;
  releaseId: string;
  channel: string;
  status: UpdateRunStatus;
  currentStep: string | null;
  startedAt: string;
  completedAt: string | null;
  deploymentProvider: string | null;
  deploymentReference: string | null;
  migrationProvider: string | null;
  backupReference: string | null;
  errorCode: string | null;
  safeErrorMessage: string | null;
  rollbackStatus: string;
  initiatedByEmail: string | null;
  steps: Array<{
    step: string;
    position: number;
    status: UpdateStepStatus;
    outputSummary: string | null;
    errorCode: string | null;
    startedAt: string | null;
    completedAt: string | null;
  }>;
};

export class UpdateError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "UpdateError";
    this.code = code;
  }
}
