import type { TrackingStatusCode } from "../shipping/provider";

export type TrackingEventView = {
  id: string;
  shipmentId: string;
  carrierProvider: string;
  eventCode: string;
  normalizedStatus: TrackingStatusCode;
  description: string | null;
  location: string | null;
  occurredAt: string;
};

/** Safe projection for a future customer-facing tracking page. */
export type OrderTrackingView = {
  orderNumber: string;
  shipments: {
    carrierProvider: string;
    trackingNumber: string | null;
    trackingUrl: string | null;
    status: TrackingStatusCode;
    shippedAt: string | null;
    deliveredAt: string | null;
    events: { status: TrackingStatusCode; description: string | null; occurredAt: string }[];
  }[];
};
