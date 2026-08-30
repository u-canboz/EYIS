/**
 * eyis:seeds:generate — erzeugt die kanonischen System-Seed-Dateien und das
 * Seed-Manifest aus der historischen Migrationskette.
 *
 * Die Seed-Anweisungen werden wortgleich aus den Migrationen übernommen, in
 * denen sie ursprünglich standen, und lediglich idempotent gekapselt. Damit
 * kann eine Fresh-Install-Datenbank exakt dieselben Systemdaten besitzen wie
 * eine historisch gewachsene Installation.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  SEEDS_DIR,
  SEED_MANIFEST_PATH,
  SEED_UNITS,
  buildSeedManifest,
  renderSeedFile,
} from "./system-seeds";

const version = process.env["EYIS_SEED_VERSION"] ?? "1.1.0";
const generatedAt = new Date().toISOString().slice(0, 10);

for (const unit of SEED_UNITS) {
  if (unit.sources.length === 0) continue; // vom Baseline-Generator erzeugt
  const sql = renderSeedFile(unit);
  writeFileSync(join(SEEDS_DIR, unit.file), sql, "utf8");
  console.log(`  geschrieben  ${unit.file}  (${sql.length} Bytes)`);
}

const manifest = buildSeedManifest(version, generatedAt);
writeFileSync(SEED_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log("");
console.log(`System-Seed-Units: ${manifest.units.length}`);
console.log(`system_seed_fingerprint: ${manifest.system_seed_fingerprint}`);
