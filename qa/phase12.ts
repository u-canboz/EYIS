/* QA harness — Phase 12: öffentliche Store API + SDK, inkl. Cross-Tenant-Isolation. */
import { writeFileSync } from "node:fs";
import { check, results, summary } from "./lib";
import { createKey, updateKey } from "../src/lib/commerce/store/keys.server";
import { confirmMockPayment } from "./flow";

const BASE = process.env["QA_STORE_BASE"] ?? "http://localhost:8080/api/public/store/v1";
const ORG_A = "ba039523-f8ec-44ff-bb9d-2b5b86b0c0a6";
const SHOP_A = "a9751182-2f3a-4f9a-a2e6-73b6ffd48974";
const ORG_B = "29cb83d1-2f6a-42ff-8bb5-413463402b07";
const SHOP_B = "b7fa4e29-2a98-4640-8c2f-c6064e9b1658";

type Res = { status: number; code: string | null; body: any; requestId: string | null };

async function call(
  key: string,
  method: string,
  path: string,
  opts: { body?: unknown; cartToken?: string; guest?: string; auth?: string; origin?: string } = {},
): Promise<Res> {
  const headers: Record<string, string> = { "x-commerce-key": key };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.cartToken) headers["x-cart-token"] = opts.cartToken;
  if (opts.guest) headers["x-guest-token"] = opts.guest;
  if (opts.auth) headers["authorization"] = `Bearer ${opts.auth}`;
  if (opts.origin) headers["origin"] = opts.origin;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
  });
  const text = await res.text();
  let envelope: any = null;
  try {
    envelope = text ? JSON.parse(text) : null;
  } catch {
    envelope = text;
  }
  const isEnvelope = envelope && typeof envelope === "object";
  return {
    status: res.status,
    code: isEnvelope ? (envelope.error?.code ?? null) : null,
    body: isEnvelope && "data" in envelope ? envelope.data : (envelope?.error ?? envelope),
    requestId: res.headers.get("x-request-id"),
  };
}

const denied = (r: Res) => [401, 403, 404].includes(r.status);
const INTERNAL_FIELDS = ["organization_id", "organizationId", "cost", "costMinor", "internal_status", "key_hash"];

function assertNoInternals(name: string, payload: unknown) {
  const json = JSON.stringify(payload ?? {});
  const leaked = INTERNAL_FIELDS.filter((f) => json.includes(`"${f}"`));
  check(name, leaked.length === 0, leaked.length ? `Leck: ${leaked.join(", ")}` : "keine internen Felder");
}

