/**
 * Erzeugt die maschinenlesbaren Manifeste unter docs/agent/ und im Repo-Root.
 *
 * Ausführen: `bun run generate:manifests`
 * Prüfen (kein Schreiben, Exit 1 bei Abweichung): `bun run generate:manifests -- --check`
 *
 * Quellen (in dieser Reihenfolge maßgeblich):
 *   1. Code            — src/routes/**, src/lib/commerce/store/routes.server.ts
 *   2. Migrationen     — supabase/migrations/*.sql (letzter Dateiname)
 *   3. Modul-Definition— scripts/manifest/modules.def.ts (pfadgeprüft)
 */

import { readdirSync, readFileSync, statSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";
import { MODULES } from "./modules.def";
import {
  STORE_API_BASE_PATH,
  STORE_API_GROUPS,
  STORE_ERROR_CODES,
  STORE_HEADERS,
  STORE_RATE_LIMITS,
} from "../../src/lib/commerce/store/api-catalog";

export const GENERATOR_VERSION = "1.0.0";
/**
 * Teilt die Befehle danach, ob alle referenzierten Skripte im
 * Release-Artefakt liegen. Befehle ohne Skriptverweis (vite, eslint …) gelten
 * als installiert, weil sie zum Kundenprojekt selbst gehören.
 */
function splitCommands(scripts: Record<string, string>) {
  const shipped = new Set(artifactFiles());
  const installed: Record<string, string> = {};
  const repositoryOnly: Record<string, string> = {};
  for (const [name, command] of Object.entries(scripts)) {
    const refs = referencedScripts(command);
    const nested = [...command.matchAll(/bun run ([\w:.-]+)/g)].map((m) => m[1]!);
    const nestedRefs = nested.flatMap((n) => referencedScripts(scripts[n] ?? ""));
    const all = [...refs, ...nestedRefs];
    if (all.every((s) => shipped.has(s))) installed[name] = command;
    else repositoryOnly[name] = command;
  }
  return { installed, repositoryOnly };
}

const ROOT = process.cwd();
const CHECK = process.argv.includes("--check");

const problems: string[] = [];
const fail = (msg: string) => problems.push(msg);

// ---------------------------------------------------------------- provenance

function gitCommit(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function latestMigration(): string {
  const dir = join(ROOT, "supabase/migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files.at(-1) ?? "none";
}

function provenance() {
  return {
    generated_at: new Date().toISOString(),
    source_commit: gitCommit(),
    latest_migration: latestMigration(),
    generator_version: GENERATOR_VERSION,
    generated_by: "scripts/manifest/generate.ts",
    note: "Generierte Datei. Nicht von Hand bearbeiten — `bun run generate:manifests` ausführen.",
  };
}

// ------------------------------------------------------------------- helpers

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else out.push(abs);
  }
  return out;
}

/** src/routes/foo.bar.tsx -> /foo/bar ; index -> / ; $id -> :id ; _x pathless */
function routePathFromFile(rel: string): string | null {
  let p = rel.replace(/^src\/routes\//, "").replace(/\.(tsx|ts)$/, "");
  if (p === "__root") return null;
  const segments: string[] = [];
  for (const raw of p.split("/").flatMap((s) => s.split("."))) {
    if (raw === "route" || raw === "index") continue;
    if (raw.startsWith("_")) continue; // pathless layout
    if (raw === "$") segments.push("*");
    else if (raw.startsWith("$")) segments.push(`:${raw.slice(1)}`);
    else segments.push(raw);
  }
  return "/" + segments.join("/");
}

function classify(url: string, source: string) {
  if (url.startsWith("/api/public/store/v1")) return "public-store-api";
  if (url.startsWith("/api/public/jobs")) return "job-endpoint";
  if (url.startsWith("/api/public/webhooks")) return "webhook";
  if (url.startsWith("/api/public")) return "public-api";
  if (url.startsWith("/api")) return "internal-api";
  if (source.includes("/_authenticated/")) return "backoffice";
  if (url.startsWith("/store")) return "storefront";
  if (url.startsWith("/portal")) return "customer-portal";
  return "public-page";
}

function authFor(kind: string, url: string) {
  switch (kind) {
    case "backoffice":
      return "supabase-session (Gate: src/routes/_authenticated/route.tsx)";
    case "public-store-api":
      return "publishable key (X-Commerce-Key) + optional cart/customer/guest token";
    case "job-endpoint":
      return "LOVABLE_CRON_SECRET (authenticateCronRequest)";
    case "webhook":
      return "provider signature verification";
    case "customer-portal":
      return "customer session / guest token";
    default:
      return url.startsWith("/api") ? "server-side check in handler" : "public";
  }
}

// ------------------------------------------------------------------ routes.json

function buildRoutes() {
  const files = walk(join(ROOT, "src/routes"))
    .map((f) => relative(ROOT, f))
    .filter((f) => /\.(tsx|ts)$/.test(f) && !f.includes("__tests__"))
    .sort();

  const routes = files
    .map((source) => {
      const url = routePathFromFile(source);
      if (url === null) return null;
      const body = readFileSync(join(ROOT, source), "utf8");
      const kind = classify(url, source);
      const methods = kind.includes("api") || kind === "webhook" || kind === "job-endpoint"
        ? [...new Set([...body.matchAll(/\b(GET|POST|PATCH|PUT|DELETE):\s/g)].map((m) => m[1]))]
        : ["GET"];
      return {
        url,
        source,
        kind,
        methods: methods.length ? methods : ["GET"],
        auth: authFor(kind, url),
        ssr: !/ssr:\s*false/.test(body),
      };
    })
    .filter(Boolean);

  const byKind: Record<string, number> = {};
  for (const r of routes as { kind: string }[]) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;

  return { ...provenance(), total: routes.length, by_kind: byKind, routes };
}

// ------------------------------------------------- store-api-v1.json + openapi

/** Liest method/path/profile direkt aus dem Laufzeit-Router. */
function routerEndpoints() {
  const src = readFileSync(join(ROOT, "src/lib/commerce/store/routes.server.ts"), "utf8");
  const re = /method:\s*"(GET|POST|PATCH|DELETE)",\s*\n\s*path:\s*"([^"]+)"/g;
  return [...src.matchAll(re)].map((m) => ({ method: m[1]!, path: m[2]! }));
}

