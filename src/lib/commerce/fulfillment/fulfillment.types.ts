/** Client-safe view types for the fulfillment workspace. */
import type { TrackingStatusCode } from "../shipping/provider";

export type FulfillmentState = "draft" | "ready" | "picking" | "packed" | "shipped" | "delivered" | "cancelled";
export type PackageStatus = "draft" | "packed" | "shipped" | "delivered" | "cancelled";
export type ShipmentStatus =
  | "created"
  | "label_created"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception"
  | "cancelled";

export const FULFILLMENT_STATE_LABELS: Record<FulfillmentState, string> = {
  draft: "Entwurf",
  ready: "Neu",
  picking: "In Kommissionierung",
  packed: "Verpackt",
  shipped: "Versendet",
  delivered: "Zugestellt",
  cancelled: "Storniert",
};

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  created: "Angelegt",
  label_created: "Label erstellt",
  in_transit: "Unterwegs",
  out_for_delivery: "In Zustellung",
  delivered: "Zugestellt",
  exception: "Problem",
  cancelled: "Storniert",
};

export const TRACKING_STATUS_LABELS: Record<TrackingStatusCode, string> = {
  pre_transit: "Sendungsdaten übermittelt",
  in_transit: "Unterwegs",
  out_for_delivery: "In Zustellung",
  delivered: "Zugestellt",
  exception: "Problem",
  returned: "Rücksendung",
  cancelled: "Storniert",
  unknown: "Unbekannt",
};

export type FulfillmentItemView = {
  id: string;
  orderItemId: string;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
  pickedQuantity: number;
  packedQuantity: number;
  shippedQuantity: number;
};

export type ShipmentView = {
  id: string;
  fulfillmentId: string;
  packageId: string | null;
  carrierProvider: string;
  carrierService: string | null;
  providerShipmentId: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: ShipmentStatus;
  normalizedTrackingStatus: TrackingStatusCode;
  shippedAt: string | null;
  deliveredAt: string | null;
  labelId: string | null;
  labelPath: string | null;
  carrierCostMinor: number | null;
  currencyCode: string | null;
  lastError: { code: string; message: string } | null;
};

export type PackageItemView = {
  id: string;
  fulfillmentItemId: string;
  title: string;
  quantity: number;
};

export type PackageView = {
  id: string;
  packageNumber: number;
  status: PackageStatus;
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  packagingType: string | null;
  items: PackageItemView[];
  shipment: ShipmentView | null;
};

export type FulfillmentView = {
  id: string;
  orderId: string;
  orderNumber: string;
  shopId: string;
  locationId: string | null;
  locationName: string | null;
  status: FulfillmentState;
  notes: string | null;
  createdAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  items: FulfillmentItemView[];
  packages: PackageView[];
};

export type FulfillmentQueueItem = {
  id: string;
  orderId: string;
  orderNumber: string;
  status: FulfillmentState;
  locationName: string | null;
  createdAt: string;
  totalQuantity: number;
  pickedQuantity: number;
  packedQuantity: number;
  shippedQuantity: number;
  packageCount: number;
  carrierProvider: string | null;
  trackingNumber: string | null;
  hasException: boolean;
  shippingMethodName: string | null;
};

export type AllocationOption = {
  locationId: string;
  locationName: string;
  available: number;
  priority: number;
};

export type AllocationLine = {
  orderItemId: string;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  orderedQuantity: number;
  alreadyPlanned: number;
  openQuantity: number;
  suggestedLocationId: string | null;
  options: AllocationOption[];
};

export type AllocationSuggestion = {
  orderId: string;
  orderNumber: string;
  shopId: string;
  trackedByInventory: boolean;
  lines: AllocationLine[];
};

export type NextAction = {
  action:
    | "create_fulfillment"
    | "start_picking"
    | "complete_picking"
    | "pack"
    | "create_label"
    | "mark_shipped"
    | "await_delivery"
    | "done";
  label: string;
  fulfillmentId: string | null;
};
