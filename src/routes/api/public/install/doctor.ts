/**
 * Doctor-Endpunkt (Phase 21): read-only Installations- und Isolationsprüfung.
 * Authentifizierung wie der Bootstrap: COMMERCE_BOOTSTRAP_SECRET als Header
 * `x-commerce-bootstrap-secret`. Gibt niemals Secrets oder Claim-Daten zurück.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/install/doctor")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env["COMMERCE_BOOTSTRAP_SECRET"];
        const provided = request.headers.get("x-commerce-bootstrap-secret") ?? "";
        if (!secret || !provided) {
          return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
        }
        const { createHash, timingSafeEqual } = await import("node:crypto");
        const digest = (v: string) => createHash("sha256").update(v, "utf8").digest();
        if (!timingSafeEqual(digest(provided), digest(secret))) {
          return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
        }
        const { runDoctor } = await import("@/lib/commerce/system/installation.server");
        const checks = await runDoctor();
        const failed = checks.filter((c) => c.status === "FAIL").length;
        return Response.json({ ok: failed === 0, checks });
      },
    },
  },
});