function buildStoreApi() {
  const catalog = STORE_API_GROUPS.flatMap((g) =>
    g.endpoints.map((e) => ({ ...e, group: g.key, groupTitle: g.title })),
  );
  const router = routerEndpoints();

  const key = (e: { method: string; path: string }) => `${e.method} ${e.path}`;
  const catalogKeys = new Set(catalog.map(key));
  const routerKeys = new Set(router.map(key));
  for (const k of routerKeys) if (!catalogKeys.has(k)) fail(`Store API: ${k} fehlt in api-catalog.ts`);
  for (const k of catalogKeys) if (!routerKeys.has(k)) fail(`Store API: ${k} fehlt in routes.server.ts`);

  return {
    ...provenance(),
    api_version: "v1",
    base_path: STORE_API_BASE_PATH,
    endpoint_count: catalog.length,
    router_endpoint_count: router.length,
    headers: STORE_HEADERS,
    rate_limits: STORE_RATE_LIMITS,
    error_codes: STORE_ERROR_CODES,
    groups: STORE_API_GROUPS,
    endpoints: catalog,
  };
}

function buildOpenApi(store: ReturnType<typeof buildStoreApi>) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const e of store.endpoints) {
    const p = STORE_API_BASE_PATH + e.path.replace(/\{(\w+)\}/g, "{$1}");
    paths[p] ??= {};
    paths[p]![e.method.toLowerCase()] = {
      tags: [e.groupTitle],
      summary: e.summary,
      description: `Auth: ${e.auth} · Rate-Profil: ${e.profile} · SDK: \`${e.sdk}\``,
      security: [{ PublishableKey: [] }],
      responses: {
        "200": { description: e.output },
        ...Object.fromEntries(
          e.errors.map((code) => {
            const def = STORE_ERROR_CODES.find((c) => c.code === code);
            return [def?.status ?? "400", { description: `${code} — ${def?.meaning ?? ""}` }];
          }),
        ),
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "EYIS — Public Store API",
      version: "1.0.0",
      description:
        "Öffentliche Storefront-Schnittstelle. Generiert aus src/lib/commerce/store/api-catalog.ts " +
        "durch scripts/manifest/generate.ts. Provenienz: docs/agent/store-api-v1.json.",
    },
    servers: [{ url: "https://{host}", variables: { host: { default: "your-commerce-os.lovable.app" } } }],
    components: {
      securitySchemes: {
        PublishableKey: { type: "apiKey", in: "header", name: "X-Commerce-Key" },
      },
    },
    paths,
  };
}

// ------------------------------------------------------------- modules.json

function buildModules() {
  for (const m of MODULES) {
    for (const p of m.paths) {
      if (!existsSync(join(ROOT, p))) fail(`Modul ${m.id}: Pfad existiert nicht — ${p}`);
    }
    for (const t of m.tests) {
      if (!existsSync(join(ROOT, t))) fail(`Modul ${m.id}: Test/Nachweis fehlt — ${t}`);
    }
    for (const d of m.depends_on) {
      if (!MODULES.some((x) => x.id === d)) fail(`Modul ${m.id}: unbekannte Abhängigkeit ${d}`);
    }
  }
  return { ...provenance(), count: MODULES.length, modules: MODULES };
}

// -------------------------------------------------------------- root manifest

