/**
 * EYIS Route Boundary — die Grenze zwischen Kundenoberfläche und EYIS-Runtime.
 *
 * Hintergrund: Bei einer Dedicated-Installation in ein bestehendes
 * Lovable-Shopprojekt bleibt `src/routes/__root.tsx` CUSTOMER-OWNED. Das
 * Kundenprojekt rendert dort in der Regel Header, Footer, Navigation und
 * eigenes Branding um `<Outlet />`. Ohne Grenze erbt das EYIS-Backoffice
 * dieses Chrome — die Folge war doppelte Navigation, fremde Typografie und
 * ein Backoffice, das optisch Teil des Shops wirkt.
 *
 * Diese Datei ist die einzige Wahrheit darüber, welche Pfade zur EYIS-Runtime
 * gehören. Sie ist bewusst frei von Framework-, Server- und Supabase-Importen,
 * damit sie sowohl im Kunden-Root-Layout als auch in Tests und im Installer
 * verwendbar ist.
 */

/** Pfad-Präfixe, die ausschließlich der EYIS-Runtime gehören. */
export const EYIS_INTERNAL_PREFIXES = [
  "/app",
  "/portal",
  "/api/public/store",
  "/api/public/jobs",
  "/api/public/install",
  "/api/public/webhooks",
] as const;

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

/**
 * True, wenn der Pfad zur EYIS-Runtime gehört und das Kunden-Chrome deshalb
 * NICHT gerendert werden darf. Ein exakter Präfixtreffer reicht nicht: `/apps`
 * oder `/application` sind Kundenpfade und bleiben unberührt.
 */
export function isEyisInternalRoute(pathname: string): boolean {
  const path = normalize(pathname);
  return EYIS_INTERNAL_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** True für Pfade, die dem Kundenprojekt gehören und nie überschrieben werden. */
export function isCustomerOwnedRoute(pathname: string): boolean {
  return !isEyisInternalRoute(pathname);
}
