/**
 * Claim-Session-Tausch (Phase 21): der Owner fügt den Claim-Code einmalig in
 * /app/setup ein (POST-Body, niemals URL). Bei Gültigkeit wird eine kurzlebige,
 * httpOnly-Setup-Session gesetzt; der Klartext verbleibt weder in
 * Browser-History, Logs noch Referrer. Der Token wird hier NICHT verbraucht —
 * das geschieht erst beim atomaren Owner-Claim.
 */
import { createFileRoute } from "@tanstack/react-router";

const COOKIE_NAME = "commerce_setup_claim";
const SESSION_TTL_SECONDS = 15 * 60;

export const Route = createFileRoute("/api/public/install/claim-session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let code = "";
        try {
          const body = (await request.json()) as { claimCode?: unknown };
          code = typeof body.claimCode === "string" ? body.claimCode.trim() : "";
        } catch {
          code = "";
        }
        if (!code) {
          return Response.json(
            { ok: false, code: "CLAIM_INVALID", error: "Claim-Code fehlt." },
            { status: 400 },
          );
        }
        const { validateClaimToken, InstallationError } = await import(
          "@/lib/commerce/system/installation.server"
        );
        try {
          await validateClaimToken(code);
        } catch (error) {
          if (error instanceof InstallationError) {
            return Response.json(
              { ok: false, code: error.code, error: error.message },
              { status: 403 },
            );
          }
          throw error;
        }
        const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
        const cookie =
          `${COOKIE_NAME}=${encodeURIComponent(code)}; Path=/app; HttpOnly; SameSite=Strict` +
          `; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json", "set-cookie": cookie },
        });
      },
    },
  },
});
