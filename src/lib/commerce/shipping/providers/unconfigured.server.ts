/**
 * Stub for carriers that are modelled but not yet connected. It never invents
 * rates, labels or tracking data — it fails loudly with a typed error.
 */
import { CarrierError, type CarrierProvider } from "../provider";

export function makeUnconfiguredCarrier(id: string, displayName: string): CarrierProvider {
  const fail = (): never => {
    throw new CarrierError(
      "not_supported",
      `${displayName} ist noch nicht angebunden. Bitte Zugangsdaten hinterlegen, bevor diese Aktion genutzt werden kann.`,
      false,
    );
  };
  return {
    id,
    displayName,
    capabilities: {
      supportsRates: false,
      supportsLabels: false,
      supportsCancellation: false,
      supportsTracking: false,
      supportsTrackingWebhook: false,
      supportsMultiPackage: false,
    },
    async createShipment() {
      return fail();
    },
    async createLabel() {
      return fail();
    },
  };
}
