/**
 * Ausführung und Zustandsverwaltung des EYIS Database Install Packs.
 *
 * Die Funktionen hier kapseln Reihenfolge, Journal, Checksummen und
 * Wiederaufnahme. Wo DDL nur über das Lovable/Supabase Migration Tool möglich
 * ist, nutzt der Agent dieselbe Logik über die CLI (`eyis:install:next`) und
 * schreibt den Journalzustand anschließend fort.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assertPackGate } from "./signature";

export type InstallState = "NOT_INSTALLED" | "PARTIAL_INSTALL" | "INSTALLED" | "RECOVERY";

export type Manifest = {
  version: string;
  schema_version: string;
  migration_head: string;
  migration_versions: string[];
  schema_fingerprint: string;
  payload_budget: {
    target_unit_bytes: number;
    hard_statement_bytes: number;
    largest_unit_bytes: number;
    largest_atomic_statement_bytes: number;
    largest_atomic_statement_object: string;
  };
  fresh_install: { units: ManifestUnit[] };
  system_seeds: { id: string; file: string; version: string; checksum: string; idempotent: boolean }[];
  migration_history_reconciliation: {
    file: string;
    checksum: string;
    registers_versions: number;
    required_before: string;
  };
  verification: Record<string, string>;
};

export type ManifestUnit = {
  id: string;
  file: string;
  position: number;
  title: string;
  bytes: number;
  checksum: string;
  statements: number;
  required: boolean;
};

export const PACK_DIR = join(process.cwd(), "installer", "database");
export const MANIFEST_PATH = join(PACK_DIR, "eyis-database-installer.manifest.json");

export function loadManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
}

export function unitSql(unit: { file: string }) {
  return readFileSync(join(PACK_DIR, unit.file), "utf8");
}

export function checksum(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function psql(sql: string, env: NodeJS.ProcessEnv = {}) {
  return execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-At", "-c", sql], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
}

export function psqlFile(path: string, env: NodeJS.ProcessEnv = {}) {
  return execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-q", "-f", path], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
}

function tableExists(name: string, env: NodeJS.ProcessEnv) {
  return psql(`select to_regclass('public.${name}') is not null`, env).trim() === "t";
}

/** Zustandserkennung ohne Annahmen: Journal, EYIS-Objekte, Vollständigkeit. */
export function detectState(manifest: Manifest, env: NodeJS.ProcessEnv = {}) {
  const hasJournal = tableExists("eyis_installation_units", env);
  const eyisObjects = Number(
    psql(
      `select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`,
      env,
    ).trim(),
  );

  if (!hasJournal) {
    // Ohne Journal: entweder leer, oder eine ältere, über die Migrationskette
    // aufgebaute Installation. Letztere wird an der Objektzahl erkannt und gilt
    // als vollständig, sobald `eyis:database:verify` PASS meldet.
    const legacyComplete = eyisObjects >= manifest.fresh_install.units.length;
    return {
      state: (eyisObjects === 0
        ? "NOT_INSTALLED"
        : legacyComplete
          ? "INSTALLED"
          : "PARTIAL_INSTALL") as InstallState,
      completed: [] as string[],
      failed: [] as string[],
      tables: eyisObjects,
    };
  }

  const rows = JSON.parse(
    psql(
      `select coalesce(json_agg(t), '[]'::json) from (select unit_id, checksum, status from public.eyis_installation_units) t`,
      env,
    ),
  ) as { unit_id: string; checksum: string; status: string }[];

  const completed = rows.filter((r) => r.status === "PASS").map((r) => r.unit_id);
  const failed = rows.filter((r) => r.status === "FAIL" || r.status === "RUNNING").map((r) => r.unit_id);
  const allDone = manifest.fresh_install.units.every((u) => completed.includes(u.id));
  return {
    state: (allDone ? "INSTALLED" : "PARTIAL_INSTALL") as InstallState,
    completed,
    failed,
    tables: eyisObjects,
  };
}

/** Nächste noch offene Unit — Grundlage für den Agent Execution Plan. */
export function nextUnit(manifest: Manifest, env: NodeJS.ProcessEnv = {}) {
  const status = detectState(manifest, env);
  if (status.state === "INSTALLED") return null;
  return (
    manifest.fresh_install.units.find(
      (unit) => !status.completed.includes(unit.id) || status.failed.includes(unit.id),
    ) ?? null
  );
}

function recordUnit(unit: ManifestUnit, status: string, env: NodeJS.ProcessEnv, error?: string) {
  if (!tableExists("eyis_installation_units", env)) return;
  const safeError = error ? `'${error.slice(0, 400).replace(/'/g, "''")}'` : "null";
  psql(
    `insert into public.eyis_installation_units (unit_id, position, checksum, status, started_at, completed_at, error_message)
     values ('${unit.id}', ${unit.position}, '${unit.checksum}', '${status}', now(),
             ${status === "PASS" ? "now()" : "null"}, ${safeError})
     on conflict (unit_id) do update set status = excluded.status, checksum = excluded.checksum,
       completed_at = excluded.completed_at, error_message = excluded.error_message, updated_at = now()`,
    env,
  );
}

