/**
 * EYIS Installer CLI.
 *
 *   bun run eyis:install:status    Zustand und nächste Schritte
 *   bun run eyis:install:next      Nächste offene Installation Unit (inkl. SQL)
 *   bun run eyis:install:inspect   Partial-Install-Analyse und Recovery-Pfad
 *   bun run eyis:install:verify    Schema-Verification gegen den Fingerprint
 *
 * Die CLI führt kein DDL aus, wenn die Plattform das nicht erlaubt. Sie liefert
 * dem Agenten die exakt nächste Unit, die er über das Migration Tool anwendet.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { computeFingerprint, diffNormalized } from "./installer/fingerprint";
import { introspect } from "./installer/introspect";
import { historicalOwnership } from "./installer/migration-history";
import { PACK_DIR, detectState, loadManifest, nextUnit, psql, unitSql } from "./installer/runner";

const command = process.argv[2] ?? "status";
const manifest = loadManifest();

function safeDetect() {
  try {
    return detectState(manifest);
  } catch {
    return null;
  }
}

function status() {
  const state = safeDetect();
  console.log(`Deployment mode: ${process.env["COMMERCE_DEPLOYMENT_MODE"] ?? "dedicated"}`);
  console.log(`Installer baseline: ${manifest.version}`);
  console.log(`Units: ${manifest.fresh_install.units.length}`);
  console.log(`System seeds: ${manifest.system_seeds.length}`);
  console.log(`Migration head: ${manifest.migration_head} (${manifest.migration_versions.length} Versionen)`);
  console.log(`Schema fingerprint: ${manifest.schema_fingerprint}`);
  if (!state) {
    console.log("Database: UNREACHABLE (kein direkter DB-Zugriff — Units über das Migration Tool anwenden)");
    return;
  }
  console.log(`Database: ${state.state}`);
  console.log(`Angewendete Units: ${state.completed.length}/${manifest.fresh_install.units.length}`);
  if (state.state === "NOT_INSTALLED") console.log("\nReady for fresh install.");
  if (state.state === "PARTIAL_INSTALL") console.log("\nRecovery nötig: bun run eyis:install:inspect");
  if (state.state === "INSTALLED") console.log("\nBaseline gesperrt. Weitere Änderungen ausschließlich über Migrationen.");
}

function next() {
  const unit = nextUnit(manifest);
  if (!unit) {
    console.log("Keine offene Unit. Installation vollständig.");
    return;
  }
  console.log(`# ${unit.position}/${manifest.fresh_install.units.length} — ${unit.id} (${unit.bytes} Bytes)`);
  console.log(unitSql(unit));
}

function inspect() {
  const state = safeDetect();
  if (!state) {
    console.log("EYIS installation state: UNKNOWN (kein DB-Zugriff aus dieser Umgebung)");
    return;
  }
  const historical = historicalOwnership();
  const liveTables = JSON.parse(
    psql(
      `select coalesce(json_agg(c.relname), '[]'::json) from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`,
    ),
  ) as string[];
  const eyisOwned = liveTables.filter(
    (t) => historical.tables.includes(t) || t.startsWith("eyis_installation"),
  );
  const customerOwned = liveTables.filter((t) => !eyisOwned.includes(t));

  const dataTables = ["orders", "products", "customers", "invoices"].filter((t) => liveTables.includes(t));
  let hasData = false;
  for (const table of dataTables) {
    if (Number(psql(`select count(*) from public.${table}`).trim()) > 0) hasData = true;
  }

  console.log(`EYIS installation state: ${state.state}`);
  console.log("");
  console.log(`Existing EYIS tables: ${eyisOwned.length}`);
  console.log(`Existing EYIS enums: ${psql(`select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e'`).trim()}`);
  console.log(`Existing EYIS functions: ${psql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`).trim()}`);
  console.log(`Customer-owned tables (never touched): ${customerOwned.length}`);
  console.log(`Known applied migration history: ${manifest.migration_versions.length} Versionen im Repository`);
  console.log(`Relevant commerce data present: ${hasData ? "YES" : "NO"}`);
  console.log("");
  console.log(`Safe clean reinstall possible: ${!hasData && state.state !== "INSTALLED" ? "YES" : "NO"}`);
}

function verify() {
  const expected = JSON.parse(readFileSync(join(PACK_DIR, manifest.verification["expected_objects"]), "utf8"));
  const actual = computeFingerprint(introspect());
  const problems = diffNormalized(expected, actual.normalized);
  console.log(`Erwarteter Fingerprint: ${manifest.schema_fingerprint}`);
  console.log(`Tatsächlicher Fingerprint: ${actual.hash}`);
  if (actual.hash === manifest.schema_fingerprint && problems.length === 0) {
    console.log("Schema verification: PASS");
    return;
  }
  console.log("Schema verification: FAIL");
  for (const problem of problems.slice(0, 40)) console.log(`  - ${problem}`);
  process.exit(1);
}

switch (command) {
  case "status":
    status();
    break;
  case "next":
    next();
    break;
  case "inspect":
    inspect();
    break;
  case "verify":
    verify();
    break;
  default:
    console.error(`Unbekannter Befehl: ${command}`);
    process.exit(1);
}
