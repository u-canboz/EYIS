/**
 * Semantische Versionen und Kanal-Regeln für das Update Center.
 * Rein funktional, keine Server-Abhängigkeiten.
 */
import type { AutoUpdatePolicy, ReleaseManifest, UpdateChannel } from "./types";

export type ParsedVersion = { major: number; minor: number; patch: number; pre: string | null };

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

export function parseVersion(input: string): ParsedVersion | null {
  const m = SEMVER.exec(input.trim().replace(/^v/, ""));
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    pre: m[4] ?? null,
  };
}

/** -1 = a < b, 0 = gleich, 1 = a > b. Wirft bei ungültiger Version. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) throw new Error(`Ungültige Version: ${!pa ? a : b}`);
  for (const key of ["major", "minor", "patch"] as const) {
    if (pa[key] !== pb[key]) return pa[key] < pb[key] ? -1 : 1;
  }
  if (pa.pre === pb.pre) return 0;
  // Ein Prerelease ist immer kleiner als das finale Release.
  if (pa.pre && !pb.pre) return -1;
  if (!pa.pre && pb.pre) return 1;
  return (pa.pre as string) < (pb.pre as string) ? -1 : 1;
}

export function isNewer(candidate: string, installed: string): boolean {
  return compareVersions(candidate, installed) > 0;
}

/** Welche Kanäle darf eine Installation im gewählten Kanal sehen? */
export function channelsFor(channel: UpdateChannel): UpdateChannel[] {
  if (channel === "development") return ["stable", "beta", "development"];
  if (channel === "beta") return ["stable", "beta"];
  return ["stable"];
}

export type UpgradeType = "patch" | "minor" | "major";

export function upgradeType(from: string, to: string): UpgradeType {
  const a = parseVersion(from);
  const b = parseVersion(to);
  if (!a || !b) throw new Error("Ungültige Version");
  if (a.major !== b.major) return "major";
  if (a.minor !== b.minor) return "minor";
  return "patch";
}

/**
 * Wählt das passende Release. Regeln:
 *  - nur Releases im erlaubten Kanal
 *  - nur neuere Versionen
 *  - `minFromVersion` muss erfüllt sein (sonst Zwischenupdate nötig)
 */
export function selectCandidate(
  releases: ReleaseManifest[],
  installedVersion: string,
  channel: UpdateChannel,
): { candidate: ReleaseManifest | null; blockedBy: ReleaseManifest | null } {
  const allowed = new Set(channelsFor(channel));
  const newer = releases
    .filter((r) => allowed.has(r.channel) && isNewer(r.version, installedVersion))
    .sort((a, b) => compareVersions(a.version, b.version));
  if (newer.length === 0) return { candidate: null, blockedBy: null };

  // Nächstes anwendbares Release (Kettenupdate statt Sprung).
  for (const release of newer) {
    if (compareVersions(installedVersion, release.minFromVersion) >= 0) {
      return { candidate: release, blockedBy: null };
    }
  }
  return { candidate: null, blockedBy: newer[newer.length - 1] ?? null };
}

/** Darf dieses Release ohne Klick automatisch laufen? */
export function isAutoUpdateAllowed(
  policy: AutoUpdatePolicy,
  from: string,
  release: ReleaseManifest,
): boolean {
  if (policy === "manual") return false;
  if (release.migrations.length > 0 || release.requiresManualStep) return false;
  const type = upgradeType(from, release.version);
  if (policy === "security_only") return Boolean(release.securityRelease) && type === "patch";
  return type === "patch";
}

// ---------------------------------------------------------------------------
// Installations-Auflösung: RC vs. Stable (Phase 27)
// ---------------------------------------------------------------------------

export type ReleaseResolution =
  | { status: "PASS"; release: ReleaseManifest; reason: string }
  | { status: "BLOCKED"; release: null; reason: string };

/** Sieht die Referenz wie ein Release Candidate aus (v1.0.0-rc.1)? */
export function isReleaseCandidateRef(ref: string): boolean {
  return /-rc\.\d+$/.test(ref.trim().replace(/^v/, ""));
}

/**
 * Bestimmt, welches signierte Release installiert wird.
 *
 * - ohne Referenz: neuestes signiertes **Stable**;
 * - mit RC-Referenz: genau dieser signierte Pre-Release;
 * - kein Stable vorhanden: BLOCKED — es gibt keinen Rückfall auf einen RC
 *   oder auf `main`;
 * - ein RC wird in Production nie automatisch installiert.
 */
export function resolveInstallCandidate(
  releases: ReleaseManifest[],
  options: { requestedRef?: string | null; environment?: string } = {},
): ReleaseResolution {
  const requested = options.requestedRef?.trim();
  const isProduction = (options.environment ?? "").toLowerCase() === "production";

  if (requested) {
    const wanted = requested.replace(/^v/, "");
    const match = releases.find((r) => r.version.replace(/^v/, "") === wanted);
    if (!match) {
      return {
        status: "BLOCKED",
        release: null,
        reason: `Kein signiertes Release ${requested} in der Registry.`,
      };
    }
    if (isReleaseCandidateRef(wanted) && isProduction) {
      return {
        status: "BLOCKED",
        release: null,
        reason: `Release Candidate ${requested} wird in Production nicht installiert.`,
      };
    }
    return { status: "PASS", release: match, reason: `Ausdrücklich angefordert: ${requested}.` };
  }

  const stable = releases
    .filter((r) => r.channel === "stable" && !parseVersion(r.version)?.pre)
    .sort((a, b) => compareVersions(a.version, b.version));
  const latest = stable[stable.length - 1];
  if (!latest) {
    return {
      status: "BLOCKED",
      release: null,
      reason: "Kein signiertes Stable-Release vorhanden — kein Rückfall auf RC oder main.",
    };
  }
  return { status: "PASS", release: latest, reason: `Neuestes Stable: ${latest.version}.` };
}
