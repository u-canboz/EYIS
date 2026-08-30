/**
 * Validierung des Code-Distribution-Manifests (Phase 27).
 *
 * Das Manifest ist die verbindliche Verteilungsgrenze. Ein Pfad darf genau
 * einer Kategorie angehören; sonst entscheidet im Kundenprojekt der Zufall der
 * Reihenfolge, ob eine Datei ausgeliefert oder geschützt wird.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import { classifyPath, type OwnershipDecision } from "../../src/lib/commerce/updates/ownership";

const ROOT = process.cwd();
export const DISTRIBUTION_PATH = join(
  ROOT,
  "installer",
  "distribution",
  "eyis-code-distribution.manifest.json",
);

export type DistributionManifest = {
  version: string;
  install: string[];
  reference_only: string[];
  customer_owned: string[];
  customer_routes?: string[];
  generated: string[];
  optional: string[];
  integration_patch: { path: string }[];
  shared_convention?: string[];
  exclude_from_install?: string[];
};

/** Erwartete Laufzeit-Klassifikation je Manifest-Kategorie. */
const EXPECTED: Record<string, OwnershipDecision> = {
  install: "eyis",
  reference_only: "reference_only",
  customer_owned: "customer",
  generated: "generated",
  optional: "optional",
  integration_patch: "integration_patch",
};

export type DistributionResult = {
  status: "PASS" | "FAIL";
  version: string;
  paths: number;
  duplicates: string[];
  missing: string[];
  routeConflicts: string[];
  ownershipMismatches: string[];
  problems: string[];
};

function sample(pattern: string): string {
  return pattern.endsWith("/**") ? `${pattern.slice(0, -3)}/beispiel.ts` : pattern;
}

export function validateDistribution(
  manifest: DistributionManifest = JSON.parse(
    require("node:fs").readFileSync(DISTRIBUTION_PATH, "utf8"),
  ) as DistributionManifest,
): DistributionResult {
  const categories: [string, string[]][] = [
    ["install", manifest.install],
    ["reference_only", manifest.reference_only],
    ["customer_owned", manifest.customer_owned],
    ["generated", manifest.generated],
    ["optional", manifest.optional],
    ["integration_patch", manifest.integration_patch.map((p) => p.path)],
  ];

  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  const missing: string[] = [];
  const routeConflicts: string[] = [];
  const ownershipMismatches: string[] = [];
  let paths = 0;

  for (const [category, list] of categories) {
    for (const pattern of list) {
      paths++;
      const previous = seen.get(pattern);
      if (previous) {
        duplicates.push(`${pattern} steht in "${previous}" und "${category}"`);
      } else {
        seen.set(pattern, category);
      }

      const base = pattern.endsWith("/**") ? pattern.slice(0, -3) : pattern;
      if (!pattern.startsWith(".env") && !existsSync(join(ROOT, base))) {
        missing.push(`${pattern} (${category})`);
      }

      const expected = EXPECTED[category];
      const actual = classifyPath(sample(pattern));
      if (expected && actual !== expected) {
        ownershipMismatches.push(
          `${pattern}: Manifest "${category}" ⇄ Laufzeit "${actual}"`,
        );
      }
    }
  }

  // Quelle/Ziel: Kundenrouten dürfen nie ausgeliefert werden.
  for (const route of manifest.customer_routes ?? []) {
    const file = route === "/" ? "src/routes/index.tsx" : `src/routes${route}.tsx`;
    if (manifest.install.includes(file)) {
      routeConflicts.push(`${file} ist Kundenroute "${route}", steht aber unter install`);
    }
    if (classifyPath(file) === "eyis") {
      routeConflicts.push(`${file} wird zur Laufzeit als EYIS-owned klassifiziert`);
    }
  }

  const problems = [...duplicates, ...missing.map((m) => `fehlt: ${m}`), ...routeConflicts, ...ownershipMismatches];
  return {
    status: problems.length === 0 ? "PASS" : "FAIL",
    version: manifest.version,
    paths,
    duplicates,
    missing,
    routeConflicts,
    ownershipMismatches,
    problems,
  };
}
