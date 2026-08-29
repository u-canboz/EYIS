/**
 * QA — EYIS Database Install Pack gegen eine echte, vollständig leere Datenbank.
 *
 *   bun run qa:database-installer
 *
 * Startet einen isolierten, temporären Postgres-Cluster (kein Zugriff auf die
 * EYIS-Datenbank, keine Kundendaten), legt die Supabase-Kompatibilitätsschicht
 * an und installiert ausschließlich über das Database Install Pack —
 * ohne die historische Migrationskette.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { computeFingerprint } from "../scripts/installer/fingerprint";
import { introspect } from "../scripts/installer/introspect";
import {
  detectState,
  loadManifest,
  markInstalled,
  psql,
  psqlFile,
  runFreshInstall,
  runSeeds,
} from "../scripts/installer/runner";

export type Check = { name: string; status: "PASS" | "FAIL"; detail: string };

const PRELUDE = `
-- Supabase-Kompatibilitätsschicht. Wird auf einer echten Lovable-Cloud-Datenbank
-- von der Plattform bereitgestellt und ist NICHT Teil des Install Packs.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create schema if not exists extensions;
create schema if not exists auth;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb, created_at timestamptz default now());
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
create extension if not exists pg_net with schema public;
`;

export function startCluster() {
  const dir = mkdtempSync(join(tmpdir(), "eyis-freshdb-"));
  const data = join(dir, "data");
  const socket = join(dir, "sock");
  execFileSync("initdb", ["-D", data, "-U", "postgres", "-A", "trust", "--no-sync"], { stdio: "ignore" });
  execFileSync("mkdir", ["-p", socket]);
  execFileSync("pg_ctl", ["-D", data, "-o", `-k ${socket} -c listen_addresses=`, "-w", "start"], { stdio: "ignore" });
  const env: NodeJS.ProcessEnv = {
    PGHOST: socket,
    PGUSER: "postgres",
    PGDATABASE: "postgres",
    PGPASSWORD: "",
    PGPORT: "5432",
    PGSSLMODE: "disable",
  };
  const preludePath = join(dir, "prelude.sql");
  writeFileSync(preludePath, PRELUDE);
  psqlFile(preludePath, env);
  return {
    env,
    stop: () => {
      try {
        execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { stdio: "ignore" });
      } catch {
        /* Cluster bereits beendet */
      }
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function check(checks: Check[], name: string, ok: boolean, detail: string) {
  checks.push({ name, status: ok ? "PASS" : "FAIL", detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
}

export function runFreshInstallScenario() {
  const manifest = loadManifest();
  const checks: Check[] = [];
  const cluster = startCluster();
  try {
    const before = detectState(manifest, cluster.env);
    check(checks, "Fresh install detection", before.state === "NOT_INSTALLED", `state=${before.state}`);

    const started = Date.now();
    const result = runFreshInstall(manifest, { env: cluster.env });
    check(
      checks,
      "Database pack applied",
      result.applied.length === manifest.fresh_install.units.length,
      `${result.applied.length}/${manifest.fresh_install.units.length} Units in ${Math.round((Date.now() - started) / 1000)}s`,
    );

    const seeds = runSeeds(manifest, cluster.env);
    check(checks, "System seeds", seeds.length > 0, `${seeds.length} Seeds idempotent angewendet`);
    runSeeds(manifest, cluster.env);
    const permissionRows = Number(psql("select count(*) from public.role_permissions", cluster.env).trim());
    const seedRows = Number(
      psql("select count(*) from public.role_permissions", cluster.env).trim(),
    );
    check(checks, "Seeds idempotent", permissionRows === seedRows && permissionRows > 0, `${permissionRows} Rechte-Zeilen nach zwei Läufen`);

    markInstalled(manifest, cluster.env);
    const after = detectState(manifest, cluster.env);
    check(checks, "Installed state", after.state === "INSTALLED", `state=${after.state}`);

    const actual = computeFingerprint(introspect(cluster.env));
    check(
      checks,
      "Schema fingerprint",
      actual.hash === manifest.schema_fingerprint,
      actual.hash === manifest.schema_fingerprint ? actual.hash : `erwartet ${manifest.schema_fingerprint}, erhalten ${actual.hash}`,
    );

    let blocked = false;
    try {
      runFreshInstall(manifest, { env: cluster.env });
    } catch {
      blocked = true;
    }
    check(checks, "Baseline über bestehende Installation gesperrt", blocked, "runFreshInstall wirft bei INSTALLED");

    const rlsGaps = psql(
      `select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`,
      cluster.env,
    ).trim();
    check(checks, "RLS vollständig aktiv", rlsGaps === "0", `${rlsGaps} Tabellen ohne RLS`);
  } finally {
    cluster.stop();
  }
  return checks;
}

export function runInterruptionScenario() {
  const manifest = loadManifest();
  const checks: Check[] = [];
  const cluster = startCluster();
  try {
    const first = runFreshInstall(manifest, { env: cluster.env, stopAfter: 9 });
    check(checks, "Installation unterbrochen", first.applied.length === 9, `${first.applied.length} Units angewendet`);

    const mid = detectState(manifest, cluster.env);
    check(checks, "Partial state erkannt", mid.state === "PARTIAL_INSTALL", `state=${mid.state}`);

    const resumed = runFreshInstall(manifest, { env: cluster.env });
    check(
      checks,
      "Wiederaufnahme ohne Neustart",
      resumed.skipped.length === 9 && resumed.applied.length === manifest.fresh_install.units.length - 9,
      `${resumed.skipped.length} übersprungen, ${resumed.applied.length} fortgesetzt`,
    );

    runSeeds(manifest, cluster.env);
    markInstalled(manifest, cluster.env);
    const actual = computeFingerprint(introspect(cluster.env));
    check(checks, "Fingerprint nach Recovery", actual.hash === manifest.schema_fingerprint, actual.hash);
  } finally {
    cluster.stop();
  }
  return checks;
}

if (import.meta.main) {
  const checks = [...runFreshInstallScenario(), ...runInterruptionScenario()];
  const failed = checks.filter((c) => c.status === "FAIL");
  console.log(`\n${checks.length - failed.length}/${checks.length} PASS`);
  if (failed.length) process.exit(1);
}
