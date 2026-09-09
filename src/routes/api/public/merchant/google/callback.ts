/**
 * Rückleitung der Google-Merchant-Freigabe.
 * Der Aufruf wird ausschließlich über den einmalig verwendbaren OAuth-State
 * autorisiert; ohne gültigen State passiert nichts.
 */
import { createFileRoute } from "@tanstack/react-router";

function page(message: string, ok: boolean) {
  return new Response(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Google Merchant Center</title></head><body style="font-family:system-ui;padding:2rem"><h1>${ok ? "Konto verbunden" : "Verbindung fehlgeschlagen"}</h1><p>${message}</p><p><a href="/app/marketing/google-shopping">Zurück zum Backoffice</a></p></body></html>`,
    { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/merchant/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) return page("Google hat keine gültige Antwort geschickt.", false);

        const { getAdmin } = await import("@/lib/commerce/core.server");
        const admin = await getAdmin();
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state));
        const stateHash = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const { data } = await admin
          .from("oauth_states")
          .select("organization_id, shop_id")
          .eq("state_hash", stateHash)
          .eq("provider", "google_merchant")
          .is("used_at", null)
          .maybeSingle();
        const row = data as Record<string, unknown> | null;
        if (!row) return page("Die Freigabe ist abgelaufen. Bitte erneut starten.", false);

        const organizationId = row["organization_id"] as string;
        const shopId = row["shop_id"] as string;
        try {
          const { consumeOAuthState } = await import(
            "@/lib/commerce/integrations/integration.server"
          );
          await consumeOAuthState({
            state,
            organizationId,
            shopId,
            provider: "google_merchant",
          });
          const { completeAuthorization } = await import("@/lib/commerce/store/merchant.server");
          await completeAuthorization({
            organizationId,
            shopId,
            code,
            redirectUri: `${url.origin}/api/public/merchant/google/callback`,
          });
          return page("Das Google-Merchant-Konto ist jetzt verbunden.", true);
        } catch (error) {
          return page(error instanceof Error ? error.message : "Unbekannter Fehler.", false);
        }
      },
    },
  },
});
