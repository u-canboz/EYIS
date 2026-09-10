/** Normalizes the signed artifact format and the original Update Center format. */
import { z } from "zod";
import { parseVersion } from "./versions";
import { UpdateError, type ReleaseManifest } from "./types";

const version = z.string().refine((value) => parseVersion(value) !== null, "Ungültige Version");
const schema = z.object({
  version,
  channel: z.enum(["stable", "beta", "development", "prerelease"]),
  releaseId: z.string().min(1).optional(),
  publishedAt: z.string().datetime().optional(),
  minFromVersion: version.optional(),
  seedVersion: z.number().int().nonnegative().optional(),
  migrations: z.array(z.string().min(1)).optional(),
  requiresManualStep: z.boolean().optional(),
  securityRelease: z.boolean().optional(),
  notes: z.string().optional(),
  artifact: z.object({
    name: z.string().optional(),
    url: z.string().url().optional(),
    sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
    bytes: z.number().int().positive().optional(),
  }),
  files: z.array(z.object({ path: z.string() })).optional(),
});

type ReleaseSource = {
  tag: string;
  publishedAt: string;
  assets: Array<{ name: string; browserUrl: string; size: number }>;
};

export function parseSignedManifest(raw: string, source: ReleaseSource): ReleaseManifest {
  const parsed = schema.safeParse(JSON.parse(raw));
  if (!parsed.success)
    throw new UpdateError(
      "MANIFEST_INVALID",
      "Signiertes Release-Manifest hat ein ungültiges Format.",
    );
  const data = parsed.data;
  if (source.tag.replace(/^v/, "") !== data.version.replace(/^v/, "")) {
    throw new UpdateError(
      "RELEASE_VERSION_MISMATCH",
      "Release-Tag und signierte Version stimmen nicht überein.",
    );
  }
  const asset = source.assets.find(
    (a) => a.name === data.artifact.name || a.browserUrl === data.artifact.url,
  );
  if (!asset || (data.artifact.bytes !== undefined && data.artifact.bytes !== asset.size)) {
    throw new UpdateError(
      "ARTIFACT_NOT_FOUND",
      "Das signierte Artefakt ist im Release nicht vorhanden oder hat eine andere Größe.",
    );
  }
  const channel = data.channel === "prerelease" ? "beta" : data.channel;
  if (channel === "stable" && parseVersion(data.version)?.pre) {
    throw new UpdateError(
      "RELEASE_CHANNEL_MISMATCH",
      "Ein Prerelease darf nicht als Stable angeboten werden.",
    );
  }
  // Legacy packs lack an upgrade contract. They remain discoverable, but require
  // an operator until compatibility, migrations and seeds are explicitly signed.
  const legacy =
    data.minFromVersion === undefined ||
    data.seedVersion === undefined ||
    data.migrations === undefined;
  return {
    releaseId: data.releaseId ?? source.tag,
    manifestUrl: source.assets.find((a) => a.name === "eyis-release.json")?.browserUrl,
    signatureUrl: source.assets.find((a) => a.name === "eyis-release.json.sig")?.browserUrl,
    version: data.version,
    channel,
    publishedAt: data.publishedAt ?? source.publishedAt,
    minFromVersion: data.minFromVersion ?? "0.0.0-0",
    migrations:
      data.migrations ??
      (data.files ?? []).map((f) => f.path).filter((p) => p.startsWith("supabase/migrations/")),
    seedVersion: data.seedVersion ?? 0,
    requiresManualStep: legacy || data.requiresManualStep === true,
    securityRelease: data.securityRelease ?? false,
    notes:
      data.notes ??
      (legacy
        ? "Älteres Installationspaket ohne signierten Upgrade-Vertrag. Betreutes Update erforderlich."
        : undefined),
    artifact: { url: asset.browserUrl, sha256: data.artifact.sha256, bytes: asset.size },
  };
}
