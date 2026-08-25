/**
 * Phase 8 — Invoicing & Document Engine.
 *
 * Pure types shared by server, renderer and UI. Money is always integer minor
 * units, tax rates are basis points (1900 = 19 %).
 */

export const DOCUMENT_RENDERER_VERSION = "doc-renderer-1.0.0";

export type DocumentType =
  | "invoice"
  | "credit_note"
  | "delivery_note"
  | "proforma_invoice"
  | "quote"
  | "return_document"
  | "payment_receipt"
  | "cancellation_document";

export type InvoiceStatus = "draft" | "issued" | "partially_credited" | "credited" | "voided";
export type CreditNoteStatus = "draft" | "issued" | "voided";
export type DeliveryNoteStatus = "draft" | "issued" | "voided";
export type DocumentFormat = "pdf" | "zugferd" | "xrechnung" | "ubl";
export type SequenceResetPolicy = "never" | "yearly" | "monthly";
export type InvoiceItemType = "product" | "shipping" | "discount" | "custom";
export type InvoiceCreationStrategy = "manual" | "on_order_paid" | "on_order_created";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  invoice: "Rechnung",
  credit_note: "Gutschrift",
  delivery_note: "Lieferschein",
  proforma_invoice: "Proformarechnung",
  quote: "Angebot",
  return_document: "Retourenschein",
  payment_receipt: "Zahlungsbeleg",
  cancellation_document: "Stornobeleg",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Entwurf",
  issued: "Ausgestellt",
  partially_credited: "Teilweise gutgeschrieben",
  credited: "Vollständig gutgeschrieben",
  voided: "Storniert",
};

export const CREDIT_NOTE_STATUS_LABELS: Record<CreditNoteStatus, string> = {
  draft: "Entwurf",
  issued: "Ausgestellt",
  voided: "Storniert",
};

export const SEQUENCE_RESET_LABELS: Record<SequenceResetPolicy, string> = {
  never: "Nie zurücksetzen",
  yearly: "Jährlich zurücksetzen",
  monthly: "Monatlich zurücksetzen",
};

export const CREATION_STRATEGY_LABELS: Record<InvoiceCreationStrategy, string> = {
  manual: "Nur manuell",
  on_order_paid: "Sobald die Bestellung bezahlt ist",
  on_order_created: "Sobald die Bestellung entsteht",
};

