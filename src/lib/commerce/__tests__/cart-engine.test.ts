import { describe, expect, it } from "vitest";
import { calculateCart } from "../cart-engine";
import type { CartEngineInput, CartEngineLine } from "../cart-types";
import type { PromotionRow } from "../pricing-types";

const ORG = "org-1";
const SHOP = "shop-1";
const NOW = "2026-03-01T10:00:00.000Z";

function line(overrides: Partial<CartEngineLine> & { id: string }): CartEngineLine {
  return {
    productId: "p-1",
    variantId: `v-${overrides.id}`,
    quantity: 1,
    unitBaseMinor: 1000,
    unitResolvedMinor: 1000,
    appliedPriceRules: [],
    categoryIds: [],
    collectionIds: [],
    ...overrides,
  };
}

function promo(
  overrides: Partial<PromotionRow> & { id: string; type: PromotionRow["type"] },
): PromotionRow {
  return {
    organization_id: ORG,
    shop_id: SHOP,
    name: overrides.id,
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
    ...overrides,
  } as PromotionRow;
}

function input(overrides: Partial<CartEngineInput> = {}): CartEngineInput {
  return {
    organizationId: ORG,
    shopId: SHOP,
    currencyCode: "EUR",
    customerGroupId: null,
    promotionCodes: [],
    lines: [line({ id: "a" })],
    shipping: null,
    promotions: [],
    taxMinor: 0,
    now: NOW,
    ...overrides,
  };
}

