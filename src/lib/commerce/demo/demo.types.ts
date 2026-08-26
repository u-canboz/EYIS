/* Demo- und QA-Datensystem: geteilte Konstanten und Typen (client-sicher). */

export const SEED_VERSION = "1.0.0";
export const DEMO_ORG_NAME = "Commerce OS Demo";
export const DEMO_ORG_SLUG_PREFIX = "commerce-os-demo";
export const DEMO_SHOP_NAME = "Demo Shop";
export const DEMO_SHOP_SLUG = "demo-shop";
export const QA_ORG_PREFIX = "QA Fixture ";
export const QA_SLUG_PREFIX = "qa-fixture-";

/** Metadata-Tag, an dem Idempotenz und Reset erkennen, was zum Seed gehört. */
export const DEMO_TAG = "demo_seed";
export const QA_TAG = "qa_fixture";

export const SEED_STEPS = [
  "foundation",
  "catalog",
  "media",
  "inventory",
  "customers",
  "promotions",
  "orders",
] as const;
export type SeedStep = (typeof SEED_STEPS)[number];

export const SEED_STEP_LABELS: Record<SeedStep, string> = {
  foundation: "Organisation, Shop, Steuern, Versand, Zahlungsanbieter",
  catalog: "Kategorien, Kollektionen, Produkte, Varianten, Preise",
  media: "Produktbilder (Upload & Zuordnung)",
  inventory: "Lagerbestände",
  customers: "Kunden & Adressen",
  promotions: "Promotions",
  orders: "Bestellungen über den echten Checkout-Fluss",
};

export const ORDER_SEED_TOTAL = 40;
export const ORDER_SEED_BATCH = 5;

export const QA_SCENARIOS = [
  "catalog_full",
  "pricing_promotions",
  "inventory_concurrency",
  "cart_checkout",
  "payment_success",
  "payment_failure",
  "payment_pending",
  "order_refund",
  "mixed_tax_order",
  "partial_fulfillment",
  "shipping_exception",
  "invoice_credit_note",
  "customer_portal",
  "return_full",
  "return_partial",
  "communication_retry",
  "automation_failure",
  "cross_tenant",
  "security_tokens",
  "backup_restore",
  "large_dataset",
  "mobile_ui_full",
] as const;
export type QaScenario = (typeof QA_SCENARIOS)[number];

export const QA_SCENARIO_LABELS: Record<QaScenario, string> = {
  catalog_full: "Katalog vollständig (Blueprints, Kategorien, Kollektionen)",
  pricing_promotions: "Pricing & Promotions",
  inventory_concurrency: "Inventar-Konkurrenz (Bestand 1, kein Backorder)",
  cart_checkout: "Warenkorb & Checkout (aktiver Warenkorb)",
  payment_success: "Zahlung erfolgreich",
  payment_failure: "Zahlung fehlgeschlagen",
  payment_pending: "Zahlung ausstehend",
  order_refund: "Bestellung mit Teil-Erstattung",
  mixed_tax_order: "Bestellung mit gemischten Steuersätzen (7 %/19 %)",
  partial_fulfillment: "Teil-Fulfillment",
  shipping_exception: "Versand mit Störung (Exception-Tracking)",
  invoice_credit_note: "Rechnung & Gutschrift",
  customer_portal: "Kundenportal (Kunde, Bestellungen, Gast-Link)",
  return_full: "Retoure vollständig",
  return_partial: "Retoure teilweise",
  communication_retry: "Kommunikation mit Retry-Warteschlange",
  automation_failure: "Automation mit fehlgeschlagener Ausführung",
  cross_tenant: "Cross-Tenant-Isolation (Paar-Tests)",
  security_tokens: "Security: API-Keys & Gast-Tokens",
  backup_restore: "Backup/Restore-Drill-Datensatz",
  large_dataset: "Großer Datensatz (20 Produkte, 20 Bestellungen)",
  mobile_ui_full: "Mobile/UI-Kantfälle (lange Texte, ohne Bilder)",
};

export type DemoEnvironmentInfo = {
  organizationId: string;
  organizationName: string;
  seedVersion: string;
  status: string;
  seededAt: string;
  lastResetAt: string | null;
};

export type DemoCounts = {
  products: number;
  orders: number;
  customers: number;
  media: number;
};

export type DemoStatus = {
  environment: DemoEnvironmentInfo | null;
  counts: DemoCounts | null;
  steps: Record<SeedStep, boolean>;
};

export type SeedStepResult = {
  step: SeedStep;
  done: boolean;
  detail: string;
  /** Nur beim Orders-Schritt: weitere Batches nötig. */
  progress?: { created: number; total: number };
};

export type QaFixtureInfo = {
  id: string;
  organizationId: string;
  organizationName: string;
  scenario: QaScenario;
  runRef: string;
  status: string;
  manifest: Record<string, string | number | boolean | null>;
  residualNotes: string | null;
  createdAt: string;
  destroyedAt: string | null;
};