export type DocumentAddress = {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  street?: string | null;
  street2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
  vatId?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type SellerSnapshot = {
  company_name?: string | null;
  legal_form?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country_code?: string | null;
  tax_number?: string | null;
  vat_id?: string | null;
  register_court?: string | null;
  register_number?: string | null;
  managing_director?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website?: string | null;
  bank_account_holder?: string | null;
  bank_iban?: string | null;
  bank_bic?: string | null;
  bank_name?: string | null;
  payment_terms_days?: number | null;
  payment_terms_text?: string | null;
  leitweg_id?: string | null;
};

export type BrandingSnapshot = {
  preset?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  font_family?: string | null;
  sender_block?: string | null;
  payment_details?: string | null;
  footer_text?: string | null;
  legal_footer?: string | null;
  show_product_sku?: boolean | null;
  show_tax_breakdown?: boolean | null;
};

export type DocumentLine = {
  position: number;
  itemType: InvoiceItemType;
  productName: string;
  variantName: string | null;
  sku: string | null;
  description: string | null;
  quantity: number;
  unitNetMinor: number;
  discountMinor: number;
  lineNetMinor: number;
  taxRateBasisPoints: number;
  taxReasonCode: string;
  taxMinor: number;
  lineGrossMinor: number;
};

export type DocumentTaxRow = {
  rateBasisPoints: number;
  netMinor: number;
  taxMinor: number;
  grossMinor: number;
  reasonCode: string;
};

export type InvoiceView = {
  id: string;
  organizationId: string;
  shopId: string;
  orderId: string;
  orderNumber: string | null;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  currencyCode: string;
  issueDate: string | null;
  serviceDate: string | null;
  dueDate: string | null;
  customerType: "consumer" | "business" | "any";
  customerName: string | null;
  customerCompany: string | null;
  customerEmail: string | null;
  customerVatId: string | null;
  billingAddress: DocumentAddress;
  seller: SellerSnapshot;
  branding: BrandingSnapshot;
  subtotalNetMinor: number;
  discountMinor: number;
  shippingNetMinor: number;
  taxTotalMinor: number;
  totalGrossMinor: number;
  paidMinor: number;
  creditedMinor: number;
  creditableMinor: number;
  taxBreakdown: DocumentTaxRow[];
  paymentTerms: string | null;
  notes: string | null;
  items: DocumentLine[];
  createdAt: string;
  issuedAt: string | null;
  voidReason: string | null;
  files: DocumentFileView[];
  creditNotes: CreditNoteView[];
};

export type CreditNoteView = {
  id: string;
  creditNoteNumber: string | null;
  status: CreditNoteStatus;
  invoiceId: string;
  orderId: string;
  currencyCode: string;
  reason: string | null;
  subtotalNetMinor: number;
  taxTotalMinor: number;
  totalGrossMinor: number;
  taxBreakdown: DocumentTaxRow[];
  createdAt: string;
  issuedAt: string | null;
  items: DocumentLine[];
};

export type DeliveryNoteView = {
  id: string;
  documentNumber: string | null;
  status: DeliveryNoteStatus;
  orderId: string;
  orderNumber: string | null;
  fulfillmentId: string | null;
  itemCount: number;
  createdAt: string;
  issuedAt: string | null;
};

export type DocumentFileView = {
  id: string;
  documentId: string;
  documentType: DocumentType;
  format: DocumentFormat;
  version: number;
  storagePath: string | null;
  fileSize: number | null;
  checksum: string | null;
  createdAt: string;
};

export type InvoiceListItem = {
  id: string;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  orderId: string;
  orderNumber: string | null;
  customerName: string | null;
  currencyCode: string;
  totalGrossMinor: number;
  creditedMinor: number;
  issueDate: string | null;
  createdAt: string;
  hasPdf: boolean;
};

export type DocumentSequence = {
  id: string;
  documentType: DocumentType;
  prefix: string;
  suffix: string | null;
  nextNumber: number;
  padding: number;
  resetPolicy: SequenceResetPolicy;
  currentPeriod: string | null;
  includePeriod: boolean;
};

export type InvoiceSettings = {
  shopId: string;
  companyName: string | null;
  legalForm: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string;
  taxNumber: string | null;
  vatId: string | null;
  registerCourt: string | null;
  registerNumber: string | null;
  managingDirector: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  bankAccountHolder: string | null;
  bankIban: string | null;
  bankBic: string | null;
  bankName: string | null;
  paymentTermsDays: number;
  paymentTermsText: string | null;
  invoiceCreationStrategy: InvoiceCreationStrategy;
  automaticallyCreateInvoice: boolean;
  automaticallyIssueInvoice: boolean;
  creditNoteDraftOnRefund: boolean;
  einvoiceZugferdEnabled: boolean;
  einvoiceXrechnungEnabled: boolean;
  leitwegId: string | null;
};

export type DocumentBranding = {
  shopId: string;
  preset: string;
  logoMediaId: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  fontFamily: string;
  senderBlock: string | null;
  paymentDetails: string | null;
  footerText: string | null;
  legalFooter: string | null;
  showProductSku: boolean;
  showProductImages: boolean;
  showTaxBreakdown: boolean;
  bankDetails: Record<string, string | number | boolean | null>;
};

export type DocumentSetup = {
  settings: InvoiceSettings | null;
  branding: DocumentBranding | null;
  sequences: DocumentSequence[];
  missing: string[];
};

export const SETUP_LABELS: Record<string, string> = {
  company: "Firmenname fehlt",
  address: "Vollständige Anschrift fehlt",
  tax: "Steuernummer oder USt-IdNr. fehlt",
  sequence: "Nummernkreis für Rechnungen fehlt",
};

/** Renderable, format-agnostic view model. */
export type RenderableDocument = {
  kind: "invoice" | "credit_note" | "delivery_note";
  title: string;
  number: string;
  isDraft: boolean;
  issueDate: string | null;
  serviceDate: string | null;
  dueDate: string | null;
  currencyCode: string;
  seller: SellerSnapshot;
  branding: BrandingSnapshot;
  recipient: DocumentAddress;
  recipientVatId: string | null;
  reference: { label: string; value: string }[];
  lines: DocumentLine[];
  showAmounts: boolean;
  totals: {
    netMinor: number;
    taxMinor: number;
    grossMinor: number;
    discountMinor: number;
    shippingNetMinor: number;
  };
  taxRows: DocumentTaxRow[];
  taxNotes: string[];
  paymentTerms: string | null;
  notes: string | null;
};
