/**
 * Client-safe cart & checkout types. No logic — the cart engine lives in
 * cart-engine.ts and runs server-side only.
 * All money is integer minor units.
 */
import type { AppliedPriceRule, AppliedPromotion, PromotionType } from "./pricing-types";

export const PRICING_ENGINE_VERSION = "2026.1.0";

export type CartStatus = "active" | "checkout" | "completed" | "abandoned" | "expired";

export type CheckoutSessionStatus =
  "open" | "validated" | "awaiting_payment" | "completed" | "expired" | "cancelled";

export type ShippingPricingType = "fixed" | "free";

export type ShippingMethodView = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  pricingType: ShippingPricingType;
  amountMinor: number;
  currencyCode: string;
  countries: string[];
  minSubtotalMinor: number | null;
  maxSubtotalMinor: number | null;
  freeAboveMinor: number | null;
  position: number;
  status: string;
};

/** One cart line as the engine sees it — already resolved at line level. */
export type CartEngineLine = {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  /** Unit price before promotions, from the single pricing engine. */
  unitBaseMinor: number;
  unitResolvedMinor: number;
  appliedPriceRules: AppliedPriceRule[];
  categoryIds: string[];
  collectionIds: string[];
};

export type CartEngineInput = {
  organizationId: string;
  shopId: string;
  currencyCode: string;
  customerGroupId: string | null;
  promotionCodes: string[];
  lines: CartEngineLine[];
  /** Selected shipping option, null before the customer picks one. */
  shipping: {
    methodId: string;
    amountMinor: number;
    freeAboveMinor: number | null;
  } | null;
  promotions: import("./pricing-types").PromotionRow[];
  taxMinor: number;
  /** True when line prices already contain tax (gross shops) — tax is not added on top. */
  taxIncluded?: boolean;
  now: string;
};

export type CartLineResult = {
  lineId: string;
  variantId: string;
  quantity: number;
  unitBaseMinor: number;
  unitResolvedMinor: number;
  lineSubtotalMinor: number;
  lineDiscountMinor: number;
  lineTotalMinor: number;
  appliedPriceRules: AppliedPriceRule[];
  appliedPromotions: AppliedPromotion[];
};

export type CartTotals = {
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
};

export type CartCalculation = {
  currencyCode: string;
  pricingEngineVersion: string;
  totals: CartTotals;
  lines: CartLineResult[];
  appliedPromotions: AppliedPromotion[];
  pendingPromotions: AppliedPromotion[];
  rejectedCodes: { code: string; reason: string }[];
  freeShipping: boolean;
};

export type CartItemView = {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  title: string;
  variantTitle: string;
  sku: string | null;
  image: string | null;
  unitResolvedMinor: number;
  lineSubtotalMinor: number;
  lineDiscountMinor: number;
  lineTotalMinor: number;
};

export type CartView = {
  id: string;
  status: CartStatus;
  currencyCode: string;
  email: string | null;
  locale: string;
  regionCode: string | null;
  expiresAt: string;
  items: CartItemView[];
  promotionCodes: string[];
  totals: CartTotals;
  appliedPromotions: AppliedPromotion[];
  pendingPromotions: AppliedPromotion[];
  rejectedCodes: { code: string; reason: string }[];
  freeShipping: boolean;
  snapshotVersion: number;
  pricingEngineVersion: string;
  warnings: string[];
  /** Tax breakdown of the current calculation (phase 6). */
  tax: {
    engineVersion: string;
    calculationMode: "gross" | "net";
    netTotalMinor: number;
    taxMinor: number;
    grossTotalMinor: number;
    reverseCharge: boolean;
    breakdown: import("./tax/tax.types").TaxBreakdownEntry[];
    notes: string[];
  };
};

export type AddressInput = {
  firstName: string;
  lastName: string;
  company?: string | null;
  street: string;
  street2?: string | null;
  postalCode: string;
  city: string;
  state?: string | null;
  countryCode: string;
  phone?: string | null;
};

export type CheckoutView = {
  id: string;
  status: CheckoutSessionStatus;
  cartId: string;
  email: string | null;
  expiresAt: string;
  shippingAddress: (AddressInput & { id: string }) | null;
  billingAddress: (AddressInput & { id: string }) | null;
  billingSameAsShipping: boolean;
  shippingMethod: ShippingMethodView | null;
  totals: CartTotals;
  currencyCode: string;
  ready: boolean;
  issues: string[];
  cart: CartView;
};

export type PromotionSummary = {
  id: string;
  name: string;
  code: string | null;
  type: PromotionType;
  discountMinor: number;
};
