/**
 * Integration Center — zentrale, client-sichere Provider-Registry.
 *
 * Liegt ÜBER den drei Engines (payments/, communications/, shipping/) und
 * beschreibt nur Metadaten: keine Secrets, keine Verbindungslogik. Die Engines
 * bleiben führend für Verhalten; diese Registry steuert ausschließlich die
 * gemeinsame Bedienebene.
 *
 * Produktregel: Nicht implementierte Provider werden als „Noch nicht verfügbar"
 * geführt — niemals als verbindbar dargestellt.
 */

export type IntegrationCategory = "payment" | "email" | "carrier";

export type ConnectionType = "oauth" | "api_credentials" | "smtp" | "managed" | "manual";

export type IntegrationStatus =
  | "not_connected"
  | "setup_required"
  | "verification_required"
  | "connected"
  | "error"
  | "disabled";

export const INTEGRATION_STATUS_LABELS: Record<IntegrationStatus, string> = {
  not_connected: "Nicht verbunden",
  setup_required: "Einrichtung erforderlich",
  verification_required: "Verifizierung erforderlich",
  connected: "Verbunden",
  error: "Fehler",
  disabled: "Deaktiviert",
};

export type HealthStatus = "healthy" | "warning" | "error" | "unknown";

export const HEALTH_LABELS: Record<HealthStatus, string> = {
  healthy: "Fehlerfrei",
  warning: "Warnung",
  error: "Fehler",
  unknown: "Unbekannt",
};

export type IntegrationCatalogEntry = {
  id: string;
  category: IntegrationCategory;
  displayName: string;
  description: string;
  connectionType: ConnectionType;
  /** false = kein echter Adapter vorhanden → „Noch nicht verfügbar". */
  implemented: boolean;
  /** true = nur für Tests/Demo, nie als Live-Ready. */
  testOnly: boolean;
  testModeSupported: boolean;
  healthCheckSupported: boolean;
  disconnectSupported: boolean;
  /** Benötigte Konfigurationsnachweise (Referenzen, nie Werte). */
  configurationRequirements: string[];
  /** Mögliche Fähigkeiten; tatsächliche kommen aus der Konfiguration. */
  capabilities: string[];
  documentationReference: string | null;
  /** Bestehende Detail-/Konfigurationsseite der Engine. */
  managePath: string | null;
  /** Ehrlicher Hinweis, z. B. Plattform-Blocker bei SMTP. */
  note: string | null;
};

