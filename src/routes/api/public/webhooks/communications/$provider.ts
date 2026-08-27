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
        const { ingestProviderEvent } =
          await import("@/lib/commerce/communications/communication.server");

        const provider = getProvider(providerKey);
        if (provider.key !== providerKey || !provider.parseWebhook) {
          return new Response("Unknown provider", { status: 404 });
        }

        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => {
          headers[key.toLowerCase()] = value;
        });
        // Mandantenspezifische Webhook-Secrets zuerst; nur wenn keine
        // hinterlegt sind, greift das plattformweite Secret.
        const secrets: (string | null)[] = [];
        try {
          const { loadCredentialsForProvider } = await import(
            "@/lib/commerce/integrations/credentials.server"
          );
          for (const row of await loadCredentialsForProvider("email", providerKey)) {
            const value = row.values["webhookSecret"];
            if (value) secrets.push(value);
          }
        } catch (error) {
          console.error("communication webhook credential lookup failed", providerKey, error);
        }
        if (secrets.length === 0)
          secrets.push(process.env["COMMUNICATION_WEBHOOK_SECRET"] ?? null);

        let parsed: Awaited<ReturnType<NonNullable<typeof provider.parseWebhook>>> | null = null;
        for (const secret of secrets) {
          try {
            const result = await provider.parseWebhook({ body, headers, secret });
            parsed = result;
            if (result.verified) break;
          } catch (error) {
            console.error("communication webhook rejected", providerKey, error);
            return new Response("Invalid payload", { status: 400 });
          }
        }
        if (!parsed) return new Response("Invalid payload", { status: 400 });
        if (secrets.some(Boolean) && !parsed.verified)
          return new Response("Invalid signature", { status: 401 });

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
