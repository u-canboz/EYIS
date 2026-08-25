/** Shared return (RMA) types for the admin workspace and the customer portal. */

export type ReturnStatus =
  | "requested"
  | "authorized"
  | "rejected"
  | "in_transit"
  | "received"
  | "inspection"
  | "approved"
  | "partially_approved"
  | "refunded"
  | "completed"
  | "cancelled";

export type ReturnReasonCode =
  | "wrong_size"
  | "wrong_item"
  | "damaged"
  | "defective"
  | "not_as_expected"
  | "changed_mind"
  | "late_delivery"
  | "other";

export type ReturnItemCondition =
  "new" | "opened" | "used" | "damaged" | "defective" | "missing_parts" | "unknown";

export type RestockDecision = "pending" | "restock" | "do_not_restock" | "manual_review";
export type ReturnResolution = "refund" | "store_credit" | "replacement" | "none";
export type ShippingRefundMode = "none" | "full" | "partial" | "manual";
export type ReturnWindowStart = "order_date" | "shipping_date" | "delivery_date";
export type ReturnApprovalStrategy = "manual" | "automatic_rules";

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: "Angefragt",
  authorized: "Genehmigt",
  rejected: "Abgelehnt",
  in_transit: "Unterwegs",
  received: "Eingegangen",
  inspection: "In Prüfung",
  approved: "Freigegeben",
  partially_approved: "Teilweise freigegeben",
  refunded: "Erstattet",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
};

export const RETURN_REASON_LABELS: Record<ReturnReasonCode, string> = {
  wrong_size: "Falsche Größe",
  wrong_item: "Falscher Artikel",
  damaged: "Transportschaden",
  defective: "Defekt",
  not_as_expected: "Entspricht nicht der Beschreibung",
  changed_mind: "Gefällt nicht mehr",
  late_delivery: "Zu spät geliefert",
  other: "Sonstiges",
};

export const CONDITION_LABELS: Record<ReturnItemCondition, string> = {
  new: "Neuwertig",
  opened: "Geöffnet",
  used: "Gebraucht",
  damaged: "Beschädigt",
  defective: "Defekt",
  missing_parts: "Teile fehlen",
  unknown: "Nicht geprüft",
};

export const RESTOCK_LABELS: Record<RestockDecision, string> = {
  pending: "Offen",
  restock: "Wieder einlagern",
  do_not_restock: "Nicht einlagern",
  manual_review: "Manuelle Prüfung",
};

export type ReturnSettings = {
  shopId: string;
  returnsEnabled: boolean;
  defaultReturnWindowDays: number;
  windowStart: ReturnWindowStart;
  approvalStrategy: ReturnApprovalStrategy;
  customerPaysReturnShipping: boolean;
  autoRefundOnApproval: boolean;
  autoRestock: boolean;
  instructions: string | null;
};

export type EligibilityLine = {
  orderItemId: string;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
  alreadyReturned: number;
  returnableQuantity: number;
  unitGrossMinor: number;
  lineGrossMinor: number;
  blockedReason: string | null;
};

export type ReturnEligibility = {
  orderId: string;
  orderNumber: string;
  currencyCode: string;
  eligible: boolean;
  reason: string | null;
  windowEndsAt: string | null;
  lines: EligibilityLine[];
};

export type ReturnItemView = {
  id: string;
  orderItemId: string;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  quantityOrdered: number;
  quantityRequested: number;
  quantityReceived: number;
  quantityApproved: number;
  reasonCode: ReturnReasonCode;
  condition: ReturnItemCondition;
  resolution: ReturnResolution;
  restockDecision: RestockDecision;
  restockedAt: string | null;
  restockLocationId: string | null;
  refundAmountMinor: number | null;
  inspectionNote: string | null;
};

export type ReturnListItem = {
  id: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string;
  customerId: string | null;
  customerEmail: string | null;
  status: ReturnStatus;
  reasonCategory: ReturnReasonCode;
  itemCount: number;
  refundTotalMinor: number;
  currencyCode: string;
  requestedAt: string;
};

export type ReturnDetail = ReturnListItem & {
  shopId: string;
  customerNote: string | null;
  internalNote: string | null;
  rejectionReason: string | null;
  shippingRefundMode: ShippingRefundMode;
  shippingRefundMinor: number;
  authorizedAt: string | null;
  receivedAt: string | null;
  inspectedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  refundId: string | null;
  creditNoteId: string | null;
  items: ReturnItemView[];
  timeline: { id: string; action: string; createdAt: string }[];
};

export type NextReturnAction = {
  key: string;
  label: string;
  permission: string | null;
} | null;

/** Single source of truth for "what should the agent do next". */
export function nextReturnAction(status: ReturnStatus): NextReturnAction {
  switch (status) {
    case "requested":
      return { key: "authorize", label: "Retoure genehmigen", permission: "returns.approve" };
    case "authorized":
      return { key: "in_transit", label: "Als unterwegs markieren", permission: "returns.manage" };
    case "in_transit":
      return { key: "receive", label: "Wareneingang buchen", permission: "returns.inspect" };
    case "received":
      return { key: "inspect", label: "Prüfung starten", permission: "returns.inspect" };
    case "inspection":
      return { key: "decide", label: "Prüfergebnis erfassen", permission: "returns.inspect" };
    case "approved":
    case "partially_approved":
      return { key: "settle", label: "Erstattung auslösen", permission: "payments.refund" };
    case "refunded":
      return { key: "complete", label: "Retoure abschließen", permission: "returns.manage" };
    default:
      return null;
  }
}
