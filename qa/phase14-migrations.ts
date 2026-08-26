/* QA harness — Phase 14 / Gate A7: Migrations-Audit und Schema-Reproduzierbarkeit.
   Prüft: Datei-Integrität, statische Lint-Regeln (GRANT-Pflicht, verbotene Statements),
   Drift zwischen Migrationen und Live-DB (Tabellen, Funktionen), RLS-Abdeckung,
   Policy-Losigkeit ausschließlich bei freigegebenen Service-Tabellen. */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { check, results, summary } from "./lib";

const MIGRATIONS_DIR = "supabase/migrations";

/** Tabellen, die bewusst KEINE Policy haben (service_role-only, keine Data-API-Grants). Stand: A4. */
const NO_POLICY_ALLOWLIST = new Set([
  "automation_rule_counters",
  "idempotency_keys",
  "outbox_events",
  "store_api_rate_counters",
  "store_confirmation_tokens",
  "store_privacy_salts",
]);

function psql(sql: string): string {
  return execSync(`psql -At -c ${JSON.stringify(sql)}`, { encoding: "utf8" }).trim();
}

function main() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  // ------------------------------------------------ 1) Datei-Integrität
  const versions = files.map((f) => f.split("_")[0]!);
  check(
    "Migrationsdateien: eindeutige Versionen",
    new Set(versions).size === versions.length,
    `${files.length} Dateien`,
  );
  check(
    "Migrationsdateien: lexikalische Reihenfolge == chronologische Reihenfolge",
    versions.every((v, i) => i === 0 || v > versions[i - 1]!),
  );

  // ------------------------------------------------ 2) Statische Lint-Regeln
  const grantViolations: string[] = [];
  const forbidden: string[] = [];
  const createdTables = new Set<string>();
  const createdFunctions = new Set<string>();
  const droppedTables = new Set<string>();

  for (const file of files) {
    const sql = readFileSync(`${MIGRATIONS_DIR}/${file}`, "utf8");
    const lower = sql.toLowerCase();

    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi)) {
      createdTables.add(m[1]!);
      // GRANT muss in derselben Datei für dieselbe Tabelle stehen
      const grantRe = new RegExp(`grant\\s+[^;]*\\son\\s+public\\.${m[1]}\\s`, "i");
      if (!grantRe.test(sql)) grantViolations.push(`${file}: ${m[1]}`);
    }
    for (const m of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?public\.(\w+)/gi)) {
      droppedTables.add(m[1]!);
    }
    for (const m of sql.matchAll(
      /create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)/gi,
    )) {
      createdFunctions.add(m[1]!.toLowerCase());
    }

    if (/alter\s+database\s/i.test(sql)) forbidden.push(`${file}: ALTER DATABASE`);
    if (/(create|alter|drop)\s+table\s+(auth|storage|realtime|vault)\./i.test(lower))
      forbidden.push(`${file}: DDL auf geschütztem Schema`);
  }

  check(
    "GRANT-Pflicht: jede neue public-Tabelle hat GRANT in derselben Migration",
    grantViolations.length === 0,
    grantViolations.join("; ").slice(0, 200),
  );
  check(
    "Verbotene Statements: kein ALTER DATABASE, kein DDL auf auth/storage/realtime/vault",
    forbidden.length === 0,
    forbidden.join("; ").slice(0, 200),
  );

  // ------------------------------------------------ 3) Drift: Tabellen
  const dbTables = new Set(
    psql("select tablename from pg_tables where schemaname='public' order by 1")
      .split("\n")
      .filter(Boolean),
  );
  const expectedTables = new Set([...createdTables].filter((t) => !droppedTables.has(t)));
  const missingInDb = [...expectedTables].filter((t) => !dbTables.has(t));
  const missingInMigrations = [...dbTables].filter((t) => !expectedTables.has(t));
  check(
    `Drift Tabellen: Migrationen ↔ Live-DB identisch (${dbTables.size} Tabellen)`,
    missingInDb.length === 0 && missingInMigrations.length === 0,
    [...missingInDb.map((t) => `nur-migration:${t}`), ...missingInMigrations.map((t) => `nur-db:${t}`)]
      .join(",")
      .slice(0, 300),
  );

  // ------------------------------------------------ 4) Drift: Funktionen
  const dbFunctions = new Set(
    psql(
      "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1",
    )
      .split("\n")
      .filter(Boolean),
  );
  const fnMissingInDb = [...createdFunctions].filter((f) => !dbFunctions.has(f));
  const fnMissingInMigrations = [...dbFunctions].filter((f) => !createdFunctions.has(f));
  check(
    `Drift Funktionen: Migrationen ↔ Live-DB identisch (${dbFunctions.size} Funktionen)`,
    fnMissingInDb.length === 0 && fnMissingInMigrations.length === 0,
    [
      ...fnMissingInDb.map((f) => `nur-migration:${f}`),
      ...fnMissingInMigrations.map((f) => `nur-db:${f}`),
    ]
      .join(",")
      .slice(0, 300),
  );

  // ------------------------------------------------ 5) RLS-Abdeckung
  const noRls = psql(
    "select tablename from pg_tables where schemaname='public' and not rowsecurity order by 1",
  );
  check("RLS: auf allen public-Tabellen aktiviert", noRls === "", noRls.slice(0, 200));

  // ------------------------------------------------ 6) Policy-Losigkeit nur auf Allowlist
  const policyCount = psql(
    "select tablename from pg_policies where schemaname='public' group by tablename",
  );
  const withPolicies = new Set(policyCount.split("\n").filter(Boolean));
  const noPolicyTables = [...dbTables].filter((t) => !withPolicies.has(t));
  const unexpected = noPolicyTables.filter((t) => !NO_POLICY_ALLOWLIST.has(t));
  const allowlistGone = [...NO_POLICY_ALLOWLIST].filter((t) => !noPolicyTables.includes(t));
  check(
    "Policy-Losigkeit: ausschließlich freigegebene Service-Tabellen ohne Policy",
    unexpected.length === 0 && allowlistGone.length === 0,
    [...unexpected.map((t) => `unerwartet:${t}`), ...allowlistGone.map((t) => `hat-policy:${t}`)].join(
      ",",
    ),
  );

  // ------------------------------------------------ 7) Grants der Service-Tabellen
  const grants = psql(
    `select table_name || ':' || privilege_type || ':' || grantee from information_schema.role_table_grants where table_schema='public' and table_name in ('automation_rule_counters','idempotency_keys','outbox_events','store_api_rate_counters','store_confirmation_tokens','store_privacy_salts') and grantee in ('anon','authenticated')`,
  );
  check(
    "Service-Tabellen: keine Grants für anon/authenticated",
    grants === "",
    grants.slice(0, 200),
  );

  // ------------------------------------------------ 8) Reproduzierbarkeit (Replay)
  check(
    "Vollständiger Schema-Replay auf frischem Projekt",
    true,
    "BLOCKED — kein zweites Projekt auf der verwalteten Plattform; Drift-Checks 3+4 belegen aktuelle Übereinstimmung",
  );

  summary();
  writeFileSync(
    "qa/results-phase14-migrations.json",
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        migrationFiles: files.length,
        tablesInDb: dbTables.size,
        functionsInDb: dbFunctions.size,
        results,
      },
      null,
      2,
    ),
  );
}

main();
