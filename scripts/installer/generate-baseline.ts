/**
 * EYIS Database Install Pack — Baseline-Generator.
 *
 *   bun run eyis:database:baseline
 *
 * Erzeugt aus dem Endzustand der aktuellen EYIS-Datenbank ein versioniertes,
 * in Installation Units aufgeteiltes Fresh-Install-Paket samt Manifest,
 * Fingerprint und Ownership-Inventar.
 *
 * Regeln (siehe .lovable/plan/… und docs/production/INSTALLATION.md):
 *  - kein Concat der historischen Migrationen
 *  - Drift Gate: ungeklärte Abweichung Live-DB ↔ Migrationskette = FAIL
 *  - SQL wird nur an vollständigen Statement-Grenzen getrennt
 *  - keine Daten, keine Secrets, keine Demo-Inhalte
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DOMAIN_ORDER, domainOf } from "./domains";
import {
  emitEnums,
  emitExtensions,
  emitForeignKeys,
  emitFunctionGrants,
  emitFunctions,
  emitGrants,
  emitIndexes,
  emitPolicy,
  emitRls,
  emitTable,
  emitTriggers,
  type Statement,
} from "./emit";
import { introspect } from "./introspect";
import { buildSeeds } from "./seeds";
import { historicalOwnership, migrationHead, migrationVersions, tablesFromMigrations } from "./migration-history";

export const TARGET_UNIT_BYTES = 18 * 1024;
/** Nachgewiesene Obergrenze eines einzelnen Tool-Payloads. */
export const HARD_STATEMENT_BYTES = 48 * 1024;
export const BASELINE_VERSION = "1.0.0";

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "installer", "database");
const BASELINE_DIR = join(OUT_DIR, "baseline");
const VERIFY_DIR = join(OUT_DIR, "verification");

/** Installer-eigene Objekte sind nicht Teil der Baseline (Unit 000 legt sie an). */
const JOURNAL_TABLES = new Set(["eyis_installation_state", "eyis_installation_units"]);

type Section = { id: string; title: string; statements: Statement[] };

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function driftGate(liveTables: string[]) {
  const fromMigrations = tablesFromMigrations();
  const live = liveTables.filter((t) => !JOURNAL_TABLES.has(t));
  const unexpected = live.filter((t) => !fromMigrations.has(t));
  const missing = [...fromMigrations].filter((t) => !live.includes(t));
  if (unexpected.length || missing.length) {
    console.error("BASELINE GENERATION FAIL — ungeklärter Schema-Drift.");
    if (unexpected.length) console.error(`  Nur in der Live-DB: ${unexpected.join(", ")}`);
    if (missing.length) console.error(`  Nur in der Migrationskette: ${missing.join(", ")}`);
    console.error("  Drift klären (Migration nachziehen oder Objekt entfernen), dann erneut erzeugen.");
    process.exit(1);
  }
  return { tableCount: live.length };
}

function buildSections(): { sections: Section[]; schema: ReturnType<typeof introspect> } {
  const schema = introspect();
  schema.tables = schema.tables.filter((t) => !JOURNAL_TABLES.has(t.name));
  schema.foreignKeys = schema.foreignKeys.filter((f) => !JOURNAL_TABLES.has(f.table));
  schema.indexes = schema.indexes.filter((i) => !JOURNAL_TABLES.has(i.table));
  schema.triggers = schema.triggers.filter((t) => !JOURNAL_TABLES.has(t.table));
  schema.policies = schema.policies.filter((p) => !JOURNAL_TABLES.has(p.table));
  schema.grants = schema.grants.filter((g) => !JOURNAL_TABLES.has(g.table));

  driftGate(schema.tables.map((t) => t.name));

  const sections: Section[] = [];
  sections.push({
    id: "foundation-extensions",
    title: "Extensions und Enums",
    statements: [...emitExtensions(schema), ...emitEnums(schema)],
  });

  const byDomain = <T extends { table?: string; object: string }>(items: T[], key: (i: T) => string) => {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const domain = domainOf(key(item));
      if (!map.has(domain)) map.set(domain, []);
      map.get(domain)!.push(item);
    }
    return map;
  };

  const tableStatements = schema.tables.map(emitTable);
  const tablesByDomain = byDomain(tableStatements, (s) => s.object);
  for (const domain of DOMAIN_ORDER) {
    const items = tablesByDomain.get(domain);
    if (items?.length) sections.push({ id: `${domain}-tables`, title: `Tabellen: ${domain}`, statements: items });
  }

  sections.push({ id: "relations-foreign-keys", title: "Fremdschlüssel", statements: emitForeignKeys(schema) });

  const fnStatements = emitFunctions(schema);
  const fnByDomain = byDomain(fnStatements, (s) => s.object);
  for (const domain of DOMAIN_ORDER) {
    const items = fnByDomain.get(domain);
    if (items?.length) sections.push({ id: `${domain}-functions`, title: `Funktionen: ${domain}`, statements: items });
  }

  sections.push({ id: "relations-triggers", title: "Trigger", statements: emitTriggers(schema) });
  sections.push({ id: "relations-indexes", title: "Indexe", statements: emitIndexes(schema) });
  sections.push({
    id: "security-rls",
    title: "Row Level Security",
    statements: [...emitRls(schema), ...schema.policies.map(emitPolicy)],
  });
  sections.push({ id: "security-grants", title: "Grants", statements: emitGrants(schema.grants) });
  sections.push({
    id: "security-function-grants",
    title: "Ausführungsrechte Funktionen",
    statements: emitFunctionGrants(schema),
  });

  return { sections: sections.filter((s) => s.statements.length > 0), schema };
}

