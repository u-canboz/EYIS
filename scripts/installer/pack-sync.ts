/**
 * Pack-Sync-Gate — verhindert einen veralteten Fresh-Install-Pack.
 *
 * Der im Blackbox-Test aufgetretene Defekt war: `supabase/migrations/**` enthielt
 * Migrationen, die im Fresh Installer nicht repräsentiert waren. Ein Fresh Install
 * hätte damit ein älteres Schema erzeugt als eine Upgrade-Installation.
 *
 * Die Prüfung ist bewusst dynamisch: sie kennt keine feste Anzahl von Migrationen,
 * sondern vergleicht die tatsächliche Migrationsmenge mit dem, was das Manifest
 * beschreibt — über Versionsliste, `schema_version`, `migration_head` und einen
 * deterministischen Fingerprint über alle Migrationsinhalte.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const REPO_ROOT = process.cwd();
export const MIGRATIONS_DIR = join(REPO_ROOT, "supabase", "migrations");
export const MANIFEST_PATH = join(
  REPO_ROOT,
  "installer",
  "database",
  "eyis-database-installer.manifest.json",
);

export type MigrationFile = { version: string; file: string; sha256: string };

export type PackManifest = {
  version: string;
  schema_version: string;
  migration_head: string;
  migration_versions: string[];
  migration_set_fingerprint?: string;
  fresh_install: { units: { id: string; file: string; checksum: string }[] };
};

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Alle Migrationsdateien in kanonischer Reihenfolge (Version = Dateipräfix). */
export function readMigrations(dir: string = MIGRATIONS_DIR): MigrationFile[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((file) => ({
      version: file.split("_")[0] ?? file.replace(/\.sql$/, ""),
      file,
      sha256: sha256(readFileSync(join(dir, file))),
    }));
}

/**
 * Deterministischer Fingerprint der gesamten Migrationsmenge.
 * Ändert sich bei jeder neuen, entfernten oder inhaltlich geänderten Migration —
 * nicht nur bei einer anderen Dateianzahl.
 */
export function migrationSetFingerprint(migrations: MigrationFile[] = readMigrations()): string {
  return sha256(
    JSON.stringify(migrations.map((m) => [m.version, m.sha256])),
  );
}

export function readPackManifest(path: string = MANIFEST_PATH): PackManifest {
  return JSON.parse(readFileSync(path, "utf8")) as PackManifest;
}

export type SyncResult = {
  status: "PASS" | "FAIL";
  problems: string[];
  newestMigration: string | null;
  packSchemaVersion: string;
  migrationCount: number;
  packMigrationCount: number;
  expectedFingerprint: string;
  packFingerprint: string | null;
};

/** Vergleicht Migrationskette und Fresh-Install-Pack. Abweichung = FAIL. */
export function checkPackSync(
  migrations: MigrationFile[] = readMigrations(),
  manifest: PackManifest = readPackManifest(),
): SyncResult {
  const problems: string[] = [];
  const newest = migrations.at(-1)?.version ?? null;
  const expected = migrationSetFingerprint(migrations);
  const packVersions = new Set(manifest.migration_versions ?? []);

  const missing = migrations.filter((m) => !packVersions.has(m.version)).map((m) => m.version);
  const unknown = (manifest.migration_versions ?? []).filter(
    (v) => !migrations.some((m) => m.version === v),
  );

  if (missing.length) {
    problems.push(
      `DATABASE PACK STALE — nicht im Fresh Installer: ${missing.join(", ")}. Fresh Install Pack muss neu erzeugt werden.`,
    );
  }
  if (unknown.length) {
    problems.push(
      `Fresh Installer nennt Migrationen, die nicht existieren: ${unknown.join(", ")}.`,
    );
  }
  if (newest && manifest.schema_version !== newest) {
    problems.push(
      `schema_version des Packs (${manifest.schema_version}) entspricht nicht der neuesten Migration (${newest}).`,
    );
  }
  const headNumber = Number(manifest.migration_head);
  if (!Number.isFinite(headNumber) || headNumber !== migrations.length) {
    problems.push(
      `migration_head (${manifest.migration_head}) entspricht nicht der Anzahl Migrationen (${migrations.length}).`,
    );
  }
  if (!manifest.migration_set_fingerprint) {
    problems.push(
      "Fresh Installer besitzt keinen migration_set_fingerprint — Pack stammt aus der Zeit vor dem Sync-Gate und muss neu erzeugt werden.",
    );
  } else if (manifest.migration_set_fingerprint !== expected) {
    problems.push(
      `Migration-Set-Fingerprint weicht ab (Pack ${manifest.migration_set_fingerprint.slice(0, 16)}…, tatsächlich ${expected.slice(0, 16)}…).`,
    );
  }

  return {
    status: problems.length ? "FAIL" : "PASS",
    problems,
    newestMigration: newest,
    packSchemaVersion: manifest.schema_version,
    migrationCount: migrations.length,
    packMigrationCount: (manifest.migration_versions ?? []).length,
    expectedFingerprint: expected,
    packFingerprint: manifest.migration_set_fingerprint ?? null,
  };
}