export const INTEGRATION_CATALOG: IntegrationCatalogEntry[] = [
  // ---- Zahlungen ----
  {
    id: "stripe",
    category: "payment",
    displayName: "Stripe",
    description: "Karten und Wallet-Zahlungen über gehostetes Stripe Checkout.",
    connectionType: "api_credentials",
    implemented: true,
    testOnly: false,
    testModeSupported: true,
    healthCheckSupported: true,
    disconnectSupported: true,
    configurationRequirements: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    capabilities: ["card", "apple_pay", "google_pay"],
    documentationReference: "https://docs.stripe.com",
    managePath: "/app/zahlungen",
    note: "Secret-Key-Verbindung. Stripe Connect (OAuth) ist als nächste Erweiterung dokumentiert.",
  },
  {
    id: "mock",
    category: "payment",
    displayName: "Test-Zahlungsanbieter",
    description: "Deterministischer Zahlungsfluss für Demo und QA.",
    connectionType: "manual",
    implemented: true,
    testOnly: true,
    testModeSupported: true,
    healthCheckSupported: true,
    disconnectSupported: true,
    configurationRequirements: [],
    capabilities: ["card"],
    documentationReference: null,
    managePath: "/app/zahlungen",
    note: "Nur Testmodus — kann nicht live geschaltet werden.",
  },
  {
    id: "paypal",
    category: "payment",
    displayName: "PayPal",
    description: "PayPal-Wallet und Käuferschutz.",
    connectionType: "oauth",
    implemented: false,
    testOnly: false,
    testModeSupported: true,
    healthCheckSupported: false,
    disconnectSupported: false,
    configurationRequirements: [],
    capabilities: ["paypal"],
    documentationReference: "https://developer.paypal.com",
    managePath: null,
    note: null,
  },
  {
    id: "mollie",
    category: "payment",
    displayName: "Mollie",
    description: "Europäische Zahlungsarten (iDEAL, SEPA, Karten).",
    connectionType: "api_credentials",
    implemented: false,
    testOnly: false,
    testModeSupported: true,
    healthCheckSupported: false,
    disconnectSupported: false,
    configurationRequirements: [],
    capabilities: ["card", "ideal", "sepa_debit"],
    documentationReference: "https://docs.mollie.com",
    managePath: null,
    note: null,
  },
  // ---- E-Mail ----
  {
    id: "lovable",
    category: "email",
    displayName: "Verwalteter Versand",
    description: "Plattform-seitig verwalteter transaktionaler E-Mail-Versand.",
    connectionType: "managed",
    implemented: true,
    testOnly: false,
    testModeSupported: true,
    healthCheckSupported: true,
    disconnectSupported: true,
    configurationRequirements: ["Verifizierte Absenderdomain"],
    capabilities: ["transactional", "delivery_webhooks", "bounce_webhooks"],
    documentationReference: null,
    managePath: "/app/kommunikation/regeln",
    note: "Versand läuft ausschließlich über die Communication Engine.",
  },
  {
    id: "test",
    category: "email",
    displayName: "Test-E-Mail-Anbieter",
    description: "Protokolliert Sends ohne echten Versand (Demo/QA).",
    connectionType: "manual",
    implemented: true,
    testOnly: true,
    testModeSupported: true,
    healthCheckSupported: true,
    disconnectSupported: true,
    configurationRequirements: [],
    capabilities: ["transactional"],
    documentationReference: null,
    managePath: "/app/kommunikation/regeln",
    note: "Nur Testmodus.",
  },
  {
    id: "smtp",
    category: "email",
    displayName: "Eigener SMTP-Server",
    description: "Versand über einen eigenen SMTP-Server des Händlers.",
    connectionType: "smtp",
    implemented: false,
    testOnly: false,
    testModeSupported: false,
    healthCheckSupported: false,
    disconnectSupported: false,
    configurationRequirements: ["SMTP-Host", "Port", "TLS-Modus", "Zugangsdaten"],
    capabilities: ["transactional"],
    documentationReference: null,
    managePath: null,
    note: "BLOCKED: Die Serverless-Laufzeit bietet keine zuverlässigen rohen TCP/TLS-Verbindungen für generisches SMTP. API-basierte Anbieter sind der empfohlene Weg.",
  },
  {
    id: "resend",
    category: "email",
    displayName: "Resend",
    description: "API-basierter transaktionaler Versand mit Domain-Verifizierung.",
    connectionType: "api_credentials",
    implemented: false,
    testOnly: false,
    testModeSupported: true,
    healthCheckSupported: false,
    disconnectSupported: false,
    configurationRequirements: [],
    capabilities: ["transactional", "domain_verification"],
    documentationReference: "https://resend.com/docs",
    managePath: null,
    note: null,
  },
  {
    id: "postmark",
    category: "email",
    displayName: "Postmark",
    description: "Transaktionaler Versand mit hoher Zustellqualität.",
    connectionType: "api_credentials",
    implemented: false,
    testOnly: false,
    testModeSupported: true,
    healthCheckSupported: false,
    disconnectSupported: false,
    configurationRequirements: [],
    capabilities: ["transactional", "domain_verification"],
    documentationReference: "https://postmarkapp.com/developer",
    managePath: null,
    note: null,
  },
  {
    id: "ses",
    category: "email",
    displayName: "Amazon SES",
    description: "Skalierbarer Versand über AWS.",
    connectionType: "api_credentials",
    implemented: false,
    testOnly: false,
    testModeSupported: true,
    healthCheckSupported: false,
    disconnectSupported: false,
    configurationRequirements: [],
    capabilities: ["transactional", "domain_verification"],
    documentationReference: "https://docs.aws.amazon.com/ses/",
    managePath: null,
    note: null,
  },
  // ---- Versand ----
  {
    id: "mock-carrier",
    category: "carrier",
    displayName: "Test-Carrier",
    description: "Deterministische Labels und Tracking für Demo und QA.",
    connectionType: "manual",
    implemented: true,
    testOnly: true,
    testModeSupported: true,
    healthCheckSupported: true,
    disconnectSupported: true,
    configurationRequirements: [],
    capabilities: ["rates", "labels", "tracking"],
    documentationReference: null,
    managePath: "/app/versand/dienstleister",
    note: "Nur Testmodus.",
  },
  {
    id: "dhl",
    category: "carrier",
    displayName: "DHL",
    description: "Paketversand national und international.",
    connectionType: "api_credentials",
    implemented: false,
    testOnly: false,
    testModeSupported: true,
    healthCheckSupported: false,
    disconnectSupported: false,
    configurationRequirements: ["Vertragsnummer", "API-Zugang"],
    capabilities: ["labels", "tracking"],
    documentationReference: "https://developer.dhl.com",
    managePath: "/app/versand/dienstleister",
    note: "Adapter-Stub vorhanden; Zugangsdaten und Implementierung fehlen.",
  },
  {
    id: "dpd",
    category: "carrier",
    displayName: "DPD",
    description: "Paketversand.",
    connectionType: "api_credentials",
    implemented: false,
    testOnly: false,
    testModeSupported: true,
    healthCheckSupported: false,
    disconnectSupported: false,
    configurationRequirements: [],
    capabilities: ["labels", "tracking"],
    documentationReference: null,
    managePath: null,
    note: null,
  },
  {
    id: "gls",
    category: "carrier",
    displayName: "GLS",
    description: "Paketversand.",
    connectionType: "api_credentials",
    implemented: false,
    testOnly: false,
    testModeSupported: true,
    healthCheckSupported: false,
    disconnectSupported: false,
    configurationRequirements: [],
    capabilities: ["labels", "tracking"],
    documentationReference: null,
    managePath: null,
    note: null,
  },
  {
    id: "ups",
    category: "carrier",
    displayName: "UPS",
    description: "Paketversand national und international.",
    connectionType: "api_credentials",
    implemented: false,
    testOnly: false,
    testModeSupported: true,
    healthCheckSupported: false,
    disconnectSupported: false,
    configurationRequirements: [],
    capabilities: ["labels", "tracking"],
    documentationReference: null,
    managePath: null,
    note: null,
  },
  {
    id: "sendcloud",
    category: "carrier",
    displayName: "Sendcloud",
    description: "Multi-Carrier-Versandplattform.",
    connectionType: "oauth",
    implemented: false,
    testOnly: false,
    testModeSupported: true,
    healthCheckSupported: false,
    disconnectSupported: false,
    configurationRequirements: [],
    capabilities: ["labels", "tracking", "multi_carrier"],
    documentationReference: "https://docs.sendcloud.sc",
    managePath: null,
    note: null,
  },
];

export function integrationEntry(category: IntegrationCategory, id: string) {
  return INTEGRATION_CATALOG.find((e) => e.category === category && e.id === id);
}

/** Maps a carrier/payment engine provider id to its catalog entry id. */
export function catalogIdFor(category: IntegrationCategory, providerId: string): string {
  if (category === "carrier" && providerId === "mock") return "mock-carrier";
  return providerId;
}

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  payment: "Zahlungen",
  email: "E-Mail",
  carrier: "Versand",
};
