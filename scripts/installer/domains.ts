/** Zuordnung von Datenbankobjekten zu Installations-Domänen. */

export type DomainId =
  | "foundation"
  | "identity"
  | "catalog"
  | "pricing"
  | "inventory"
  | "cart-checkout"
  | "payments-orders"
  | "tax-shipping"
  | "customers-returns"
  | "documents"
  | "communications"
  | "automation"
  | "store-api"
  | "system-updates";

export const DOMAIN_ORDER: DomainId[] = [
  "foundation",
  "identity",
  "catalog",
  "pricing",
  "inventory",
  "cart-checkout",
  "payments-orders",
  "tax-shipping",
  "customers-returns",
  "documents",
  "communications",
  "automation",
  "store-api",
  "system-updates",
];

const RULES: [DomainId, RegExp][] = [
  ["identity", /^(organizations|memberships|profiles|invitations|user_roles|role_permissions|audit_log)/],
  ["catalog", /^(products|product_|categories|collections|media_assets|variant_option_values)/],
  ["pricing", /^(price|prices|promotions)/],
  ["inventory", /^(inventory_|stock_alert_rules)/],
  ["cart-checkout", /^(cart|carts|checkout_)/],
  ["payments-orders", /^(order|orders|payment_|payments|refunds|provider_credentials)/],
  ["tax-shipping", /^(tax_|shipping_|shipments|tracking_|packages|package_|fulfillment|fulfillments|delivery_notes)/],
  ["customers-returns", /^(customer|customers|guest_order_access_tokens|return|returns|vat_validations)/],
  ["documents", /^(invoice|invoices|credit_note|document_)/],
  ["communications", /^(communication|communications|sender_|outgoing_webhook_endpoints)/],
  ["automation", /^(automation_|tasks|outbox_events|idempotency_keys)/],
  ["store-api", /^(store_|shop|shops|oauth_states)/],
  ["system-updates", /^(commerce_installation|update_run|update_runs|demo_environments|qa_fixtures|integration_|eyis_installation)/],
];

export function domainOf(objectName: string): DomainId {
  for (const [domain, re] of RULES) if (re.test(objectName)) return domain;
  return "foundation";
}