async function main() {
  // ---------------------------------------------------------------- 1. Keys
  const keyA = await createKey({
    organizationId: ORG_A,
    shopId: SHOP_A,
    name: `QA Phase12 A ${Date.now()}`,
    environment: "test",
    allowedOrigins: ["http://localhost:8080"],
    actorId: null,
  });
  const keyB = await createKey({
    organizationId: ORG_B,
    shopId: SHOP_B,
    name: `QA Phase12 B ${Date.now()}`,
    environment: "test",
    allowedOrigins: ["http://localhost:8080"],
    actorId: null,
  });
  const revoked = await createKey({
    organizationId: ORG_A,
    shopId: SHOP_A,
    name: `QA Phase12 revoked ${Date.now()}`,
    environment: "test",
    allowedOrigins: ["*"],
    actorId: null,
  });
  await updateKey({ organizationId: ORG_A, keyId: revoked.id, status: "revoked" });
  check("Keys für zwei Shops erstellt", Boolean(keyA.key && keyB.key), `${keyA.prefix} / ${keyB.prefix}`);

  const cfg = await call(keyA.key, "GET", "/config");
  check("GET /config", cfg.status === 200 && !!cfg.body?.shop, `${cfg.status} ${cfg.body?.shop?.name ?? ""}`);
  check("Antwort trägt Request-ID", !!cfg.requestId, cfg.requestId ?? "fehlt");

  // ---------------------------------------------------------------- 2. Katalog
  const products = await call(keyA.key, "GET", "/products?page=1&pageSize=5");
  check("GET /products", products.status === 200 && Array.isArray(products.body?.data), String(products.status));
  assertNoInternals("Produktliste ohne interne Felder", products.body);
  const first = products.body?.data?.[0];
  let variantId: string | null = null;
  if (first?.handle) {
    const detail = await call(keyA.key, "GET", `/products/${encodeURIComponent(first.handle)}`);
    check("GET /products/:handle", detail.status === 200, String(detail.status));
    assertNoInternals("Produktdetail ohne interne Felder", detail.body);
    variantId = detail.body?.variants?.[0]?.id ?? null;
  } else {
    check("GET /products/:handle", false, "kein Produkt im Shop A");
  }
  const search = await call(keyA.key, "GET", `/search?q=${encodeURIComponent(first?.title?.slice(0, 4) ?? "a")}`);
  check("GET /search", search.status === 200, String(search.status));
  const cats = await call(keyA.key, "GET", "/categories");
  check("GET /categories", cats.status === 200, String(cats.status));

  // ---------------------------------------------------------------- 3. Cart
  const cartA = await call(keyA.key, "POST", "/cart", { body: { locale: "de-DE" } });
  const cartAId: string = cartA.body?.cart?.id;
  const cartAToken: string = cartA.body?.cartToken;
  check("POST /cart", cartA.status === 200 && !!cartAId && !!cartAToken, String(cartA.status));

  const noToken = await call(keyA.key, "GET", `/cart/${cartAId}`);
  check("Cart ohne Token abgelehnt", denied(noToken), `${noToken.status} ${noToken.code}`);

  const withToken = await call(keyA.key, "GET", `/cart/${cartAId}`, { cartToken: cartAToken });
  check("Cart mit Token lesbar", withToken.status === 200, String(withToken.status));

  let itemId: string | null = null;
  if (variantId) {
    const added = await call(keyA.key, "POST", `/cart/${cartAId}/items`, {
      cartToken: cartAToken,
      body: { variantId, quantity: 2 },
    });
    check("Position hinzufügen", added.status === 200, `${added.status} ${added.code ?? ""}`);
    itemId = added.body?.items?.[0]?.id ?? null;
    if (itemId) {
      const upd = await call(keyA.key, "PATCH", `/cart/${cartAId}/items/${itemId}`, {
        cartToken: cartAToken,
        body: { quantity: 1 },
      });
      check("Menge ändern", upd.status === 200 && upd.body?.items?.[0]?.quantity === 1, String(upd.status));
      const totals = upd.body?.totals;
      const lineSum = (upd.body?.items ?? []).reduce(
        (n: number, i: any) => n + Number(i.lineTotalMinor ?? i.totalMinor ?? 0),
        0,
      );
      check(
        "Summen konsistent",
        !!totals && Number(totals.subtotalMinor ?? -1) === lineSum,
        JSON.stringify(totals ?? {}),
      );
      const promo = await call(keyA.key, "POST", `/cart/${cartAId}/promotions`, {
        cartToken: cartAToken,
        body: { code: "QA-NICHT-EXISTENT" },
      });
      const promoNoDiscount =
        promo.status >= 400 || Number(promo.body?.totals?.discountMinor ?? 0) === 0;
      check(
        "Unbekannter Promo-Code ohne Wirkung",
        promoNoDiscount,
        `${promo.status} ${promo.code ?? "kein Rabatt"}`,
      );
      const del = await call(keyA.key, "DELETE", `/cart/${cartAId}/items/${itemId}`, { cartToken: cartAToken });
      check("Position entfernen", del.status === 200, String(del.status));
      // wieder befüllen für Checkout
      const re = await call(keyA.key, "POST", `/cart/${cartAId}/items`, {
        cartToken: cartAToken,
        body: { variantId, quantity: 1 },
      });
      itemId = re.body?.items?.[0]?.id ?? null;
    } else {
      check("Menge ändern", false, "keine Position erzeugt");
    }
  } else {
    check("Position hinzufügen", false, "keine Variante verfügbar");
  }

  // ---------------------------------------------------------------- 4. Checkout
  let sessionId: string | null = null;
  if (itemId) {
    const started = await call(keyA.key, "POST", "/checkout", {
      cartToken: cartAToken,
      body: { cartId: cartAId, email: "qa-phase12@example.com" },
    });
    sessionId = started.body?.id ?? null;
    check("Checkout starten", started.status === 200 && !!sessionId, `${started.status} ${started.code ?? ""}`);
    if (sessionId) {
      const addr = await call(keyA.key, "POST", `/checkout/${sessionId}/address`, {
        cartToken: cartAToken,
        body: {
          type: "shipping",
          billingSameAsShipping: true,
          address: {
            firstName: "Qa",
            lastName: "Tester",
            street: "Teststraße 1",
            postalCode: "10115",
            city: "Berlin",
            countryCode: "DE",
          },
        },
      });
      check("Adresse setzen", addr.status === 200, `${addr.status} ${addr.code ?? ""}`);
      const opts = await call(keyA.key, "GET", `/checkout/${sessionId}/shipping-options`, { cartToken: cartAToken });
      check("Versandarten laden", opts.status === 200, `${opts.status} ${JSON.stringify(opts.body)?.slice(0, 80)}`);
      const methodId = Array.isArray(opts.body) ? opts.body[0]?.id : null;
      if (methodId) {
        const set = await call(keyA.key, "POST", `/checkout/${sessionId}/shipping-option`, {
          cartToken: cartAToken,
          body: { shippingMethodId: methodId },
        });
        check("Versandart wählen", set.status === 200, String(set.status));
      } else {
        check("Versandart wählen", false, "keine Versandart konfiguriert");
      }
      const validated = await call(keyA.key, "POST", `/checkout/${sessionId}/validate`, {
        cartToken: cartAToken,
        body: {},
      });
      check("Checkout validieren", validated.status === 200, `${validated.status} ${validated.code ?? ""}`);
      const pay = await call(keyA.key, "POST", `/checkout/${sessionId}/payment-session`, {
        cartToken: cartAToken,
        body: { returnUrl: "http://localhost:8080/store/bestaetigung", provider: "mock" },
      });
      check("Payment-Session anlegen", pay.status === 200, `${pay.status} ${pay.code ?? ""}`);
      const paySessionId = pay.body?.id ?? null;
      if (paySessionId) {
        const finalized = await confirmMockPayment(paySessionId).catch((e) => ({ error: String(e) }) as never);
        check(
          "Mock-Zahlung finalisiert",
          !!(finalized as Record<string, unknown>)?.["order_id"],
          JSON.stringify(finalized).slice(0, 120),
        );
        const status = await call(keyA.key, "GET", `/payments/${paySessionId}/status`, { cartToken: cartAToken });
        check("Zahlungsstatus lesbar", status.status === 200, `${status.status} ${status.body?.status ?? ""}`);
        const token = status.body?.confirmationToken;
        if (token) {
          const one = await call(keyA.key, "GET", `/orders/confirmation/${encodeURIComponent(token)}`);
          check("Confirmation-Token einlösbar", one.status === 200, String(one.status));
          const two = await call(keyA.key, "GET", `/orders/confirmation/${encodeURIComponent(token)}`);
          check("Confirmation-Token nur einmal gültig", denied(two), `${two.status} ${two.code}`);
        } else {
          check("Confirmation-Token", false, `kein Token (status=${status.body?.status ?? "?"})`);
        }
      }
    }
  }

  // ------------------------------------------------------- 5. Konto & Gast
  const badLogin = await call(keyA.key, "POST", "/customer/auth/login", {
    body: { email: "qa-unbekannt@example.com", password: "FalschesPasswort123" },
  });
  check("Login mit falschen Daten abgelehnt", denied(badLogin), `${badLogin.status} ${badLogin.code}`);
  const me = await call(keyA.key, "GET", "/customer/me");
  check("Konto ohne Session abgelehnt", denied(me), `${me.status} ${me.code}`);
  const guestReq = await call(keyA.key, "POST", "/orders/guest-access", {
    body: { orderNumber: "NICHT-EXISTENT", email: "qa-phase12@example.com" },
  });
  check("Gastzugang antwortet neutral", guestReq.status === 200, JSON.stringify(guestReq.body).slice(0, 80));
  const guestOrder = await call(keyA.key, "GET", "/orders/guest");
  check("Gastbestellung ohne Token abgelehnt", denied(guestOrder), `${guestOrder.status} ${guestOrder.code}`);
  const guestBad = await call(keyA.key, "GET", "/orders/guest", { guest: "gefälschter-token" });
  check("Gefälschter Guest-Token abgelehnt", denied(guestBad), `${guestBad.status} ${guestBad.code}`);

  // ---------------------------------------------------------------- 6. Retoure
  const elig = await call(keyA.key, "GET", "/returns/eligibility", { guest: "gefälschter-token" });
  check("Retouren-Eligibility ohne gültigen Token abgelehnt", denied(elig), `${elig.status} ${elig.code}`);
  const retCreate = await call(keyA.key, "POST", "/returns", {
    guest: "gefälschter-token",
    body: { items: [{ orderItemId: crypto.randomUUID(), quantity: 1 }], reason: "damaged", idempotencyKey: crypto.randomUUID() },
  });
  check("Retoure ohne gültigen Token abgelehnt", denied(retCreate), `${retCreate.status} ${retCreate.code}`);

  // ----------------------------------------------------- 7. Cross-Tenant
  const cartB = await call(keyB.key, "POST", "/cart", { body: { locale: "de-DE" } });
  const cartBId: string = cartB.body?.cart?.id;
  const cartBToken: string = cartB.body?.cartToken;
  check("Shop B Warenkorb angelegt", cartB.status === 200 && !!cartBId, String(cartB.status));

  const xs: [string, Res][] = [
    ["GET /cart/:id (B-ID, A-Key)", await call(keyA.key, "GET", `/cart/${cartBId}`, { cartToken: cartBToken })],
    [
      "POST /cart/:id/items (B-ID + B-Token, A-Key)",
      await call(keyA.key, "POST", `/cart/${cartBId}/items`, {
        cartToken: cartBToken,
        body: { variantId: crypto.randomUUID(), quantity: 1 },
      }),
    ],
    [
      "PATCH /cart/:id/items (B-ID + B-Token, A-Key)",
      await call(keyA.key, "PATCH", `/cart/${cartBId}/items/${crypto.randomUUID()}`, {
        cartToken: cartBToken,
        body: { quantity: 1 },
      }),
    ],
    [
      "GET /checkout/:id (fremde ID)",
      await call(keyB.key, "GET", `/checkout/${sessionId ?? crypto.randomUUID()}`, { cartToken: cartBToken }),
    ],
    [
      "GET /orders/confirmation/:token (fremder Shop)",
      await call(keyB.key, "GET", `/orders/confirmation/${crypto.randomUUID()}`),
    ],
    [
      "GET /customer/orders/:id (fremder Shop)",
      await call(keyB.key, "GET", `/customer/orders/${crypto.randomUUID()}`),
    ],
    [
      "GET /customer/orders/:id/documents/:doc (fremder Shop)",
      await call(keyB.key, "GET", `/customer/orders/${crypto.randomUUID()}/documents/${crypto.randomUUID()}`),
    ],
    [
      "GET /orders/guest/documents/:doc (fremder Token)",
      await call(keyB.key, "GET", `/orders/guest/documents/${crypto.randomUUID()}`, { guest: "fremd" }),
    ],
    [
      "POST /returns (fremder Shop)",
      await call(keyB.key, "POST", "/returns", {
        guest: "fremd",
        body: {
          items: [{ orderItemId: crypto.randomUUID(), quantity: 1 }],
          reason: "damaged",
          idempotencyKey: crypto.randomUUID(),
        },
      }),
    ],
  ];
  for (const [name, res] of xs) {
    check(`Cross-Tenant: ${name}`, denied(res), `${res.status} ${res.code}`);
  }
  const shapes = new Set(
    xs
      .filter(([, r]) => r.status !== 200)
      .map(([, r]) => Object.keys((r.body ?? {}) as Record<string, unknown>).sort().join(",")),
  );
  check("Fehlerform einheitlich (kein Existenz-Leak)", shapes.size <= 2, [...shapes].join(" | "));

  // ---------------------------------------------------------------- 8. Negativfälle
  const revokedRes = await call(revoked.key, "GET", "/config");
  check("Widerrufener Key abgelehnt", revokedRes.status === 401, `${revokedRes.status} ${revokedRes.code}`);
  const badKey = await call("pk_test_" + "x".repeat(40), "GET", "/config");
  check("Unbekannter Key abgelehnt", badKey.status === 401, `${badKey.status} ${badKey.code}`);
  const badOrigin = await call(keyA.key, "GET", "/config", { origin: "https://boese.example.com" });
  check("Fremder Origin abgelehnt", badOrigin.status === 403, `${badOrigin.status} ${badOrigin.code}`);
  const foreignCartToken = await call(keyA.key, "GET", `/cart/${cartAId}`, { cartToken: cartBToken });
  check("Fremder Cart-Token abgelehnt", denied(foreignCartToken), `${foreignCartToken.status} ${foreignCartToken.code}`);
  const unknownEndpoint = await call(keyA.key, "GET", "/gibt-es-nicht");
  check("Unbekannter Endpunkt = 404", unknownEndpoint.status === 404, String(unknownEndpoint.status));

  // Rate-Limit (customer_login: 5 / 300 s)
  let limited = false;
  for (let i = 0; i < 8; i++) {
    const r = await call(keyA.key, "POST", "/customer/auth/password-reset", {
      body: { email: `qa-rate-${i}@example.com` },
    });
    if (r.status === 429) {
      limited = true;
      break;
    }
  }
  check("Rate-Limit greift (customer_login)", limited, limited ? "429 erhalten" : "kein 429 nach 8 Versuchen");

  // Idempotenz: gleicher Key -> keine zweite Ressource
  const idem = crypto.randomUUID();
  const r1 = await call(keyA.key, "POST", "/returns", {
    guest: "fremd",
    body: { items: [{ orderItemId: crypto.randomUUID(), quantity: 1 }], reason: "damaged", idempotencyKey: idem },
  });
  const r2 = await call(keyA.key, "POST", "/returns", {
    guest: "fremd",
    body: { items: [{ orderItemId: crypto.randomUUID(), quantity: 1 }], reason: "damaged", idempotencyKey: idem },
  });
  check("Idempotente Wiederholung identisch", r1.status === r2.status, `${r1.status}/${r2.status}`);

  // Keys aufräumen
  await updateKey({ organizationId: ORG_A, keyId: keyA.id, status: "revoked" });
  await updateKey({ organizationId: ORG_B, keyId: keyB.id, status: "revoked" });

  writeFileSync("qa/results-phase12.json", JSON.stringify(results, null, 2));
  summary();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
