/**
 * Gemeinsame Webhook-Verarbeitung für alle Zahlungsanbieter.
 *
 * Der Kern bleibt unverändert: journalisieren (unveränderlich), Duplikate
 * erkennen, Betrag und Währung gegen die Payment-Session prüfen und erst dann
 * die bestehende Finalisierung aufrufen. Hier entsteht keine zweite Engine.
 */
import { getAdmin } from "../core.server";
import type { WebhookEvent } from "./provider.server";

export async function processPaymentWebhookEvent(
  provider: string,
  event: WebhookEvent,
): Promise<Response> {
  const admin = await getAdmin();
  const payments = await import("./payment.server");

  const { error: insertError } = await admin.from("payment_events").insert({
    provider,
    provider_event_id: event.providerEventId,
    event_type: event.eventType,
    payload: event.payload as never,
    signature_verified: true,
  } as never);
  if (insertError && insertError.code === "23505") return new Response("ok (duplicate)");
  if (insertError) {
    console.error(`${provider} payment_events insert failed`, insertError);
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
        // Betrag und Währung müssen zur Session passen — sonst keine Bestellung.
        const expected = Number(ps.amount_minor);
        if (event.amountMinor !== null && event.amountMinor !== expected)
          throw new Error(
            `Betrag weicht ab: Anbieter meldet ${event.amountMinor}, erwartet ${expected}.`,
          );
        if (
          event.currencyCode &&
          event.currencyCode.toUpperCase() !== String(ps.currency_code).toUpperCase()
        )
          throw new Error("Währung weicht von der Zahlungssitzung ab.");

        await payments.finalizeFromPayment({
          organizationId: ps.organization_id,
          paymentSessionId: ps.id,
          providerPaymentId: event.providerPaymentId,
          amountMinor: event.amountMinor ?? expected,
          currencyCode: event.currencyCode ?? ps.currency_code,
          idempotencyKey: `webhook:${event.providerEventId}`,
        });
      } else if (event.outcome === "failed") {
        await payments.markPaymentFailed(ps.id, "Zahlung vom Anbieter abgelehnt.");
      } else if (event.outcome === "cancelled") {
        await payments.markPaymentFailed(ps.id, "Zahlung abgelaufen oder abgebrochen.", true);
      }
      // "refunded" wird von der Refund-Engine geführt und hier nur journalisiert.
    }
  } catch (e) {
    processError = e instanceof Error ? e.message : "Unbekannter Fehler";
    console.error(`${provider} webhook processing failed`, processError);
  }

  await admin
    .from("payment_events")
    .update({
      processed: !processError,
      processed_at: new Date().toISOString(),
      process_error: processError,
    } as never)
    .eq("provider_event_id", event.providerEventId);

  return processError ? new Response("Processing error", { status: 500 }) : new Response("ok");
}
