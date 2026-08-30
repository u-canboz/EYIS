/**
 * EYIS Route Boundary — die Grenze zwischen Kundenoberfläche und EYIS-Runtime.
 *
 * Hintergrund: Bei einer Dedicated-Installation in ein bestehendes
 * Lovable-Shopprojekt bleibt `src/routes/__root.tsx` CUSTOMER-OWNED. Das
 * Kundenprojekt rendert dort in der Regel Header, Footer, Navigation und
 * eigenes Branding um `<Outlet />`. Ohne Grenze erbt das EYIS-Backoffice
 * dieses Chrome.
 *
 * Phase 26: Die Basis-Grenze enthält ausschließlich Pfade, die eine
 * EYIS-Basisinstallation garantiert selbst mitbringt. `/portal` gehört zum
 * OPTIONALEN Kundenportal-Modul. Wird es nicht installiert, bleibt `/portal`
 * eine ganz normale Kundenroute und darf niemals das Kunden-Chrome verlieren.
 *
 * Die Datei ist bewusst frei von Framework-, Server- und Supabase-Importen,
 * damit sie im Kunden-Root-Layout, in Tests und im Installer nutzbar ist.
 */

/** Pfad-Präfixe der EYIS-Basisinstallation. Immer vorhanden. */
export const EYIS_BASE_PREFIXES = [
  "/app",
  "/api/public/store",
  "/api/public/jobs",
  "/api/public/install",
  "/api/public/webhooks",
] as const;

/** Optionale Module und die Präfixe, die sie zusätzlich beanspruchen. */
export const EYIS_OPTIONAL_MODULE_PREFIXES = {
  portal: ["/portal"],
} as const;

export type EyisOptionalModule = keyof typeof EYIS_OPTIONAL_MODULE_PREFIXES;

/**
 * Rückwärtskompatibler Alias. Enthält nur noch die garantierten Basis-Präfixe.
 */
export const EYIS_INTERNAL_PREFIXES = EYIS_BASE_PREFIXES;

/**
 * Reservierter Anmeldepfad des Backoffice. Ein Kundenprojekt darf einen
 * eigenen `/login` oder `/auth` besitzen; EYIS kollidiert damit nicht.
 */
export const EYIS_AUTH_PATH = "/app/login";

/** CSS-Scope, unter dem das Backoffice seine eigenen Tokens auflöst. */
export const EYIS_ADMIN_SCOPE_CLASS = "eyis-admin";

function normalize(pathname: string): string {
  const path = pathname.split("?")[0]!.split("#")[0]!;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/";
}

/** Aktive Präfixe = Basis + ausdrücklich installierte optionale Module. */
export function activePrefixes(installedModules: EyisOptionalModule[] = []): string[] {
  const optional = installedModules.flatMap((m) => [...(EYIS_OPTIONAL_MODULE_PREFIXES[m] ?? [])]);
  return [...EYIS_BASE_PREFIXES, ...optional];
}

/**
 * True, wenn der Pfad zur EYIS-Runtime gehört und das Kunden-Chrome deshalb
 * NICHT gerendert werden darf. Ein exakter Präfixtreffer reicht nicht: `/apps`
 * oder `/application` sind Kundenpfade und bleiben unberührt.
 *
 * Optionale Module werden nur berücksichtigt, wenn sie übergeben werden.
 */
export function isEyisInternalRoute(
  pathname: string,
  installedModules: EyisOptionalModule[] = [],
): boolean {
  const path = normalize(pathname);
  return activePrefixes(installedModules).some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** True für Pfade, die dem Kundenprojekt gehören und nie überschrieben werden. */
export function isCustomerOwnedRoute(
  pathname: string,
  installedModules: EyisOptionalModule[] = [],
): boolean {
  return !isEyisInternalRoute(pathname, installedModules);
}