export type RunOptions = { env?: NodeJS.ProcessEnv; stopAfter?: number; onUnit?: (u: ManifestUnit) => void };

/**
 * Wendet alle offenen Units an. Baseline wird niemals über eine bestehende
 * Installation gelegt — das ist eine harte Sperre, keine Empfehlung.
 */
export function preflightDirectDdl(env: NodeJS.ProcessEnv = {}): { ok: boolean; reason?: string } {
  try {
    psql("select 1", env);
  } catch (error) {
    return { ok: false, reason: `Kein direkter Datenbankzugang: ${error instanceof Error ? error.message : String(error)}` };
  }
  try {
    psql("create table if not exists public.eyis_ddl_probe(id int); drop table if exists public.eyis_ddl_probe", env);
  } catch (error) {
    return {
      ok: false,
      reason: `Der verfügbare Datenbankbenutzer darf kein DDL im Schema public ausführen (${
        error instanceof Error ? error.message.split("\n")[0] : String(error)
      }).`,
    };
  }
  return { ok: true };
}

export class DirectDdlUnavailableError extends Error {
  code = "DIRECT_DDL_UNAVAILABLE";
  constructor(reason: string) {
    super(
      `${reason}\n\nDas ist auf einer frischen Lovable-Cloud-Datenbank der Normalfall. ` +
        "Verwende den Agent Migration Plan: `bun run installer/eyis.ts plan`, " +
        "danach je Schritt `bun run installer/eyis.ts step <n>` über das Plattform-Migration-Tool anwenden.",
    );
    this.name = "DirectDdlUnavailableError";
  }
}

export function runFreshInstall(manifest: Manifest, options: RunOptions = {}) {
  const env = options.env ?? {};
  // Kein blindes psql mehr: fehlt das Recht, wird sauber auf den Agent
  // Migration Plan verwiesen statt mitten in Unit 000 abzubrechen.
  const preflight = preflightDirectDdl(env);
  if (!preflight.ok) throw new DirectDdlUnavailableError(preflight.reason!);
  // Harte Sperre: ohne bestandenes Pack-Gate wird keine SQL-Anweisung ausgeführt.
  assertPackGate({ ...process.env, ...env });
  const before = detectState(manifest, env);
  if (before.state === "INSTALLED") {
    throw new Error("EYIS ist bereits installiert. Der Database Install Pack darf nur für Fresh Installs laufen.");
  }


  const applied: string[] = [];
  const skipped: string[] = [];
  for (const unit of manifest.fresh_install.units) {
    const status = detectState(manifest, env);
    if (status.completed.includes(unit.id) && !status.failed.includes(unit.id)) {
      skipped.push(unit.id);
      continue;
    }
    const sql = unitSql(unit);
    if (checksum(sql) !== unit.checksum) {
      throw new Error(`Checksumme der Unit ${unit.id} weicht vom Manifest ab.`);
    }
    recordUnit(unit, "RUNNING", env);
    try {
      psqlFile(join(PACK_DIR, unit.file), env);
    } catch (error) {
      recordUnit(unit, "FAIL", env, error instanceof Error ? error.message : String(error));
      throw error;
    }
    recordUnit(unit, "PASS", env);
    applied.push(unit.id);
    options.onUnit?.(unit);
    if (options.stopAfter && applied.length >= options.stopAfter) break;
  }
  return { applied, skipped };
}

export function runSeeds(manifest: Manifest, env: NodeJS.ProcessEnv = {}) {
  for (const seed of manifest.system_seeds) {
    const sql = readFileSync(join(PACK_DIR, seed.file), "utf8");
    if (checksum(sql) !== seed.checksum) throw new Error(`Checksumme des Seeds ${seed.id} weicht ab.`);
    psqlFile(join(PACK_DIR, seed.file), env);
  }
  return manifest.system_seeds.map((s) => s.id);
}

export function markInstalled(manifest: Manifest, env: NodeJS.ProcessEnv = {}) {
  psql(
    `insert into public.eyis_installation_state
       (id, baseline_version, schema_version, migration_head, schema_fingerprint, state, completed_at)
     values (true, '${manifest.version}', '${manifest.schema_version}', '${manifest.migration_head}',
             '${manifest.schema_fingerprint}', 'INSTALLED', now())
     on conflict (id) do update set state = 'INSTALLED', completed_at = now(),
       schema_fingerprint = excluded.schema_fingerprint, updated_at = now()`,
    env,
  );
}
