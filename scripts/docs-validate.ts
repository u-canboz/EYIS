/**
 * Prüft die Agenten-Dokumentation. Ausführen: `bun run docs:validate`
 *
 * Geprüft wird:
 *   1. Pflichtdateien vorhanden
 *   2. Relative Markdown-Links zeigen auf existierende Dateien
 *   3. Referenzierte Repo-Pfade (`src/...`, `qa/...`, `docs/...`) existieren
 *   4. Keine Secret-Muster in der Dokumentation
 *   5. Keine erfundene SDK-Installation (npm install @commerce-os/sdk)
 *   6. Manifeste aktuell (Delegation an scripts/manifest/generate.ts --check)
 *   7. Manifeste tragen generated_at, source_commit, latest_migration, generator_version
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, normalize } from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const problems: string[] = [];
const fail = (m: string) => problems.push(m);

const REQUIRED = [
  "AGENTS.md",
  "README.md",
  "commerce-os.manifest.json",
  "src/lib/commerce/AGENTS.md",
  "src/lib/store-sdk/AGENTS.md",
  "src/routes/store/AGENTS.md",
  "docs/agent/MIGRATION_RULES.md",
  "docs/agent/START_HERE.md",
  "docs/agent/ARCHITECTURE_MAP.md",
  "docs/agent/SECURITY_BOUNDARIES.md",
  "docs/agent/MODULE_REGISTRY.md",
  "docs/agent/CHANGE_PLAYBOOK.md",
  "docs/agent/OPERATING_MODES.md",
  "docs/agent/CUSTOMER_ONBOARDING.md",
  "docs/agent/NEW_STOREFRONT_RUNBOOK.md",
  "docs/agent/STORE_API_GUIDE.md",
  "docs/agent/DATA_MODEL_OVERVIEW.md",
  "docs/agent/TESTING_AND_QA.md",
  "docs/agent/GLOSSARY.md",
  "docs/agent/PROMPTS.md",
  "docs/agent/modules.json",
  "docs/agent/routes.json",
  "docs/agent/store-api-v1.json",
  "docs/agent/openapi-store-v1.json",
];

for (const f of REQUIRED) if (!existsSync(join(ROOT, f))) fail(`Pflichtdatei fehlt: ${f}`);

// ------------------------------------------------------------ markdown checks

function mdFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const abs = join(dir, e);
    if (statSync(abs).isDirectory()) {
      if (["node_modules", ".git", "dist", ".output"].includes(e)) continue;
      mdFiles(abs, out);
    } else if (e.endsWith(".md")) out.push(abs);
  }
  return out;
}

const docs = [
  ...mdFiles(join(ROOT, "docs")),
  ...mdFiles(join(ROOT, "qa")),
  ...mdFiles(join(ROOT, ".github")),
  join(ROOT, "AGENTS.md"),
  join(ROOT, "README.md"),
  "src/lib/commerce/AGENTS.md",
  "src/lib/store-sdk/AGENTS.md",
  "src/routes/store/AGENTS.md",
].map((p) => (p.startsWith("/") ? p : join(ROOT, p)));

const SECRET_PATTERNS: [RegExp, string][] = [
  [/sk_live_[A-Za-z0-9]/, "Stripe Live Secret"],
  [/sk_test_[A-Za-z0-9]{10}/, "Stripe Test Secret"],
  [/whsec_[A-Za-z0-9]{10}/, "Stripe Webhook Secret"],
  [/sb_secret_[A-Za-z0-9]/, "Supabase Secret Key"],
  [/service_role[^\n]{0,20}ey[A-Za-z0-9_-]{20}/, "Service-Role-JWT"],
  [/eyJhbGciOi[A-Za-z0-9_-]{20}/, "JWT"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "Private Key"],
];

for (const file of docs) {
  if (!existsSync(file)) continue;
  const rel = file.replace(ROOT + "/", "");
  const body = readFileSync(file, "utf8");

  for (const [re, label] of SECRET_PATTERNS)
    if (re.test(body)) fail(`${rel}: mögliches Secret im Klartext (${label})`);

  for (const line of body.split("\n")) {
    if (/^\s*(\$\s*)?(npm|bun|pnpm|yarn)\s+(install|add|i)\s+@commerce-os\/sdk/.test(line))
      fail(`${rel}: Installationsbefehl für das nicht existierende Paket @commerce-os/sdk`);
  }

  // relative Markdown-Links
  for (const m of body.matchAll(/\[[^\]]*\]\((?!https?:|mailto:|#)([^)#\s]+)/g)) {
    const target = normalize(join(dirname(file), m[1]!));
    if (!existsSync(target)) fail(`${rel}: toter Link → ${m[1]}`);
  }

  // Repo-Pfade in Backticks
  for (const m of body.matchAll(/`((?:src|qa|docs|supabase|scripts)\/[A-Za-z0-9._/$-]+)`/g)) {
    let p = m[1]!.replace(/[.,)]$/, "");
    if (p.includes("*") || p.includes("{")) continue;
    if (!existsSync(join(ROOT, p))) fail(`${rel}: referenzierter Pfad existiert nicht → ${p}`);
  }
}

// -------------------------------------------------------------- manifest meta

for (const f of [
  "commerce-os.manifest.json",
  "docs/agent/modules.json",
  "docs/agent/routes.json",
  "docs/agent/store-api-v1.json",
]) {
  const abs = join(ROOT, f);
  if (!existsSync(abs)) continue;
  const json = JSON.parse(readFileSync(abs, "utf8"));
  for (const key of ["generated_at", "source_commit", "latest_migration", "generator_version"])
    if (!json[key]) fail(`${f}: Feld ${key} fehlt`);
}

// eindeutige IDs
const modules = existsSync(join(ROOT, "docs/agent/modules.json"))
  ? JSON.parse(readFileSync(join(ROOT, "docs/agent/modules.json"), "utf8"))
  : { modules: [] };
const ids = new Set<string>();
for (const m of modules.modules as { id: string }[]) {
  if (ids.has(m.id)) fail(`modules.json: doppelte Modul-ID ${m.id}`);
  ids.add(m.id);
}

// jede Modul-ID muss im Registry-Markdown vorkommen
if (existsSync(join(ROOT, "docs/agent/MODULE_REGISTRY.md"))) {
  const reg = readFileSync(join(ROOT, "docs/agent/MODULE_REGISTRY.md"), "utf8");
  for (const id of ids)
    if (!reg.includes(id)) fail(`MODULE_REGISTRY.md: Modul ${id} nicht dokumentiert`);
}

// ------------------------------------------------------------- generator sync

try {
  execSync("bun run scripts/manifest/generate.ts --check", { cwd: ROOT, stdio: "pipe" });
} catch (e) {
  const out = String((e as { stdout?: Buffer }).stdout ?? "") + String((e as { stderr?: Buffer }).stderr ?? "");
  fail("Manifeste sind nicht synchron:\n" + out.trim());
}

if (problems.length) {
  console.error(`docs:validate FEHLGESCHLAGEN (${problems.length})`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`docs:validate OK — ${REQUIRED.length} Pflichtdateien, ${docs.length} Markdown-Dateien geprüft.`);
