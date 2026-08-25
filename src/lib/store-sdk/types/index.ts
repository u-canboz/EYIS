/**
 * Public Store API contract.
 * These types are the ONLY shapes that ever cross the public boundary.
 * They are intentionally free of internal ids, org ids, cost data and
 * internal status values. All money is integer minor units.
 */

export type StoreMoney = {
  amountMinor: number;
  currencyCode: string;
};

export type StoreConfig = {
  shop: { name: string; handle: string; locale: string; currencyCode: string };
  countries: string[];
  taxDisplayMode: "gross" | "net";
  features: {
    search: boolean;
    promotions: boolean;
    guestCheckout: boolean;
    customerAccounts: boolean;
    returns: boolean;
  };
  apiVersion: string;
  environment: "test" | "live";
};

export type StoreAvailability = "in_stock" | "low_stock" | "out_of_stock" | "backorder";

export type StorePrice = {
  currencyCode: string;
  unitAmountMinor: number;
  compareAtAmountMinor: number | null;
  taxIncluded: boolean;
};

export type StoreVariant = {
  id: string;
  title: string;
  sku: string | null;
  options: { key: string; value: string }[];
  price: StorePrice | null;
  availability: StoreAvailability;
  availableQuantity: number | null;
};

export type StoreImage = { url: string; alt: string | null; position: number };

export type StoreProductSummary = {
  id: string;
  handle: string;
  title: string;
  subtitle: string | null;
  image: StoreImage | null;
  price: StorePrice | null;
  availability: StoreAvailability;
};

export type StoreProduct = StoreProductSummary & {
  description: string | null;
  vendor: string | null;
  productType: string | null;
  images: StoreImage[];
  options: { key: string; name: string; values: string[] }[];
  variants: StoreVariant[];
  categories: { id: string; handle: string; name: string }[];
  collections: { id: string; handle: string; name: string }[];
  seo: { title: string | null; description: string | null };
};

export type StoreCategory = {
  id: string;
  handle: string;
  name: string;
  description: string | null;
  parentId: string | null;
  position: number;
};

export type StoreCollection = {
  id: string;
  handle: string;
  name: string;
  description: string | null;
};

export type StorePagination = { page: number; pageSize: number; total: number; hasMore: boolean };
export type StoreList<T> = { data: T[]; pagination: StorePagination };

export type StoreCartItem = {
  id: string;
  productId: string;
  variantId: string;
  title: string;
  variantTitle: string;
  sku: string | null;
  image: string | null;
  quantity: number;
  unitAmountMinor: number;
  lineSubtotalMinor: number;
  lineDiscountMinor: number;
  lineTotalMinor: number;
};

export type StoreTotals = {
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
};

export type StoreCart = {
  id: string;
  currencyCode: string;
  email: string | null;
  items: StoreCartItem[];
  promotionCodes: string[];
  rejectedCodes: { code: string; reason: string }[];
  totals: StoreTotals;
  tax: {
    calculationMode: "gross" | "net";
    netTotalMinor: number;
    taxMinor: number;
    grossTotalMinor: number;
    reverseCharge: boolean;
    breakdown: { rate: number; label: string; netMinor: number; taxMinor: number }[];
    pricesIncludeTax: boolean;
  };
  warnings: string[];
  expiresAt: string;
};

export type StoreCartCreated = { cart: StoreCart; cartToken: string };

export type StoreAddress = {
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

export type StoreShippingOption = {
  id: string;
  name: string;
  description: string | null;
  amountMinor: number;
  currencyCode: string;
};

export type StoreCheckoutStatus =
  "open" | "validated" | "awaiting_payment" | "completed" | "expired" | "cancelled";

export type StoreCheckout = {
  id: string;
  status: StoreCheckoutStatus;
  email: string | null;
  expiresAt: string;
  shippingAddress: StoreAddress | null;
  billingAddress: StoreAddress | null;
  billingSameAsShipping: boolean;
  shippingOption: StoreShippingOption | null;
  totals: StoreTotals;
  currencyCode: string;
  ready: boolean;
  issues: string[];
  cart: StoreCart;
};

export type StorePaymentSession = {
  id: string;
  type: "redirect" | "embedded";
  status: "created" | "pending" | "paid" | "failed" | "cancelled" | "expired";
  redirectUrl: string | null;
  amountMinor: number;
  currencyCode: string;
};

export type StorePaymentStatus = {
  status: StorePaymentSession["status"];
  /** Present exactly once the payment is settled: short-lived, single-use. */
  confirmationToken: string | null;
  confirmationExpiresAt: string | null;
};

export type StoreOrderItem = {
  title: string;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
  lineTotalMinor: number;
};

export type StoreOrderDocument = {
  id: string;
  kind: "invoice" | "credit_note" | "delivery_note";
  number: string | null;
  issuedAt: string | null;
};

export type StoreOrderTracking = {
  carrier: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  events: { code: string; description: string | null; occurredAt: string }[];
};

export type StoreOrder = {
  id: string;
  orderNumber: string;
  placedAt: string;
  currencyCode: string;
  totalMinor: number;
  subtotalMinor: number;
  shippingMinor: number;
  taxMinor: number;
  discountMinor: number;
  paymentStatus: string;
  fulfillmentStatus: string;
  items: StoreOrderItem[];
  addresses: { type: string; address: Record<string, string | null> }[];
  documents: StoreOrderDocument[];
  tracking: StoreOrderTracking[];
  returns: { id: string; returnNumber: string; status: string; requestedAt: string }[];
};

export type StoreOrderSummary = {
  id: string;
  orderNumber: string;
  placedAt: string;
  totalMinor: number;
  currencyCode: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  itemCount: number;
};

export type StoreCustomer = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  kind: "b2c" | "b2b";
};

export type StoreReturnEligibility = {
  eligible: boolean;
  reason: string | null;
  items: { orderItemId: string; title: string; returnableQuantity: number }[];
};

export type StoreReturn = {
  id: string;
  returnNumber: string;
  status: string;
  requestedAt: string;
};

export type StoreGuestAccess = { requested: true };

export type StoreErrorCode =
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "CART_EXPIRED"
  | "CUSTOMER_SESSION_EXPIRED"
  | "OUT_OF_STOCK"
  | "PRICE_CHANGED"
  | "PAYMENT_FAILED"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export const STORE_API_VERSION = "v1";
