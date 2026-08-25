/* Phase 5 acceptance: section 16 — Stripe webhook hardening (offline, ohne Live-Keys). */
process.env['STRIPE_WEBHOOK_SECRET'] = "whsec_qa_offline_secret";
import { admin, check, expectThrow, summary, results, readState } from "./lib";
import { stripeProvider } from "@/lib/commerce/payments/stripe.server";
import { writeFileSync } from "fs";

const s = readState();

async function sign(payload: string, ts: number, secret = process.env['STRIPE_WEBHOOK_SECRET']!) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${payload}`));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function body(eventId: string, paymentSessionId: string, amount = 5480, currency = "eur") {
  return JSON.stringify({
    id: eventId,
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_qa",
        payment_intent: "pi_test_qa",
        amount_total: amount,
        currency,
        payment_status: "paid",
        status: "complete",
        metadata: { payment_session_id: paymentSessionId },
        client_reference_id: paymentSessionId,
      },
    },
  });
}

async function main() {
  const ts = Math.floor(Date.now() / 1000);
  const raw = body("evt_qa_1", "11111111-1111-1111-1111-111111111111");

  const good = await stripeProvider.parseWebhook(raw, new Headers({ "stripe-signature": `t=${ts},v1=${await sign(raw, ts)}` }));
  check("Webhook: gültige Signatur akzeptiert", good.providerEventId === "evt_qa_1" && good.outcome === "paid", JSON.stringify({ id: good.providerEventId, outcome: good.outcome }));
  check("Webhook: Payment Session aus Metadaten gelesen", good.paymentSessionId === "11111111-1111-1111-1111-111111111111", String(good.paymentSessionId));

  await expectThrow(
    "Webhook: falsche Signatur abgelehnt",
    () => stripeProvider.parseWebhook(raw, new Headers({ "stripe-signature": `t=${ts},v1=${"0".repeat(64)}` })),
    /Signatur/,
  );
  await expectThrow(
    "Webhook: manipulierter Body abgelehnt",
    async () => {
      const sig = await sign(raw, ts);
      return stripeProvider.parseWebhook(body("evt_qa_1", "11111111-1111-1111-1111-111111111111", 100), new Headers({ "stripe-signature": `t=${ts},v1=${sig}` }));
    },
    /Signatur/,
  );
  await expectThrow(
    "Webhook: fremdes Signing Secret abgelehnt",
    async () => stripeProvider.parseWebhook(raw, new Headers({ "stripe-signature": `t=${ts},v1=${await sign(raw, ts, "whsec_wrong")}` })),
    /Signatur/,
  );
  await expectThrow(
    "Webhook: Replay außerhalb Zeitfenster abgelehnt",
    async () => {
      const old = ts - 3600;
      return stripeProvider.parseWebhook(raw, new Headers({ "stripe-signature": `t=${old},v1=${await sign(raw, old)}` }));
    },
    /abgelaufen/,
  );
  await expectThrow("Webhook: fehlender Header abgelehnt", () => stripeProvider.parseWebhook(raw, new Headers()), /Signatur fehlt/);

  // Journal + Deduplizierung auf Datenbankebene
  const eventId = `evt_qa_dedupe_${Date.now()}`;
  const row = { provider: "stripe", provider_event_id: eventId, event_type: "checkout.session.completed", payload: JSON.parse(raw), signature_verified: true, organization_id: s['orgA']! };
  const first = await admin.from("payment_events").insert(row as never);
  const second = await admin.from("payment_events").insert(row as never);
  check("Webhook-Journal: erster Eintrag gespeichert", !first.error, first.error?.message ?? "ok");
  check("Webhook-Journal: Duplikat abgewiesen (23505)", second.error?.code === "23505", second.error?.code ?? "kein Fehler");

  const upd = await admin.from("payment_events").update({ event_type: "hacked" } as never).eq("provider_event_id", eventId);
  check("Webhook-Journal: Payload unveränderlich", !!upd.error, upd.error?.message?.slice(0, 90) ?? "kein Fehler");
  const del = await admin.from("payment_events").delete().eq("provider_event_id", eventId);
  check("Webhook-Journal: nicht löschbar", !!del.error, del.error?.message?.slice(0, 90) ?? "kein Fehler");

  const payments = await import("@/lib/commerce/payments/payment.server");
  await expectThrow(
    "Webhook: unbekannte Payment Session führt zu Fehler statt Order",
    () => payments.loadPaymentSession("22222222-2222-2222-2222-222222222222"),
  );

  summary();
  writeFileSync("qa/results-webhook.json", JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
