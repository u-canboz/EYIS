#!/usr/bin/env bun
/**
 * EYIS Install Dependencies — Pre-rc.7 Hotfix
 *
 * Erzeugt installer/resources/eyis-install-dependencies.json: die vollständige,
 * deterministische Liste aller *Runtime*-Abhängigkeiten, die der installierte
 * EYIS-Produktionscode importiert.
 *
 * Harte Regeln:
 *  - Nur Produktionscode aus den 'install'-Pfaden des Code-Distribution-Manifests.
 *    Testcode, Fixtures, Mocks, qa/, docs/, scripts/ werden ausgeschlossen.
 *  - Interne Aliase (@/…), relative Pfade und Node/Bun-Builtins sind keine
 *    Abhängigkeiten.
 *  - Jeder Paketname wird gegen die npm-Namensregeln validiert; ungültige Namen
 *    brechen den Lauf mit FAIL ab.
 *  - Kein 0.0.0-Fallback: unbekannte Pakete führen zu UNKNOWN_RUNTIME_DEPENDENCY.
 *  - Template-Baseline wird getrennt ausgewiesen (provided_by_template) und nur
 *    dann anerkannt, wenn das Paket in dieser package.json nachweisbar ist.
 *
 * Deterministisch und idempotent: identische Eingabe → byte-identische Ausgabe.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, "installer/distribution/eyis-code-distribution.manifest.json");
const OUT = path.join(ROOT, "installer/resources/eyis-install-dependencies.json");
const PKG = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

/** Pakete, die das unterstützte Lovable-Template verbindlich mitbringt. */
export const TEMPLATE_BASELINE = [
  "@tanstack/react-query",
  "@tanstack/react-router",
  "@tanstack/react-start",
  "react",
  "react-dom",
  "sonner",
] as const;

/** Pfadmuster, die niemals Teil der Kunden-Runtime sind. */
export const NON_RUNTIME_PATTERNS: RegExp[] = [
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

export function isRuntimeFile(rel: string): boolean {
  return !NON_RUNTIME_PATTERNS.some((re) => re.test(rel));
}

const BUILTIN = /^(node|bun):/;
const NODE_BARE_BUILTINS = new Set([
  "fs",
  "path",
  "crypto",
  "url",
  "os",
  "stream",
  "buffer",
  "events",
  "util",
  "zlib",
  "http",
  "https",
  "net",
  "timers",
  "child_process",
  "assert",
]);

export function isExternalSpecifier(spec: string): boolean {
  if (!spec) return false;
  if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("@/")) return false;
  if (spec.startsWith("~/") || spec.startsWith("#")) return false;
  if (BUILTIN.test(spec)) return false;
  if (NODE_BARE_BUILTINS.has(spec.split("/")[0]!)) return false;
  return true;
}

const NPM_NAME =
  /^(?:@[a-z0-9-][a-z0-9-._]*\/)?[a-z0-9-][a-z0-9-._]*$/;

export function isValidPackageName(name: string): boolean {
  if (!name || name.trim() !== name) return false;
  if (name.length > 214) return false;
  return NPM_NAME.test(name);
}

export function packageName(spec: string): string {
  const parts = spec.split("/");
  return spec.startsWith("@") ? `${parts[0]}/${parts[1] ?? ""}` : parts[0]!;
}

function declaredVersion(name: string): string | null {
  const declared = PKG.dependencies?.[name] ?? PKG.devDependencies?.[name];
  return typeof declared === "string" ? declared : null;
}

function resolvedVersion(name: string): string | null {
  const p = path.join(ROOT, "node_modules", name, "package.json");
  if (existsSync(p)) return (JSON.parse(readFileSync(p, "utf8")) as { version: string }).version;
  const declared = declaredVersion(name);
  return declared ? declared.replace(/^[\^~]/, "") : null;
}

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

// ---- Dateien der Kategorie 'install' einsammeln (nur Runtime-Code)
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as { install: string[] };
const glob = new Bun.Glob("**/*.{ts,tsx}");
const files: string[] = [];
for (const pattern of manifest.install) {
  if (pattern.endsWith("/**")) {
    const base = pattern.slice(0, -3);
    if (!existsSync(path.join(ROOT, base))) continue;
    for (const f of glob.scanSync({ cwd: path.join(ROOT, base), onlyFiles: true })) {
      files.push(`${base}/${f}`);
    }
  } else if (pattern.includes("*")) {
    for (const f of new Bun.Glob(pattern).scanSync({ cwd: ROOT, onlyFiles: true })) files.push(f);
  } else if (existsSync(path.join(ROOT, pattern)) && /\.tsx?$/.test(pattern)) {
    files.push(pattern);
  }
}
const runtimeFiles = [...new Set(files)].filter(isRuntimeFile).sort();

// ---- Imports extrahieren
const seen = new Set<string>();
const runtime: Array<{ name: string; version: string; reason: string }> = [];
const baseline: Array<{ name: string; version: string; reason: string }> = [];

for (const rel of runtimeFiles) {
  const source = stripComments(readFileSync(path.join(ROOT, rel), "utf8"));
  const re = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (!spec || !isExternalSpecifier(spec)) continue;
    const name = packageName(spec);
    if (!isValidPackageName(name)) {
      fail(`INVALID_PACKAGE_NAME: "${name}" (aus "${spec}" in ${rel})`);
    }
    if (seen.has(name)) continue;
    seen.add(name);

    const reason = `imported by ${rel.replace(/^src\//, "")}`;
    if ((TEMPLATE_BASELINE as readonly string[]).includes(name)) {
      const version = declaredVersion(name);
      if (!version) fail(`TEMPLATE_BASELINE_NOT_DECLARED: ${name}`);
      baseline.push({ name, version: version.replace(/^[\^~]/, ""), reason });
      continue;
    }
    const version = resolvedVersion(name);
    if (!version) fail(`UNKNOWN_RUNTIME_DEPENDENCY: ${name} (${reason})`);
    if (version === "0.0.0") fail(`UNRESOLVED_VERSION: ${name} (${reason})`);
    runtime.push({ name, version, reason });
  }
}

const sortByName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
runtime.sort(sortByName);
baseline.sort(sortByName);

const out = {
  schema: "eyis.install.dependencies.v2",
  package_manager: "bun",
  description:
    "Runtime-Abhängigkeiten, die der installierte EYIS-Produktionscode über die Lovable-Template-Baseline hinaus benötigt. Maschinell erzeugt (bun run installer:dependencies), nicht von Hand editieren.",
  generated_from: "installer/distribution/eyis-code-distribution.manifest.json + src/ (nur Runtime-Dateien)",
  scanned_runtime_files: runtimeFiles.length,
  runtime_dependencies: runtime,
  provided_by_template: baseline,
  installer_tooling_dependencies: [] as Array<{ name: string; version: string; reason: string }>,
  install_command:
    runtime.length > 0 ? `bun add ${runtime.map((d) => `${d.name}@${d.version}`).join(" ")}` : "",
};

writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(
  `✔ ${runtime.length} Runtime-Abhängigkeiten, ${baseline.length} Template-Baseline → ${path.relative(ROOT, OUT)}`,
);
