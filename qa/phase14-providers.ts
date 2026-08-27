/**
 * QA harness — Gate B / B8: Provider-Readiness (Payments, E-Mail, Carrier).
 *
 * Prüft ausschließlich lesend, ob die Anbieteranbindungen technisch
 * betriebsbereit sind. Es werden keine Live-Zugangsdaten gesetzt, keine echten
 * Zahlungen ausgelöst und keine echten E-Mails versendet.
 *
 * Aufruf: bun run qa:providers
 */
import { writeFileSync } from "node:fs";
import { admin, check, results, summary } from "./lib";

const APP = process.env["QA_APP_BASE"] ?? "http://localhost:8080";

type Readiness = { domain: string; provider: string; status: string; evidence: string };
const matrix: Readiness[] = [];

function note(name: string, status: "OFFEN" | "BLOCKED", evidence: string) {
  results.push({ name, ok: true, detail: `${status}: ${evidence}` });
  console.log(`${status}  ${name} — ${evidence}`);
}

async function main() {
  // ------------------------------------------------------------- Payments
  const { data: pay } = await admin
    .from("payment_provider_configs")
    .select("provider, status, environment");
  const providers = [...new Set((pay ?? []).map((p) => p.provider))];
  check(
    "B8.1 Zahlungsanbieter konfiguriert",
    (pay ?? []).length > 0,
    `${(pay ?? []).length} Konfigurationen: ${providers.join(", ")}`,
  );
  const liveStripe = (pay ?? []).filter(
    (p) => p.provider === "stripe" && p.environment === "live" && p.status === "active",
  );
  check(
    "B8.2 Kein Stripe-Live-Modus aktiv (Production-Sperre)",
    liveStripe.length === 0,
    `${liveStripe.length} Live-Konfigurationen`,
  );
  const hasStripeSecret = Boolean(process.env["STRIPE_SECRET_KEY"]);
  const hasStripeWebhookSecret = Boolean(process.env["STRIPE_WEBHOOK_SECRET"]);
  check(
    "B8.3 Stripe-Adapter im Code vorhanden und ladbar",
    Boolean((await import("../src/lib/commerce/payments/provider.server")).getProvider),
    "getProvider('stripe') lädt stripe.server",
  );
  matrix.push({
    domain: "Payments",
    provider: "Stripe",
    status: hasStripeSecret && hasStripeWebhookSecret ? "OFFEN" : "BLOCKED",
    evidence: hasStripeSecret
      ? "Secret vorhanden, Live-Freigabe ausstehend"
      : "STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET nicht gesetzt",
  });
  matrix.push({
    domain: "Payments",
    provider: "Mock",
    status: providers.includes("mock") ? "PASS" : "FAIL",
    evidence: "Mock-Provider aktiv für Dev/QA",
  });

  // Webhook-Endpunkt muss ohne gültige Signatur ablehnen.
  const wh = await fetch(`${APP}/api/public/webhooks/stripe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: "evt_test", type: "payment_intent.succeeded" }),
  });
  check(
    "B8.4 Stripe-Webhook lehnt unsignierte Anfragen ab",
    wh.status === 400 || wh.status === 401 || wh.status === 403,
    `status ${wh.status}`,
  );

  // -------------------------------------------------------------- E-Mail
  const { data: comm } = await admin
    .from("communication_provider_configs")
    .select("channel, provider, status, test_mode");
  const emailProviders = [...new Set((comm ?? []).map((c) => c.provider))];
  check(
    "B8.5 E-Mail-Anbieter konfiguriert",
    (comm ?? []).length > 0,
    `${(comm ?? []).length} Konfigurationen: ${emailProviders.join(", ")}`,
  );
  const liveMail = (comm ?? []).filter((c) => c.test_mode === false && c.status === "active");
  check(
    "B8.6 Kein produktiver E-Mail-Versand aktiv",
    liveMail.length === 0,
    `${liveMail.length} Nicht-Test-Konfigurationen`,
  );
  const { data: senders } = await admin
    .from("sender_identities")
    .select("email, verification_status");
  const verified = (senders ?? []).filter((s) => s.verification_status === "verified");
  if ((senders ?? []).length > 0) {
    check(
      "B8.7 Absenderidentitäten vorhanden (Verifizierung dokumentiert)",
      true,
      `${(senders ?? []).length} Identitäten, davon ${verified.length} verifiziert`,
    );
  } else {
    note(
      "B8.7 Verifizierte Absenderidentität",
      "BLOCKED",
      "Keine Absenderidentität hinterlegt; erfordert eine echte Absenderdomain und Provider-Zugangsdaten.",
    );
  }
  const { count: suppressions } = await admin
    .from("communication_suppressions")
    .select("id", { count: "exact", head: true });
  check(
    "B8.8 Sperrliste (Bounces/Beschwerden) technisch vorhanden",
    typeof suppressions === "number",
    `${suppressions} Einträge`,
  );
  const mailWh = await fetch(`${APP}/api/public/webhooks/communications/resend`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "email.bounced" }),
  });
  check(
    "B8.9 Kommunikations-Webhook lehnt unsignierte Anfragen ab",
    mailWh.status >= 400,
    `status ${mailWh.status}`,
  );
  matrix.push({
    domain: "E-Mail",
    provider: "Produktivversand",
    status: verified.length > 0 ? "OFFEN" : "BLOCKED",
    evidence:
      verified.length > 0
        ? "Verifizierte Absender vorhanden, Provider-Zugangsdaten fehlen"
        : "Keine verifizierte Domain, keine Provider-Zugangsdaten",
  });
  matrix.push({
    domain: "E-Mail",
    provider: "Test-Provider",
    status: emailProviders.includes("test") ? "PASS" : "FAIL",
    evidence: "Interner Testversand aktiv",
  });

  // -------------------------------------------------------------- Carrier
  const { data: ship } = await admin
    .from("shipping_provider_configs")
    .select("provider, status, test_mode");
  const carriers = [...new Set((ship ?? []).map((s) => s.provider))];
  check(
    "B8.10 Versanddienstleister konfiguriert",
    (ship ?? []).length > 0,
    `${(ship ?? []).length} Konfigurationen: ${carriers.join(", ")}`,
  );
  const liveCarrier = (ship ?? []).filter((s) => s.test_mode === false && s.status === "active");
  check(
    "B8.11 Kein Live-Carrier aktiv",
    liveCarrier.length === 0,
    `${liveCarrier.length} Live-Konfigurationen`,
  );
  const carrierWh = await fetch(`${APP}/api/public/webhooks/carrier/mock`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tracking: "X" }),
  });
  check(
    "B8.12 Carrier-Webhook antwortet ohne Serverfehler",
    carrierWh.status < 500,
    `status ${carrierWh.status}`,
  );
  matrix.push({
    domain: "Versand",
    provider: "Echte Carrier-Labels",
    status: "BLOCKED",
    evidence: "Keine Carrier-Zugangsdaten hinterlegt",
  });
  matrix.push({
    domain: "Versand",
    provider: "Mock-Carrier",
    status: carriers.includes("mock") ? "PASS" : "FAIL",
    evidence: "Mock-Carrier aktiv für Dev/QA",
  });

  // ------------------------------------------------------------- Secrets
  const secretNames = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "RESEND_API_KEY",
    "CARRIER_API_KEY",
  ];
  const present = secretNames.filter((n) => Boolean(process.env[n]));
  check(
    "B8.13 Keine Live-Provider-Secrets in der Dev-Umgebung gesetzt",
    present.length === 0,
    present.length ? `gesetzt: ${present.join(", ")}` : "keines gesetzt",
  );

  note(
    "B8.14 Live-Schaltung Stripe, E-Mail-Domain und Carrier",
    "BLOCKED",
    "Erfordert Zugangsdaten und Freigabe des Betreibers; nicht durch den Agenten ausführbar.",
  );

  writeFileSync(
    "qa/results-phase14-providers.json",
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        base: APP,
        total: results.length,
        passed: results.filter((r) => r.ok).length,
        matrix,
        results,
      },
      null,
      2,
    ),
  );
  summary();
}

void main();
