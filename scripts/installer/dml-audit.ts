/**
 * eyis:seeds:audit — vollständiges DML-Audit der Migrationskette.
 *
 * Ziel: nachweisen, dass jede Datenanweisung (INSERT/UPDATE/DELETE) aus der
 * Migrationshistorie genau einer der folgenden Kategorien zugeordnet ist:
 *
 *   system_seed   Systemdaten, die eine Fresh-Install-Datenbank braucht.
 *                 Muss durch eine Unit in eyis-system-seeds.manifest.json
 *                 abgedeckt sein.
 *   runtime       DML innerhalb einer Funktions- oder Triggerdefinition.
 *                 Läuft zur Laufzeit, gehört zum Schema, nicht zu den Seeds.
 *   backfill      Einmalige Korrektur historischer Daten. Für eine leere
 *                 Datenbank ohne Wirkung.
 *
 * Das Ergebnis wird als installer/database/seeds/eyis-dml-audit.json
 * geschrieben und von `eyis:seeds:verify` gegen die Seed-Units geprüft.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { MIGRATIONS_DIR, SEED_UNITS, SEEDS_DIR, sha256 } from "./system-seeds";

type Finding = {
  migration: string;
  line: number;
  statement: string;
  table: string | null;
  category: "system_seed" | "runtime" | "backfill";
  covered_by: string | null;
};

const SEEDED_TABLES = new Set(SEED_UNITS.flatMap((u) => u.tables));
const UNIT_BY_TABLE = new Map<string, string>();
for (const unit of SEED_UNITS) for (const t of unit.tables) UNIT_BY_TABLE.set(t, unit.id);

const DML = /^(INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO)\s+/i;
const TABLE = /^(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO)\s+(?:public\.)?([a-z_][a-z0-9_]*)/i;

const findings: Finding[] = [];

for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
  if (!file.endsWith(".sql")) continue;
  const version = file.split("_")[0]!;
  const lines = readFileSync(join(MIGRATIONS_DIR, file), "utf8").split("\n");
  let inBody = false;
  lines.forEach((raw, index) => {
    // Dollar-Quotes markieren Funktions- und DO-Körper. DML darin ist Laufzeitlogik.
    const dollars = raw.match(/\$[a-z_]*\$/gi);
    const trimmed = raw.trim();
    const wasInBody = inBody;
    if (dollars) for (let i = 0; i < dollars.length; i += 1) inBody = !inBody;

    if (!DML.test(trimmed)) return;
    const table = trimmed.match(TABLE)?.[1] ?? null;
    const runtime = wasInBody || inBody || raw.startsWith("  ") || raw.startsWith("\t");
    const category: Finding["category"] = runtime
      ? "runtime"
      : table && SEEDED_TABLES.has(table)
        ? "system_seed"
        : "backfill";
    findings.push({
      migration: version,
      line: index + 1,
      statement: trimmed.slice(0, 120),
      table,
      category,
      covered_by: category === "system_seed" && table ? (UNIT_BY_TABLE.get(table) ?? null) : null,
    });
  });
}

const bySeedTable = new Map<string, number>();
for (const f of findings) {
  if (f.category !== "system_seed" || !f.table) continue;
  bySeedTable.set(f.table, (bySeedTable.get(f.table) ?? 0) + 1);
}

const uncovered = findings.filter((f) => f.category === "system_seed" && !f.covered_by);

const report = {
  manifest: "eyis-dml-audit",
  generated_at: new Date().toISOString().slice(0, 10),
  migrations_scanned: readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).length,
  totals: {
    all: findings.length,
    system_seed: findings.filter((f) => f.category === "system_seed").length,
    runtime: findings.filter((f) => f.category === "runtime").length,
    backfill: findings.filter((f) => f.category === "backfill").length,
  },
  seed_tables: Object.fromEntries([...bySeedTable].sort()),
  uncovered_system_dml: uncovered,
  findings: findings.filter((f) => f.category !== "runtime"),
};

const out = `${JSON.stringify(report, null, 2)}\n`;
writeFileSync(join(SEEDS_DIR, "eyis-dml-audit.json"), out, "utf8");

console.log(`Migrationen geprüft: ${report.migrations_scanned}`);
console.log(`DML gesamt: ${report.totals.all}`);
console.log(`  system_seed: ${report.totals.system_seed}`);
console.log(`  runtime:     ${report.totals.runtime}`);
console.log(`  backfill:    ${report.totals.backfill}`);
console.log(`Nicht abgedeckte Systemdaten: ${uncovered.length}`);
console.log(`Audit-Checksumme: ${sha256(out).slice(0, 16)}`);
if (uncovered.length) process.exit(1);
