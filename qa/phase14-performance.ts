/* QA harness — Gate B / B3: Performance und Lastverhalten.
 * Misst Store-API, Seitenauslieferung und Nebenläufigkeit gegen die befüllte
 * Demo-Organisation. Nur Dev/Preview, nie Production. */
import { writeFileSync } from "node:fs";
import { admin, check, results, summary } from "./lib";
import { createKey } from "../src/lib/commerce/store/keys.server";

const APP = process.env["QA_APP_BASE"] ?? "http://localhost:8080";
const BASE = `${APP}/api/public/store/v1`;
const ORG = "5eebb5ba-0a22-4a34-9c28-5dfab7d48924";

type Stat = { label: string; n: number; p50: number; p95: number; max: number; errors: number };
const stats: Stat[] = [];

function percentile(values: number[], p: number) {
  const s = [...values].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0);
}

async function bench(label: string, n: number, fn: () => Promise<number>): Promise<Stat> {
  const times: number[] = [];
  let errors = 0;
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    const status = await fn().catch(() => 0);
    const dt = performance.now() - t0;
    if (status >= 400 || status === 0) errors++;
    else times.push(dt);
  }
  const stat: Stat = {
    label,
    n,
    p50: percentile(times, 50),
    p95: percentile(times, 95),
    max: Math.round(Math.max(0, ...times)),
    errors,
  };
  stats.push(stat);
  return stat;
}

