/**
 * GET /api/public/store/v1/runtime-config
 *
 * Same-Origin-Selbstauskunft der Dedicated-Installation. Liefert
 * ausschließlich öffentliche Daten (Deployment-Modus, API-Version,
 * Publishable Key des Hauptshops, Shop-Handle, Locale, Währung).
 *
 * Diese Route liegt bewusst VOR der Publishable-Key-Prüfung des Gateways —
 * sie liefert den Key ja gerade erst aus. Sie ist read-only, cachefrei und
 * gibt niemals Secrets, Provider-Credentials oder interne IDs zurück.
 */
import { createFileRoute } from "@tanstack/react-router";

const HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export const Route = createFileRoute("/api/public/store/v1/runtime-config")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { resolveStoreRuntimeConfig } = await import(
            "@/lib/commerce/system/runtime-config.server"
          );
          const data = await resolveStoreRuntimeConfig();
          return new Response(JSON.stringify({ data }), { headers: HEADERS });
        } catch (error) {
          console.error("runtime-config failed", error);
          return new Response(
            JSON.stringify({
              error: { code: "INTERNAL_ERROR", message: "Runtime-Konfiguration nicht verfügbar." },
            }),
            { status: 500, headers: HEADERS },
          );
        }
      },
    },
  },
});
