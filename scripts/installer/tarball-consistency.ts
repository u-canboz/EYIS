/**
 * BB-RC7-03 / BB-RC7-04 — bidirektionale Konsistenz zwischen Tarball und
 * Manifesten.
 *
 * Der rc.7-Blackbox-Test fand zwei Richtungen desselben Defekts:
 * 1. Dateien lagen im Tarball, ohne dass eine Manifest-Kategorie sie erklärt.
 * 2. `commerce-os.manifest.json` versprach Befehle, deren Skripte im
 *    installierten Projekt gar nicht existieren.
 *
 * Zusätzlich wird die Autonomie der ausgelieferten Skripte geprüft: jeder
 * relative Import einer Tarball-Datei muss selbst im Tarball liegen.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";

import { ROOT, artifactFiles, droppedFromArtifact } from "./artifact";

type DistManifest = {
  install: string[];
  install_tooling?: string[];
  repository_only?: string[];
  exclude_from_install?: string[];
};

export type ConsistencyResult = {
  status: "PASS" | "FAIL";
  files: number;
  uncategorized: string[];
  unexplainedDrops: string[];
  deadCommandRefs: string[];
  unresolvedImports: string[];
  problems: string[];
};

const globToRegExp = (pattern: string) =>
  new RegExp(
    `^${pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "\u0000")
      .replace(/\*/g, "[^/]*")
      .replace(/\u0000/g, ".*")}$`,
  );

const matchesAny = (file: string, patterns: string[]) =>
  patterns.some((p) => globToRegExp(p).test(file));

/** Skriptpfade, die ein Manifest-Befehl aufruft. */
export function referencedScripts(command: string): string[] {
  return [...command.matchAll(/(?:^|\s)((?:scripts|installer|qa)\/[\w./-]+\.tsx?)/g)].map(
    (m) => m[1]!,
  );
}

function resolveRelative(from: string, spec: string): string | null {
  const base = normalize(join(dirname(from), spec));
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), base]) {
    if (existsSync(join(ROOT, candidate))) return relative(ROOT, join(ROOT, candidate));
  }
  return null;
}

export function validateTarballConsistency(): ConsistencyResult {
  const dist = JSON.parse(
    readFileSync(
      join(ROOT, "installer", "distribution", "eyis-code-distribution.manifest.json"),
      "utf8",
    ),
  ) as DistManifest;

  const files = artifactFiles();
  const shipped = new Set(files);
  const categoryPatterns = [...dist.install, ...(dist.install_tooling ?? [])];

  // Richtung 1 — Tarball → Manifest: jede Datei braucht eine Kategorie.
  const uncategorized = files.filter((f) => !matchesAny(f, categoryPatterns));

  // Richtung 2 — Manifest → Tarball: jeder Abwurf braucht eine Begründung.
  const excludes = dist.exclude_from_install ?? [];
  const unexplainedDrops = droppedFromArtifact().filter((f) => !matchesAny(f, excludes));

  // Richtung 3 — Befehle: kein Skriptverweis darf im Kundenprojekt ins Leere zeigen.
  const commerce = JSON.parse(readFileSync(join(ROOT, "commerce-os.manifest.json"), "utf8")) as {
    installed_commands?: Record<string, string>;
  };
  const deadCommandRefs: string[] = [];
  for (const [name, command] of Object.entries(commerce.installed_commands ?? {})) {
    for (const script of referencedScripts(command)) {
      if (!shipped.has(script)) deadCommandRefs.push(`${name} → ${script}`);
    }
  }

  // Richtung 4 — Autonomie: relative Importe bleiben im Tarball.
  const unresolvedImports: string[] = [];
  for (const file of files) {
    if (!/\.tsx?$/.test(file)) continue;
    const source = readFileSync(join(ROOT, file), "utf8");
    const specs = [
      ...source.matchAll(/from\s*["'](\.[^"']+)["']/g),
      ...source.matchAll(/import\(\s*["'](\.[^"']+)["']\s*\)/g),
    ].map((m) => m[1]!);
    for (const spec of specs) {
      const target = resolveRelative(file, spec);
      if (!target || !shipped.has(target)) unresolvedImports.push(`${file} → ${spec}`);
    }
  }

  const problems = [
    ...uncategorized.map((f) => `ohne Kategorie im Tarball: ${f}`),
    ...unexplainedDrops.map((f) => `ohne Begründung ausgeschlossen: ${f}`),
    ...deadCommandRefs.map((f) => `toter Befehlsverweis: ${f}`),
    ...unresolvedImports.map((f) => `Import verlässt den Tarball: ${f}`),
  ];

  return {
    status: problems.length === 0 ? "PASS" : "FAIL",
    files: files.length,
    uncategorized,
    unexplainedDrops,
    deadCommandRefs,
    unresolvedImports,
    problems,
  };
}
