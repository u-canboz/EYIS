/**
 * Carrier contract. The fulfillment core never knows a carrier name: every
 * operational action goes through this interface, so DHL, DPD, GLS, UPS or
 * Sendcloud can be added later without touching fulfillment or orders.
 */

export type TrackingStatusCode =
  | "pre_transit"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception"
  | "returned"
  | "cancelled"
  | "unknown";

export type ShippingExceptionCode =
  | "provider_unavailable"
  | "invalid_address"
  | "invalid_dimensions"
  | "label_generation_failed"
  | "tracking_unknown"
  | "not_supported";

/** Provider failures are typed so the UI can explain them without guessing. */
export class CarrierError extends Error {
  readonly code: ShippingExceptionCode;
  readonly retryable: boolean;
  constructor(code: ShippingExceptionCode, message: string, retryable = true) {
    super(message);
    this.name = "CarrierError";
    this.code = code;
    this.retryable = retryable;
  }
}

export const EXCEPTION_LABELS: Record<ShippingExceptionCode, string> = {
  provider_unavailable: "Versanddienstleister nicht erreichbar",
  invalid_address: "Lieferadresse unvollständig oder ungültig",
  invalid_dimensions: "Gewicht oder Maße unzulässig",
  label_generation_failed: "Label konnte nicht erzeugt werden",
  tracking_unknown: "Keine Tracking-Daten verfügbar",
  not_supported: "Vom Versanddienstleister nicht unterstützt",
};

export type CarrierCapabilities = {
  supportsRates: boolean;
  supportsLabels: boolean;
  supportsCancellation: boolean;
  supportsTracking: boolean;
  supportsTrackingWebhook: boolean;
  supportsMultiPackage: boolean;
};

export type CarrierAddress = {
  name: string;
  company?: string | null;
  line1: string;
  line2?: string | null;
  postalCode: string;
  city: string;
  countryCode: string;
  email?: string | null;
  phone?: string | null;
};

export type CarrierParcel = {
  packageId: string;
  packageNumber: number;
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  packagingType: string | null;
};

export type CarrierRate = {
  service: string;
  serviceName: string;
  amountMinor: number;
  currencyCode: string;
  estimatedDays: number | null;
};

export type CreateCarrierShipmentInput = {
  shipmentId: string;
  service: string | null;
  reference: string;
  address: CarrierAddress;
  parcel: CarrierParcel;
  testMode: boolean;
  idempotencyKey: string;
  /** Test-provider only: forces a deterministic outcome. */
  scenario?: string | null;
};

export type CreateCarrierShipmentResult = {
  providerShipmentId: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  costMinor: number | null;
  currencyCode: string | null;
  raw: Record<string, unknown>;
};

export type CarrierLabel = {
  format: "pdf" | "png" | "zpl";
  mimeType: string;
  /** Base64-encoded label document. Never persisted in a table. */
  contentBase64: string;
};

export type NormalizedTrackingEvent = {
  providerEventId: string | null;
  code: string;
  status: TrackingStatusCode;
  description: string | null;
  location: string | null;
  occurredAt: string;
  raw: Record<string, unknown>;
};

export type CarrierTrackingSnapshot = {
  status: TrackingStatusCode;
  events: NormalizedTrackingEvent[];
};

export type CarrierWebhookResult = {
  providerShipmentId: string | null;
  trackingNumber: string | null;
  events: NormalizedTrackingEvent[];
};

export interface CarrierProvider {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities: CarrierCapabilities;
  getRates?(input: {
    address: CarrierAddress;
    parcel: CarrierParcel;
    testMode: boolean;
  }): Promise<CarrierRate[]>;
  createShipment(input: CreateCarrierShipmentInput): Promise<CreateCarrierShipmentResult>;
  createLabel(
    input: CreateCarrierShipmentInput & { providerShipmentId: string },
  ): Promise<CarrierLabel>;
  cancelShipment?(providerShipmentId: string): Promise<void>;
  getTracking?(input: {
    providerShipmentId: string | null;
    trackingNumber: string | null;
  }): Promise<CarrierTrackingSnapshot>;
  /** Verifies the signature and maps the payload. Throws when the signature is invalid. */
  parseTrackingWebhook?(
    rawBody: string,
    headers: Headers,
    secret: string | null,
  ): Promise<CarrierWebhookResult>;
}
