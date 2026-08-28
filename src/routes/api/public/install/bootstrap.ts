/**
 * System-Bootstrap für Dedicated Installationen (Phase 21).
 *
 * Sicherheit:
 *  - Ausschließlich über das serverseitige Credential COMMERCE_BOOTSTRAP_SECRET,
 *    übergeben als HTTP-Header `x-commerce-bootstrap-secret` (niemals URL).
 *  - Timing-sicherer Vergleich. Keine anonyme oder session-basierte Ausführung.
 *  - Nach erfolgreicher Initialisierung dauerhaft gesperrt:
 *    403 INSTALLATION_ALREADY_INITIALIZED.
 */
import { createFileRoute } from "@tanstack/react-router";

async function checkBootstrapCredential(request: Request): Promise<Response | null> {
  const secret = process.env["COMMERCE_BOOTSTRAP_SECRET"];
  if (!secret) {
    return Response.json(
      { ok: false, code: "BOOTSTRAP_DISABLED", error: "Bootstrap ist nicht konfiguriert." },
      { status: 403 },
    );
  }
  const provided = request.headers.get("x-commerce-bootstrap-secret") ?? "";
  if (!provided) {
    return Response.json(
      { ok: false, code: "BOOTSTRAP_FORBIDDEN", error: "Forbidden" },
      { status: 403 },
    );
  }
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const digest = (v: string) => createHash("sha256").update(v, "utf8").digest();
  if (!timingSafeEqual(digest(provided), digest(secret))) {
    return Response.json(
      { ok: false, code: "BOOTSTRAP_FORBIDDEN", error: "Forbidden" },
      { status: 403 },
    );
  }
  return null;
}

export const Route = createFileRoute("/api/public/install/bootstrap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await checkBootstrapCredential(request);
        if (denied) return denied;
        try {
          const { runBootstrap, InstallationError } = await import(
            "@/lib/commerce/system/installation.server"
          );
          const result = await runBootstrap();
          return Response.json(result);
        } catch (error) {
          if (error instanceof (await import("@/lib/commerce/system/installation.server")).InstallationError) {
            const status = error.code === "INSTALLATION_ALREADY_INITIALIZED" ? 403 : 409;
            return Response.json(
              { ok: false, code: error.code, error: error.message },
              { status },
            );
          }
          const message = error instanceof Error ? error.message : "unknown";
          return Response.json({ ok: false, code: "BOOTSTRAP_FAILED", error: message }, { status: 500 });
        }
      },
    },
  },
});
