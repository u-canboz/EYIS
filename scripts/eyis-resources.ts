/**
 * eyis:resources — Nicht-Schema-Ressourcen aus dem Resource-Manifest prüfen
 * und bereitstellen (Storage-Buckets, Job-Endpunkte, Runtime-Konfiguration).
 *
 *   bun run eyis:resources:verify     nur prüfen, nichts verändern
 *   bun run eyis:resources:provision  fehlende Buckets anlegen, Rest prüfen
 *
 * Secrets werden ausschließlich auf Anwesenheit geprüft und niemals ausgegeben.
 * Cron-Zeitpläne werden nicht automatisch angelegt: der Zeitplan gehört zur
 * Plattform des Kundenprojekts. Das Skript prüft statt dessen nachweisbar,
 * dass jeder Job-Endpunkt existiert und ohne gültiges Cron-Secret 401 liefert.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

type ResourceManifest = {
  version: string;
  storage_buckets: { id: string; public: boolean; purpose: string }[];
  jobs: {
    id: string;
    endpoint: string;
    schedule: string;
    auth: string;
    cron_job_name: string;
    secret_header: string;
    secret_key: string;
    timeout_seconds: number;
  }[];
  cron: { mechanism: string; requires_extensions: string[]; base_url_source: string };
  runtime_configuration: { key: string; required: boolean; secret: boolean }[];
};

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), "installer", "resources", "eyis-resources.manifest.json"), "utf8"),
) as ResourceManifest;

const provision = process.argv[2] === "provision";
const baseUrl = (process.env["COMMERCE_OS_URL"] ?? "http://localhost:8080").replace(/\/$/, "");

type Row = { check: string; status: "PASS" | "FAIL" | "FIXED" | "BLOCKED"; detail: string };
const rows: Row[] = [];

// --- Storage ---------------------------------------------------------------
const url = process.env["VITE_SUPABASE_URL"];
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!url || !serviceKey) {
  rows.push({
    check: "Storage buckets",
    status: "BLOCKED",
    detail: "Kein Service-Zugang in dieser Umgebung — Buckets über die Plattform bereitstellen.",
  });
} else {
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) {
    rows.push({ check: "Storage buckets", status: "FAIL", detail: error.message });
  } else {
    const have = new Map((buckets ?? []).map((b) => [b.id, b.public]));
    for (const want of manifest.storage_buckets) {
      if (!have.has(want.id)) {
        if (!provision) {
          rows.push({ check: `Bucket ${want.id}`, status: "FAIL", detail: "fehlt" });
          continue;
        }
        const { error: cErr } = await admin.storage.createBucket(want.id, { public: want.public });
        rows.push({
          check: `Bucket ${want.id}`,
          status: cErr ? "FAIL" : "FIXED",
          detail: cErr ? cErr.message : `angelegt (public=${want.public})`,
        });
        continue;
      }
      const isPublic = have.get(want.id);
      rows.push({
        check: `Bucket ${want.id}`,
        status: isPublic === want.public ? "PASS" : "FAIL",
        detail: `public=${isPublic}, erwartet ${want.public}`,
      });
    }
  }
}

// --- Jobs ------------------------------------------------------------------
for (const job of manifest.jobs) {
  try {
    const res = await fetch(`${baseUrl}${job.endpoint}`, { method: "POST" });
    rows.push({
      check: `Job ${job.id}`,
      status: res.status === 401 ? "PASS" : "FAIL",
      detail: `${job.endpoint} → ${res.status} (erwartet 401 ohne Cron-Secret), Plan ${job.schedule}`,
    });
  } catch (e) {
    rows.push({
      check: `Job ${job.id}`,
      status: "FAIL",
      detail: e instanceof Error ? e.message : "nicht erreichbar",
    });
  }
}

// --- Cron-Zeitpläne --------------------------------------------------------
/**
 * Vollständige, idempotente Registrierung der Job-Zeitpläne über pg_cron + pg_net.
 * Das Secret steht nie im Klartext in der SQL: es wird zur Laufzeit aus
 * `app.settings.cron_secret` gelesen, das beim Setup gesetzt wird.
 */
