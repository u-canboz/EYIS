/**
 * EYIS System-Seed-CLI.
 *
 *   bun run eyis:seeds:audit     DML-Audit der Migrationskette
 *   bun run eyis:seeds:generate  Seed-Dateien und Seed-Manifest neu erzeugen
 *   bun run eyis:seeds:verify    Manifest-Integrität und (falls erreichbar) Datenbankzustand
 *   bun run eyis:seeds:sql       Gesamtes idempotentes Seed-SQL auf stdout
 *
 * `verify` läuft in zwei Stufen: die Manifestprüfung braucht keine Datenbank
 * und ist damit auch in `bun run verify` verwendbar. Die Datenbankprüfung wird
 * nur ausgeführt, wenn psql eine Verbindung herstellen kann.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SEEDS_DIR, SEED_UNITS, loadSeedManifest, sha256 } from "./installer/system-seeds";
import { psql } from "./installer/runner";

const command = process.argv[2] ?? "verify";

function seedSql() {
  return SEED_UNITS.filter((u) => u.sources.length > 0)
    .map((u) => readFileSync(join(SEEDS_DIR, u.file), "utf8"))
    .join("\n");
}

/** Stufe 1 — offline: Dateien, Checksummen und Fingerprint stimmen überein. */
export function verifyManifest(): string[] {
  const problems: string[] = [];
  const manifest = loadSeedManifest();
  if (manifest.units.length !== SEED_UNITS.length) {
    problems.push(`Unit-Anzahl weicht ab: Manifest ${manifest.units.length}, Katalog ${SEED_UNITS.length}`);
  }
  for (const unit of manifest.units) {
    let content: string;
    try {
      content = readFileSync(join(SEEDS_DIR, unit.file), "utf8");
    } catch {
      problems.push(`Seed-Datei fehlt: ${unit.file}`);
      continue;
    }
    const actual = sha256(content);
    if (actual !== unit.checksum) {
      problems.push(`Checksumme abweichend: ${unit.file}`);
    }
    if (!/DO \$eyis_seed\$|ON CONFLICT|WHERE NOT EXISTS/.test(content)) {
      problems.push(`Seed nicht nachweisbar idempotent: ${unit.file}`);
    }
  }
  return problems;
}

/** Stufe 2 — gegen eine erreichbare Datenbank. */
function verifyDatabase(): string[] | null {
  const problems: string[] = [];
  const manifest = loadSeedManifest();
  try {
    psql("select 1");
  } catch {
    return null;
  }
  for (const unit of manifest.units) {
    for (const e of unit.expect) {
      const count = Number(psql(`select count(*) from public.${e.table} where ${e.where}`).trim());
      if (count < e.min) {
        problems.push(`${unit.id}: ${e.table} hat ${count} Zeilen, erwartet mindestens ${e.min}`);
      }
    }
    const rk = unit.required_keys;
    if (!rk) continue;
    const present = new Set(
      psql(
        `select ${rk.column} from public.${rk.table} where ${rk.where ?? "true"}`,
      )
        .trim()
        .split("\n")
        .filter(Boolean),
    );
    for (const key of rk.keys) {
      if (!present.has(key)) problems.push(`${unit.id}: Schlüssel '${key}' fehlt in ${rk.table}`);
    }
  }
  return problems;
}

switch (command) {
  case "sql":
    console.log(seedSql());
    break;
  case "verify": {
    const manifest = loadSeedManifest();
    console.log("EYIS — System Seeds");
    console.log("=".repeat(72));
    console.log(`Seed-Version:            ${manifest.version}`);
    console.log(`system_seed_fingerprint: ${manifest.system_seed_fingerprint}`);
    console.log(`Units:                   ${manifest.units.length}`);

    const offline = verifyManifest();
    console.log(`Manifest-Integrität:     ${offline.length === 0 ? "PASS" : "FAIL"}`);
    for (const p of offline) console.log(`  - ${p}`);

    const db = verifyDatabase();
    if (db === null) {
      console.log("Datenbankprüfung:        SKIPPED (keine Verbindung aus dieser Umgebung)");
    } else {
      console.log(`Datenbankprüfung:        ${db.length === 0 ? "PASS" : "FAIL"}`);
      for (const p of db) console.log(`  - ${p}`);
    }
    console.log("=".repeat(72));
    process.exit(offline.length + (db?.length ?? 0) === 0 ? 0 : 1);
    break;
  }
  default:
    console.error(`Unbekannter Befehl: ${command}`);
    process.exit(1);
}
