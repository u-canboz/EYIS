/**
 * eyis:database:forward-port — bringt den Fresh-Install-Pack ohne Live-Datenbank
 * auf den Stand aller vorhandenen Migrationen.
 *
 * `eyis:database:baseline` erzeugt den Pack aus der Introspektion einer
 * verbundenen Datenbank und ist der Normalweg. Ist keine direkte
 * Datenbankverbindung verfügbar (Lovable-Runtime ohne psql), würde der Pack
 * ohne diesen Weg still veralten — genau der Defekt aus dem Blackbox-Test.
 *
 * Der Forward-Port ist deterministisch: jede noch nicht repräsentierte
 * Migration wird als zusätzliche, in sich abgeschlossene Installation Unit
 * ans Ende der Baseline gestellt. Ein Fresh Install erzeugt damit denselben
 * finalen Schema-Zustand wie die vollständige Migrationskette. Es entsteht
 * keine Nachtrags-Migration nach der Installation.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { MANIFEST_PATH, migrationSetFingerprint, readMigrations, readPackManifest } from "./pack-sync";

const ROOT = process.cwd();
const PACK_ROOT = join(ROOT, "installer", "database");
const RECONCILE = join(PACK_ROOT, "reconcile", "001_migration_history.sql");

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

type Unit = {
  id: string;
  file: string;
  position: number;
  title: string;
  bytes: number;
  checksum: string;
  statements: number;
  required: boolean;
};

export function forwardPort(): { added: string[]; schemaVersion: string; head: string } {
  const migrations = readMigrations();
  const manifest = readPackManifest() as ReturnType<typeof readPackManifest> & {
    fresh_install: { units: Unit[] };
    migration_history_reconciliation: { file: string; checksum: string; registers_versions: number };
    schema_fingerprint_state?: string;
    schema_fingerprint_migration_head?: string;
    generated_at: string;
  };

  const known = new Set(manifest.migration_versions ?? []);
  const missing = migrations.filter((m) => !known.has(m.version));

  let position = Math.max(...manifest.fresh_install.units.map((u) => u.position)) + 1;
  const added: string[] = [];

  for (const migration of missing) {
    const sql = readFileSync(join(ROOT, "supabase", "migrations", migration.file), "utf8").trimEnd();
    const body = `-- EYIS Baseline Unit ${String(position).padStart(3, "0")} — Forward-Port der Migration ${migration.version}.\n-- Inhalt entspricht Byte-für-Byte der Migration; Fresh Install und Upgrade\n-- erreichen damit denselben Schema-Zustand.\n\n${sql}\n`;
    const file = `baseline/${String(position).padStart(3, "0")}_forward_${migration.version}.sql`;
    writeFileSync(join(PACK_ROOT, file), body, "utf8");
    manifest.fresh_install.units.push({
      id: `forward-${migration.version}`,
      file,
      position,
      title: `Forward-Port ${migration.version}`,
      bytes: Buffer.byteLength(body, "utf8"),
      checksum: sha256(body),
      statements: (body.match(/;\s*$/gm) ?? []).length,
      required: true,
    });
    added.push(migration.version);
    position += 1;
  }

  const versions = migrations.map((m) => m.version);
  manifest.migration_versions = versions;
  manifest.schema_version = versions.at(-1) ?? manifest.schema_version;
  manifest.migration_head = String(versions.length).padStart(3, "0");
  manifest.migration_set_fingerprint = migrationSetFingerprint(migrations);
  manifest.generated_at = new Date().toISOString().slice(0, 10);

  // Der strukturelle Schema-Fingerprint stammt aus einer Live-Introspektion und
  // kann ohne Datenbankverbindung nicht neu berechnet werden. Der Zustand wird
  // ausdrücklich markiert statt stillschweigend als gültig ausgegeben.
  if (added.length) {
    manifest.schema_fingerprint_state = "REQUIRES_REINTROSPECTION";
    manifest.schema_fingerprint_migration_head = manifest.schema_fingerprint_migration_head ?? "20260828213156";
  }

  // Reconciliation registriert ALLE Versionen, sonst spielt `supabase db push`
  // die neuen Migrationen nach dem Fresh Install erneut ein.
  const reconcile = readFileSync(RECONCILE, "utf8");
  const rebuilt = reconcile.replace(
    /FROM \(VALUES[\s\S]*?\) AS v\(version\)/,
    `FROM (VALUES\n${versions.map((v) => `  ('${v}')`).join(",\n")}\n) AS v(version)`,
  );
  writeFileSync(RECONCILE, rebuilt, "utf8");
  manifest.migration_history_reconciliation.checksum = sha256(rebuilt);
  manifest.migration_history_reconciliation.registers_versions = versions.length;

  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { added, schemaVersion: manifest.schema_version, head: manifest.migration_head };
}

if (import.meta.main) {
  const result = forwardPort();
  console.log("EYIS — Fresh Install Pack Forward-Port");
  console.log("=".repeat(72));
  console.log(`Neue Units:      ${result.added.length ? result.added.join(", ") : "keine"}`);
  console.log(`schema_version:  ${result.schemaVersion}`);
  console.log(`migration_head:  ${result.head}`);
}
