/**
 * Release Registry (server-only).
 *
 * Das zentrale EYIS-Repository liefert ausschliesslich signierte Releases:
 * je Release ein `eyis-release.json` plus `eyis-release.json.sig` (Ed25519).
 * Nur Manifeste mit gültiger Signatur werden angenommen.
 */
import { listReleases, downloadAssetText, resolveGithubAuth } from "./github.server";
import { verifyManifestSignature } from "./signature";
import { UpdateError, type ReleaseManifest, type UpdateChannel } from "./types";
import { loadUpdateConfig, type UpdateConfig } from "./providers.server";
import { resolveInstallCandidate, type ReleaseResolution } from "./versions";

const MANIFEST_ASSET = "eyis-release.json";
const SIGNATURE_ASSET = "eyis-release.json.sig";

function parseManifest(raw: string): ReleaseManifest {
  const data = JSON.parse(raw) as Partial<ReleaseManifest>;
  const required: Array<keyof ReleaseManifest> = [
    "releaseId",
    "version",
    "channel",
    "publishedAt",
    "minFromVersion",
    "seedVersion",
    "artifact",
  ];
  for (const key of required) {
    if (data[key] == null) {
      throw new UpdateError("MANIFEST_INVALID", `Release-Manifest unvollständig: ${String(key)} fehlt.`);
    }
  }
  const channel = data.channel as UpdateChannel;
  if (!["stable", "beta", "development"].includes(channel)) {
    throw new UpdateError("MANIFEST_INVALID", `Unbekannter Release-Kanal "${channel}".`);
  }
  return {
    releaseId: String(data.releaseId),
    version: String(data.version),
    channel,
    publishedAt: String(data.publishedAt),
    minFromVersion: String(data.minFromVersion),
    migrations: Array.isArray(data.migrations) ? data.migrations.map(String) : [],
    seedVersion: Number(data.seedVersion),
    requiresManualStep: Boolean(data.requiresManualStep),
    securityRelease: Boolean(data.securityRelease),
    notes: data.notes ? String(data.notes) : undefined,
    artifact: {
      url: String(data.artifact?.url ?? ""),
      sha256: String(data.artifact?.sha256 ?? ""),
      bytes: data.artifact?.bytes ? Number(data.artifact.bytes) : undefined,
    },
  };
}

export type RegistryResult = {
  releases: ReleaseManifest[];
  rejected: Array<{ tag: string; reason: string }>;
};

/** Lädt und verifiziert alle Release-Manifeste der Registry. */
export async function fetchSignedReleases(
  config: UpdateConfig = loadUpdateConfig(),
): Promise<RegistryResult> {
  if (!config.releasePublicKey) {
    throw new UpdateError(
      "REGISTRY_SETUP_REQUIRED",
      "Kein Release-Signaturschlüssel konfiguriert — Releases können nicht verifiziert werden.",
    );
  }
  const auth = await resolveGithubAuth();
  const raw = await listReleases(config.releaseRepo, auth.token);
  const releases: ReleaseManifest[] = [];
  const rejected: Array<{ tag: string; reason: string }> = [];

  for (const release of raw) {
    if (release.draft) continue;
    const manifestAsset = release.assets.find((a) => a.name === MANIFEST_ASSET);
    const signatureAsset = release.assets.find((a) => a.name === SIGNATURE_ASSET);
    if (!manifestAsset || !signatureAsset) {
      rejected.push({ tag: release.tag, reason: "Manifest oder Signatur fehlt." });
      continue;
    }
    try {
      const manifestRaw = await downloadAssetText(manifestAsset.url, auth.token);
      const signature = (await downloadAssetText(signatureAsset.url, auth.token)).trim();
      await verifyManifestSignature(manifestRaw, signature, config.releasePublicKey);
      releases.push(parseManifest(manifestRaw));
    } catch (e) {
      rejected.push({
        tag: release.tag,
        reason: e instanceof Error ? e.message : "Verifikation fehlgeschlagen.",
      });
    }
  }
  return { releases, rejected };
}

/**
 * Auflösung für eine Installation: holt die signierten Releases und wählt
 * daraus nach den Regeln aus `versions.ts` aus. Ohne signierten Stable-Release
 * gibt es kein Ergebnis — kein Fallback auf `main`, kein unsigniertes Pack.
 */
export async function resolveInstallRelease(options: {
  requestedRef?: string | null;
  environment?: string;
  config?: UpdateConfig;
}): Promise<{ resolution: ReleaseResolution; rejected: Array<{ tag: string; reason: string }> }> {
  const { releases, rejected } = await fetchSignedReleases(options.config ?? loadUpdateConfig());
  const resolution = resolveInstallCandidate(releases, {
    requestedRef: options.requestedRef ?? null,
    environment: options.environment ?? process.env["APP_ENV"] ?? "",
  });
  return { resolution, rejected };
}
