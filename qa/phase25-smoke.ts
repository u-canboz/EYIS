/**
 * Phase 25 — Fachliche Smoke-Tests einer frischen EYIS-Installation.
 *
 * Kette: Produkt → Variante → Preis → Veröffentlichung → Store API → SDK →
 * Warenkorb → Neuberechnung. Zusätzlich ein Kommunikations-Smoke über die
 * echte Template-/Render-Engine.
 *
 * Läuft ausschließlich gegen Dev/Preview. Keine Production-Aktion, keine
 * echten Zahlungen, kein echter Versand.
 */

import { writeFileSync } from "node:fs";

import * as cartApi from "@/lib/commerce/cart.server";
import { resolveTemplate, loadBranding } from "@/lib/commerce/communications/communication.server";
import { renderEmail } from "@/lib/commerce/communications/renderer";
import { ensurePriceSet } from "@/lib/commerce/pricing.server";
import { createCommerceClient } from "@/lib/store-sdk";
import { admin, check, readState, results, summary } from "./lib";

const s = readState();
const ORG = s["orgA"]!;
const SHOP = s["shopA"]!;
const BASE = (process.env["COMMERCE_OS_URL"] ?? "http://localhost:8080").replace(/\/$/, "");
const STAMP = Date.now();
const HANDLE = `qa-smoke-${STAMP}`;
const PRICE_MINOR = 2490;

async function ensureStoreKey(): Promise<string | null> {
  const { data } = await admin
    .from("store_api_keys")
    .select("key_prefix")
    .eq("shop_id", SHOP)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return (data as { key_prefix?: string } | null)?.key_prefix ?? null;
}