/** Packt Statements in Units. Getrennt wird ausschließlich zwischen Statements. */
function packUnits(sections: Section[]) {
  const units: { id: string; title: string; sql: string; statements: Statement[] }[] = [];
  for (const section of sections) {
    let current: Statement[] = [];
    let size = 0;
    let part = 0;
    const flush = () => {
      if (!current.length) return;
      part += 1;
      const suffix = String.fromCharCode(96 + part); // a, b, c …
      const id = `${section.id}-${suffix}`;
      units.push({
        id,
        title: section.title,
        statements: current,
        // check_function_bodies bleibt aus: Funktionen referenzieren einander
        // wechselseitig, eine topologische Reihenfolge existiert nicht.
        sql: `-- EYIS Database Install Pack — ${section.title} (${id})\n-- Automatisch erzeugt. Nicht von Hand bearbeiten.\n\nSET check_function_bodies = off;\n\n${current
          .map((s) => s.sql)
          .join("\n\n")}\n`,
      });
      current = [];
      size = 0;
    };
    for (const statement of section.statements) {
      const bytes = Buffer.byteLength(statement.sql, "utf8");
      if (bytes > HARD_STATEMENT_BYTES) {
        console.error(
          `GENERATOR FAIL — unteilbares Statement überschreitet das Payload-Limit (${bytes} > ${HARD_STATEMENT_BYTES}).`,
        );
        console.error(`  Objekt: ${statement.kind} ${statement.object}`);
        process.exit(1);
      }
      if (size > 0 && size + bytes > TARGET_UNIT_BYTES) flush();
      current.push(statement);
      size += bytes + 2;
    }
    flush();
  }
  return units;
}

