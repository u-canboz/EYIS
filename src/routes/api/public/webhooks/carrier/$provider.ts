/**
 * Carrier tracking webhook. The signature is verified inside the carrier adapter
 * before anything is written; events are matched to a shipment and stored
 * append-only, so replays are harmless and late events never move status back.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/carrier/$provider")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const provider = params.provider;
        const rawBody = await request.text();

        const { getCarrier } = await import("@/lib/commerce/shipping/registry.server");
        const { getAdmin } = await import("@/lib/commerce/core.server");
        const { recordTrackingEvents } = await import("@/lib/commerce/tracking/tracking.server");

        let carrier;
        try {
          carrier = await getCarrier(provider);
        } catch {
          return new Response("Unknown carrier", { status: 404 });
        }
        if (!carrier.capabilities.supportsTrackingWebhook || !carrier.parseTrackingWebhook) {
          return new Response("Webhook not supported", { status: 404 });
        }

        const admin = await getAdmin();
        const { data: configs } = await admin
          .from("shipping_provider_configs")
          .select("organization_id, configuration_reference")
          .eq("provider", provider)
          .eq("status", "active");

        const secretName = ((configs ?? []) as Record<string, unknown>[])
          .map((c) => (c['configuration_reference'] as Record<string, string> | null)?.['webhook_secret_name'])
          .find(Boolean);
        const secret = secretName ? (process.env[secretName] ?? null) : null;

        let parsed;
        try {
          parsed = await carrier.parseTrackingWebhook(rawBody, request.headers, secret);
        } catch (e) {
          console.error("carrier webhook rejected", provider, e);
          return new Response("Invalid signature", { status: 401 });
        }

        let query = admin.from("shipments").select("id, organization_id").eq("carrier_provider", provider).limit(1);
        if (parsed.providerShipmentId) query = query.eq("provider_shipment_id", parsed.providerShipmentId);
        else if (parsed.trackingNumber) query = query.eq("tracking_number", parsed.trackingNumber);
        else return new Response("Missing shipment reference", { status: 400 });

        const { data: shipments } = await query;
        const shipment = ((shipments ?? []) as Record<string, unknown>[])[0];
        // Unknown reference: acknowledge so the carrier stops retrying.
        if (!shipment) return new Response("ok (unknown shipment)");

        try {
          const result = await recordTrackingEvents(
            shipment['organization_id'] as string,
            shipment['id'] as string,
            provider,
            parsed.events,
          );
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "content-type": "application/json" },
          });
        } catch (e) {
          console.error("tracking ingest failed", provider, e);
          return new Response("Processing error", { status: 500 });
        }
      },
    },
  },
});
