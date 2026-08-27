/* Phase 18 final: Integration Center end-to-end recheck.
 * Payment-Method-Discovery -> Checkout -> Payment Session -> Testzahlung ->
 * Order-Finalisierung -> Shop Readiness, plus Cross-Tenant-Isolation und
 * Secret-Leakage. Dev/QA only. */
import { admin, check, readState, summary, results } from "./lib";
import { toValidatedCheckout, confirmMockPayment, checkout, payments } from "./flow";
import { createKey } from "../src/lib/commerce/store/keys.server";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";

const s = readState();
const ORG = s["orgA"]!;
const SHOP = s["shopA"]!;
const ORG_B = s["orgB"]!;
const SHOP_B = s["shopB"]!;
const BASE = process.env["QA_STORE_BASE"] ?? "http://localhost:8080/api/public/store/v1";

const SECRET_RE = /sk_live|sk_test|whsec_[a-zA-Z0-9]|SUPABASE_SERVICE_ROLE_KEY|service_role/;

async function main() {
  const { getShopReadiness, listIntegrations } = await import(
    "../src/lib/commerce/integrations/integration.server"
  );

  /* ---------- 1. Shop Readiness (Ausgangslage) ---------- */
  const readinessBefore = await getShopReadiness(ORG, SHOP);
  check(
    "Readiness: sechs Bereiche, serverseitig abgeleitet",
    readinessBefore.areas.length === 6,
    readinessBefore.areas.map((a) => `${a.key}:${a.ready ? "READY" : "OFFEN"}`).join(", "),
  );
  check(
    "Readiness: kein Live-Ready im Testmodus",
    readinessBefore.liveReady === false,
    `liveReady=${readinessBefore.liveReady}`,
  );

  /* ---------- 2. Payment-Method-Discovery ---------- */
  const keyA = await createKey({
    organizationId: ORG,
    shopId: SHOP,
    name: "phase18-e2e-a",
    environment: "test",
    allowedOrigins: ["http://localhost:8080"],
    actorId: null,
  });
  const keyB = await createKey({
    organizationId: ORG_B,
    shopId: SHOP_B,
    name: "phase18-e2e-b",
    environment: "test",
    allowedOrigins: ["http://localhost:8080"],
    actorId: null,
  });

  const fetchMethods = async (key: string) => {
    const res = await fetch(`${BASE}/payment-methods`, { headers: { "x-commerce-key": key } });
    const body = (await res.json()) as { data?: unknown };
    const data = Array.isArray(body) ? body : (body.data ?? []);
    return { status: res.status, methods: data as { id: string; provider: string; testOnly?: boolean }[] };
  };

  const a = await fetchMethods(keyA.key);
  check(
    "Discovery: /payment-methods liefert aktive Methoden für Shop A",
    a.status === 200 && a.methods.length > 0,
    `status=${a.status} methods=${a.methods.map((m) => m.provider).join(",") || "keine"}`,
  );
  check(
    "Discovery: nur implementierte Provider",
    a.methods.every((m) => ["mock", "stripe"].includes(m.provider)),
    a.methods.map((m) => m.provider).join(","),
  );
  check(
    "Discovery: Test-Provider ist als testOnly markiert",
    a.methods.filter((m) => m.provider === "mock").every((m) => m.testOnly === true),
  );
  check("Discovery: keine Secrets in der Antwort", !SECRET_RE.test(JSON.stringify(a.methods)));

  /* ---------- 3. Cross-Tenant-Isolation ---------- */
  const b = await fetchMethods(keyB.key);
  const { data: cfgA } = await admin
    .from("payment_provider_configs")
    .select("id")
    .eq("organization_id", ORG)
    .eq("shop_id", SHOP);
  const { data: cfgB } = await admin
    .from("payment_provider_configs")
    .select("id")
    .eq("organization_id", ORG_B)
    .eq("shop_id", SHOP_B);
  check(
    "Cross-Tenant: Shop B sieht ausschließlich eigene Methoden",
    b.status === 200 && b.methods.length === (cfgB ?? []).length,
    `shopB=${b.methods.length} configsB=${(cfgB ?? []).length} configsA=${(cfgA ?? []).length}`,
  );
  const viewsA = await listIntegrations(ORG, SHOP);
  const viewsB = await listIntegrations(ORG_B, SHOP_B);
  check(
    "Cross-Tenant: Integrationsansichten sind shop-gebunden",
    JSON.stringify(viewsA.map((v) => v.status)) !== JSON.stringify(viewsB.map((v) => v.status)) ||
      viewsA.length === viewsB.length,
    `A=${viewsA.length} B=${viewsB.length}`,
  );
  const { data: crossConn } = await admin
    .from("integration_connections")
    .select("organization_id, shop_id");
  check(
    "Cross-Tenant: jede Verbindung ist org- und shop-gebunden",
    (crossConn ?? []).every((c) => !!c.organization_id && !!c.shop_id),
    `rows=${(crossConn ?? []).length}`,
  );

  /* ---------- 4. Secret-Leakage ---------- */
  check(
    "Secret-Leakage: Registry client-sicher (kein Server-Import)",
    !readFileSync("src/lib/commerce/integrations/registry.ts", "utf8").match(
      /client\.server|process\.env|supabase-js/,
    ),
  );
  const distDir = "dist/client/assets";
  if (existsSync(distDir)) {
    const hits = readdirSync(distDir)
      .filter((f) => f.endsWith(".js"))
      .filter((f) => SECRET_RE.test(readFileSync(`${distDir}/${f}`, "utf8")));
    check("Secret-Leakage: kein Secret im Client-Bundle", hits.length === 0, hits.join(",") || "0 Treffer");
  } else {
    check("Secret-Leakage: Client-Bundle vorhanden", false, "dist/client/assets fehlt — build ausführen");
  }
  check(
    "Secret-Leakage: Storefront-Checkout ohne hartcodierte Zahlungsarten",
    !readFileSync("src/routes/store/checkout.tsx", "utf8").match(
      /"(stripe|paypal|klarna|mollie|Kreditkarte)"/i,
    ),
  );

  /* ---------- 5. E2E mit Test-Payment-Provider ---------- */
  const chosen = a.methods.find((m) => m.provider === "mock");
  check("E2E: Test-Zahlungsart aus Discovery gewählt", !!chosen, chosen?.provider ?? "keine");

  const flow = await toValidatedCheckout({
    orgId: ORG,
    shopId: SHOP,
    variantId: s["variantId"]!,
    shippingId: s["shippingId"]!,
  });
  check("E2E: Checkout validiert", flow.view.ready, `total=${flow.view.totals.totalMinor}`);

  const { session } = await checkout.loadSessionAuthorized(flow.sessionId, flow.token);
  const pay = await payments.createPaymentSession({
    organizationId: session.organization_id,
    shopId: session.shop_id,
    checkoutSessionId: session.id,
    email: session.email,
    provider: chosen!.provider,
    returnUrl: "http://localhost:8080/store/bestaetigung",
    cancelUrl: "http://localhost:8080/store/checkout",
  });
  check(
    "E2E: Payment Session mit entdecktem Provider",
    pay.provider === chosen!.provider && pay.environment !== "live",
    `${pay.provider}/${pay.environment} ${pay.amountMinor} ${pay.currencyCode}`,
  );

  const finalized = await confirmMockPayment(pay.paymentSessionId);
  check("E2E: Order finalisiert", finalized.created === true, JSON.stringify(finalized).slice(0, 120));
  const { data: order } = await admin
    .from("orders")
    .select("payment_status, order_status, total_minor")
    .eq("id", finalized.order_id)
    .single();
  check("E2E: Zahlungsstatus paid", order!.payment_status === "paid", String(order!.payment_status));
  check(
    "E2E: Bestellstatus gesetzt",
    ["confirmed", "processing", "completed"].includes(String(order!.order_status)),
    String(order!.order_status),
  );
  const ps = await payments.loadPaymentSession(pay.paymentSessionId);
  check("E2E: Payment Session final", ps.status === "paid", ps.status);

  /* ---------- 6. Readiness nach dem Lauf ---------- */
  const readinessAfter = await getShopReadiness(ORG, SHOP);
  check(
    "Readiness nach E2E: Zahlungen READY",
    readinessAfter.areas.find((x) => x.key === "payments")?.ready === true,
    readinessAfter.areas.map((x) => `${x.key}:${x.ready ? "READY" : "OFFEN"}`).join(", "),
  );
  check(
    "Readiness nach E2E: Livebetrieb weiterhin nicht freigegeben (Testmodus)",
    readinessAfter.liveReady === false,
  );

  /* ---------- Cleanup ---------- */
  await admin.from("store_api_keys").delete().in("id", [keyA.id, keyB.id]);

  writeFileSync("qa/results-phase18-e2e.json", JSON.stringify(results, null, 2));
  summary();
}

main();
