/**
 * Shared, client-safe types for the pricing engine.
 * Contains no pricing logic — the single engine lives in pricing-engine.ts.
 */

export type PriceType = "base" | "sale" | "tier" | "customer_group" | "override";

export type PromotionType =
  | "percentage"
  | "fixed_amount"
  | "fixed_price"
  | "buy_x_get_y"
  | "free_shipping";

export type PriceScope = "product" | "variant";

export type PriceRow = {
  id: string;
  organization_id: string;
  shop_id: string;
  price_set_id: string;
  scope: PriceScope;
  type: PriceType;
  currency_code: string;
  amount_minor: number;
  starts_at: string | null;
  ends_at: string | null;
  min_quantity: number | null;
  max_quantity: number | null;
  customer_group_id: string | null;
  priority: number;
  status: string;
  conditions: Record<string, unknown>;
  updated_at: string;
};

export type PromotionRow = {
  id: string;
  organization_id: string;
  shop_id: string;
  name: string;
  code: string | null;
  type: PromotionType;
  value: number;
  currency_code: string | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  priority: number;
  stackable: boolean;
  conditions: PromotionCondition[];
  actions: PromotionAction[];
};

export type PromotionCondition =
  | { kind: "product"; ids: string[] }
  | { kind: "variant"; ids: string[] }
  | { kind: "category"; ids: string[] }
  | { kind: "collection"; ids: string[] }
  | { kind: "minimum_quantity"; value: number }
  | { kind: "minimum_subtotal"; value: number }
  | { kind: "customer_group"; ids: string[] }
  | { kind: "date_range"; from?: string | null; to?: string | null }
  | { kind: string; [key: string]: unknown };

export type PromotionAction =
  | { kind: "percentage_discount"; value: number }
  | { kind: "fixed_discount"; value: number }
  | { kind: "set_price"; value: number }
  | { kind: "free_item"; productId?: string; variantId?: string; quantity?: number }
  | { kind: "free_shipping" }
  | { kind: string; [key: string]: unknown };

/** Everything the engine needs, loaded once per resolution. Cross-tenant safe. */
export type PricingSnapshot = {
  organizationId: string;
  shopId: string;
  shopCurrency: string;
  prices: PriceRow[];
  promotions: PromotionRow[];
  productCategoryIds: string[];
  productCollectionIds: string[];
};

export type PricingContext = {
  shopId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  currencyCode: string;
  customerGroupId?: string | null;
  promotionCodes?: string[];
  now: string;
};

export type PriceRuleStage =
  | "variant_override"
  | "customer_group"
  | "quantity_tier"
  | "sale"
  | "base";

export type AppliedPriceRule = {
  priceId: string;
  stage: PriceRuleStage;
  type: PriceType;
  scope: PriceScope;
  amountMinor: number;
  label: string;
};

export type AppliedPromotion = {
  promotionId: string;
  name: string;
  code: string | null;
  type: PromotionType;
  stackable: boolean;
  priority: number;
  discountMinor: number;
  /** Modelled but not yet enforceable (needs cart / customer / orders). */
  pending?: "requires_cart" | "requires_orders";
  note?: string;
};

export type ExplanationStep = {
  label: string;
  amountMinor: number;
  /** Negative for discounts. */
  deltaMinor?: number;
  source: string;
};

export type PricingResult = {
  currencyCode: string;
  quantity: number;
  baseAmount: number;
  resolvedUnitAmount: number;
  subtotal: number;
  discounts: number;
  total: number;
  compareAtAmount?: number;
  appliedPriceRules: AppliedPriceRule[];
  rejectedPriceRules: { priceId: string; reason: string }[];
  appliedPromotions: AppliedPromotion[];
  pendingPromotions: AppliedPromotion[];
  shippingDiscountEligible: boolean;
  explanation: ExplanationStep[];
};

/** Wire-safe shapes for conditions/actions crossing the server-function boundary. */
export type SerializableCondition = {
  kind: string;
  ids?: string[];
  value?: number;
  from?: string | null;
  to?: string | null;
};

export type SerializableAction = {
  kind: string;
  value?: number;
  productId?: string;
  variantId?: string;
  quantity?: number;
};
