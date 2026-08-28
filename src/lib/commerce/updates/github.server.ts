/**
 * GitHub-Transport für das Update Center (server-only).
 *
 * Auth-Reihenfolge:
 *  1. GitHub App (bevorzugt): kurzlebiger Installation Token, auf genau ein
 *     Repository und minimale Rechte begrenzt.
 *  2. Fine-grained PAT (Übergang, für wenige Installationen).
 *
 * Tokens werden nie geloggt, nie zurückgegeben und nie persistiert.
 */
import { UpdateError } from "./types";

const API = "https://api.github.com";

export type GithubAuthMode = "github_app" | "pat" | "none";

export type GithubAuth = {
  mode: GithubAuthMode;
  /** Nur intern; niemals nach aussen geben. */
  token: string | null;
  detail: string;
};

function env(key: string): string {
  return (process.env[key] ?? "").trim();
}

function b64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** App-JWT (RS256, max. 10 Minuten) für die GitHub App. */
async function createAppJwt(appId: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = b64url(
    new TextEncoder().encode(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId })),
  );
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(privateKeyPem) as unknown as BufferSource,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(data) as unknown as BufferSource,
  );
  return `${data}.${b64url(new Uint8Array(sig))}`;
}

/** Ermittelt einen nutzbaren Token für Schreibzugriffe auf das Kunden-Repo. */
export async function resolveGithubAuth(): Promise<GithubAuth> {
  const appId = env("EYIS_GITHUB_APP_ID");
  const installationId = env("EYIS_GITHUB_APP_INSTALLATION_ID");
  const privateKey = env("EYIS_GITHUB_APP_PRIVATE_KEY");
  if (appId && installationId && privateKey) {
    const jwt = await createAppJwt(appId, privateKey.replace(/\\n/g, "\n"));
    const res = await fetch(`${API}/app/installations/${installationId}/access_tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!res.ok) {
      return {
        mode: "none",
        token: null,
        detail: `GitHub-App-Token konnte nicht ausgestellt werden (HTTP ${res.status}).`,
      };
    }
    const body = (await res.json()) as { token: string; expires_at: string };
    return {
      mode: "github_app",
      token: body.token,
      detail: `GitHub App Installation Token (gültig bis ${body.expires_at}).`,
    };
  }
  const pat = env("EYIS_GITHUB_TOKEN");
  if (pat) {
    return {
      mode: "pat",
      token: pat,
      detail: "Fine-grained Personal Access Token (Übergangslösung, GitHub App empfohlen).",
    };
  }
  return { mode: "none", token: null, detail: "Keine GitHub-Zugangsdaten konfiguriert." };
}

async function ghFetch(path: string, token: string | null, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "eyis-update-center",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${API}${path}`, { ...init, headers });
}

export type RepoInfo = { fullName: string; defaultBranch: string; private: boolean };

export async function getRepo(repo: string, token: string | null): Promise<RepoInfo> {
  const res = await ghFetch(`/repos/${repo}`, token);
  if (!res.ok) {
    throw new UpdateError(
      "GITHUB_REPO_UNREACHABLE",
      `Repository ${repo} nicht erreichbar (HTTP ${res.status}).`,
    );
  }
  const body = (await res.json()) as { full_name: string; default_branch: string; private: boolean };
  return { fullName: body.full_name, defaultBranch: body.default_branch, private: body.private };
}

/** Liest eine Datei vom Default-Branch. `null`, wenn sie nicht existiert. */
export async function getFileContent(
  repo: string,
  path: string,
  ref: string,
  token: string | null,
): Promise<string | null> {
  const res = await ghFetch(
    `/repos/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`,
    token,
    { headers: { Accept: "application/vnd.github.raw+json" } },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new UpdateError(
      "GITHUB_FILE_UNREACHABLE",
      `Datei ${path} konnte nicht gelesen werden (HTTP ${res.status}).`,
    );
  }
  return res.text();
}

/** Startet den Update-Workflow im Kunden-Repository. */
export async function dispatchRepositoryEvent(
  repo: string,
  eventType: string,
  payload: Record<string, unknown>,
  token: string | null,
): Promise<void> {
  const res = await ghFetch(`/repos/${repo}/dispatches`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_type: eventType, client_payload: payload }),
  });
  if (res.status !== 204) {
    throw new UpdateError(
      "DISPATCH_FAILED",
      `repository_dispatch an ${repo} fehlgeschlagen (HTTP ${res.status}).`,
    );
  }
}

