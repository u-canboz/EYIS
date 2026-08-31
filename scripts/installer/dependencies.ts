#!/usr/bin/env bun
/**
 * EYIS Install Dependencies — Phase 30 (rc.6/rc.7 Preflight)
 *
 * Erzeugt installer/resources/eyis-install-dependencies.json: die vollständige,
 * deterministische Liste aller Runtime-Abhängigkeiten, die der Installations-Code
 * (install/update/shared aus dem Code-Distribution-Manifest) importiert.
 *
 * Quelle: src/ (Code, Rang 1). Paketnamen-Versionen kommen aus der package.json
 * dieses Repos — bei einer Range wird die installierte Version aus
 * node_modules/<name>/package.json gepinnt.
 *
 * Reihenfolge: install/update/shared-Dateien sortiert, dann Imports in
 * Erstauftretens-Reihenfolge. Deterministisch, idempotent.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, "installer/distribution/eyis-code-distribution.manifest.json");
const OUT = path.join(ROOT, "installer/resources/eyis-install-dependencies.json");
const PKG = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));

// Bereits Standard im Lovable-Template bzw. kein npm-Paket — nicht nötig.
const TEMPLATE_BASELINE = new Set([
  "@tanstack/react-query",
  "@tanstack/react-router",
  "@tanstack/react-start",
  "react",
  "react-dom",
  "sonner",
]);

const BUILTIN = /^node:/;

function isBareSpecifier(spec: string): boolean {
  return !spec.startsWith(".") && !spec.startsWith("/") && !spec.startsWith("@/") && !BUILTIN.test(spec);
}

function packageName(spec: string): string {
  const parts = spec.split("/");
  return spec.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
}

function installedVersion(name: string): string {
  const p = path.join(ROOT, "node_modules", name, "package.json");
  if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8")).version as string;
  const declared = PKG.dependencies?.[name] ?? PKG.devDependencies?.[name];
  return typeof declared === "string" ? declared.replace(/^[\^~]/, "") : "0.0.0";
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as { install: string[] };
const glob = new Bun.Glob("**/*.{ts,tsx}");
const files: string[] = [];
for (const pattern of manifest.install) {
  if (pattern.endsWith("/**")) {
    for (const f of glob.scanSync({ cwd: path.join(ROOT, pattern.slice(0, -3)), onlyFiles: true })) {
      files.push(`${pattern.slice(0, -3)}/${f}`);
    }
  } else if (pattern.includes("*")) {
    for (const f of new Bun.Glob(pattern).scanSync({ cwd: ROOT, onlyFiles: true })) files.push(f);
  } else if (existsSync(path.join(ROOT, pattern))) {
    files.push(pattern);
  }
}
files.sort();

const seen = new Set<string>();
const deps: Array<{ name: string; version: string; reason: string }> = [];
for (const rel of files) {
  const source = readFileSync(path.join(ROOT, rel), "utf8");
  const re = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const spec = m[1] ?? m[2];
    if (!spec || !isBareSpecifier(spec)) continue;
    const name = packageName(spec);
    if (TEMPLATE_BASELINE.has(name) || seen.has(name)) continue;
    seen.add(name);
    deps.push({
      name,
      version: installedVersion(name),
      reason: `imported by ${rel.replace(/^src\//, "")}`,
    });
  }
}

const out = {
  schema: "eyis.install.dependencies.v1",
  package_manager: "bun",
  description:
    "Runtime-Abhängigkeiten, die der EYIS-Installations-Code über die Lovable-Template-Baseline hinaus benötigt. Maschinell erzeugt, nicht von Hand editieren.",
  generated_from: "installer/distribution/eyis-code-distribution.manifest.json + src/",
  dependencies: deps,
};

writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(`✔ ${deps.length} Abhängigkeiten → ${path.relative(ROOT, OUT)}`);