function buildRootManifest(
  routes: ReturnType<typeof buildRoutes>,
  store: ReturnType<typeof buildStoreApi>,
  modules: ReturnType<typeof buildModules>,
) {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  return {
    ...provenance(),
    name: "commerce-os",
    product: "EYIS",
    description:
      "Mandantenfähige Commerce-Engine (Backoffice, Store API v1, Store SDK, Referenz-Storefront).",
    version: "1.0.0-rc1",
    status: "V1 frozen — production hardening",
    stack: {
      framework: "TanStack Start v1 (React 19, Vite 7)",
      runtime: "Cloudflare Worker (edge)",
      styling: "Tailwind CSS v4",
      backend: "Lovable Cloud (Supabase: Postgres, Auth, Storage)",
      package_manager: "bun",
    },
    public_api_version: "v1",
    sdk_version: "1.0.0",
    sdk_distribution: "repository-source",
    compatible_api_versions: ["v1"],
    sdk_path: "src/lib/store-sdk",
    store_api_base_path: STORE_API_BASE_PATH,
    operating_modes: [
      {
        id: "A",
        name: "Neuer Kunde im bestehenden EYIS",
        needs_new_database: false,
        summary: "Neue Organisation + Shop in der bestehenden Installation. Kein neues Backend.",
      },
      {
        id: "B",
        name: "Neue Storefront (React/Lovable)",
        needs_new_database: false,
        summary: "Eigenes Frontend-Projekt, angebunden per API-URL + Publishable Key über das SDK.",
      },
      {
        id: "C",
        name: "Dedicated Deployment",
        needs_new_database: true,
        summary:
          "Eigenständige Commerce-OS-Installation mit eigener Datenbank, Auth, Storage und Secrets. Nur auf ausdrücklichen Wunsch.",
      },
    ],
    counts: {
      modules: modules.count,
      routes: routes.total,
      store_api_endpoints: store.endpoint_count,
      migrations: readdirSync(join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql"))
        .length,
      public_tables: 112,
    },
    entry_points: {
      agent_rules: "AGENTS.md",
      start_here: "docs/agent/START_HERE.md",
      architecture: "docs/agent/ARCHITECTURE_MAP.md",
      security: "docs/agent/SECURITY_BOUNDARIES.md",
      modules: "docs/agent/modules.json",
      routes: "docs/agent/routes.json",
      store_api: "docs/agent/store-api-v1.json",
      openapi: "docs/agent/openapi-store-v1.json",
      storefront_runbook: "docs/agent/NEW_STOREFRONT_RUNBOOK.md",
      customer_onboarding: "docs/agent/CUSTOMER_ONBOARDING.md",
      change_playbook: "docs/agent/CHANGE_PLAYBOOK.md",
    },
    commands: pkg.scripts,
    // BB-RC7-03: In einem installierten Kundenprojekt existieren nur die
    // ausgelieferten Skripte. Die Aufteilung verhindert tote Verweise.
    installed_commands: splitCommands(pkg.scripts).installed,
    repository_only_commands: splitCommands(pkg.scripts).repositoryOnly,
    blocked_integrations: ["stripe-live", "email-delivery", "carrier-labels"],
    source_of_truth_order: [
      "code",
      "applied migrations / db introspection",
      "latest qa reports",
      "machine-readable manifests",
      "descriptive documentation",
      "older plans",
    ],
  };
}

// ------------------------------------------------------------------------ run

function emit(path: string, data: unknown) {
  const abs = join(ROOT, path);
  mkdirSync(join(abs, ".."), { recursive: true });
  const next = JSON.stringify(data, null, 2) + "\n";
  if (CHECK) {
    if (!existsSync(abs)) return fail(`Manifest fehlt: ${path} — 'bun run generate:manifests' ausführen`);
    const strip = (s: string) =>
      s.replace(/"generated_at":\s*"[^"]*",?\n/g, "").replace(/"source_commit":\s*"[^"]*",?\n/g, "");
    if (strip(readFileSync(abs, "utf8")) !== strip(next))
      fail(`Manifest veraltet: ${path} — 'bun run generate:manifests' ausführen`);
    return;
  }
  writeFileSync(abs, next);
  console.log(`  ${CHECK ? "geprüft" : "geschrieben"}: ${path}`);
}

const routes = buildRoutes();
const store = buildStoreApi();
const modules = buildModules();

emit("docs/agent/routes.json", routes);
emit("docs/agent/store-api-v1.json", store);
emit("docs/agent/openapi-store-v1.json", buildOpenApi(store));
emit("docs/agent/modules.json", modules);
emit("commerce-os.manifest.json", buildRootManifest(routes, store, modules));

if (problems.length) {
  console.error(`\nFEHLER (${problems.length}):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `\nOK — ${modules.count} Module, ${routes.total} Routen, ${store.endpoint_count} Store-API-Endpunkte, Migration ${routes.latest_migration}.`,
);
