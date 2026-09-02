/**
 * Phase 31 — Technical Blackbox gegen einen frisch installierten, isolierten
 * Cluster (Schritt 1 des Freigabeplans, plattformunabhängiger Teil).
 *
 *   bun run qa:technical-blackbox
 *
 * Der Cluster wird lokal und temporär gestartet, ausschließlich über das
 * signierte Database Install Pack aufgebaut und danach über eine echte
 * PostgREST-Daten-API angesprochen. Alle Prüfungen laufen gegen den echten
 * Anwendungscode (Bootstrap, Claim, Doctor, Store-API-Gateway, Engines).
 * Nichts wird simuliert: was ohne echte Lovable-Plattformdienste (GoTrue,
 * Storage, Hosting, pg_cron) nicht beweisbar ist, wird als
 * LOVABLE_PLATFORM_VALIDATION_REQUIRED ausgewiesen.
 *
 * Dev/QA only — niemals gegen Production.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { openSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { startCluster } from "./database-installer";
import {
  loadManifest,
  markInstalled,
  psql,
  psqlFile,
  runFreshInstall,
  runSeeds,
} from "../scripts/installer/runner";

type Status = "PASS" | "FAIL" | "LOVABLE_PLATFORM_VALIDATION_REQUIRED";
type Row = { area: string; name: string; status: Status; detail: string };

const rows: Row[] = [];
function record(area: string, name: string, status: Status, detail = "") {
  rows.push({ area, name, status, detail });
  console.log(`${status.padEnd(38)} ${area} — ${name}${detail ? ` — ${detail}` : ""}`);
}
function check(area: string, name: string, ok: boolean, detail = "") {
  record(area, name, ok ? "PASS" : "FAIL", detail);
}
function platform(area: string, name: string, detail: string) {
  record(area, name, "LOVABLE_PLATFORM_VALIDATION_REQUIRED", detail);
}

const JWT_SECRET = "eyis-local-blackbox-jwt-secret-0123456789abcdef";
const PGRST_PORT = 3931;
const API_PORT = 3932;

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}
function signJwt(payload: Record<string, unknown>) {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(
    JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 7200 }),
  );
  const sig = createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

/**
 * Supabase-Standardrechte: die Plattform setzt Default Privileges auf `public`,
 * damit neu erzeugte Tabellen für anon/authenticated/service_role erreichbar
 * sind. Muss VOR der Installation gesetzt werden — genau wie in Lovable Cloud.
 */
function preparePlatformGrants(env: NodeJS.ProcessEnv) {
  psql(
    `grant usage on schema public to anon, authenticated, service_role;
     alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
     alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
     alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;`,
    env,
  );
}

/** Plattform-Kompatibilitätsschicht (wird in Lovable Cloud von Supabase gestellt). */
function preparePlatformLayer(env: NodeJS.ProcessEnv) {
  psql(
    `create role authenticator login noinherit;
     grant anon, authenticated, service_role to authenticator;
     grant usage on schema public to anon, authenticated, service_role;
     -- PostgREST >= 12 setzt ausschließlich request.jwt.claims.
     create or replace function auth.uid() returns uuid language sql stable as $fn$
       select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', ''), '')::uuid $fn$;
     create or replace function auth.role() returns text language sql stable as $fn$
       select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'anon') $fn$;
     create or replace function auth.jwt() returns jsonb language sql stable as $fn$
       select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $fn$;`,
    env,
  );
}

