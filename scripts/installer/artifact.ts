/**
 * Deterministischer Release-Artefakt-Builder (Phase 27).
 *
 * Erzeugt aus dem Distribution-Manifest, dem Database Pack und den benötigten
 * Installer-Skripten ein reproduzierbares `eyis-dedicated-<version>.tar.gz`
 * plus ein Artefakt-Manifest `eyis-release.json`.
 *
 * Grundregeln:
 * - Nur Kategorie `install` plus ausdrücklich gelistete Installer-Skripte.
 *   Marketing-Routen, Reference-Storefront, Demo-Assets, QA, Docs, `.env`,
 *   customer_owned, generated und optional sind ausgeschlossen.
 * - Fehlt eine erwartete Datei: harter Abbruch (PACK COMPLETENESS: FAIL).
 * - Feste Sortierung, fixe mtime/uid/gid und fixes Gzip-Header-Feld —
 *   zweimaliges Bauen liefert denselben SHA-256.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

export const ROOT = process.cwd();
export const ARTIFACT_DIR = join(ROOT, "installer", "artifact");

const EXTRA_FILES = [
  "scripts/installer/runner.ts",
  "scripts/installer/signature.ts",
  "scripts/installer/route-contract.ts",
  "scripts/installer/seeds.ts",
  "scripts/installer/system-seeds.ts",
  "scripts/installer/fingerprint.ts",
  "scripts/installer/migration-history.ts",
  "scripts/installer/introspect.ts",
  "scripts/eyis-install.ts",
  "scripts/eyis-seeds.ts",
  "scripts/eyis-resources.ts",
  "scripts/eyis-pack-signature.ts",
];

/** Pfade, die niemals in ein Artefakt gelangen dürfen. */
const FORBIDDEN = [
  /^\.env/,
  /^qa\//,
  /^docs\//,
  /^public\/demo-assets\//,
  /^src\/routes\/index\.tsx$/,
  /^src\/routes\/entwickler\.tsx$/,
  /^src\/routes\/dokumentation/,
  /^src\/components\/site\//,
  /^src\/routes\/store\//,
  /^src\/routes\/portal\//,
  /^src\/eyis\/portal\//,
  /^src\/routeTree\.gen\.ts$/,
  /^src\/integrations\/lovable\//,
  /^src\/integrations\/supabase\/(?!cron-auth)/,
  /^src\/styles\.css$/,
  /^src\/routes\/__root\.tsx$/,
  /^templates\//,
  /\/__tests__\//,
];

type DistManifest = { version: string; install: string[] };

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      walk(full, out);
    } else {
      out.push(relative(ROOT, full));
    }
  }
  return out;
}

function expand(pattern: string): string[] {
  if (pattern.endsWith("/**")) {
    const base = join(ROOT, pattern.slice(0, -3));
    if (!existsSync(base)) throw new Error(`PACK COMPLETENESS: FAIL — ${pattern} existiert nicht.`);
    return walk(base);
  }
  if (!existsSync(join(ROOT, pattern))) {
    throw new Error(`PACK COMPLETENESS: FAIL — ${pattern} existiert nicht.`);
  }
  return [pattern];
}

/** Alle Dateien des Artefakts, deterministisch sortiert. */
export function artifactFiles(): string[] {
  const dist = JSON.parse(
    readFileSync(join(ROOT, "installer", "distribution", "eyis-code-distribution.manifest.json"), "utf8"),
  ) as DistManifest;
  const files = new Set<string>();
  for (const pattern of dist.install) for (const f of expand(pattern)) files.add(f);
  for (const extra of EXTRA_FILES) for (const f of expand(extra)) files.add(f);

  const list = [...files].filter((f) => !FORBIDDEN.some((re) => re.test(f))).sort();
  if (list.length === 0) throw new Error("PACK COMPLETENESS: FAIL — leeres Artefakt.");
  return list;
}

// ---------------------------------------------------------------- tar (ustar)

