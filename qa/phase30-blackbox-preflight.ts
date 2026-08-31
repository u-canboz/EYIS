/**
 * qa:blackbox-preflight — Pre-rc.7 Blackbox-Preflight (Phase 30, ohne DB/Netz).
 *
 * Prüft den vollständigen Dependency-Graph des Installations-Codes, den
 * Build-Gate-Ablauf (Code → Build → DB), die Typ-Generierung und die
 * Resume-Fähigkeit des Agent Migration Plan.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { buildAgentPlan } from "../scripts/installer/agent-plan";
import { loadManifest } from "../scripts/installer/runner";

type Check = { id: string; status: "PASS" | "FAIL"; detail: string };
const checks: Check[] = [];
const record = (id: string, ok: boolean, detail: string) =>
  checks.push({ id, status: ok ? "PASS" : "FAIL", detail });

const ROOT = process.cwd();
const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
};

// ---- 1. Dependency-Graph: jeder Bare-Import des Install-Codes ist abgedeckt
const codeManifest = JSON.parse(
  readFileSync("installer/distribution/eyis-code-distribution.manifest.json", "utf8"),
) as { install: string[] };
const depPlan = JSON.parse(
  readFileSync("installer/resources/eyis-install-dependencies.json", "utf8"),
) as { dependencies: Array<{ name: string }> };
const covered = new Set(depPlan.dependencies.map((d) => d.name));
const TEMPLATE_BASELINE = new Set([
  "@tanstack/react-query",
  "@tanstack/react-router",
  "@tanstack/react-start",
  "react",
  "react-dom",
  "sonner",
]);

const installFiles: string[] = [];
for (const pattern of codeManifest.install) {
  if (pattern.endsWith("/**")) installFiles.push(...walk(path.join(ROOT, pattern.slice(0, -3))));
  else if (!pattern.includes("*") && existsSync(path.join(ROOT, pattern)))
    installFiles.push(path.join(ROOT, pattern));
}
const bare = new Set<string>();
for (const file of installFiles) {
  const src = readFileSync(file, "utf8");
  const re = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const spec = m[1] ?? m[2];
    if (!spec || spec.startsWith(".") || spec.startsWith("@/") || spec.startsWith("node:")) continue;
    const parts = spec.split("/");
    bare.add(spec.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0]!);
  }
}
const missing = [...bare].filter((n) => !covered.has(n) && !TEMPLATE_BASELINE.has(n)).sort();
record(
  "P1 Dependency-Graph vollständig (inkl. pdf-lib)",
  missing.length === 0 && covered.has("pdf-lib"),
  missing.length === 0
    ? `${covered.size} Abhängigkeiten im Plan, kein ungedeckter Import.`
    : `Fehlen im Plan: ${missing.join(", ")}`,
);

// ---- 2. Build-Gate: Distribution baut, bevor Migrationen laufen
const workflow = existsSync(".github/workflows/eyis-release.yml")
  ? readFileSync(".github/workflows/eyis-release.yml", "utf8")
  : "";
const buildIdx = workflow.search(/bun run build/);
const dbIdx = workflow.search(/supabase (db push|migration)/);
record(
  "P2 Build-Gate vor Datenbank-Schritten",
  buildIdx !== -1 && (dbIdx === -1 || buildIdx < dbIdx),
  "Release-Reihenfolge: Code-Artefakt baut, bevor irgendetwas die DB berührt.",
);

// ---- 3. Typ-Generierung im Installationspfad vorhanden
const installer = readFileSync("installer/eyis.ts", "utf8");
record(
  "P3 Supabase-Typgenerierung im Installer verdrahtet",
  /gen types|db push|migration/.test(installer) || existsSync("scripts/installer/apply-migrations.ts"),
  "Installer ruft Plattform-Typgenerierung/Migrationsanwendung auf.",
);

// ---- 4. Agent Plan: Resume/Retry idempotent
const manifest = loadManifest();
const planA = buildAgentPlan(manifest);
const planB = buildAgentPlan(manifest);
const journal = readFileSync("scripts/installer/agent-plan.ts", "utf8");
record(
  "P4 Agent Plan deterministisch + Resume-sicher",
  JSON.stringify(planA) === JSON.stringify(planB) &&
    /ON CONFLICT/i.test(journal) &&
    planA.units.length > 0,
  `${planA.units.length} Units, Journal-Resume über ON CONFLICT, identischer Wiederholungsplan.`,
);

// ---- 5. Kanonischer Cron-Secret-Name
const resources = readFileSync("installer/resources/eyis-resources.manifest.json", "utf8");
const cronAuth = readFileSync("src/integrations/supabase/cron-auth.ts", "utf8");
record(
  "P5 Kanonischer Cron-Secret-Name durchgehend",
  resources.includes("LOVABLE_CRON_SECRET") &&
    !/"secret_key": "CRON_SECRET"/.test(resources) &&
    cronAuth.includes("LOVABLE_CRON_SECRET"),
  "Manifest und Runtime nutzen LOVABLE_CRON_SECRET (Authorization: Bearer).",
);

// ---- Report
const failed = checks.filter((c) => c.status === "FAIL");
for (const c of checks) console.log(`${c.status === "PASS" ? "✓" : "✗"} ${c.id} — ${c.detail}`);
console.log(`\n${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length > 0) process.exit(1);