describe("cart engine", () => {
  it("sums line subtotals without promotions", () => {
    const r = calculateCart(
      input({
        lines: [line({ id: "a", quantity: 2 }), line({ id: "b", unitResolvedMinor: 2500 })],
      }),
    );
    expect(r.totals.subtotalMinor).toBe(4500);
    expect(r.totals.discountMinor).toBe(0);
    expect(r.totals.totalMinor).toBe(4500);
  });

  it("keeps tax at zero in phase 4", () => {
    const r = calculateCart(input());
    expect(r.totals.taxMinor).toBe(0);
  });

  it("applies a percentage promotion across all lines", () => {
    const r = calculateCart(
      input({
        lines: [line({ id: "a" }), line({ id: "b", unitResolvedMinor: 3000 })],
        promotions: [promo({ id: "p10", type: "percentage", value: 1000 })],
      }),
    );
    expect(r.totals.discountMinor).toBe(400);
    expect(r.lines.reduce((s, l) => s + l.lineDiscountMinor, 0)).toBe(400);
  });

  it("requires a code for coded promotions", () => {
    const promos = [promo({ id: "p", type: "percentage", value: 2000, code: "SAVE20" })];
    const without = calculateCart(input({ promotions: promos }));
    expect(without.totals.discountMinor).toBe(0);
    const withCode = calculateCart(input({ promotions: promos, promotionCodes: ["save20"] }));
    expect(withCode.totals.discountMinor).toBe(200);
  });

  it("reports unknown codes as rejected", () => {
    const r = calculateCart(input({ promotionCodes: ["NOPE"] }));
    expect(r.rejectedCodes[0]?.code).toBe("NOPE");
  });

  it("distributes discounts so the line sum equals the cart discount", () => {
    const r = calculateCart(
      input({
        lines: [
          line({ id: "a", unitResolvedMinor: 333 }),
          line({ id: "b", unitResolvedMinor: 334 }),
          line({ id: "c", unitResolvedMinor: 333 }),
        ],
        promotions: [promo({ id: "p", type: "fixed_amount", value: 100 })],
      }),
    );
    expect(r.totals.discountMinor).toBe(100);
    expect(r.lines.reduce((s, l) => s + l.lineDiscountMinor, 0)).toBe(100);
  });

  it("assigns rounding remainders deterministically, not by input order", () => {
    const lines = [
      line({ id: "a", unitResolvedMinor: 333 }),
      line({ id: "b", unitResolvedMinor: 334 }),
      line({ id: "c", unitResolvedMinor: 333 }),
    ];
    const promos = [promo({ id: "p", type: "fixed_amount", value: 100 })];
    const first = calculateCart(input({ lines, promotions: promos }));
    const shuffled = calculateCart(
      input({ lines: [lines[2]!, lines[0]!, lines[1]!], promotions: promos }),
    );
    const asMap = (r: ReturnType<typeof calculateCart>) =>
      Object.fromEntries(r.lines.map((l) => [l.lineId, l.lineDiscountMinor]));
    expect(asMap(first)).toEqual(asMap(shuffled));
  });

  it("scopes a promotion to matching lines only", () => {
    const r = calculateCart(
      input({
        lines: [line({ id: "a", productId: "p-1" }), line({ id: "b", productId: "p-2" })],
        promotions: [
          promo({
            id: "p",
            type: "percentage",
            value: 5000,
            conditions: [{ kind: "product", ids: ["p-1"] }] as never,
          }),
        ],
      }),
    );
    expect(r.totals.discountMinor).toBe(500);
    const byLine = Object.fromEntries(r.lines.map((l) => [l.lineId, l.lineDiscountMinor]));
    expect(byLine["a"]).toBe(500);
    expect(byLine["b"]).toBe(0);
  });

  it("rejects a promotion whose minimum subtotal is not reached", () => {
    const r = calculateCart(
      input({
        promotions: [
          promo({
            id: "p",
            type: "fixed_amount",
            value: 500,
            code: "MIN",
            conditions: [{ kind: "minimum_subtotal", value: 5000 }] as never,
          }),
        ],
        promotionCodes: ["MIN"],
      }),
    );
    expect(r.totals.discountMinor).toBe(0);
    expect(r.rejectedCodes[0]?.reason).toContain("Bedingungen");
  });

  it("never discounts below zero", () => {
    const r = calculateCart(
      input({ promotions: [promo({ id: "p", type: "fixed_amount", value: 999999 })] }),
    );
    expect(r.totals.totalMinor).toBe(0);
    expect(r.totals.discountMinor).toBe(1000);
  });

  it("stops after a non-stackable promotion", () => {
    const r = calculateCart(
      input({
        promotions: [
          promo({ id: "p1", type: "percentage", value: 1000, priority: 10, stackable: false }),
          promo({ id: "p2", type: "percentage", value: 1000, priority: 5 }),
        ],
      }),
    );
    expect(r.appliedPromotions).toHaveLength(1);
    expect(r.totals.discountMinor).toBe(100);
  });

  it("stacks stackable promotions on the running amount", () => {
    const r = calculateCart(
      input({
        promotions: [
          promo({ id: "p1", type: "percentage", value: 1000, priority: 10 }),
          promo({ id: "p2", type: "percentage", value: 1000, priority: 5 }),
        ],
      }),
    );
    expect(r.totals.discountMinor).toBe(100 + 90);
  });

  it("applies shipping and honours the free-above threshold", () => {
    const paid = calculateCart(
      input({ shipping: { methodId: "m", amountMinor: 490, freeAboveMinor: 5000 } }),
    );
    expect(paid.totals.shippingMinor).toBe(490);
    expect(paid.totals.totalMinor).toBe(1490);

    const free = calculateCart(
      input({
        lines: [line({ id: "a", unitResolvedMinor: 6000 })],
        shipping: { methodId: "m", amountMinor: 490, freeAboveMinor: 5000 },
      }),
    );
    expect(free.totals.shippingMinor).toBe(0);
  });

  it("free_shipping promotion removes shipping cost", () => {
    const r = calculateCart(
      input({
        shipping: { methodId: "m", amountMinor: 490, freeAboveMinor: null },
        promotions: [promo({ id: "fs", type: "free_shipping" })],
      }),
    );
    expect(r.freeShipping).toBe(true);
    expect(r.totals.shippingMinor).toBe(0);
  });

  it("buy x get y discounts the cheapest qualifying units", () => {
    const r = calculateCart(
      input({
        lines: [
          line({ id: "a", unitResolvedMinor: 1000, quantity: 2 }),
          line({ id: "b", unitResolvedMinor: 500, quantity: 1 }),
        ],
        promotions: [
          promo({
            id: "bxgy",
            type: "buy_x_get_y",
            actions: [{ kind: "buy_x_get_y", buy: 2, get: 1 }] as never,
          }),
        ],
      }),
    );
    // 3 units → one free group → the cheapest unit (500) is free.
    expect(r.totals.discountMinor).toBe(500);
    expect(r.appliedPromotions[0]?.note).toContain("Buy X Get Y");
  });

  it("marks per-customer usage limits as pending", () => {
    const r = calculateCart(
      input({
        promotions: [promo({ id: "p", type: "percentage", value: 1000, usageLimitPerCustomer: 1 })],
      }),
    );
    expect(r.pendingPromotions[0]?.pending).toBe("requires_orders");
  });

  it("ignores promotions from another organization or shop", () => {
    const r = calculateCart(
      input({
        promotions: [
          promo({ id: "x", type: "percentage", value: 5000, organization_id: "other" }),
          promo({ id: "y", type: "percentage", value: 5000, shop_id: "other-shop" }),
        ],
      }),
    );
    expect(r.totals.discountMinor).toBe(0);
  });

  it("ignores expired promotions and other currencies", () => {
    const r = calculateCart(
      input({
        promotions: [
          promo({
            id: "old",
            type: "percentage",
            value: 5000,
            ends_at: "2026-01-01T00:00:00.000Z",
          }),
          promo({ id: "usd", type: "percentage", value: 5000, currency_code: "USD" }),
        ],
      }),
    );
    expect(r.totals.discountMinor).toBe(0);
  });

  it("is deterministic for identical input", () => {
    const args = input({
      lines: [
        line({ id: "a", unitResolvedMinor: 1234, quantity: 3 }),
        line({ id: "b", unitResolvedMinor: 999 }),
      ],
      promotions: [
        promo({ id: "p1", type: "percentage", value: 1500, priority: 3 }),
        promo({ id: "p2", type: "fixed_amount", value: 250, priority: 3 }),
      ],
      shipping: { methodId: "m", amountMinor: 495, freeAboveMinor: null },
    });
    expect(JSON.stringify(calculateCart(args))).toBe(JSON.stringify(calculateCart(args)));
  });

  it("records the pricing engine version on every calculation", () => {
    expect(calculateCart(input()).pricingEngineVersion).toMatch(/^\d{4}\./);
  });
});