export type WorkflowRun = {
  id: number;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  createdAt: string;
  displayTitle: string;
};

/** Findet den Workflow-Lauf, der zu einem Update-Lauf gehört. */
export async function findWorkflowRun(
  repo: string,
  correlationId: string,
  token: string | null,
  since: string,
): Promise<WorkflowRun | null> {
  const res = await ghFetch(
    `/repos/${repo}/actions/runs?event=repository_dispatch&per_page=30&created=%3E%3D${since.slice(0, 10)}`,
    token,
  );
  if (!res.ok) return null;
  const body = (await res.json()) as {
    workflow_runs: Array<{
      id: number;
      status: string;
      conclusion: string | null;
      html_url: string;
      created_at: string;
      display_title: string;
      name?: string;
    }>;
  };
  const match = body.workflow_runs.find(
    (r) => r.display_title?.includes(correlationId) || r.name?.includes(correlationId),
  );
  const chosen = match ?? body.workflow_runs[0];
  if (!chosen) return null;
  return {
    id: chosen.id,
    status: chosen.status,
    conclusion: chosen.conclusion,
    htmlUrl: chosen.html_url,
    createdAt: chosen.created_at,
    displayTitle: chosen.display_title,
  };
}

export async function getWorkflowRun(
  repo: string,
  runId: number,
  token: string | null,
): Promise<WorkflowRun | null> {
  const res = await ghFetch(`/repos/${repo}/actions/runs/${runId}`, token);
  if (!res.ok) return null;
  const r = (await res.json()) as {
    id: number;
    status: string;
    conclusion: string | null;
    html_url: string;
    created_at: string;
    display_title: string;
  };
  return {
    id: r.id,
    status: r.status,
    conclusion: r.conclusion,
    htmlUrl: r.html_url,
    createdAt: r.created_at,
    displayTitle: r.display_title,
  };
}

/** Jobs eines Laufs — belegt, ob Code, Migration und Deployment wirklich liefen. */
export async function getWorkflowJobs(
  repo: string,
  runId: number,
  token: string | null,
): Promise<Array<{ name: string; status: string; conclusion: string | null }>> {
  const res = await ghFetch(`/repos/${repo}/actions/runs/${runId}/jobs?per_page=50`, token);
  if (!res.ok) return [];
  const body = (await res.json()) as {
    jobs: Array<{
      name: string;
      status: string;
      conclusion: string | null;
      steps?: Array<{ name: string; status: string; conclusion: string | null }>;
    }>;
  };
  const out: Array<{ name: string; status: string; conclusion: string | null }> = [];
  for (const job of body.jobs) {
    out.push({ name: job.name, status: job.status, conclusion: job.conclusion });
    for (const step of job.steps ?? []) {
      out.push({ name: `${job.name} / ${step.name}`, status: step.status, conclusion: step.conclusion });
    }
  }
  return out;
}

export type ReleaseAsset = { name: string; url: string; browserUrl: string; size: number };
export type GithubRelease = {
  tag: string;
  name: string;
  draft: boolean;
  prerelease: boolean;
  publishedAt: string;
  assets: ReleaseAsset[];
};

export async function listReleases(repo: string, token: string | null): Promise<GithubRelease[]> {
  const res = await ghFetch(`/repos/${repo}/releases?per_page=20`, token);
  if (!res.ok) {
    throw new UpdateError(
      "REGISTRY_UNREACHABLE",
      `Release-Registry ${repo} nicht erreichbar (HTTP ${res.status}).`,
    );
  }
  const body = (await res.json()) as Array<{
    tag_name: string;
    name: string;
    draft: boolean;
    prerelease: boolean;
    published_at: string;
    assets: Array<{ name: string; url: string; browser_download_url: string; size: number }>;
  }>;
  return body.map((r) => ({
    tag: r.tag_name,
    name: r.name,
    draft: r.draft,
    prerelease: r.prerelease,
    publishedAt: r.published_at,
    assets: (r.assets ?? []).map((a) => ({
      name: a.name,
      url: a.url,
      browserUrl: a.browser_download_url,
      size: a.size,
    })),
  }));
}

export async function downloadAssetText(url: string, token: string | null): Promise<string> {
  const res = await ghFetch(url.replace(API, ""), token, {
    headers: { Accept: "application/octet-stream" },
  });
  if (!res.ok) {
    throw new UpdateError("ASSET_UNREACHABLE", `Release-Asset nicht lesbar (HTTP ${res.status}).`);
  }
  return res.text();
}
