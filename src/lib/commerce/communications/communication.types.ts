/** Shared types of the communication engine. Browser-safe (no server imports). */

export type CommunicationChannel = "email" | "sms" | "push" | "whatsapp";

export type CommunicationStatus =
  | "draft"
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "failed"
  | "cancelled"
  | "suppressed";

export type DeliveryStatus =
  | "accepted"
  | "sent"
  | "delivered"
  | "soft_bounce"
  | "hard_bounce"
  | "complained"
  | "rejected"
  | "unknown";

export type SuppressionReason = "hard_bounce" | "complaint" | "manual" | "invalid_recipient";

export const STATUS_LABELS: Record<CommunicationStatus, string> = {
  draft: "Entwurf",
  queued: "In Warteschlange",
  sending: "Wird gesendet",
  sent: "Gesendet",
  delivered: "Zugestellt",
  failed: "Fehlgeschlagen",
  cancelled: "Abgebrochen",
  suppressed: "Unterdrückt",
};

export const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
  accepted: "Angenommen",
  sent: "Gesendet",
  delivered: "Zugestellt",
  soft_bounce: "Vorübergehend unzustellbar",
  hard_bounce: "Dauerhaft unzustellbar",
  complained: "Als Spam markiert",
  rejected: "Abgewiesen",
  unknown: "Unbekannt",
};

/* ------------------------------ blocks ---------------------------------- */

export type BlockType =
  | "logo"
  | "heading"
  | "text"
  | "button"
  | "divider"
  | "order_summary"
  | "shipment_summary"
  | "tracking"
  | "document"
  | "return_summary"
  | "refund_summary"
  | "address"
  | "payment_summary"
  | "footer";

export type Block = {
  type: BlockType;
  text?: string;
  label?: string;
  url?: string;
};

export const BLOCK_LABELS: Record<BlockType, string> = {
  logo: "Logo",
  heading: "Überschrift",
  text: "Text",
  button: "Button",
  divider: "Trennlinie",
  order_summary: "Bestellübersicht",
  shipment_summary: "Sendungsübersicht",
  tracking: "Tracking",
  document: "Dokument",
  return_summary: "Retourenübersicht",
  refund_summary: "Erstattung",
  address: "Lieferadresse",
  payment_summary: "Zahlung",
  footer: "Footer",
};

/** Blocks an editor may add manually. Data blocks come from the template. */
export const EDITABLE_BLOCKS: BlockType[] = [
  "logo",
  "heading",
  "text",
  "button",
  "divider",
  "order_summary",
  "shipment_summary",
  "tracking",
  "document",
  "return_summary",
  "refund_summary",
  "address",
  "payment_summary",
  "footer",
];

/* ------------------------------ context --------------------------------- */

export type ContextLineItem = {
  name: string;
  quantity: number;
  line_total: string;
};

export type CommunicationContext = {
  shop: { name: string; support_email: string; website_url: string };
  customer: { first_name: string; last_name: string; full_name: string; email: string };
  order?: {
    number: string;
    date: string;
    subtotal: string;
    discount: string;
    shipping: string;
    tax: string;
    total: string;
    currency: string;
    items: ContextLineItem[];
    shipping_address: string[];
  };
  shipment?: {
    carrier: string;
    tracking_number: string;
    tracking_url: string;
    items: ContextLineItem[];
    status: string;
  };
  invoice?: { number: string; date: string; total: string };
  credit_note?: { number: string; date: string; total: string };
  return?: { number: string; status: string; items: ContextLineItem[]; instructions: string };
  refund?: { amount: string; reason: string };
  payment?: { method: string; amount: string; status: string };
  links: {
    order: string;
    tracking: string;
    document: string;
    return: string;
    portal: string;
    guest_access: string;
  };
};

