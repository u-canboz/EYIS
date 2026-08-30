/**
 * Dedicated Route Contract (Phase 26).
 *
 * Der Blackbox-Test musste Links im installierten Code von Hand korrigieren:
 * die EYIS-Basisruntime verwies auf `/auth`, `/store` und `/portal` — Ziele, die
 * eine Basisinstallation gar nicht mitbringt (reference_only bzw. optional).
 *
 * Dieser Contract prüft maschinell: jeder statische Navigationslink aus dem
 * `install`-Graph muss auf ein garantiert vorhandenes Ziel zeigen.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { classifyPath } from "../../src/lib/commerce/updates/ownership";
import { EYIS_BASE_PREFIXES } from "../../src/lib/eyis/route-boundary";

const ROOT = process.cwd();

/**
 * Immer vorhandene Ziele: die Kunden-Startseite (jedes Projekt hat `/`) und
 * alles unterhalb der garantierten EYIS-Basis-Präfixe.
 */
export function isGuaranteedTarget(target: string): boolean {
  if (target === "/") return true;
  return EYIS_BASE_PREFIXES.some((p) => target === p || target.startsWith(`${p}/`));
}

const LINK_PATTERNS: RegExp[] = [
  /\bto\s*=\s*"(\/[^"${}]*)"/g,
  /\bto\s*:\s*"(\/[^"${}]*)"/g,
  /\bhref\s*=\s*"(\/[^"${}]*)"/g,
  /\bhref\s*:\s*"(\/[^"${}]*)"/g,
  /window\.location\.href\s*=\s*"(\/[^"${}]*)"/g,
  /navigate\(\s*"(\/[^"${}]*)"/g,
];

export type RouteViolation = { file: string; target: string };

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Alle Dateien der Basisinstallation (Kategorie `eyis`). */
export function baseInstallFiles(root: string = join(ROOT, "src")): string[] {
  return walk(root)
    .map((f) => relative(ROOT, f))
    .filter((f) => classifyPath(f) === "eyis");
}

export function findViolations(files: string[] = baseInstallFiles()): RouteViolation[] {
  const violations: RouteViolation[] = [];
  for (const file of files) {
    const source = readFileSync(join(ROOT, file), "utf8");
    for (const pattern of LINK_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source)) !== null) {
        const target = match[1]!;
        if (!isGuaranteedTarget(target)) violations.push({ file, target });
      }
    }
  }
  return violations;
}