async function main() {
  const { data: shop } = await admin
    .from("shops")
    .select("id")
    .eq("organization_id", ORG)
    .limit(1)
    .single();
  const key = await createKey({
    organizationId: ORG,
    shopId: shop!.id,
    name: `gateb-perf-${Date.now()}`,
    environment: "test",
    allowedOrigins: ["*"],
    actorId: null,
  });
  const H = { "x-commerce-key": key.key };

  async function api(path: string, init: RequestInit = {}) {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...H, ...(init.headers ?? {}) },
    });
    await res.text();
    return res.status;
  }

  // ------------------------------------------------------- B3.1 Store API
  const list = await bench("GET /products (Katalogliste, 32 Produkte)", 30, () =>
    api("/products?limit=24"),
  );
  check(
    `Katalogliste p95 unter 3000 ms (${list.p95} ms)`,
    list.p95 < 3000 && list.errors === 0,
    JSON.stringify(list),
  );

  const { data: product } = await admin
    .from("products")
    .select("handle")
    .eq("organization_id", ORG)
    .eq("status", "active")
    .limit(1)
    .single();
  const detail = await bench(`GET /products/${product!.handle} (Detail)`, 30, () =>
    api(`/products/${product!.handle}`),
  );
  check(
    `Produktdetail p95 unter 1500 ms (${detail.p95} ms)`,
    detail.p95 < 1500 && detail.errors === 0,
    JSON.stringify(detail),
  );

  const search = await bench("GET /products?search= (Suche)", 20, () =>
    api("/products?search=shirt&limit=24"),
  );
  check(
    `Suche p95 unter 2500 ms (${search.p95} ms)`,
    search.p95 < 2500 && search.errors === 0,
    JSON.stringify(search),
  );

  // ------------------------------------------------------- B3.2 Cart-Fluss
  const cartRes = await fetch(`${BASE}/cart`, { method: "POST", headers: H });
  const cartBody = await cartRes.json();
  const cartId = cartBody?.data?.cart?.id as string;
  const cartToken = cartBody?.data?.cartToken as string;
  check("Warenkorb für Messung angelegt", Boolean(cartId && cartToken));

  const { data: variant } = await admin
    .from("product_variants")
    .select("id, product_id")
    .eq("organization_id", ORG)
    .limit(1)
    .single();

  const addItem = await bench("POST /cart/:id/items (Position hinzufügen)", 15, () =>
    api(`/cart/${cartId}/items`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-cart-token": cartToken },
      body: JSON.stringify({ variantId: variant!.id, quantity: 1 }),
    }),
  );
  check(
    `Warenkorb-Schreibvorgang p95 unter 2500 ms (${addItem.p95} ms)`,
    addItem.p95 < 2500 && addItem.errors === 0,
    JSON.stringify(addItem),
  );

  const readCart = await bench("GET /cart/:id (Warenkorb lesen)", 20, () =>
    api(`/cart/${cartId}`, { headers: { "x-cart-token": cartToken } }),
  );
  check(
    `Warenkorb lesen p95 unter 1500 ms (${readCart.p95} ms)`,
    readCart.p95 < 1500 && readCart.errors === 0,
    JSON.stringify(readCart),
  );

  // ------------------------------------------------------ B3.3 Parallellast
  const started = performance.now();
  const settled = await Promise.allSettled(
    Array.from({ length: 10 }, () =>
      fetch(`${BASE}/products?limit=24`, { headers: H, signal: AbortSignal.timeout(60_000) }),
    ),
  );
  const wall = Math.round(performance.now() - started);
  const parallel = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const okCount = parallel.filter((r) => r.status === 200).length;
  const rateLimited = parallel.filter((r) => r.status === 429).length;
  await Promise.all(parallel.map((r) => r.text()));
  check(
    `10 parallele Katalogabrufe werden bedient (${okCount} OK, ${rateLimited} ratenbegrenzt, ${wall} ms)`,
    okCount + rateLimited === 10 && wall < 30_000,
    `ok=${okCount} 429=${rateLimited} wall=${wall}ms`,
  );

  // Nebenläufige Schreibzugriffe auf denselben Warenkorb dürfen nicht zu
  // inkonsistenten Mengen führen.
  const before = await (
    await fetch(`${BASE}/cart/${cartId}`, {
      headers: { ...H, "x-cart-token": cartToken },
    })
  ).json();
  const beforeQty = (before?.data?.cart?.items ?? []).reduce(
    (sum: number, i: { quantity?: number }) => sum + (i.quantity ?? 0),
    0,
  );
  await Promise.all(
    Array.from({ length: 8 }, () =>
      fetch(`${BASE}/cart/${cartId}/items`, {
        method: "POST",
        headers: { ...H, "content-type": "application/json", "x-cart-token": cartToken },
        body: JSON.stringify({ variantId: variant!.id, quantity: 1 }),
      }).then((r) => r.text()),
    ),
  );
  const after = await (
    await fetch(`${BASE}/cart/${cartId}`, {
      headers: { ...H, "x-cart-token": cartToken },
    })
  ).json();
  const afterQty = (after?.data?.cart?.items ?? []).reduce(
    (sum: number, i: { quantity?: number }) => sum + (i.quantity ?? 0),
    0,
  );
  check(
    "Nebenläufige Warenkorb-Schreibzugriffe bleiben konsistent",
    afterQty >= beforeQty && afterQty <= beforeQty + 8,
    `vorher ${beforeQty}, nachher ${afterQty}`,
  );

  // Kein Überverkauf: Reservierungen dürfen den Bestand nicht übersteigen.
  const { data: levels } = await admin
    .from("inventory_levels")
    .select("on_hand, reserved")
    .eq("organization_id", ORG);
  const oversold = (levels ?? []).filter((l) => Number(l.reserved) > Number(l.on_hand));
  check(
    "Kein Überverkauf: reservierte Menge nie größer als Bestand",
    oversold.length === 0,
    `${oversold.length} von ${(levels ?? []).length} Beständen`,
  );

  // ------------------------------------------------ B3.4 Seitenauslieferung
  for (const route of ["/", "/store", "/store/warenkorb", "/portal/gast"]) {
    const s = await bench(`GET ${route} (HTML)`, 10, async () => {
      const r = await fetch(`${APP}${route}`);
      await r.text();
      return r.status;
    });
    check(
      `Seite ${route} p95 unter 2500 ms (${s.p95} ms)`,
      s.p95 < 2500 && s.errors === 0,
      JSON.stringify(s),
    );
  }

  // ------------------------------------------------- B3.5 Datenbankabfragen
  const dbList = await bench("DB: Bestellliste (50 Zeilen mit Joins)", 15, async () => {
    const { error } = await admin
      .from("orders")
      .select("id, order_number, total_minor, order_status, payment_status, customer_id, created_at")
      .eq("organization_id", ORG)
      .order("created_at", { ascending: false })
      .limit(50);
    return error ? 500 : 200;
  });
  check(
    `Bestellliste p95 unter 800 ms (${dbList.p95} ms)`,
    dbList.p95 < 800 && dbList.errors === 0,
    JSON.stringify(dbList),
  );

  // ------------------------------------------------------------- Aufräumen
  await admin.from("store_api_keys").delete().eq("id", key.id);
  const { count: leftKeys } = await admin
    .from("store_api_keys")
    .select("id", { count: "exact", head: true })
    .like("name", "gateb-perf-%");
  check("Last-Test-Schlüssel entfernt", (leftKeys ?? 0) === 0, `${leftKeys} verbleibend`);

  writeFileSync(
    "qa/results-phase14-performance.json",
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        base: APP,
        stats,
        total: results.length,
        passed: results.filter((r) => r.ok).length,
        results,
      },
      null,
      2,
    ),
  );
  console.log("\n-- Messwerte --");
  for (const s of stats)
    console.log(
      `${s.label}: p50=${s.p50}ms p95=${s.p95}ms max=${s.max}ms n=${s.n} err=${s.errors}`,
    );
  summary();
}

void main();