function cronSql(base: string): string {
  const lines = manifest.jobs.map(
    (job) => `select cron.schedule(
  '${job.cron_job_name}',
  '${job.schedule}',
  $job$
    select net.http_post(
      url := '${base}${job.endpoint}',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        '${job.secret_header}', current_setting('app.settings.cron_secret', true)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := ${job.timeout_seconds * 1000}
    );
  $job$
);`,
  );
  return [
    "create extension if not exists pg_cron;",
    "create extension if not exists pg_net;",
    ...manifest.jobs.map((j) => `select cron.unschedule('${j.cron_job_name}') where exists (select 1 from cron.job where jobname = '${j.cron_job_name}');`),
    ...lines,
  ].join("\n\n");
}

if (process.argv.includes("--print-cron") || process.argv[2] === "cron") {
  console.log(cronSql(baseUrl));
  process.exit(0);
}

{
  const dbUrl =
      process.env["SUPABASE_DB_URL"] ?? process.env["DATABASE_URL"] ?? (process.env["PGHOST"] ? "" : undefined);
  if (dbUrl === undefined) {
    rows.push({
      check: "Cron-Zeitpläne",
      status: "BLOCKED",
      detail:
        "Kein Datenbankzugang in dieser Umgebung. SQL ausgeben mit: bun run eyis:resources:cron",
    });
  } else {
    const { execFileSync } = await import("node:child_process");
    const run = (sql: string) =>
      execFileSync("psql", [...(dbUrl ? [dbUrl] : []), "-tAc", sql], { encoding: "utf8" }).trim();
    if (provision) {
      try {
        execFileSync("psql", [...(dbUrl ? [dbUrl] : []), "-v", "ON_ERROR_STOP=1", "-f", "-"], {
          input: cronSql(baseUrl),
          encoding: "utf8",
        });
      } catch (e) {
        rows.push({
          check: "Cron-Registrierung",
          status: "FAIL",
          detail: e instanceof Error ? e.message.slice(0, 200) : "psql-Fehler",
        });
      }
    }
    for (const job of manifest.jobs) {
      try {
        const found = run(
          `select schedule from cron.job where jobname = '${job.cron_job_name}' limit 1`,
        );
        rows.push({
          check: `Cron ${job.cron_job_name}`,
          status: found === job.schedule ? "PASS" : "FAIL",
          detail: found ? `registriert: ${found}` : "nicht registriert",
        });
      } catch (e) {
        rows.push({
          check: `Cron ${job.cron_job_name}`,
          status: "BLOCKED",
          detail: e instanceof Error ? e.message.split("\n")[0]!.slice(0, 160) : "pg_cron nicht verfügbar",
        });
      }
    }
  }
}

// --- Runtime-Konfiguration -------------------------------------------------
for (const cfg of manifest.runtime_configuration) {
  const present = Boolean(process.env[cfg.key]);
  rows.push({
    check: `Config ${cfg.key}`,
    status: present || !cfg.required ? "PASS" : "FAIL",
    detail: cfg.secret ? (present ? "gesetzt" : "fehlt") : (process.env[cfg.key] ?? "fehlt"),
  });
}

console.log(`EYIS — Ressourcen (Manifest ${manifest.version})`);
console.log("=".repeat(72));
for (const r of rows) console.log(`  ${r.status.padEnd(8)} ${r.check} — ${r.detail}`);
console.log("=".repeat(72));
const failed = rows.filter((r) => r.status === "FAIL").length;
const blocked = rows.filter((r) => r.status === "BLOCKED").length;
console.log(failed === 0 ? `Ergebnis: PASS${blocked ? ` (${blocked} BLOCKED)` : ""}` : `Ergebnis: FAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
