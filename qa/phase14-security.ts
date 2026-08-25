/* QA harness — Phase 14 / Gate A3: Security-Audit (OWASP ASVS L2 + API Top 10). */
import { writeFileSync } from "node:fs";
import { admin, check, results, summary } from "./lib";
import { createKey, updateKey } from "../src/lib/commerce/store/keys.server";

const APP = process.env["QA_APP_BASE"] ?? "http://localhost:8080";
const BASE = `${APP}/api/public/store/v1`;
const ORG_A = "ba039523-f8ec-44ff-bb9d-2b5b86b0c0a6";
const SHOP_A = "a9751182-2f3a-4f9a-a2e6-73b6ffd48974";
const ORG_B = "29cb83d1-2f6a-42ff-8bb5-413463402b07";
const SHOP_B = "b7fa4e29-2a98-4640-8c2f-c6064e9b1658";

type Res = { status: number; code: string | null; text: string; body: any };

async function call(
  path: string,
  init: RequestInit & { key?: string | null } = {},
): Promise<Res> {
  const headers = new Headers(init.headers);
  if (init.key) headers.set("x-commerce-key", init.key);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: res.status, code: body?.error?.code ?? null, text, body };
}

async function main() {
  // ---------------------------------------------------------- API keys
  const keyA = await createKey({
    organizationId: ORG_A,
    shopId: SHOP_A,
    name: "phase14-a",
    environment: "test",
    allowedOrigins: ["https://shop-a.example"],
    actorId: null,
  });
  const keyB = await createKey({
    organizationId: ORG_B,
    shopId: SHOP_B,
    name: "phase14-b",
    environment: "test",
    allowedOrigins: ["https://shop-b.example"],
    actorId: null,
  });

  // --------------------------------------------------- A3.1 Key handling
  check("Store API ohne Key -> 401", (await call("/products")).status === 401);
  check(
    "Store API mit erfundenem Key -> 401",
    (await call("/products", { key: "pk_test_" + "0".repeat(64) })).status === 401,
  );
  check(
    "Publishable Key erlaubt Katalog-Read",
    (await call("/products", { key: keyA.key })).status === 200,
  );
  check(
    "Fremde Origin wird abgelehnt",
    (await call("/products", { key: keyA.key, headers: { origin: "https://evil.test" } }))
      .status === 403,
  );
  check(
    "Erlaubte Origin wird akzeptiert",
    (
      await call("/products", {
        key: keyA.key,
        headers: { origin: "https://shop-a.example" },
      })
    ).status === 200,
  );
  await updateKey({ organizationId: ORG_A, keyId: keyA.id, status: "revoked", actorId: null });
  check(
    "Widerrufener Key -> 401",
    (await call("/products", { key: keyA.key })).status === 401,
  );
  const keyA2 = await createKey({
    organizationId: ORG_A,
    shopId: SHOP_A,
    name: "phase14-a2",
    environment: "test",
    allowedOrigins: ["https://shop-a.example"],
    actorId: null,
  });

  // ------------------------------------------- A3.2 Object-Level Authorization
  const cart = await call("/cart", { key: keyA2.key, method: "POST" });
  const cartId: string = cart.body?.data?.cart?.id;
  const cartToken: string = cart.body?.data?.cartToken;
  check("Cart anlegen liefert Token", Boolean(cartId && cartToken));
  check(
    "Cart ohne Token -> 401/403",
    [401, 403].includes((await call(`/cart/${cartId}`, { key: keyA2.key })).status),
  );
  check(
    "Cart mit falschem Token -> 403",
    (
      await call(`/cart/${cartId}`, {
        key: keyA2.key,
        headers: { "x-cart-token": "f".repeat(64) },
      })
    ).status === 403,
  );
  check(
    "Cross-Tenant: Shop-B-Key auf Cart von Shop A -> 403/404",
    [403, 404].includes(
      (
        await call(`/cart/${cartId}`, {
          key: keyB.key,
          headers: { "x-cart-token": cartToken },
        })
      ).status,
    ),
  );
  check(
    "Manipulierte Cart-ID -> 403/404",
    [403, 404].includes(
      (
        await call(`/cart/00000000-0000-0000-0000-000000000000`, {
          key: keyA2.key,
          headers: { "x-cart-token": cartToken },
        })
      ).status,
    ),
  );

  // -------------------------------------------------- A3.3 Guest-Token-Scope
  check(
    "Guest-Endpunkt ohne Token -> 401",
    (await call("/orders/guest", { key: keyA2.key })).status === 401,
  );
  check(
    "Erfundener Guest-Token -> 403",
    (await call("/orders/guest", { key: keyA2.key, headers: { "x-guest-token": "a".repeat(64) } }))
      .status === 403,
  );

  // ------------------------------------------------------- A3.4 Eingaben
  const injection = await call(
    `/products?search=${encodeURIComponent("a,handle.neq.zzz,name.ilike.*")}`,
    { key: keyA2.key },
  );
  check("Filter-Injection in Suche wird neutralisiert", injection.status === 200);
  const oversize = await call(`/cart/${cartId}/items`, {
    key: keyA2.key,
    method: "POST",
    headers: { "content-type": "application/json", "x-cart-token": cartToken },
    body: JSON.stringify({ variantId: "x".repeat(200_000), quantity: 1 }),
  });
  check("Übergroßer Payload -> 400", oversize.status === 400, `status ${oversize.status}`);
  const badJson = await call(`/cart/${cartId}/items`, {
    key: keyA2.key,
    method: "POST",
    headers: { "content-type": "application/json", "x-cart-token": cartToken },
    body: "{",
  });
  check("Ungültiges JSON -> 400", badJson.status === 400);
  const massAssign = await call(`/cart/${cartId}/items`, {
    key: keyA2.key,
    method: "POST",
    headers: { "content-type": "application/json", "x-cart-token": cartToken },
    body: JSON.stringify({ variantId: "00000000-0000-0000-0000-000000000000", quantity: 1, organization_id: ORG_B, unit_price_minor: 1 }),
  });
  check(
    "Mass Assignment (fremde Felder) wird nicht übernommen",
    massAssign.status >= 400 || !JSON.stringify(massAssign.body).includes(ORG_B),
  );
  const traversal = await call("/orders/guest/documents/..%2F..%2Fsecret", {
    key: keyA2.key,
    headers: { "x-guest-token": "a".repeat(64) },
  });
  check("Path Traversal im Dokumentpfad -> kein 200", traversal.status !== 200);

  // ------------------------------------------------------- A3.5 Fehlerausgabe
  const err = await call("/cart/not-a-uuid", {
    key: keyA2.key,
    headers: { "x-cart-token": cartToken },
  });
  check(
    "Keine Stack Traces / internen Details in Fehlern",
    !/at\s+\w+\s+\(|node_modules|supabase\.co|service_role|sb_secret/i.test(err.text),
  );

  // ----------------------------------------------------------- A3.6 Rate limit
  const keyRate = await createKey({
    organizationId: ORG_A,
    shopId: SHOP_A,
    name: "phase14-rate",
    environment: "test",
    allowedOrigins: ["*"],
    actorId: null,
  });
  let limited = false;
  for (let i = 0; i < 14; i++) {
    const r = await call("/orders/guest-access", {
      key: keyRate.key,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderNumber: `X-${i}`, email: "nobody@example.test" }),
    });
    if (r.status === 429) {
      limited = true;
      break;
    }
  }
  check("Guest-Lookup wird ratenbegrenzt (429)", limited);

  // ------------------------------------------------------ A3.7 Job-Endpunkte
  for (const job of ["communications", "automation", "expiration"]) {
    const anon = await fetch(`${APP}/api/public/jobs/${job}`, { method: "POST" });
    check(`Job ${job} ohne Cron-Secret -> 401`, anon.status === 401, `status ${anon.status}`);
    const withKey = await fetch(`${APP}/api/public/jobs/${job}`, {
      method: "POST",
      headers: { apikey: process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "x" },
    });
    check(
      `Job ${job} akzeptiert Publishable Key NICHT`,
      withKey.status === 401,
      `status ${withKey.status}`,
    );
  }

  // ------------------------------------------------------- A3.8 Security-Header
  const page = await fetch(`${APP}/`);
  const h = (n: string) => page.headers.get(n);
  check("X-Content-Type-Options: nosniff", h("x-content-type-options") === "nosniff");
  check("Referrer-Policy gesetzt", Boolean(h("referrer-policy")));
  check("Permissions-Policy gesetzt", Boolean(h("permissions-policy")));
  check(
    "CSP zunächst nur im Report-Only-Modus",
    Boolean(h("content-security-policy-report-only")) && !h("content-security-policy"),
  );
  const apiRes = await fetch(`${BASE}/products`, {
    headers: { "x-commerce-key": keyA2.key },
  });
  check("Store API: no-store", (apiRes.headers.get("cache-control") ?? "").includes("no-store"));

  // -------------------------------------------- A3.9 Datenbank-Privilegien
  const { data: retExec } = await admin
    .from("store_api_keys")
    .select("id")
    .limit(1);
  check("Service-Rolle erreichbar (Kontrollabfrage)", Array.isArray(retExec));

  // cleanup
  for (const k of [keyA2, keyB, keyRate]) {
    await admin.from("store_api_keys").delete().eq("id", k.id);
  }

  writeFileSync(
    "qa/results-phase14-security.json",
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        base: APP,
        total: results.length,
        passed: results.filter((r) => r.ok).length,
        results,
      },
      null,
      2,
    ),
  );
  summary();
}

void main();
