/**
 * Mollie-Webhook. Mollie signiert nicht und sendet nur eine Zahlungs-ID.
 * Verbindlich ist deshalb allein der frisch über die API geladene Zustand
 * (Re-Fetch-Verifikation) mit dem Schlüssel des jeweiligen Shops.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/mollie")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const { createMollieProvider } = await import("@/lib/commerce/payments/mollie.server");
        const { loadCredentialsForProvider } = await import(
          "@/lib/commerce/integrations/credentials.server"
        );
        const { processPaymentWebhookEvent } = await import(
          "@/lib/commerce/payments/webhook-intake.server"
        );

        let event;
        try {
          const stored = await loadCredentialsForProvider("payment", "mollie");
          for (const row of stored) {
            if (!row.values["apiKey"]) continue;
            try {
              const provider = createMollieProvider({ apiKey: row.values["apiKey"] });
              // Nur der Shop, dessen Konto die Zahlung wirklich kennt, verifiziert.
              event = await provider.parseWebhook(rawBody, request.headers);
              break;
            } catch {
              /* nächster Shop */
            }
          }
        } catch (e) {
          console.error("mollie webhook credential lookup failed", e);
        }

        if (!event) {
          console.error("mollie webhook could not be verified");
          return new Response("Invalid notification", { status: 401 });
        }
        return processPaymentWebhookEvent("mollie", event);
      },
    },
  },
});
