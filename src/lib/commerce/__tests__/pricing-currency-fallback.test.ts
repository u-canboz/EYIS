/**
 * Regression Phase 25: Ohne ausdrückliche Währung im Kontext muss die
 * Preisauflösung die Shop-Währung verwenden. Ohne diesen Fallback lieferte die
 * öffentliche Katalog-Abfrage `price: null`, obwohl ein Preis gesetzt war.
 */
import { describe, expect, it } from "vitest";

import { resolvePricing } from "../pricing-engine";
import type { PriceRow, PricingSnapshot } from "../pricing-types";

const ORG = "org-a";
const SHOP = "shop-a";

function snapshot(): PricingSnapshot {
  const row: PriceRow = {
    id: "price-base",
    organization_id: ORG,
    shop_id: SHOP,
    price_set_id: "set-1",
    scope: "variant",
    type: "base",
    currency_code: "EUR",
    amount_minor: 2490,
    starts_at: null,
    ends_at: null,
    min_quantity: null,
    max_quantity: null,
    customer_group_id: null,
    priority: 0,
    status: "active",
    conditions: {},
    updated_at: "2026-01-01T00:00:00.000Z",
  } as PriceRow;
  return {
    organizationId: ORG,
    shopId: SHOP,
    shopCurrency: "EUR",
    prices: [row],
    promotions: [],
    productCategoryIds: [],
    productCollectionIds: [],
  };
}

describe("Preisauflösung ohne Währungsangabe", () => {
  it("löst mit der Shop-Währung auf", () => {
    const result = resolvePricing(snapshot(), {
      shopId: SHOP,
      productId: "prod-1",
      variantId: "var-1",
      quantity: 1,
      currencyCode: "EUR",
      customerGroupId: null,
      promotionCodes: [],
    } as never);
    expect(result.resolvedUnitAmount).toBe(2490);
    expect(result.currencyCode).toBe("EUR");
  });

  it("liefert ohne passende Währung keinen Preis", () => {
    const result = resolvePricing(snapshot(), {
      shopId: SHOP,
      productId: "prod-1",
      variantId: "var-1",
      quantity: 1,
      currencyCode: "CHF",
      customerGroupId: null,
      promotionCodes: [],
    } as never);
    expect(result.resolvedUnitAmount).toBe(0);
  });
});