/** Whitelisted scalar variables usable inside subject/text blocks. */
export const VARIABLE_CATALOGUE: { group: string; items: { path: string; label: string }[] }[] = [
  {
    group: "Kunde",
    items: [
      { path: "customer.first_name", label: "Vorname" },
      { path: "customer.last_name", label: "Nachname" },
      { path: "customer.full_name", label: "Voller Name" },
      { path: "customer.email", label: "E-Mail" },
    ],
  },
  {
    group: "Bestellung",
    items: [
      { path: "order.number", label: "Bestellnummer" },
      { path: "order.date", label: "Bestelldatum" },
      { path: "order.total", label: "Gesamtbetrag" },
      { path: "order.currency", label: "Währung" },
    ],
  },
  {
    group: "Versand",
    items: [
      { path: "shipment.carrier", label: "Versanddienstleister" },
      { path: "shipment.tracking_number", label: "Sendungsnummer" },
    ],
  },
  {
    group: "Dokumente",
    items: [
      { path: "invoice.number", label: "Rechnungsnummer" },
      { path: "invoice.total", label: "Rechnungsbetrag" },
      { path: "credit_note.number", label: "Gutschriftnummer" },
    ],
  },
  {
    group: "Retoure",
    items: [
      { path: "return.number", label: "Retourennummer" },
      { path: "return.status", label: "Retourenstatus" },
      { path: "refund.amount", label: "Erstattungsbetrag" },
    ],
  },
  {
    group: "Shop",
    items: [
      { path: "shop.name", label: "Shop-Name" },
      { path: "shop.support_email", label: "Support-E-Mail" },
      { path: "shop.website_url", label: "Website" },
    ],
  },
  {
    group: "Links",
    items: [
      { path: "links.order", label: "Bestellung im Portal" },
      { path: "links.tracking", label: "Tracking-Link" },
      { path: "links.document", label: "Dokument-Link" },
      { path: "links.return", label: "Retoure im Portal" },
      { path: "links.portal", label: "Kundenkonto" },
      { path: "links.guest_access", label: "Gastzugang" },
    ],
  },
];

export const ALLOWED_VARIABLES = VARIABLE_CATALOGUE.flatMap((g) => g.items.map((i) => i.path));

/* ------------------------------ branding -------------------------------- */

export type CommunicationBranding = {
  logoUrl: string | null;
  primaryColor: string;
  backgroundColor: string;
  contentBackgroundColor: string;
  textColor: string;
  mutedTextColor: string;
  buttonStyle: string;
  borderRadius: number;
  fontFamily: string;
  footerText: string;
  supportEmail: string | null;
  websiteUrl: string | null;
  socialLinks: { label: string; url: string }[];
};

export const DEFAULT_BRANDING: CommunicationBranding = {
  logoUrl: null,
  primaryColor: "#1f2937",
  backgroundColor: "#f4f4f5",
  contentBackgroundColor: "#ffffff",
  textColor: "#18181b",
  mutedTextColor: "#71717a",
  buttonStyle: "solid",
  borderRadius: 8,
  fontFamily: "Helvetica, Arial, sans-serif",
  footerText: "",
  supportEmail: null,
  websiteUrl: null,
  socialLinks: [],
};

/* ------------------------------ list rows -------------------------------- */

export type TemplateListItem = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  isSystem: boolean;
  locales: string[];
  eventTypes: string[];
  updatedAt: string;
};

export type TemplateVersionRow = {
  id: string;
  version: number;
  locale: string;
  subject: string;
  preheader: string | null;
  blocks: Block[];
  publishedAt: string | null;
  createdAt: string;
};

export type TemplateDetail = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  isSystem: boolean;
  organizationId: string | null;
  requiredBlocks: BlockType[];
  versions: TemplateVersionRow[];
};

export type CommunicationListItem = {
  id: string;
  createdAt: string;
  recipient: string;
  templateKey: string;
  status: CommunicationStatus;
  deliveryStatus: DeliveryStatus | null;
  provider: string | null;
  subject: string;
  orderNumber: string | null;
  sourceEventType: string | null;
  isTestSend: boolean;
};

export type CommunicationDetail = CommunicationListItem & {
  html: string;
  text: string;
  locale: string;
  senderName: string | null;
  senderAddress: string | null;
  templateVersion: number | null;
  lastError: string | null;
  resendOf: string | null;
  attempts: {
    id: string;
    attemptNumber: number;
    provider: string;
    status: DeliveryStatus;
    errorCode: string | null;
    errorMessage: string | null;
    startedAt: string;
    completedAt: string | null;
    providerMessageId: string | null;
  }[];
  providerEvents: {
    id: string;
    eventType: string;
    provider: string;
    receivedAt: string;
    signatureVerified: boolean;
    processingStatus: string;
  }[];
};

export type RuleRow = {
  id: string;
  eventType: string;
  templateKey: string;
  templateName: string;
  enabled: boolean;
  delaySeconds: number;
  conditions: Record<string, string | number | boolean | null>;
};

export type ProviderConfigRow = {
  id: string;
  provider: string;
  displayName: string;
  status: string;
  testMode: boolean;
  priority: number;
  capabilities: Record<string, boolean>;
};

export type SenderIdentityRow = {
  id: string;
  displayName: string;
  senderName: string;
  senderAddress: string;
  replyTo: string | null;
  verificationStatus: string;
  isDefault: boolean;
};
