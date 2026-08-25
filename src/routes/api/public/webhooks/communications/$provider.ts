/**
 * Provider delivery webhook (delivered, bounce, complaint).
 * The signature is verified inside the provider adapter; the raw payload is
 * journaled immutably and only the processing status is updated afterwards.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/communications/$provider")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const providerKey = params.provider;
        const body = await request.text();

        const { getProvider } = await import("@/lib/commerce/communications/registry.server");
        const { ingestProviderEvent } = await import(
          "@/lib/commerce/communications/communication.server"
        );

        const provider = getProvider(providerKey);
        if (provider.key !== providerKey || !provider.parseWebhook) {
          return new Response("Unknown provider", { status: 404 });
        }

        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => {
          headers[key.toLowerCase()] = value;
        });
        const secret = process.env["COMMUNICATION_WEBHOOK_SECRET"] ?? null;

        let parsed;
        try {
          parsed = await provider.parseWebhook({ body, headers, secret });
        } catch (error) {
          console.error("communication webhook rejected", providerKey, error);
          return new Response("Invalid payload", { status: 400 });
        }
        if (secret && !parsed.verified) return new Response("Invalid signature", { status: 401 });

        for (const event of parsed.events) {
          await ingestProviderEvent({
            provider: providerKey,
            providerEventId: event.providerEventId,
            providerMessageId: event.providerMessageId,
            eventType: event.eventType,
            deliveryStatus: event.deliveryStatus,
            recipient: event.recipient,
            signatureVerified: parsed.verified,
            payload: event.payload,
          });
        }
        return new Response("ok");
      },
    },
  },
});