function tarHeader(path: string, size: number): Buffer {
  const header = Buffer.alloc(512);
  if (Buffer.byteLength(path) > 100) throw new Error(`Pfad zu lang für tar: ${path}`);
  header.write(path, 0, 100, "utf8");
  header.write("0000644\0", 100, 8, "ascii"); // mode
  header.write("0000000\0", 108, 8, "ascii"); // uid
  header.write("0000000\0", 116, 8, "ascii"); // gid
  header.write(`${size.toString(8).padStart(11, "0")}\0`, 124, 12, "ascii");
  header.write("00000000000\0", 136, 12, "ascii"); // mtime = epoch (deterministisch)
  header.write("        ", 148, 8, "ascii"); // checksum placeholder
  header.write("0", 156, 1, "ascii"); // type: file
  header.write("ustar\x0000", 257, 8, "ascii");
  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");
  return header;
}

function buildTar(files: string[]): Buffer {
  const chunks: Buffer[] = [];
  for (const file of files) {
    const data = readFileSync(join(ROOT, file));
    chunks.push(tarHeader(file, data.length), data);
    const pad = (512 - (data.length % 512)) % 512;
    if (pad) chunks.push(Buffer.alloc(pad));
  }
  chunks.push(Buffer.alloc(1024)); // Endblöcke
  return Buffer.concat(chunks);
}

const sha256 = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

export type ArtifactResult = {
  version: string;
  channel: "stable" | "rc";
  files: { path: string; bytes: number; sha256: string }[];
  tarball: string;
  tarballSha256: string;
  manifestPath: string;
  manifestSha256: string;
  bytes: number;
};

export function buildArtifact(version: string, opts: { write: boolean } = { write: true }): ArtifactResult {
  const files = artifactFiles();
  const entries = files.map((path) => {
    const data = readFileSync(join(ROOT, path));
    return { path, bytes: data.length, sha256: sha256(data) };
  });
  const tar = buildTar(files);
  // mtime: 0 hält das Gzip-Ergebnis deterministisch; die Option ist zur Laufzeit
  // gültig, fehlt aber in den ZlibOptions-Typen.
  const gz = gzipSync(tar, { level: 9, mtime: 0 } as unknown as { level: number });

  const installer = JSON.parse(
    readFileSync(join(ROOT, "installer", "database", "eyis-database-installer.manifest.json"), "utf8"),
  ) as { version: string; schema_version: string; fresh_install: { units: unknown[] } };
  const seeds = JSON.parse(
    readFileSync(join(ROOT, "installer", "database", "seeds", "eyis-system-seeds.manifest.json"), "utf8"),
  ) as { system_seed_fingerprint: string };
  const fingerprint = JSON.parse(
    readFileSync(join(ROOT, "installer", "database", "verification", "fingerprint.json"), "utf8"),
  ) as Record<string, unknown>;
  const anchor = JSON.parse(
    readFileSync(join(ROOT, "installer", "distribution", "eyis-trust-anchor.json"), "utf8"),
  ) as { keys: { key_id: string; status?: string }[] };
  const activeKey = (anchor.keys ?? []).find((k) => (k.status ?? "active") === "active");

  const manifest = {
    manifest: "eyis-release",
    version,
    channel: version.includes("-rc.") ? "rc" : "stable",
    commit: process.env["GITHUB_SHA"] ?? "local",
    generated_at: process.env["EYIS_RELEASE_TIMESTAMP"] ?? "deterministic",
    pack_version: installer.version,
    schema_version: installer.schema_version,
    baseline_units: installer.fresh_install.units.length,
    schema_fingerprint: (fingerprint["schema_fingerprint"] as string) ?? null,
    system_seed_fingerprint: seeds.system_seed_fingerprint,
    key_id: activeKey?.key_id ?? null,
    file_count: entries.length,
    artifact: { name: `eyis-dedicated-${version}.tar.gz`, bytes: gz.length, sha256: sha256(gz) },
    files: entries,
  };
  const manifestRaw = `${JSON.stringify(manifest, null, 2)}\n`;

  const tarball = join(ARTIFACT_DIR, `eyis-dedicated-${version}.tar.gz`);
  const manifestPath = join(ARTIFACT_DIR, "eyis-release.json");
  if (opts.write) {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(tarball, gz);
    writeFileSync(manifestPath, manifestRaw, "utf8");
  }

  return {
    version,
    channel: manifest.channel as "stable" | "rc",
    files: entries,
    tarball,
    tarballSha256: manifest.artifact.sha256,
    manifestPath,
    manifestSha256: sha256(manifestRaw),
    bytes: gz.length,
  };
}