async function waitFor(url: string, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return true;
    } catch {
      /* noch nicht bereit */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function startPostgrest(socket: string, dir: string): ChildProcess {
  const conf = join(dir, "postgrest.conf");
  writeFileSync(
    conf,
    [
      `db-uri = "postgres://authenticator@/postgres?host=${socket}&port=5432"`,
      `db-schemas = "public"`,
      `db-anon-role = "anon"`,
      `db-extra-search-path = "public, extensions"`,
      `jwt-secret = "${JWT_SECRET}"`,
      `server-port = ${PGRST_PORT}`,
      `db-pool = 6`,
      `log-level = "error"`,
      "",
    ].join("\n"),
  );
  const bin = execFileSync("bash", ["-lc", "nix build --no-link --print-out-paths nixpkgs#postgrest 2>/dev/null | head -1"], {
    encoding: "utf8",
  }).trim();
  const exe = bin ? join(bin, "bin", "postgrest") : "postgrest";
  return spawn(exe, [conf], { stdio: ["ignore", "ignore", openSync("/tmp/eyis-postgrest.log", "w")] });
}

/** Supabase-kompatibler Endpunkt: /rest/v1/* -> PostgREST, /storage/v1/* -> nicht verfügbar. */
function startApiProxy() {
  return Bun.serve({
    port: API_PORT,
    idleTimeout: 60,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname.startsWith("/rest/v1")) {
        const target = `http://127.0.0.1:${PGRST_PORT}${url.pathname.slice("/rest/v1".length) || "/"}${url.search}`;
        const headers = new Headers(req.headers);
        headers.delete("host");
        headers.delete("apikey");
        const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();
        return fetch(target, { method: req.method, headers, body });
      }
      // GoTrue und Storage existieren lokal nicht — kein Fake, klare Absage.
      return new Response(JSON.stringify({ message: "service unavailable in isolated cluster" }), {
        status: 501,
        headers: { "content-type": "application/json" },
      });
    },
  });
}

async function main() {
  const manifest = loadManifest();
  const cluster = startCluster();
  const socket = String(cluster.env["PGHOST"]);
  let pgrst: ChildProcess | undefined;
  let proxy: ReturnType<typeof startApiProxy> | undefined;

  try {
    // ---------------------------------------------------------------- Install
    preparePlatformGrants(cluster.env);
    const result = runFreshInstall(manifest, { env: cluster.env });
    check(
      "Installation",
      "Database Install Pack angewendet",
      result.applied.length === manifest.fresh_install.units.length,
      `${result.applied.length}/${manifest.fresh_install.units.length} Units`,
    );
    const seeds = runSeeds(manifest, cluster.env);
    check("Installation", "System Seeds angewendet", seeds.length > 0, `${seeds.length} Seeds`);
    psqlFile(join(process.cwd(), "installer", "database", manifest.migration_history_reconciliation.file), cluster.env);
    markInstalled(manifest, cluster.env);

    preparePlatformLayer(cluster.env);
    pgrst = startPostgrest(socket, socket.replace(/\/sock$/, ""));
    proxy = startApiProxy();
    const ready = await waitFor(`http://127.0.0.1:${API_PORT}/rest/v1/`);
    check("Installation", "Daten-API (PostgREST) erreichbar", ready, `port ${API_PORT}`);
    if (!ready) return;

    process.env["SUPABASE_URL"] = `http://127.0.0.1:${API_PORT}`;
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = signJwt({ role: "service_role" });
    process.env["SUPABASE_PUBLISHABLE_KEY"] = signJwt({ role: "anon" });
    process.env["APP_ENV"] = "development";
    process.env["COMMERCE_DEPLOYMENT_MODE"] = "dedicated";

    await runChecks(cluster.env);
  } finally {
    proxy?.stop(true);
    pgrst?.kill("SIGKILL");
    cluster.stop();
  }

  const failed = rows.filter((r) => r.status === "FAIL");
  const blocked = rows.filter((r) => r.status === "LOVABLE_PLATFORM_VALIDATION_REQUIRED");
  console.log("\n" + "=".repeat(78));
  console.log(`TECHNICAL BLACKBOX: ${rows.length - failed.length - blocked.length}/${rows.length - blocked.length} PASS`);
  console.log(`LOVABLE PLATFORM VALIDATION REQUIRED: ${blocked.length}`);
  if (failed.length) {
    console.log("\nFAILS:");
    for (const f of failed) console.log(`  ${f.area} — ${f.name}: ${f.detail}`);
    process.exitCode = 1;
  }
  writeFileSync("qa/results-phase31-technical-blackbox.json", JSON.stringify(rows, null, 2));
}

