/**
 * Test carrier. It never talks to a network and is refused outside test mode.
 * Scenarios make every branch of the fulfillment engine reproducible.
 */
import {
  CarrierError,
  type CarrierLabel,
  type CarrierProvider,
  type CarrierRate,
  type CarrierTrackingSnapshot,
  type CarrierWebhookResult,
  type CreateCarrierShipmentInput,
  type CreateCarrierShipmentResult,
  type NormalizedTrackingEvent,
  type TrackingStatusCode,
} from "../provider";

export const MOCK_SCENARIOS = [
  "label_success",
  "provider_failure",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "exception",
  "returned",
] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

const SEQUENCES: Record<MockScenario, TrackingStatusCode[]> = {
  label_success: ["pre_transit"],
  provider_failure: ["pre_transit"],
  in_transit: ["pre_transit", "in_transit"],
  out_for_delivery: ["pre_transit", "in_transit", "out_for_delivery"],
  delivered: ["pre_transit", "in_transit", "out_for_delivery", "delivered"],
  exception: ["pre_transit", "in_transit", "exception"],
  returned: ["pre_transit", "in_transit", "exception", "returned"],
};

const DESCRIPTIONS: Record<TrackingStatusCode, string> = {
  pre_transit: "Sendungsdaten übermittelt",
  in_transit: "Sendung ist unterwegs",
  out_for_delivery: "Sendung ist in Zustellung",
  delivered: "Sendung zugestellt",
  exception: "Zustellproblem gemeldet",
  returned: "Sendung geht zurück an Absender",
  cancelled: "Sendung storniert",
  unknown: "Status unbekannt",
};

function scenarioOf(value: string | null | undefined): MockScenario {
  return (MOCK_SCENARIOS as readonly string[]).includes(value ?? "")
    ? (value as MockScenario)
    : "label_success";
}

function assertTestMode(testMode: boolean) {
  if (!testMode)
    throw new CarrierError(
      "not_supported",
      "Der Test-Carrier ist im Live-Betrieb nicht zulässig.",
      false,
    );
}

function buildEvents(shipmentRef: string, scenario: MockScenario): NormalizedTrackingEvent[] {
  const base = Date.now() - SEQUENCES[scenario].length * 3600_000;
  return SEQUENCES[scenario].map((status, index) => ({
    providerEventId: `${shipmentRef}_evt_${index}`,
    code: `MOCK_${status.toUpperCase()}`,
    status,
    description: DESCRIPTIONS[status],
    location: "Testzentrum",
    occurredAt: new Date(base + index * 3600_000).toISOString(),
    raw: { scenario, index },
  }));
}

export const mockCarrier: CarrierProvider = {
  id: "mock",
  displayName: "Test-Carrier",
  capabilities: {
    supportsRates: true,
    supportsLabels: true,
    supportsCancellation: true,
    supportsTracking: true,
    supportsTrackingWebhook: true,
    supportsMultiPackage: true,
  },

  async getRates({ parcel, testMode }): Promise<CarrierRate[]> {
    assertTestMode(testMode);
    const weight = parcel.weightGrams ?? 1000;
    return [
      {
        service: "standard",
        serviceName: "Test Standard",
        amountMinor: 490 + Math.floor(weight / 1000) * 100,
        currencyCode: "EUR",
        estimatedDays: 3,
      },
      {
        service: "express",
        serviceName: "Test Express",
        amountMinor: 1290 + Math.floor(weight / 1000) * 100,
        currencyCode: "EUR",
        estimatedDays: 1,
      },
    ];
  },

  async createShipment(input: CreateCarrierShipmentInput): Promise<CreateCarrierShipmentResult> {
    assertTestMode(input.testMode);
    const scenario = scenarioOf(input.scenario);
    if (
      !input.address.line1 ||
      !input.address.postalCode ||
      !input.address.city ||
      !input.address.countryCode
    ) {
      throw new CarrierError("invalid_address", "Die Lieferadresse ist unvollständig.", false);
    }
    if ((input.parcel.weightGrams ?? 0) <= 0) {
      throw new CarrierError(
        "invalid_dimensions",
        "Für die Sendung wird ein Gewicht benötigt.",
        false,
      );
    }
    if (scenario === "provider_failure") {
      throw new CarrierError(
        "provider_unavailable",
        "Der Versanddienstleister antwortet derzeit nicht.",
      );
    }
    const ref = `mock_${input.shipmentId.slice(0, 8)}_${input.parcel.packageNumber}`;
    return {
      providerShipmentId: ref,
      trackingNumber: `MOCK${input.shipmentId.replace(/-/g, "").slice(0, 12).toUpperCase()}${input.parcel.packageNumber}`,
      trackingUrl: `https://tracking.example.test/${ref}`,
      costMinor: input.service === "express" ? 1290 : 490,
      currencyCode: "EUR",
      raw: { scenario },
    };
  },

  async createLabel(input): Promise<CarrierLabel> {
    assertTestMode(input.testMode);
    if (scenarioOf(input.scenario) === "provider_failure") {
      throw new CarrierError("label_generation_failed", "Das Label konnte nicht erzeugt werden.");
    }
    const doc = [
      "%PDF-1.4",
      `% Testlabel ${input.providerShipmentId}`,
      `% ${input.address.name}, ${input.address.postalCode} ${input.address.city}`,
      "%%EOF",
    ].join("\n");
    return { format: "pdf", mimeType: "application/pdf", contentBase64: btoa(doc) };
  },

  async cancelShipment() {
    /* nothing to cancel at the test carrier */
  },

  async getTracking({ providerShipmentId, trackingNumber }): Promise<CarrierTrackingSnapshot> {
    const ref = providerShipmentId ?? trackingNumber;
    if (!ref) throw new CarrierError("tracking_unknown", "Keine Sendungsnummer hinterlegt.", false);
    const scenario = scenarioOf(null);
    const events = buildEvents(ref, scenario);
    return { status: events[events.length - 1]?.status ?? "unknown", events };
  },

  async parseTrackingWebhook(rawBody, headers, secret): Promise<CarrierWebhookResult> {
    if (secret && headers.get("x-mock-signature") !== secret) {
      throw new CarrierError("provider_unavailable", "Ungültige Webhook-Signatur.", false);
    }
    const body = JSON.parse(rawBody) as {
      providerShipmentId?: string;
      trackingNumber?: string;
      scenario?: string;
      events?: {
        id?: string;
        code?: string;
        status?: TrackingStatusCode;
        description?: string;
        location?: string;
        occurredAt?: string;
      }[];
    };
    const ref = body.providerShipmentId ?? body.trackingNumber ?? "mock";
    const events: NormalizedTrackingEvent[] = body.events?.length
      ? body.events.map((e, index) => ({
          providerEventId: e.id ?? `${ref}_evt_${index}`,
          code: e.code ?? `MOCK_${(e.status ?? "unknown").toUpperCase()}`,
          status: (e.status ?? "unknown") as TrackingStatusCode,
          description: e.description ?? DESCRIPTIONS[(e.status ?? "unknown") as TrackingStatusCode],
          location: e.location ?? null,
          occurredAt: e.occurredAt ?? new Date().toISOString(),
          raw: e as Record<string, unknown>,
        }))
      : buildEvents(ref, scenarioOf(body.scenario));
    return {
      providerShipmentId: body.providerShipmentId ?? null,
      trackingNumber: body.trackingNumber ?? null,
      events,
    };
  },
};
