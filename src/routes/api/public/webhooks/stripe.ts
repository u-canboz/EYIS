/**
 * Stripe webhook. The signature is verified inside the provider adapter before
 * anything is written, every event is journalled immutably, and finalisation is
 * idempotent through order_finalize_from_payment.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const { getProvider } = await import("@/lib/commerce/payments/provider.server");
        const { getAdmin } = await import("@/lib/commerce/core.server");
        const payments = await import("@/lib/commerce/payments/payment.server");

        let event;
        try {
          event = await (await getProvider("stripe")).parseWebhook(rawBody, request.headers);
        } catch (e) {
          console.error("stripe webhook signature rejected", e);
          return new Response("Invalid signature", { status: 401 });
        }

        const admin = await getAdmin();
        const { error: insertError } = await admin.from("payment_events").insert({
          provider: "stripe",
          provider_event_id: event.providerEventId,
          event_type: event.eventType,
          payload: event.payload as never,
          signature_verified: true,
        } as never);
        // Duplicate delivery: already journalled, nothing more to do.
        if (insertError && insertError.code === "23505") return new Response("ok (duplicate)");
        if (insertError) {
          console.error("payment_events insert failed", insertError);
          return new Response("Storage error", { status: 500 });
        }

        let processError: string | null = null;
        try {
          if (event.outcome !== "ignore" && event.paymentSessionId) {
            const ps = await payments.loadPaymentSession(event.paymentSessionId);
            await admin
              .from("payment_events")
              .update({ organization_id: ps.organization_id } as never)
              .eq("provider_event_id", event.providerEventId);

            if (event.outcome === "paid") {
              await payments.finalizeFromPayment({
                organizationId: ps.organization_id,
                paymentSessionId: ps.id,
                providerPaymentId: event.providerPaymentId,
                amountMinor: event.amountMinor ?? Number(ps.amount_minor),
                currencyCode: event.currencyCode ?? ps.currency_code,
                idempotencyKey: `webhook:${event.providerEventId}`,
              });
            } else if (event.outcome === "failed") {
              await payments.markPaymentFailed(ps.id, "Zahlung vom Anbieter abgelehnt.");
            } else if (event.outcome === "cancelled") {
              await payments.markPaymentFailed(ps.id, "Zahlung abgelaufen oder abgebrochen.", true);
            }
          }
        } catch (e) {
          processError = e instanceof Error ? e.message : "Unbekannter Fehler";
          console.error("stripe webhook processing failed", e);
        }

        await admin
          .from("payment_events")
          .update({
            processed: !processError,
            processed_at: new Date().toISOString(),
            process_error: processError,
          } as never)
          .eq("provider_event_id", event.providerEventId);

        // 200 even on internal failure would hide problems: signal a retry instead.
        return processError ? new Response("Processing error", { status: 500 }) : new Response("ok");
      },
    },
  },
});
