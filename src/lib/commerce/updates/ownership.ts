/**
 * Ownership-Grenze für Updates (Phase 22).
 *
 * EYIS-owned Dateien werden beim Update ersetzt. Kunden-owned Dateien werden
 * niemals überschrieben. Diese Liste ist die einzige Wahrheit und wird sowohl
 * vom Preflight als auch vom Kunden-Workflow (`.github/workflows/eyis-update.yml`)
 * verwendet.
 */

/** Pfade, die ein Update ersetzen darf (Glob, repo-relativ). */
export const EYIS_OWNED_PATHS: string[] = [
  "src/lib/commerce/**",
  "src/lib/store-sdk/**",
  "src/routes/api/public/store/**",
  "src/routes/api/public/jobs/**",
  "src/components/shell/**",
  "supabase/migrations/**",
  "docs/agent/**",
  "commerce-os.manifest.json",
  "package.json",
  "bun.lockb",
  ".github/workflows/eyis-update.yml",
];

/**
 * Referenz-Inhalte: bleiben im EYIS-Hauptrepository, werden aber niemals in ein
 * Kundenprojekt installiert oder dort ersetzt (Marketing, Landingpage, Demo,
 * Referenz-Storefront, interne Präsentationsseiten).
 */
export const REFERENCE_ONLY_PATHS: string[] = [
  "src/routes/index.tsx",
  "src/routes/entwickler.tsx",
  "src/routes/dokumentation.tsx",
  "src/routes/dokumentation/**",
  "src/components/site/**",
  "public/demo-assets/**",
  "LOVABLE_STOREFRONT_GUIDE.md",
  "LOVABLE_STOREFRONT_PROMPT.md",
];

/** Pfade, die dem Kunden gehören und niemals überschrieben werden. */
export const CUSTOMER_OWNED_PATHS: string[] = [
  "src/routes/store/**",
  "src/theme/**",
  "src/content/**",
  "public/brand/**",
  ".env",
  ".env.*",
  "src/custom/**",
];

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "<<GLOBSTAR_SLASH>>")
    .replace(/\*\*/g, "<<GLOBSTAR>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<GLOBSTAR_SLASH>>/g, "(?:.*/)?")
    .replace(/<<GLOBSTAR>>/g, ".*")
    .replace(/\?/g, "[^/]");
  return new RegExp(`^${escaped}$`);
}

const OWNED = EYIS_OWNED_PATHS.map(globToRegExp);
const CUSTOMER = CUSTOMER_OWNED_PATHS.map(globToRegExp);
const REFERENCE = REFERENCE_ONLY_PATHS.map(globToRegExp);

export type OwnershipDecision = "eyis" | "customer" | "reference_only" | "unmanaged";

/** Kunden-Pfade gewinnen immer — im Zweifel wird nichts überschrieben. */
export function classifyPath(path: string): OwnershipDecision {
  const clean = path.replace(/^\.\//, "");
  if (CUSTOMER.some((re) => re.test(clean))) return "customer";
  if (REFERENCE.some((re) => re.test(clean))) return "reference_only";
  if (OWNED.some((re) => re.test(clean))) return "eyis";
  return "unmanaged";
}


export function isUpdatable(path: string): boolean {
  return classifyPath(path) === "eyis";
}

/** Teilt eine Dateiliste in ersetzbare und geschützte Pfade. */
export function partitionPaths(paths: string[]) {
  const replace: string[] = [];
  const protectedPaths: string[] = [];
  const unmanaged: string[] = [];
  for (const p of paths) {
    const decision = classifyPath(p);
    if (decision === "eyis") replace.push(p);
    else if (decision === "customer") protectedPaths.push(p);
    else unmanaged.push(p);
  }
  return { replace, protected: protectedPaths, unmanaged };
}
