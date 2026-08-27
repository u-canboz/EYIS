/**
 * PayPal-Webhook. Die Signatur wird über die PayPal-Verifikations-API mit der
 * hinterlegten Webhook-ID des jeweiligen Shops geprüft. Ohne gültige Signatur
 * wird nichts geschrieben.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/paypal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const { createPayPalProvider } = await import("@/lib/commerce/payments/paypal.server");
        const { loadCredentialsForProvider } = await import(
          "@/lib/commerce/integrations/credentials.server"
        );
        const { processPaymentWebhookEvent } = await import(
          "@/lib/commerce/payments/webhook-intake.server"
        );

        let event;
        try {
          const stored = await loadCredentialsForProvider("payment", "paypal");
          for (const row of stored) {
            const { clientId, clientSecret, webhookId } = row.values;
            if (!clientId || !clientSecret || !webhookId) continue;
            try {
              const provider = createPayPalProvider({
                clientId,
                clientSecret,
                webhookId,
                environment: row.environment,
              });
              event = await provider.parseWebhook(rawBody, request.headers);
              break;
            } catch {
              /* nächste Verbindung probieren */
            }
          }
        } catch (e) {
          console.error("paypal webhook credential lookup failed", e);
        }

        if (!event) {
          console.error("paypal webhook signature rejected");
          return new Response("Invalid signature", { status: 401 });
        }
        return processPaymentWebhookEvent("paypal", event);
      },
    },
  },
});
