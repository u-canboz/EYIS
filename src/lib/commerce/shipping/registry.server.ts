/** Resolves a carrier implementation from shipping_provider_configs.provider. */
import { CarrierError, type CarrierProvider } from "./provider";

export async function getCarrier(id: string): Promise<CarrierProvider> {
  switch (id) {
    case "mock":
      return (await import("./providers/mock.server")).mockCarrier;
    case "dhl":
      return (await import("./providers/dhl.server")).dhlCarrier;
    case "dpd":
      return (await import("./providers/dpd.server")).dpdCarrier;
    case "gls":
      return (await import("./providers/gls.server")).glsCarrier;
    case "ups":
      return (await import("./providers/ups.server")).upsCarrier;
    case "sendcloud":
      return (await import("./providers/sendcloud.server")).sendcloudCarrier;
    default:
      throw new CarrierError("not_supported", `Unbekannter Versanddienstleister: ${id}`, false);
  }
}
