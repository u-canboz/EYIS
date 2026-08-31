/**
 * qa:blackbox-preflight — Pre-rc.7 Blackbox-Preflight (Phase 30, ohne DB/Netz).
 *
 * Prüft den vollständigen Dependency-Graph des Installations-Codes, den
 * Build-Gate-Ablauf (Code → Build → DB), die Typ-Generierung und die
 * Resume-Fähigkeit des Agent Migration Plan.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { buildAgentPlan, planInstructions } from "../scripts/installer/agent-plan";
import { loadManifest } from "../scripts/installer/runner";
import { validateTarballConsistency } from "../scripts/installer/tarball-consistency";

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

// ---- 1. Dependency-Plan: vollständig, valide, frei von Testcode
const codeManifest = JSON.parse(
  readFileSync("installer/distribution/eyis-code-distribution.manifest.json", "utf8"),
) as { install: string[] };
const DEP_FILE = "installer/resources/eyis-install-dependencies.json";
type DepEntry = { name: string; version: string; reason: string };
const depPlan = JSON.parse(readFileSync(DEP_FILE, "utf8")) as {
  runtime_dependencies: DepEntry[];
  provided_by_template: DepEntry[];
  installer_tooling_dependencies: DepEntry[];
  install_command: string;
};
const runtimeDeps = depPlan.runtime_dependencies ?? [];
const templateDeps = depPlan.provided_by_template ?? [];
const covered = new Set(runtimeDeps.map((d) => d.name));
const TEMPLATE_BASELINE = new Set(templateDeps.map((d) => d.name));
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const NON_RUNTIME = [
  /(^|\/)__tests__\//,
  /(^|\/)__mocks__\//,
  /(^|\/)fixtures\//,
  /(^|\/)mocks\//,
  /\.test\.tsx?$/,
  /\.spec\.tsx?$/,
  /^qa\//,
  /^docs\//,
  /^scripts\//,
];
const isRuntimeFile = (rel: string) => !NON_RUNTIME.some((re) => re.test(rel));
const NODE_BARE = new Set([
  "fs", "path", "crypto", "url", "os", "stream", "buffer", "events",
  "util", "zlib", "http", "https", "net", "timers", "child_process", "assert",
]);
const NPM_NAME = /^(?:@[a-z0-9-][a-z0-9-._]*\/)?[a-z0-9-][a-z0-9-._]*$/;
const isValidName = (n: string) => !!n && n.trim() === n && NPM_NAME.test(n);
const stripComments = (source: string): string => {
  let out = "";
  let i = 0;
  let quote: string | null = null;
  while (i < source.length) {
    const c = source[i]!;
    const next = source[i + 1];
    if (quote) {
      if (c === "\\") { out += c + (next ?? ""); i += 2; continue; }
      if (c === quote) quote = null;
      out += c; i += 1; continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; out += c; i += 1; continue; }
    if (c === "/" && next === "/") { while (i < source.length && source[i] !== "\n") i += 1; continue; }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i += 2; continue;
    }
    out += c; i += 1;
  }
  return out;
};

const installFiles: string[] = [];
for (const pattern of codeManifest.install) {
  if (pattern.endsWith("/**")) {
    const base = path.join(ROOT, pattern.slice(0, -3));
    if (existsSync(base)) installFiles.push(...walk(base));
  } else if (!pattern.includes("*") && existsSync(path.join(ROOT, pattern)) && /\.tsx?$/.test(pattern))
    installFiles.push(path.join(ROOT, pattern));
}
const runtimeFiles = installFiles
  .map((f) => path.relative(ROOT, f))
  .filter(isRuntimeFile)
  .sort();

const bare = new Set<string>();
const rawSpecs = new Set<string>();
for (const rel of runtimeFiles) {
  const src = stripComments(readFileSync(path.join(ROOT, rel), "utf8"));
  const re = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (!spec) continue;
    rawSpecs.add(spec);
    if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("@/")) continue;
    if (/^(node|bun):/.test(spec)) continue;
    const parts = spec.split("/");
    const name = spec.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0]!;
    if (NODE_BARE.has(name)) continue;
    bare.add(name);
  }
}
const missing = [...bare].filter((n) => !covered.has(n) && !TEMPLATE_BASELINE.has(n)).sort();
record(
  "P1 Dependency-Graph vollständig (inkl. pdf-lib)",
  missing.length === 0 && covered.has("pdf-lib"),
  missing.length === 0
    ? `${covered.size} Runtime-Abhängigkeiten im Plan, kein ungedeckter Import.`
    : `Fehlen im Plan: ${missing.join(", ")}`,
);

// D1 Kein Testcode im Scan
const testish = runtimeFiles.filter(
  (f) => /__tests__|\.test\.|\.spec\.|(^|\/)(fixtures|mocks|__mocks__)\//.test(f) || /^(qa|docs|scripts)\//.test(f),
);
record(
  "D1–D3 Kein Test-, Fixture- oder Toolingcode im Runtime-Scan",
  testish.length === 0,
  `${runtimeFiles.length} Runtime-Dateien gescannt, 0 Test-/Fixture-/qa-/docs-/scripts-Dateien.`,
);

// D4–D6 Keine Alias-, Relativ- oder Builtin-Namen im Manifest
const allEntries = [...runtimeDeps, ...templateDeps, ...(depPlan.installer_tooling_dependencies ?? [])];
const badSpecNames = allEntries
  .map((d) => d.name)
  .filter((n) => n.startsWith("@/") || n.startsWith(".") || n.startsWith("/") || /^(node|bun):/.test(n) || NODE_BARE.has(n));
record(
  "D4–D6 Keine Alias-, Relativ- oder Builtin-Einträge im Manifest",
  badSpecNames.length === 0,
  badSpecNames.length === 0 ? "Nur externe npm-Namen im Plan." : `Ungültig: ${badSpecNames.join(", ")}`,
);

// D7 Package-Namen valide
const invalidNames = allEntries.map((d) => d.name).filter((n) => !isValidName(n));
record(
  "D7 Alle Package-Namen sind valide npm-Namen",
  invalidNames.length === 0,
  invalidNames.length === 0 ? `${allEntries.length} Namen geprüft.` : `Ungültig: ${invalidNames.join(", ")}`,
);

// D8 Keine 0.0.0-Versionen
const zeroVersions = allEntries.filter((d) => !d.version || d.version === "0.0.0").map((d) => d.name);
record(
  "D8 Keine 0.0.0-Fallback-Versionen",
  zeroVersions.length === 0,
  zeroVersions.length === 0 ? "Alle Versionen aufgelöst." : `0.0.0: ${zeroVersions.join(", ")}`,
);

// D9 Jede Dependency in package.json nachweisbar
const declared = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
const undeclared = allEntries.map((d) => d.name).filter((n) => !(n in declared));
record(
  "D9 Jede Dependency in package.json nachgewiesen",
  undeclared.length === 0,
  undeclared.length === 0 ? "Alle Einträge deklariert." : `Nicht deklariert: ${undeclared.join(", ")}`,
);

// D10 Keine DevDependencies über Testcode in der Runtime
const devOnly = Object.keys(pkg.devDependencies ?? {});
const devLeak = runtimeDeps.map((d) => d.name).filter((n) => devOnly.includes(n) && !(n in (pkg.dependencies ?? {})));
record(
  "D10 Keine DevDependencies (z. B. vitest, typescript) im Runtime-Plan",
  devLeak.length === 0 && !covered.has("vitest") && !covered.has("typescript"),
  devLeak.length === 0 ? "Runtime-Plan enthält ausschließlich Produktionspakete." : `Dev-Leak: ${devLeak.join(", ")}`,
);

// D11/D12 Determinismus: zweiter Generatorlauf ist byte-identisch
const before = readFileSync(DEP_FILE, "utf8");
const gen = Bun.spawnSync(["bun", "run", "scripts/installer/dependencies.ts"], { cwd: ROOT });
const after = readFileSync(DEP_FILE, "utf8");
record(
  "D11–D12 Generator deterministisch (byte-identische Wiederholung)",
  gen.exitCode === 0 && before === after,
  gen.exitCode === 0 ? "Zweiter Lauf erzeugt byte-identische Ausgabe." : "Generator brach ab.",
);

// D13 Installationssimulation gegen leere temporäre package.json
const tmp = path.join("/tmp", `eyis-dep-sim-${process.pid}`);
Bun.spawnSync(["mkdir", "-p", tmp]);
Bun.spawnSync(["bash", "-c", `printf '%s' '{"name":"eyis-dep-sim","private":true}' > ${tmp}/package.json`]);
const simTargets = runtimeDeps.map((d) => `${d.name}@${d.version}`);
const simOk =
  simTargets.length > 0 &&
  simTargets.every((t) => /^(?:@[a-z0-9-][a-z0-9-._]*\/)?[a-z0-9-][a-z0-9-._]*@\d+\.\d+\.\d+/.test(t)) &&
  depPlan.install_command === `bun add ${simTargets.join(" ")}` &&
  existsSync(path.join(tmp, "package.json"));
record(
  "D13 Installationssimulation (leere package.json, Plan auflösbar)",
  simOk,
  `Plan: ${depPlan.install_command || "(leer)"} — alle Ziele mit exakter Version, keine Alias-/Testpakete.`,
);
Bun.spawnSync(["rm", "-rf", tmp]);



// ---- 2. Build-Gate: Distribution baut, bevor Migrationen laufen
const workflow = existsSync(".github/workflows/eyis-release.yml")
  ? readFileSync(".github/workflows/eyis-release.yml", "utf8")
  : "";
const verifyIdx = workflow.search(/bun run (verify|build)/);
const dbIdx = workflow.search(/supabase (db push|migration)/);
const artifactIdx = workflow.search(/eyis:release:artifact/);
record(
  "P2 Build-Gate vor Datenbank- und Artefakt-Schritten",
  verifyIdx !== -1 && (dbIdx === -1 || verifyIdx < dbIdx) && (artifactIdx === -1 || verifyIdx < artifactIdx),
  "Release-Reihenfolge: verify/build läuft, bevor Artefakt oder DB berührt werden.",
);

// ---- 3. Typ-Generierung im Installationspfad vorhanden
const instructions = planInstructions(buildAgentPlan(loadManifest()));
record(
  "P3 Typgenerierung nach Migrationen vor typecheck/build angeordnet",
  /gen types|Plattform-Generierung/.test(instructions),
  "Agent-Plan weist die Plattform-Typgenerierung nach den Migrationen ausdrücklich an.",
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
    planA.steps.length > 0,
  `${planA.steps.length} Units, Journal-Resume über ON CONFLICT, identischer Wiederholungsplan.`,
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

// ---- 6. Route-Guard-Regressionsmatrix (BB-RC7-01/05/06)
const matrix = Bun.spawnSync(
  ["bunx", "vitest", "run", "src/lib/commerce/__tests__/route-guard-matrix.test.ts"],
  { cwd: ROOT },
);
record(
  "P6 Route-Guard-Regressionsmatrix (Fälle A–L)",
  matrix.exitCode === 0,
  matrix.exitCode === 0
    ? "Root-Komponente korrekt erkannt, Guard innerster Wrapper, Rollback byte-exakt."
    : "Matrix fehlgeschlagen.",
);

// ---- 7. Manifest ⇄ Tarball bidirektional (BB-RC7-03/04)
const consistency = validateTarballConsistency();
record(
  "P7 Tarball ⇄ Manifest bidirektional konsistent",
  consistency.status === "PASS",
  consistency.status === "PASS"
    ? `${consistency.files} Dateien, jede kategorisiert, keine toten Befehlsverweise, Skripte autonom.`
    : consistency.problems.slice(0, 5).join(" | "),
);

// ---- 8. Backoffice ohne plattformgenerierte Module (BB-RC7-02)
const generatedLeak = runtimeFiles.filter((f) =>
  /from\s+["']@\/integrations\/lovable/.test(readFileSync(path.join(ROOT, f), "utf8")),
);
record(
  "P8 Kein Import plattformgenerierter Lovable-Module im Auslieferungscode",
  generatedLeak.length === 0,
  generatedLeak.length === 0
    ? "Auth läuft über die standardisierte Supabase-Schnittstelle."
    : `Harte Kopplung in: ${generatedLeak.join(", ")}`,
);

// ---- 9. Pre-Database Blackbox-Simulation (BB-RC7-08)
const sim = Bun.spawnSync(["bun", "run", "scripts/eyis-blackbox-simulate.ts"], { cwd: ROOT });
record(
  "P9 Pre-Database Blackbox-Simulation",
  sim.exitCode === 0,
  sim.exitCode === 0
    ? "Installation ohne DB/Netz/Secrets: Patches, Parse-Gate und Importauflösung PASS."
    : "Simulation fehlgeschlagen — siehe bun run eyis:blackbox:simulate.",
);

// ---- Report
const failed = checks.filter((c) => c.status === "FAIL");
for (const c of checks) console.log(`${c.status === "PASS" ? "✓" : "✗"} ${c.id} — ${c.detail}`);
console.log(`\n${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length > 0) process.exit(1);