async function runChecks(pgEnv: NodeJS.ProcessEnv) {
  const inst = await import("../src/lib/commerce/system/installation.server");

  // ------------------------------------------------------------- Bootstrap
  const boot = await inst.runBootstrap({ ownerEmail: "owner@isolated.test" });
  check("Bootstrap", "Bootstrap gegen frische Datenbank", boot.ok === true, boot.steps.join(" | "));
  check("Bootstrap", "Pending Owner vorbereitet", boot.claimState === "AWAITING_OWNER_REGISTRATION", boot.claimState);
  check("Bootstrap", "Kein Claim-Token im Antwortkörper", boot.claimToken === null, "recovery token bleibt intern");

  const singleton = Number(psql("select count(*) from public.commerce_installation", pgEnv).trim());
  check("Bootstrap", "Installation-Singleton genau einmal", singleton === 1, `rows=${singleton}`);

  let idempotentCode = "";
  try {
    await inst.runBootstrap({ ownerEmail: "owner@isolated.test" });
  } catch (e) {
    idempotentCode = e instanceof inst.InstallationError ? e.code : "UNEXPECTED";
  }
  check(
    "Bootstrap",
    "Bootstrap-Idempotenz (zweiter Lauf gesperrt)",
    idempotentCode === "INSTALLATION_ALREADY_INITIALIZED",
    `code=${idempotentCode}`,
  );
  const afterSecond = Number(psql("select count(*) from public.commerce_installation", pgEnv).trim());
  check("Bootstrap", "Zweiter Bootstrap ohne Nebenwirkung", afterSecond === 1, `rows=${afterSecond}`);

  // ----------------------------------------------------------- Owner Claim
  const ownerId = randomUUID();
  psql(
    `insert into auth.users (id, email, raw_user_meta_data) values ('${ownerId}', 'owner@isolated.test', '{}'::jsonb)`,
    pgEnv,
  );
  const claim = await inst.autoClaimOwner({
    userId: ownerId,
    email: "owner@isolated.test",
    emailVerified: true,
    organizationName: "Isolated Test Handel",
    shopName: "Hauptshop",
  });
  check("Owner", "Auto-Claim des vorbereiteten Owners", !!claim.organizationId && !!claim.shopId, `org=${claim.organizationId}`);
  platform(
    "Owner",
    "Registrierung + E-Mail-Bestätigung des Owners (GoTrue)",
    "Identität/Verifikation stammt aus Supabase Auth; lokal kein GoTrue vorhanden — Claim wurde mit serverseitig gesetzten, verifizierten Auth-Claims geprüft",
  );

  const orgId = claim.organizationId;
  const shopId = claim.shopId;

  const orgCount = Number(psql("select count(*) from public.organizations", pgEnv).trim());
  const shopCount = Number(psql("select count(*) from public.shops", pgEnv).trim());
  check("Owner", "Organisation + Hauptshop angelegt", orgCount === 1 && shopCount === 1, `orgs=${orgCount}, shops=${shopCount}`);
  const roleRow = psql(
    `select role from public.memberships where organization_id='${orgId}' and user_id='${ownerId}'`,
    pgEnv,
  ).trim();
  check("Owner", "Owner-Rolle vergeben", roleRow === "owner", `role=${roleRow || "none"}`);

  let secondClaim = "";
  try {
    await inst.autoClaimOwner({
      userId: randomUUID(),
      email: "owner@isolated.test",
      emailVerified: true,
      organizationName: "Zweiter Versuch",
      shopName: "Shop",
    });
  } catch (e) {
    secondClaim = e instanceof inst.InstallationError ? e.code : "UNEXPECTED";
  }
  check("Owner", "Zweiter Claim abgelehnt", secondClaim === "OWNER_ALREADY_CLAIMED", `code=${secondClaim}`);

  // ------------------------------------------------------- Default Settings
  const defaults: [string, string][] = [
    ["Steuerklassen", `select count(*) from public.tax_classes where organization_id='${orgId}'`],
    ["Steuer-Settings", `select count(*) from public.tax_settings where shop_id='${shopId}'`],
    ["Nummernkreise", `select count(*) from public.document_sequences where shop_id='${shopId}'`],
    ["Lagerort", `select count(*) from public.inventory_locations where shop_id='${shopId}' and status='active'`],
  ];
  for (const [name, sql] of defaults) {
    const n = Number(psql(sql, pgEnv).trim());
    check("Default Settings", name, n > 0, `${n} Zeilen`);
  }
  const currency = psql(`select currency || '/' || locale from public.shops where id='${shopId}'`, pgEnv).trim();
  check("Default Settings", "Shop-Währung und Locale gesetzt", currency.includes("/") && !currency.startsWith("/"), currency);

  // ------------------------------------------------------------ System Seeds
  const seedChecks: [string, string][] = [
    ["Rollen/Rechte", "select count(*) from public.role_permissions"],
    ["Produkt-Blueprints", "select count(*) from public.product_blueprints"],
    ["Kommunikations-Vorlagen", "select count(*) from public.communication_templates"],
  ];
  for (const [name, sql] of seedChecks) {
    const n = Number(psql(sql, pgEnv).trim());
    check("System Seeds", name, n > 0, `${n} Zeilen`);
  }

  // ------------------------------------------------------------- RLS/Grants
  const noRls = psql(
    `select coalesce(string_agg(c.relname, ', '), '') from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`,
    pgEnv,
  ).trim();
  check("RLS/Grants", "Alle public-Tabellen mit RLS", noRls === "", noRls || "0 Lücken");
  const noPolicy = psql(
    `select coalesce(string_agg(c.relname, ', '), '') from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r' and c.relrowsecurity
       and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname)
       and exists (select 1 from information_schema.role_table_grants g
                    where g.table_schema='public' and g.table_name=c.relname
                      and g.grantee in ('anon','authenticated'))`,
    pgEnv,
  ).trim();
  check("RLS/Grants", "Keine erreichbare Tabelle ohne Policy", noPolicy === "", noPolicy || "0 Lücken");
  const noGrant = psql(
    `select coalesce(string_agg(c.relname, ', '), '') from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r'
       and not exists (select 1 from information_schema.role_table_grants g
                        where g.table_schema='public' and g.table_name=c.relname and g.grantee='service_role')`,
    pgEnv,
  ).trim();
  check("RLS/Grants", "service_role auf allen Tabellen berechtigt", noGrant === "", noGrant || "0 Lücken");

  // ----------------------------------------------------------------- Doctor
  const doctor = await inst.runDoctor();
  for (const r of doctor) console.log(`      doctor: ${r.status.padEnd(15)} ${r.check}${r.detail ? ` — ${r.detail}` : ""}`);
  const doctorFails = doctor.filter((r) => r.status === "FAIL");
  check("Doctor", "Kein FAIL im Doctor", doctorFails.length === 0, doctorFails.map((f) => `${f.check}: ${f.detail ?? ""}`).join(" | ") || `${doctor.length} Prüfungen`);
  const doctorSetup = doctor.filter((r) => r.status === "SETUP REQUIRED" || r.status === "BLOCKED");
  if (doctorSetup.length) {
    platform(
      "Doctor",
      "Prüfungen mit Plattform-/Provider-Abhängigkeit",
      doctorSetup.map((d) => `${d.check}=${d.status}`).join(", "),
    );
  }
  platform("Doctor", "Storage-Buckets", "Supabase Storage existiert im isolierten Cluster nicht");

  return { orgId, shopId, ownerId };
}

main().catch((e) => {
  console.error("HARNESS ERROR", e);
  process.exitCode = 1;
});
