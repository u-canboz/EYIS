/** Client-safe carrier catalogue. The UI decides by capability, never by name. */
import type { CarrierCapabilities } from "./provider";

export type CarrierCatalogEntry = {
  id: string;
  displayName: string;
  /** false = only a stub; needs credentials before it can be used. */
  implemented: boolean;
  testOnly: boolean;
  capabilities: CarrierCapabilities;
};

const NONE: CarrierCapabilities = {
  supportsRates: false,
  supportsLabels: false,
  supportsCancellation: false,
  supportsTracking: false,
  supportsTrackingWebhook: false,
  supportsMultiPackage: false,
};

export const CARRIER_CATALOG: CarrierCatalogEntry[] = [
  {
    id: "mock",
    displayName: "Test-Carrier",
    implemented: true,
    testOnly: true,
    capabilities: {
      supportsRates: true,
      supportsLabels: true,
      supportsCancellation: true,
      supportsTracking: true,
      supportsTrackingWebhook: true,
      supportsMultiPackage: true,
    },
  },
  { id: "dhl", displayName: "DHL", implemented: false, testOnly: false, capabilities: NONE },
  { id: "dpd", displayName: "DPD", implemented: false, testOnly: false, capabilities: NONE },
  { id: "gls", displayName: "GLS", implemented: false, testOnly: false, capabilities: NONE },
  { id: "ups", displayName: "UPS", implemented: false, testOnly: false, capabilities: NONE },
  { id: "sendcloud", displayName: "Sendcloud", implemented: false, testOnly: false, capabilities: NONE },
];

export function carrierEntry(id: string): CarrierCatalogEntry | undefined {
  return CARRIER_CATALOG.find((c) => c.id === id);
}

export function carrierLabel(id: string) {
  return carrierEntry(id)?.displayName ?? id;
}
