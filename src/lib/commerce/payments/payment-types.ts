/** Client-safe payment & order types. All money is integer minor units. */

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type PaymentProviderId = "stripe" | "mock";
export type CommerceEnvironment = "test" | "live";

export type PaymentSessionStatus =
  "created" | "pending" | "paid" | "failed" | "cancelled" | "expired";

export type OrderState = "pending" | "confirmed" | "processing" | "completed" | "cancelled";
export type OrderPaymentStatus =
  "unpaid" | "authorized" | "paid" | "partially_refunded" | "refunded" | "failed";
export type OrderFulfillmentStatus =
  "unfulfilled" | "partially_fulfilled" | "fulfilled" | "returned";
export type RefundStatus = "requested" | "processing" | "completed" | "failed" | "cancelled";

export type PaymentSessionView = {
  id: string;
  provider: string;
  environment: CommerceEnvironment;
  status: PaymentSessionStatus;
  amountMinor: number;
  currencyCode: string;
  redirectUrl: string | null;
  lastError: string | null;
};

export type PaymentStatusView = {
  paymentSessionId: string;
  status: PaymentSessionStatus;
  amountMinor: number;
  currencyCode: string;
  order: {
    id: string;
    orderNumber: string;
    totalMinor: number;
    currencyCode: string;
    email: string | null;
  } | null;
};

export type OrderListItem = {
  id: string;
  orderNumber: string;
  placedAt: string;
  email: string | null;
  currencyCode: string;
  totalMinor: number;
  refundedMinor: number;
  orderStatus: OrderState;
  paymentStatus: OrderPaymentStatus;
  fulfillmentStatus: OrderFulfillmentStatus;
  environment: CommerceEnvironment;
};

export type OrderItemView = {
  id: string;
  title: string;
  variantTitle: string;
  sku: string | null;
  quantity: number;
  unitResolvedMinor: number;
  lineDiscountMinor: number;
  lineTotalMinor: number;
};

export type OrderAddressView = Record<string, JsonValue> & { type: "shipping" | "billing" };

export type OrderTransactionView = {
  id: string;
  type: string;
  provider: string;
  amountMinor: number;
  currencyCode: string;
  providerTransactionId: string | null;
  createdAt: string;
};

export type OrderRefundView = {
  id: string;
  amountMinor: number;
  currencyCode: string;
  status: RefundStatus;
  reason: string | null;
  createdAt: string;
  providerRefundId: string | null;
};

export type OrderTimelineEntry = {
  id: string;
  action: string;
  createdAt: string;
  metadata: Record<string, JsonValue>;
};

export type OrderDetailView = OrderListItem & {
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  netTotalMinor: number;
  taxBreakdown: JsonValue[];
  internalNote: string | null;
  cancelReason: string | null;
  shippingMethod: Record<string, JsonValue>;
  items: OrderItemView[];
  addresses: OrderAddressView[];
  promotions: { id: string; name: string; code: string | null; discountMinor: number }[];
  transactions: OrderTransactionView[];
  refunds: OrderRefundView[];
  timeline: OrderTimelineEntry[];
  refundableMinor: number;
};

export type ProviderConfigView = {
  id: string;
  provider: string;
  displayName: string;
  environment: CommerceEnvironment;
  status: "active" | "inactive" | "archived";
  priority: number;
  secretRef: string | null;
};

export const ORDER_STATUS_LABELS: Record<OrderState, string> = {
  pending: "Offen",
  confirmed: "Bestätigt",
  processing: "In Bearbeitung",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
};

export const PAYMENT_STATUS_LABELS: Record<OrderPaymentStatus, string> = {
  unpaid: "Nicht bezahlt",
  authorized: "Autorisiert",
  paid: "Bezahlt",
  partially_refunded: "Teilweise erstattet",
  refunded: "Erstattet",
  failed: "Fehlgeschlagen",
};

export const FULFILLMENT_STATUS_LABELS: Record<OrderFulfillmentStatus, string> = {
  unfulfilled: "Nicht versendet",
  partially_fulfilled: "Teilweise versendet",
  fulfilled: "Versendet",
  returned: "Retourniert",
};

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  requested: "Angefragt",
  processing: "In Bearbeitung",
  completed: "Abgeschlossen",
  failed: "Fehlgeschlagen",
  cancelled: "Abgebrochen",
};