async function main() {
  /* ---------------- 1. Produkt ---------------- */
  const { data: blueprint } = await admin
    .from("product_blueprints")
    .select("id, key, version")
    .eq("key", "standard")
    .maybeSingle();
  check("System-Blueprint 'standard' vorhanden", Boolean(blueprint), blueprint?.["key"] ?? "fehlt");

  const { data: product, error: pErr } = await admin
    .from("products")
    .insert({
      organization_id: ORG,
      shop_id: SHOP,
      blueprint_id: blueprint!["id"],
      blueprint_key: blueprint!["key"],
      blueprint_version: blueprint!["version"],
      name: `QA Smoke ${STAMP}`,
      handle: HANDLE,
      status: "draft",
      blueprint_data: {},
    })
    .select("id, status")
    .single();
  check("Produkt angelegt (Entwurf)", !pErr && Boolean(product), pErr?.message ?? String(product?.["id"]));
  const productId = product!["id"] as string;

  /* ---------------- 2. Variante ---------------- */
  const { data: variant, error: vErr } = await admin
    .from("product_variants")
    .insert({
      organization_id: ORG,
      product_id: productId,
      title: "Standard",
      sku: `QA-${STAMP}`,
      position: 1,
      status: "active",
    })
    .select("id")
    .single();
  check("Variante angelegt", !vErr && Boolean(variant), vErr?.message ?? String(variant?.["id"]));
  const variantId = variant!["id"] as string;

  /* ---------------- 3. Preis ---------------- */
  const priceSetId = await ensurePriceSet(admin as never, {
    organizationId: ORG,
    shopId: SHOP,
    variantId,
  });
  const { error: prErr } = await admin.from("prices").insert({
    organization_id: ORG,
    shop_id: SHOP,
    price_set_id: priceSetId,
    amount_minor: PRICE_MINOR,
    currency_code: "EUR",
    type: "base",
  });
  check("Preis über Price-Set gesetzt", !prErr, prErr?.message ?? `${PRICE_MINOR} EUR minor`);

  /* ---------------- 4. Veröffentlichen ---------------- */
  const { error: pubErr } = await admin
    .from("products")
    .update({ status: "active", published_at: new Date().toISOString() })
    .eq("id", productId);
  check("Produkt veröffentlicht", !pubErr, pubErr?.message ?? "status=active");

  /* ---------------- 5. Store API ---------------- */
  const key = await ensureStoreKey();
  if (!key) {
    check("Store-API-Schlüssel vorhanden", false, "kein aktiver Schlüssel für den Shop");
  } else {
    const res = await fetch(`${BASE}/api/public/store/v1/products/${HANDLE}`, {
      headers: { "x-store-key": key },
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    check("Store API liefert das Produkt", res.status === 200, `HTTP ${res.status}`);
    const raw = JSON.stringify(body);
    check(
      "Store API gibt den Preis serverseitig aus",
      raw.includes(String(PRICE_MINOR)),
      `${PRICE_MINOR} in Antwort: ${raw.includes(String(PRICE_MINOR))}`,
    );
    check(
      "Store API enthält keine internen Felder",
      !/organization_id|service_role|price_set_id/.test(raw),
      "Allowlist eingehalten",
    );

    /* ---------------- 6. SDK ---------------- */
    try {
      const client = createCommerceClient({
        baseUrl: `${BASE}/api/public/store/v1`,
        publishableKey: key,
      });
      const viaSdk = (await client.product(HANDLE)) as Record<string, unknown>;
      check("SDK liest dasselbe Produkt", Boolean(viaSdk), HANDLE);
    } catch (e) {
      check("SDK liest dasselbe Produkt", false, e instanceof Error ? e.message : String(e));
    }
  }

  /* ---------------- 7. Warenkorb + Neuberechnung ---------------- */
  const { cartId, token } = await cartApi.createCart({
    organizationId: ORG,
    shopId: SHOP,
    currencyCode: "EUR",
  });
  const snap = await cartApi.loadVariantSnapshot(ORG, SHOP, variantId);
  await admin.from("cart_items").insert({
    organization_id: ORG,
    shop_id: SHOP,
    cart_id: cartId,
    product_id: productId,
    variant_id: variantId,
    quantity: 2,
    title_snapshot: snap.title,
    variant_title_snapshot: snap.variantTitle,
    sku_snapshot: snap.sku,
    image_snapshot: snap.image,
  });
  let cart = await cartApi.loadCartAuthorized(cartId, token);
  let view = await cartApi.buildCartView(cart);
  check(
    "Warenkorb rechnet serverseitig 2 × Preis",
    view.totals.subtotalMinor === PRICE_MINOR * 2,
    `subtotal=${view.totals.subtotalMinor}`,
  );

  const NEW_PRICE = 1990;
  await admin.from("prices").update({ amount_minor: NEW_PRICE }).eq("price_set_id", priceSetId);
  cart = await cartApi.loadCartAuthorized(cartId, token);
  view = await cartApi.buildCartView(cart);
  check(
    "Preisänderung wird beim Reprice übernommen",
    view.totals.subtotalMinor === NEW_PRICE * 2,
    `subtotal=${view.totals.subtotalMinor}`,
  );

  /* ---------------- 8. Kommunikation ---------------- */
  for (const event of ["order.confirmed", "invoice.issued", "return.refunded"]) {
    try {
      const template = await resolveTemplate(ORG, SHOP, event);
      check(`Vorlage ${event} auflösbar`, Boolean(template), template ? "gefunden" : "fehlt");
    } catch (e) {
      check(`Vorlage ${event} auflösbar`, false, e instanceof Error ? e.message : String(e));
    }
  }

  try {
    const branding = await loadBranding(ORG, SHOP);
    const template = await resolveTemplate(ORG, SHOP, "order.confirmed");
    const rendered = renderEmail({
      subject: template!.subject,
      preheader: template!.preheader,
      blocks: template!.blocks,
      branding,
      context: {
        shop: {
          name: "QA Shop",
          support_email: "support@commerce-qa.test",
          website_url: BASE,
        },
        customer: {
          first_name: "Qa",
          last_name: "Tester",
          full_name: "Qa Tester",
          email: "qa-buyer@commerce-qa.test",
        },
        order: {
          number: "QA-1001",
          date: "01.01.2026",
          subtotal: "24,90 €",
          discount: "0,00 €",
          shipping: "0,00 €",
          tax: "3,98 €",
          total: "24,90 €",
          currency: "EUR",
          items: [],
          shipping_address: ["Qa Tester", "Teststraße 1", "10115 Berlin"],
        },
      } as never,
    });
    check("Bestellbestätigung rendert vollständig", rendered.html.length > 200, `${rendered.html.length} Zeichen`);
    check(
      "Rendering lässt keine Platzhalter offen",
      !/\{\{\s*[a-z.]+\s*\}\}/i.test(rendered.html),
      "keine offenen {{...}}",
    );
    check(
      "Rendering maskiert HTML im Kontext",
      !rendered.html.includes("<script"),
      "kein <script> im Ergebnis",
    );
  } catch (e) {
    check("Bestellbestätigung rendert vollständig", false, e instanceof Error ? e.message : String(e));
  }

  /* ---------------- Aufräumen ---------------- */
  await admin.from("cart_items").delete().eq("cart_id", cartId);
  await admin.from("carts").delete().eq("id", cartId);
  await admin.from("prices").delete().eq("price_set_id", priceSetId);
  await admin.from("price_sets").delete().eq("id", priceSetId);
  await admin.from("product_variants").delete().eq("id", variantId);
  await admin.from("products").delete().eq("id", productId);

  writeFileSync("qa/results-phase25-smoke.json", `${JSON.stringify(results, null, 2)}\n`);
  summary();
}

await main();
