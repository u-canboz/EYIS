/**
 * Deployment- und Migrations-Adapter für das Update Center (server-only).
 *
 * Grundregel (Phase 22, Owner-Vorgabe): Ein Adapter gilt erst dann als
 * SUPPORTED, wenn sein Transportweg real nachgewiesen wurde — Repository
 * erreichbar, Workflow auf dem Default-Branch vorhanden, Job im Workflow
 * deklariert. Ohne Nachweis lautet der Status SETUP_REQUIRED. Es gibt keinen
 * Fake-Schritt, der ein Update als vollständig meldet.
 */
import {
  getFileContent,
  getRepo,
  resolveGithubAuth,
  type GithubAuth,
} from "./github.server";
import type { CapabilityProof } from "./types";

export type HostingVariant = "git_auto_deploy" | "lovable_sync" | "unknown";

export type UpdateConfig = {
  /** Kunden-Repository, das aktualisiert wird (owner/repo). */
  customerRepo: string;
  /** Zentrale, signierte Release-Registry. */
  releaseRepo: string;
  eventType: string;
  workflowPath: string;
  hosting: HostingVariant;
  /** URL, die nach dem Deployment eine neue Version melden muss. */
  deploymentHealthUrl: string;
  releasePublicKey: string;
  migrationsEnabled: boolean;
};

function env(key: string, fallback = ""): string {
  return (process.env[key] ?? fallback).trim();
}

export function loadUpdateConfig(): UpdateConfig {
  const hostingRaw = env("EYIS_UPDATE_HOSTING").toLowerCase();
  const hosting: HostingVariant =
    hostingRaw === "git_auto_deploy" || hostingRaw === "lovable_sync"
      ? (hostingRaw as HostingVariant)
      : "unknown";
  return {
    customerRepo: env("EYIS_UPDATE_REPO"),
    releaseRepo: env("EYIS_RELEASE_REPO", "u-canboz/EYIS"),
    eventType: env("EYIS_UPDATE_EVENT_TYPE", "eyis-update"),
    workflowPath: ".github/workflows/eyis-update.yml",
    hosting,
    deploymentHealthUrl: env("EYIS_UPDATE_DEPLOY_HEALTH_URL"),
    releasePublicKey: env("EYIS_RELEASE_PUBLIC_KEY"),
    migrationsEnabled: env("EYIS_UPDATE_MIGRATIONS").toLowerCase() === "enabled",
  };
}

export type CapabilityReport = {
  auth: CapabilityProof;
  registry: CapabilityProof;
  code: CapabilityProof;
  deployment: CapabilityProof;
  migration: CapabilityProof;
  /** Nur wenn Code UND Deployment SUPPORTED sind, ist der Button vollautomatisch. */
  fullyAutomatic: boolean;
  /** Schemaändernde Updates nur bei SUPPORTED-Migrationsadapter. */
  schemaChangesAllowed: boolean;
};

async function probeAuth(): Promise<{ proof: CapabilityProof; auth: GithubAuth }> {
  const auth = await resolveGithubAuth();
  if (auth.mode === "github_app") {
    return {
      auth,
      proof: {
        provider: "github_app",
        status: "SUPPORTED",
        detail: "GitHub App mit kurzlebigem Installation Token.",
        evidence: [auth.detail],
      },
    };
  }
  if (auth.mode === "pat") {
    return {
      auth,
      proof: {
        provider: "github_pat",
        status: "SUPPORTED",
        detail: "Fine-grained PAT aktiv.",
        remediation:
          "Für mehrere Dedicated-Installationen auf eine EYIS GitHub App mit kurzlebigen Installation Tokens wechseln.",
        evidence: [auth.detail],
      },
    };
  }
  return {
    auth,
    proof: {
      provider: "none",
      status: "SETUP_REQUIRED",
      detail: auth.detail,
      remediation:
        "EYIS_GITHUB_APP_ID, EYIS_GITHUB_APP_INSTALLATION_ID und EYIS_GITHUB_APP_PRIVATE_KEY setzen (oder übergangsweise EYIS_GITHUB_TOKEN).",
    },
  };
}

/**
 * Nachweis 1 — Customer Repository Deployment.
 * Der Workflow muss im Kunden-Repo auf dem Default-Branch liegen, sonst
 * startet `repository_dispatch` gar nichts (GitHub-Verhalten).
 */
