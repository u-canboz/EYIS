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
  "src/lib/eyis/**",
  "src/routes/api/public/store/**",
  "src/routes/api/public/jobs/**",
  "src/eyis/**",
  "src/routes/_authenticated/app/**",
  "src/routes/app.login.tsx",
  "supabase/migrations/**",
  "installer/database/**",
  "installer/distribution/**",
  "installer/resources/**",
  "docs/agent/**",
  "commerce-os.manifest.json",
  "package.json",
  "bun.lockb",
  ".github/workflows/eyis-update.yml",
];

/**
 * Kundeneigene Dateien mit genau einem klar umrissenen, additiven Eingriff.
 * Ein Update darf sie NICHT ersetzen — es prüft nur, ob der Eingriff noch
 * vorhanden ist, und meldet ihn andernfalls als offenen Schritt.
 */
export const INTEGRATION_PATCH_PATHS: string[] = [
  "src/routes/__root.tsx",
  "src/styles.css",
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
const PATCH = INTEGRATION_PATCH_PATHS.map(globToRegExp);

export type OwnershipDecision =
  | "eyis"
  | "customer"
  | "reference_only"
  | "integration_patch"
  | "unmanaged";

/** Kunden-Pfade gewinnen immer — im Zweifel wird nichts überschrieben. */
export function classifyPath(path: string): OwnershipDecision {
  const clean = path.replace(/^\.\//, "");
  if (PATCH.some((re) => re.test(clean))) return "integration_patch";
  if (CUSTOMER.some((re) => re.test(clean))) return "customer";
  if (REFERENCE.some((re) => re.test(clean))) return "reference_only";
  if (OWNED.some((re) => re.test(clean))) return "eyis";
  return "unmanaged";
}

export function isUpdatable(path: string): boolean {
  return classifyPath(path) === "eyis";
}

/** Teilt eine Dateiliste in ersetzbare, geschützte und Referenz-Pfade. */
export function partitionPaths(paths: string[]) {
  const replace: string[] = [];
  const protectedPaths: string[] = [];
  const referenceOnly: string[] = [];
  const integrationPatch: string[] = [];
  const unmanaged: string[] = [];
  for (const p of paths) {
    const decision = classifyPath(p);
    if (decision === "eyis") replace.push(p);
    else if (decision === "customer") protectedPaths.push(p);
    else if (decision === "reference_only") referenceOnly.push(p);
    else if (decision === "integration_patch") integrationPatch.push(p);
    else unmanaged.push(p);
  }
  return { replace, protected: protectedPaths, referenceOnly, integrationPatch, unmanaged };
}

