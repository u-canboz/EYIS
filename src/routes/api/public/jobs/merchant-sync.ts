/**
 * Täglicher Abgleich der verbundenen Google-Merchant-Konten.
 * Authentifizierung: der plattformverwaltete Cron-Schlüssel (Bearer-Token).
 */
import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/merchant-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const origin = new URL(request.url).origin;
        try {
          const { connectionsForAutoSync, syncNow } = await import(
            "@/lib/commerce/store/merchant.server"
          );
          const connections = await connectionsForAutoSync();
          let ok = 0;
          let failed = 0;
          for (const connection of connections) {
            try {
              await syncNow({
                organizationId: connection.organizationId,
                shopId: connection.shopId,
                requestOrigin: origin,
                triggerSource: "schedule",
              });
              ok += 1;
            } catch {
              failed += 1;
            }
          }
          return new Response(
            JSON.stringify({ ok: true, connections: connections.length, synced: ok, failed }),
            { headers: { "content-type": "application/json" } },
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown";
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