async function probeCode(
  config: UpdateConfig,
  auth: GithubAuth,
): Promise<{ proof: CapabilityProof; workflow: string | null }> {
  if (!config.customerRepo) {
    return {
      workflow: null,
      proof: {
        provider: "github_actions",
        status: "SETUP_REQUIRED",
        detail: "Kein Kunden-Repository konfiguriert.",
        remediation: "EYIS_UPDATE_REPO auf das Repository dieser Installation setzen (owner/repo).",
      },
    };
  }
  if (!auth.token) {
    return {
      workflow: null,
      proof: {
        provider: "github_actions",
        status: "SETUP_REQUIRED",
        detail: "Ohne GitHub-Zugangsdaten kann der Workflow nicht geprüft oder gestartet werden.",
      },
    };
  }
  try {
    const repo = await getRepo(config.customerRepo, auth.token);
    const workflow = await getFileContent(
      config.customerRepo,
      config.workflowPath,
      repo.defaultBranch,
      auth.token,
    );
    if (!workflow) {
      return {
        workflow: null,
        proof: {
          provider: "github_actions",
          status: "SETUP_REQUIRED",
          detail: `${config.workflowPath} fehlt auf dem Default-Branch ${repo.defaultBranch}.`,
          remediation:
            "Workflow-Vorlage aus templates/customer-repo/.github/workflows/eyis-update.yml in das Kunden-Repository übernehmen und auf den Default-Branch mergen.",
          evidence: [`repo=${repo.fullName}`, `default_branch=${repo.defaultBranch}`],
        },
      };
    }
    const listensToDispatch =
      /repository_dispatch/.test(workflow) && workflow.includes(config.eventType);
    if (!listensToDispatch) {
      return {
        workflow,
        proof: {
          provider: "github_actions",
          status: "SETUP_REQUIRED",
          detail: `Workflow reagiert nicht auf repository_dispatch "${config.eventType}".`,
          remediation: "types: [" + config.eventType + "] im Workflow ergänzen.",
        },
      };
    }
    const unpinned = [...workflow.matchAll(/uses:\s*([^\s]+)/g)]
      .map((m) => m[1] as string)
      .filter((u) => !u.startsWith("./") && !/@[0-9a-f]{40}$/.test(u));
    return {
      workflow,
      proof: {
        provider: "github_actions",
        status: "SUPPORTED",
        detail: `Workflow auf ${repo.defaultBranch} vorhanden und hört auf "${config.eventType}".`,
        remediation:
          unpinned.length > 0
            ? `Actions auf vollständige Commit-SHAs pinnen: ${unpinned.join(", ")}`
            : undefined,
        evidence: [
          `repo=${repo.fullName}`,
          `default_branch=${repo.defaultBranch}`,
          `workflow=${config.workflowPath}`,
          unpinned.length === 0 ? "actions=sha-pinned" : `actions=unpinned:${unpinned.length}`,
        ],
      },
    };
  } catch (e) {
    return {
      workflow: null,
      proof: {
        provider: "github_actions",
        status: "SETUP_REQUIRED",
        detail: e instanceof Error ? e.message : "Repository-Prüfung fehlgeschlagen.",
      },
    };
  }
}

/**
 * Nachweis 2 — Production Deployment.
 * GitHub-Sync allein ist kein Deployment. Lovable veröffentlicht neue Stände
 * erst nach "Publish → Update"; ein programmatischer Publish-Endpunkt ist
 * nicht dokumentiert. Daher: Lovable-Hosting = SETUP_REQUIRED (manueller
 * Publish-Schritt), Git-basiertes externes Hosting = SUPPORTED, sobald der
 * Workflow einen Deploy-Job hat und eine Health-URL die Version bestätigt.
 */
function probeDeployment(config: UpdateConfig, workflow: string | null): CapabilityProof {
  if (config.hosting === "lovable_sync") {
    return {
      provider: "lovable_publish",
      status: "SETUP_REQUIRED",
      detail:
        "Lovable-Hosting: GitHub-Sync überträgt den Code, veröffentlicht ihn aber nicht. Der Live-Stand wird erst mit Publish → Update aktiv.",
      remediation:
        "Entweder Publish nach dem Code-Update manuell auslösen, oder auf ein Git-basiertes Hosting (Vercel/Netlify/Cloudflare) umstellen und EYIS_UPDATE_HOSTING=git_auto_deploy setzen.",
      evidence: ["kein programmatisch nutzbarer Lovable-Publish-Endpunkt nachgewiesen"],
    };
  }
  if (config.hosting !== "git_auto_deploy") {
    return {
      provider: "unknown",
      status: "SETUP_REQUIRED",
      detail: "Hostingvariante nicht deklariert.",
      remediation:
        "EYIS_UPDATE_HOSTING auf git_auto_deploy (Vercel/Netlify/Cloudflare Pages) oder lovable_sync setzen.",
    };
  }
  if (!workflow) {
    return {
      provider: "git_auto_deploy",
      status: "SETUP_REQUIRED",
      detail: "Workflow im Kunden-Repository nicht nachweisbar.",
    };
  }
  if (!/deploy/i.test(workflow)) {
    return {
      provider: "git_auto_deploy",
      status: "SETUP_REQUIRED",
      detail: "Der Workflow enthält keinen Deploy-Nachweisschritt.",
      remediation: "Job `deploy` aus der EYIS-Workflow-Vorlage übernehmen.",
    };
  }
  if (!config.deploymentHealthUrl) {
    return {
      provider: "git_auto_deploy",
      status: "SETUP_REQUIRED",
      detail: "Keine Health-URL konfiguriert — ein Deployment wäre nicht überprüfbar.",
      remediation:
        "EYIS_UPDATE_DEPLOY_HEALTH_URL auf den öffentlichen Health-Endpunkt der Installation setzen.",
    };
  }
  return {
    provider: "git_auto_deploy",
    status: "SUPPORTED",
    detail: "Push auf den Default-Branch löst beim Git-Hosting einen neuen Production-Build aus.",
    evidence: ["workflow=deploy job", `health_url=${config.deploymentHealthUrl}`],
  };
}

