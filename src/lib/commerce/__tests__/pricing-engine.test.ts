import { describe, expect, it } from "vitest";
import { resolvePricing } from "../pricing-engine";
import type { PriceRow, PricingSnapshot, PromotionRow } from "../pricing-types";

const ORG = "org-a";
const SHOP = "shop-a";
const PRODUCT = "prod-1";
const VARIANT = "var-1";

function price(partial: Partial<PriceRow> & { amount_minor: number }): PriceRow {
  return {
    id: partial.id ?? `price-${partial.type ?? "base"}-${partial.amount_minor}`,
    organization_id: ORG,
    shop_id: SHOP,
    price_set_id: "set-1",
    scope: "variant",
    type: "base",
    currency_code: "EUR",
    starts_at: null,
    ends_at: null,
    min_quantity: null,
    max_quantity: null,
    customer_group_id: null,
    priority: 0,
    status: "active",
    conditions: {},
    updated_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function promo(partial: Partial<PromotionRow> & { id: string; type: PromotionRow["type"] }): PromotionRow {
  return {
    organization_id: ORG,
    shop_id: SHOP,
    name: partial.id,
    code: null,
    value: 0,
    currency_code: null,
    status: "active",
    starts_at: null,
    ends_at: null,
    priority: 0,
    stackable: true,
    conditions: [],
    actions: [],
    ...partial,
  };
}

function snapshot(prices: PriceRow[], promotions: PromotionRow[] = []): PricingSnapshot {
  return {
    organizationId: ORG,
    shopId: SHOP,
    shopCurrency: "EUR",
    prices,
    promotions,
    productCategoryIds: [],
    productCollectionIds: [],
  };
}

const ctx = (over: Partial<Parameters<typeof resolvePricing>[1]> = {}) => ({
  shopId: SHOP,
  productId: PRODUCT,
  variantId: VARIANT,
  quantity: 1,
  currencyCode: "EUR",
  now: "2026-06-01T12:00:00.000Z",
  ...over,
});

describe("Basispreis", () => {
  it("liefert den Normalpreis", () => {
    const r = resolvePricing(snapshot([price({ amount_minor: 2990 })]), ctx());
    expect(r.resolvedUnitAmount).toBe(2990);
    expect(r.total).toBe(2990);
  });
});

describe("Aktionspreis", () => {
  it("Sale schlägt Normalpreis", () => {
    const r = resolvePricing(
      snapshot([price({ amount_minor: 2990 }), price({ type: "sale", amount_minor: 2490 })]),
      ctx(),
    );
    expect(r.total).toBe(2490);
    expect(r.compareAtAmount).toBe(2990);
  });

  it("wirkt nur im Zeitraum", () => {
    const sale = price({
      type: "sale",
      amount_minor: 2490,
      starts_at: "2026-12-01T00:00:00.000Z",
      ends_at: "2026-12-24T23:59:59.000Z",
    });
    const rules = snapshot([price({ amount_minor: 2990 }), sale]);
    expect(resolvePricing(rules, ctx({ now: "2026-11-30T00:00:00.000Z" })).total).toBe(2990);
    expect(resolvePricing(rules, ctx({ now: "2026-12-10T00:00:00.000Z" })).total).toBe(2490);
    expect(resolvePricing(rules, ctx({ now: "2026-12-25T00:00:00.000Z" })).total).toBe(2990);
  });
});

describe("Mengenstaffel", () => {
  const rules = snapshot([
    price({ amount_minor: 2990 }),
    price({ id: "t1", type: "tier", amount_minor: 2690, min_quantity: 5, max_quantity: 9 }),
    price({ id: "t2", type: "tier", amount_minor: 2390, min_quantity: 10 }),
  ]);

  it("1 Stück", () => expect(resolvePricing(rules, ctx({ quantity: 1 })).resolvedUnitAmount).toBe(2990));
  it("5 Stück", () => expect(resolvePricing(rules, ctx({ quantity: 5 })).resolvedUnitAmount).toBe(2690));
  it("10 Stück", () => expect(resolvePricing(rules, ctx({ quantity: 10 })).resolvedUnitAmount).toBe(2390));
  it("Zwischensumme rechnet mit Menge", () =>
    expect(resolvePricing(rules, ctx({ quantity: 5 })).subtotal).toBe(2690 * 5));
});

describe("Kundengruppe", () => {
  const rules = snapshot([
    price({ amount_minor: 2990 }),
    price({ id: "b2b", type: "customer_group", amount_minor: 2290, customer_group_id: "grp-b2b" }),
  ]);

  it("ohne Gruppe Normalpreis", () => expect(resolvePricing(rules, ctx()).total).toBe(2990));
  it("mit Gruppe Gruppenpreis", () =>
    expect(resolvePricing(rules, ctx({ customerGroupId: "grp-b2b" })).total).toBe(2290));
});

describe("Günstigster gültiger Preis statt First-Match", () => {
  it("wählt innerhalb einer Stufe den günstigsten Preis", () => {
    const r = resolvePricing(
      snapshot([
        price({ amount_minor: 2990 }),
        price({ id: "s1", type: "sale", amount_minor: 2790 }),
        price({ id: "s2", type: "sale", amount_minor: 2490 }),
      ]),
      ctx(),
    );
    expect(r.resolvedUnitAmount).toBe(2490);
    expect(r.appliedPriceRules[0]?.priceId).toBe("s2");
  });

  it("ein teurer Kundengruppenpreis verdrängt keinen günstigeren Preis derselben Stufe", () => {
    const r = resolvePricing(
      snapshot([
        price({ amount_minor: 2990 }),
        price({ id: "g-teuer", type: "customer_group", amount_minor: 2890, customer_group_id: "g" }),
        price({ id: "g-guenstig", type: "customer_group", amount_minor: 2290, customer_group_id: "g" }),
      ]),
      ctx({ customerGroupId: "g" }),
    );
    expect(r.resolvedUnitAmount).toBe(2290);
  });
});

describe("Promotions", () => {
  it("Prozent-Rabatt", () => {
    const r = resolvePricing(
      snapshot([price({ amount_minor: 10000 })], [promo({ id: "p", type: "percentage", value: 1000 })]),
      ctx(),
    );
    expect(r.total).toBe(9000);
  });

  it("Fester Rabatt", () => {
    const r = resolvePricing(
      snapshot([price({ amount_minor: 10000 })], [promo({ id: "p", type: "fixed_amount", value: 2000 })]),
      ctx(),
    );
    expect(r.total).toBe(8000);
  });

  it("Code-Promotion greift nur mit Code", () => {
    const snap = snapshot(
      [price({ amount_minor: 10000 })],
      [promo({ id: "p", type: "percentage", value: 1000, code: "SUMMER10" })],
    );
    expect(resolvePricing(snap, ctx()).total).toBe(10000);
    expect(resolvePricing(snap, ctx({ promotionCodes: ["summer10"] })).total).toBe(9000);
  });

  it("nicht kombinierbare Promotions entscheiden deterministisch", () => {
    const snap = snapshot(
      [price({ amount_minor: 10000 })],
      [
        promo({ id: "a", type: "percentage", value: 1000, stackable: false }),
        promo({ id: "b", type: "percentage", value: 2000, stackable: false }),
      ],
    );
    const first = resolvePricing(snap, ctx());
    const second = resolvePricing(snap, ctx());
    expect(first.appliedPromotions).toHaveLength(1);
    expect(first.appliedPromotions[0]?.promotionId).toBe("b");
    expect(first.total).toBe(8000);
    expect(second.total).toBe(first.total);
  });

  it("Gratisversand markiert nur die Berechtigung", () => {
    const r = resolvePricing(
      snapshot(
        [price({ amount_minor: 10000 })],
        [promo({ id: "fs", type: "free_shipping", conditions: [{ kind: "minimum_subtotal", value: 5000 }] })],
      ),
      ctx(),
    );
    expect(r.shippingDiscountEligible).toBe(true);
    expect(r.total).toBe(10000);
  });

  it("Buy X Get Y ist nur vorbereitet, nicht angewendet", () => {
    const r = resolvePricing(
      snapshot([price({ amount_minor: 10000 })], [promo({ id: "bxgy", type: "buy_x_get_y", value: 1 })]),
      ctx(),
    );
    expect(r.appliedPromotions).toHaveLength(0);
    expect(r.pendingPromotions[0]?.pending).toBe("requires_cart");
    expect(r.total).toBe(10000);
  });
});

describe("Cross Tenant", () => {
  it("fremde Promotion und fremder Preis werden ignoriert", () => {
    const snap = snapshot(
      [price({ amount_minor: 2990 }), price({ id: "fremd", organization_id: "org-b", type: "sale", amount_minor: 100 })],
      [promo({ id: "fremd-promo", organization_id: "org-b", type: "percentage", value: 5000 })],
    );
    const r = resolvePricing(snap, ctx());
    expect(r.total).toBe(2990);
    expect(r.appliedPromotions).toHaveLength(0);
  });
});