function fingerprint(schema: ReturnType<typeof introspect>) {
  const normalized = {
    enums: schema.enums.map((e) => `${e.name}(${e.values.join(",")})`).sort(),
    tables: schema.tables
      .map((t) => ({
        name: t.name,
        rls: t.rls,
        columns: t.columns.map((c) => `${c.name}:${c.type}:${c.not_null ? "NN" : "N"}`).sort(),
        constraints: t.constraints.map((c) => `${c.name}:${c.def}`).sort(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    foreignKeys: schema.foreignKeys.map((f) => `${f.table}:${f.name}:${f.def}`).sort(),
    indexes: schema.indexes.map((i) => `${i.table}:${i.name}`).sort(),
    functions: schema.functions.map((f) => f.identity).sort(),
    triggers: schema.triggers.map((t) => `${t.table}.${t.name}`).sort(),
    policies: schema.policies.map((p) => `${p.table}.${p.name}:${p.cmd}:${p.roles.join("+")}`).sort(),
    grants: schema.grants.map((g) => `${g.table}:${g.grantee}:${g.privilege}`).sort(),
    functionGrants: schema.functionGrants.map((g) => `${g.identity}:${g.grantee}`).sort(),
  };
  return { hash: sha256(JSON.stringify(normalized)), normalized };
}

export function generate() {
  const { sections, schema } = buildSections();
  const units = packUnits(sections);
  const fp = fingerprint(schema);
  const head = migrationHead();
  const versions = migrationVersions();

  if (existsSync(BASELINE_DIR)) {
    for (const file of readdirSync(BASELINE_DIR)) {
      if (file !== "000_installer_journal.sql") rmSync(join(BASELINE_DIR, file));
    }
  }
  mkdirSync(BASELINE_DIR, { recursive: true });
  mkdirSync(VERIFY_DIR, { recursive: true });

  const journalSql = readFileSync(join(BASELINE_DIR, "000_installer_journal.sql"), "utf8");
  const manifestUnits = [
    {
      id: "installer-journal",
      file: "baseline/000_installer_journal.sql",
      position: 0,
      title: "Installations-Journal",
      bytes: Buffer.byteLength(journalSql, "utf8"),
      checksum: sha256(journalSql),
      statements: 4,
      required: true,
    },
  ];

  units.forEach((unit, index) => {
    const position = index + 1;
    const file = `${String(position).padStart(3, "0")}_${unit.id.replace(/-/g, "_")}.sql`;
    writeFileSync(join(BASELINE_DIR, file), unit.sql);
    manifestUnits.push({
      id: unit.id,
      file: `baseline/${file}`,
      position,
      title: unit.title,
      bytes: Buffer.byteLength(unit.sql, "utf8"),
      checksum: sha256(unit.sql),
      statements: unit.statements.length,
      required: true,
    });
  });

  mkdirSync(join(OUT_DIR, "seeds"), { recursive: true });
  const seeds = buildSeeds().map((seed) => {
    writeFileSync(join(OUT_DIR, seed.file), seed.sql);
    return {
      id: seed.file.replace(/^seeds\/|\.sql$/g, ""),
      file: seed.file,
      version: seed.version,
      checksum: sha256(seed.sql),
      idempotent: true,
    };
  });

  // Reconciliation: alle im Baseline enthaltenen Strukturversionen werden als
  // "applied" registriert, damit `supabase db push` sie nicht erneut anwendet.
  mkdirSync(join(OUT_DIR, "reconcile"), { recursive: true });
  const reconcileSql = `-- EYIS Database Install Pack — Migration History Reconciliation.
-- Registriert die im Baseline enthaltenen Strukturversionen als bereits angewendet.
-- Ohne diesen Schritt würde ein späteres \`supabase db push\` die komplette
-- historische Kette erneut ausführen und die Installation zerstören.

CREATE SCHEMA IF NOT EXISTS supabase_migrations;

CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  statements text[],
  name text
);

INSERT INTO supabase_migrations.schema_migrations (version, name)
SELECT v.version, 'eyis_baseline_${BASELINE_VERSION}'
FROM (VALUES
${versions.map((v) => `  ('${v}')`).join(",\n")}
) AS v(version)
ON CONFLICT (version) DO NOTHING;
`;
  writeFileSync(join(OUT_DIR, "reconcile", "001_migration_history.sql"), reconcileSql);

  const allStatements = sections.flatMap((s) => s.statements);
  const largestStatement = allStatements.reduce(
    (max, s) => {
      const bytes = Buffer.byteLength(s.sql, "utf8");
      return bytes > max.bytes ? { bytes, object: `${s.kind} ${s.object}` } : max;
    },
    { bytes: 0, object: "" },
  );

  const ownership = {
    current: {
      tables: schema.tables.map((t) => t.name).sort(),
      enums: schema.enums.map((e) => e.name).sort(),
      functions: schema.functions.map((f) => f.name).sort(),
      triggers: schema.triggers.map((t) => `${t.table}.${t.name}`).sort(),
      policies: schema.policies.map((p) => `${p.table}.${p.name}`).sort(),
      journal: [...JOURNAL_TABLES].sort(),
    },
    historical: historicalOwnership(),
  };

  const manifest = {
    version: BASELINE_VERSION,
    generated_at: new Date().toISOString().slice(0, 10),
    schema_version: head.version,
    migration_head: head.id,
    migration_versions: versions,
    schema_fingerprint: fp.hash,
    payload_budget: {
      target_unit_bytes: TARGET_UNIT_BYTES,
      hard_statement_bytes: HARD_STATEMENT_BYTES,
      largest_unit_bytes: Math.max(...manifestUnits.map((u) => u.bytes)),
      largest_atomic_statement_bytes: largestStatement.bytes,
      largest_atomic_statement_object: largestStatement.object,
    },
    fresh_install: { units: manifestUnits },
    system_seeds: seeds,
    migration_history_reconciliation: {
      file: "reconcile/001_migration_history.sql",
      checksum: sha256(reconcileSql),
      registers_versions: versions.length,
      required_before: "supabase db push",
    },
    verification: {
      fingerprint: "verification/fingerprint.json",
      expected_objects: "verification/expected-objects.json",
      ownership: "verification/ownership.json",
    },
    resources: "../resources/eyis-resources.manifest.json",
  };

  writeFileSync(
    join(VERIFY_DIR, "fingerprint.json"),
    `${JSON.stringify({ schema_fingerprint: fp.hash, baseline_version: BASELINE_VERSION, migration_head: head.id }, null, 2)}\n`,
  );
  writeFileSync(join(VERIFY_DIR, "expected-objects.json"), `${JSON.stringify(fp.normalized, null, 2)}\n`);
  writeFileSync(join(VERIFY_DIR, "ownership.json"), `${JSON.stringify(ownership, null, 2)}\n`);
  writeFileSync(join(OUT_DIR, "eyis-database-installer.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`EYIS Database Install Pack ${BASELINE_VERSION}`);
  console.log(`  Units:                    ${manifestUnits.length}`);
  console.log(`  Größte Unit:              ${manifest.payload_budget.largest_unit_bytes} Bytes`);
  console.log(`  Größtes atomares Stmt:    ${largestStatement.bytes} Bytes (${largestStatement.object})`);
  console.log(`  Migration Head:           ${head.id} (${versions.length} Versionen)`);
  console.log(`  Schema Fingerprint:       ${fp.hash}`);
}

if (import.meta.main) generate();