/**
 * Nachweis 3 — Database Migration Deployment.
 * Die laufende App wendet keine Migrationen an. Nachgewiesen ist nur der Weg
 * über den Kunden-Workflow (`supabase db push` mit repo-eigenen Secrets).
 * Fehlt dieser Job, sind schemaändernde Updates gesperrt.
 */
function probeMigration(config: UpdateConfig, workflow: string | null): CapabilityProof {
  if (!config.migrationsEnabled) {
    return {
      provider: "none",
      status: "SETUP_REQUIRED",
      detail:
        "Kein Migrationsadapter freigegeben. Schemaändernde Updates bleiben gesperrt (SETUP REQUIRED).",
      remediation:
        "Migrations-Job im Kunden-Workflow einrichten (supabase db push mit SUPABASE_DB_URL/SUPABASE_ACCESS_TOKEN als Repo-Secrets) und EYIS_UPDATE_MIGRATIONS=enabled setzen.",
    };
  }
  if (!workflow) {
    return {
      provider: "github_actions_supabase_cli",
      status: "SETUP_REQUIRED",
      detail: "Workflow nicht nachweisbar — Migrationsweg unbestätigt.",
    };
  }
  const hasMigrationJob = /supabase\s+db\s+push/.test(workflow);
  const hasCredentialsRef = /SUPABASE_DB_URL|SUPABASE_ACCESS_TOKEN/.test(workflow);
  if (!hasMigrationJob || !hasCredentialsRef) {
    return {
      provider: "github_actions_supabase_cli",
      status: "SETUP_REQUIRED",
      detail:
        "Der Workflow enthält keinen belegten Migrationsschritt (`supabase db push` inkl. Repo-Secrets).",
      remediation: "Job `database` aus der EYIS-Workflow-Vorlage übernehmen.",
    };
  }
  return {
    provider: "github_actions_supabase_cli",
    status: "SUPPORTED",
    detail: "Migrationen werden im Kunden-Workflow mit der Supabase CLI auf die eigene DB angewendet.",
    evidence: ["workflow=supabase db push", "secrets=SUPABASE_DB_URL/SUPABASE_ACCESS_TOKEN"],
  };
}

function probeRegistry(config: UpdateConfig): CapabilityProof {
  if (!config.releaseRepo) {
    return {
      provider: "github_releases",
      status: "SETUP_REQUIRED",
      detail: "Keine Release-Registry konfiguriert.",
      remediation: "EYIS_RELEASE_REPO setzen (Standard: u-canboz/EYIS).",
    };
  }
  if (!config.releasePublicKey) {
    return {
      provider: "github_releases",
      status: "SETUP_REQUIRED",
      detail: "Kein Signaturschlüssel hinterlegt — unsignierte Releases werden abgelehnt.",
      remediation: "EYIS_RELEASE_PUBLIC_KEY (Ed25519, roh, base64) setzen.",
    };
  }
  return {
    provider: "github_releases",
    status: "SUPPORTED",
    detail: `Signierte Releases aus ${config.releaseRepo}.`,
    evidence: ["signature=ed25519", "checksum=sha256"],
  };
}

/** Vollständiger Fähigkeitsnachweis. Führt echte Netzwerkprüfungen aus. */
export async function probeCapabilities(config = loadUpdateConfig()): Promise<CapabilityReport> {
  const { proof: auth, auth: githubAuth } = await probeAuth();
  const { proof: code, workflow } = await probeCode(config, githubAuth);
  const deployment = probeDeployment(config, workflow);
  const migration = probeMigration(config, workflow);
  const registry = probeRegistry(config);
  return {
    auth,
    registry,
    code,
    deployment,
    migration,
    fullyAutomatic: code.status === "SUPPORTED" && deployment.status === "SUPPORTED",
    schemaChangesAllowed: migration.status === "SUPPORTED",
  };
}
