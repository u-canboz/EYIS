/**
 * Server-only document reads, lifecycle orchestration and file storage.
 * Every state transition goes through a locking SECURITY DEFINER function;
 * this module only maps rows, renders files and stores them.
 */
import { getAdmin } from "../core.server";
import type {
  CreditNoteView,
  DeliveryNoteView,
  DocumentAddress,
  DocumentBranding,
  DocumentFileView,
  DocumentLine,
  DocumentSequence,
  DocumentSetup,
  DocumentTaxRow,
  InvoiceListItem,
  InvoiceSettings,
  InvoiceStatus,
  InvoiceView,
} from "./document.types";
import { DOCUMENT_RENDERER_VERSION } from "./document.types";
import { publishInvoiceEvent } from "../event-payloads.server";

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v == null ? null : String(v));

function mapLine(r: Row): DocumentLine {
  return {
    position: num(r['position']),
    itemType: r['item_type'] as DocumentLine["itemType"],
    productName: String(r['product_name'] ?? ""),
    variantName: str(r['variant_name']),
    sku: str(r['sku']),
    description: str(r['description']),
    quantity: num(r['quantity']),
    unitNetMinor: num(r['unit_net_minor']),
    discountMinor: num(r['discount_minor']),
    lineNetMinor: num(r['line_net_minor']),
    taxRateBasisPoints: num(r['tax_rate_basis_points']),
    taxReasonCode: String(r['tax_reason_code'] ?? "standard_rate"),
    taxMinor: num(r['tax_minor']),
    lineGrossMinor: num(r['line_gross_minor']),
  };
}

function mapTaxRows(value: unknown): DocumentTaxRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const r = raw as Row;
    return {
      rateBasisPoints: num(r['rateBasisPoints'] ?? r['rate_basis_points']),
      netMinor: num(r['netMinor'] ?? r['net_minor']),
      taxMinor: num(r['taxMinor'] ?? r['tax_minor']),
      grossMinor: num(r['grossMinor'] ?? r['gross_minor']),
      reasonCode: String(r['reasonCode'] ?? r['reason_code'] ?? "standard_rate"),
    };
  });
}

function mapFile(r: Row): DocumentFileView {
  return {
    id: r['id'] as string,
    documentId: r['document_id'] as string,
    documentType: r['document_type'] as DocumentFileView["documentType"],
    format: r['format'] as DocumentFileView["format"],
    version: num(r['version']),
    storagePath: str(r['storage_path']),
    fileSize: r['file_size'] == null ? null : num(r['file_size']),
    checksum: str(r['checksum']),
    createdAt: r['created_at'] as string,
  };
}

function mapCreditNote(r: Row, items: Row[]): CreditNoteView {
  return {
    id: r['id'] as string,
    creditNoteNumber: str(r['credit_note_number']),
    status: r['status'] as CreditNoteView["status"],
    invoiceId: r['invoice_id'] as string,
    orderId: r['order_id'] as string,
    currencyCode: String(r['currency_code'] ?? "EUR"),
    reason: str(r['reason']),
    subtotalNetMinor: num(r['subtotal_net_minor']),
    taxTotalMinor: num(r['tax_total_minor']),
    totalGrossMinor: num(r['total_gross_minor']),
    taxBreakdown: mapTaxRows(r['tax_breakdown']),
    createdAt: r['created_at'] as string,
    issuedAt: str(r['issued_at']),
    items: items.map(mapLine),
  };
}

/* ───────────────────────────── reads ───────────────────────────── */

export async function listInvoices(input: {
  organizationId: string;
  shopId?: string | null;
  status?: InvoiceStatus | null;
  search?: string | null;
  limit?: number;
}): Promise<InvoiceListItem[]> {
  const admin = await getAdmin();
  let query = admin
    .from("invoices")
    .select("*")
    .eq("organization_id", input.organizationId)
    .order("created_at", { ascending: false })
    .limit(Math.min(input.limit ?? 100, 200));
  if (input.shopId) query = query.eq("shop_id", input.shopId);
  if (input.status) query = query.eq("status", input.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  let rows = (data ?? []) as Row[];

  const orderIds = [...new Set(rows.map((r) => r['order_id'] as string))];
  const [orders, files] = await Promise.all([
    orderIds.length
      ? admin.from("orders").select("id, order_number").in("id", orderIds)
      : Promise.resolve({ data: [] as Row[] }),
    rows.length
      ? admin
          .from("document_files")
          .select("document_id, format")
          .in("document_id", rows.map((r) => r['id'] as string))
      : Promise.resolve({ data: [] as Row[] }),
  ]);
  const orderMap = new Map(((orders.data ?? []) as Row[]).map((o) => [o['id'] as string, o['order_number'] as string]));
  const pdfSet = new Set(
    ((files.data ?? []) as Row[]).filter((f) => f['format'] === "pdf").map((f) => f['document_id'] as string),
  );

  if (input.search) {
    const needle = input.search.toLowerCase();
    rows = rows.filter(
      (r) =>
        String(r['invoice_number'] ?? "").toLowerCase().includes(needle) ||
        String(r['customer_name'] ?? "").toLowerCase().includes(needle) ||
        String(r['customer_email'] ?? "").toLowerCase().includes(needle) ||
        (orderMap.get(r['order_id'] as string) ?? "").toLowerCase().includes(needle),
    );
  }

  return rows.map((r) => ({
    id: r['id'] as string,
    invoiceNumber: str(r['invoice_number']),
    status: r['status'] as InvoiceStatus,
    orderId: r['order_id'] as string,
    orderNumber: orderMap.get(r['order_id'] as string) ?? null,
    customerName: str(r['customer_name']) ?? str(r['customer_company']),
    currencyCode: String(r['currency_code'] ?? "EUR"),
    totalGrossMinor: num(r['total_gross_minor']),
    creditedMinor: num(r['credited_minor']),
    issueDate: str(r['issue_date']),
    createdAt: r['created_at'] as string,
    hasPdf: pdfSet.has(r['id'] as string),
  }));
}

export async function loadInvoice(organizationId: string, invoiceId: string): Promise<InvoiceView> {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("invoices")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", invoiceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Rechnung nicht gefunden.");
  const r = data as Row;

  const [items, order, files, creditNotes] = await Promise.all([
    admin.from("invoice_items").select("*").eq("invoice_id", invoiceId).order("position"),
    admin.from("orders").select("id, order_number").eq("id", r['order_id'] as string).maybeSingle(),
    admin.from("document_files").select("*").eq("document_id", invoiceId).order("version", { ascending: false }),
    admin.from("credit_notes").select("*").eq("invoice_id", invoiceId).order("created_at", { ascending: false }),
  ]);

  const cnRows = (creditNotes.data ?? []) as Row[];
  const cnItems = cnRows.length
    ? ((
        await admin
          .from("credit_note_items")
          .select("*")
          .in("credit_note_id", cnRows.map((c) => c['id'] as string))
          .order("position")
      ).data ?? [])
    : [];

  const totalGross = num(r['total_gross_minor']);
  const credited = num(r['credited_minor']);

  return {
    id: r['id'] as string,
    organizationId: r['organization_id'] as string,
    shopId: r['shop_id'] as string,
    orderId: r['order_id'] as string,
    orderNumber: ((order.data as Row | null)?.['order_number'] as string) ?? null,
    invoiceNumber: str(r['invoice_number']),
    status: r['status'] as InvoiceStatus,
    currencyCode: String(r['currency_code'] ?? "EUR"),
    issueDate: str(r['issue_date']),
    serviceDate: str(r['service_date']),
    dueDate: str(r['due_date']),
    customerType: r['customer_type'] as InvoiceView["customerType"],
    customerName: str(r['customer_name']),
    customerCompany: str(r['customer_company']),
    customerEmail: str(r['customer_email']),
    customerVatId: str(r['customer_vat_id']),
    billingAddress: (r['billing_address_snapshot'] ?? {}) as DocumentAddress,
    seller: (r['seller_snapshot'] ?? {}) as InvoiceView["seller"],
    branding: (r['branding_snapshot'] ?? {}) as InvoiceView["branding"],
    subtotalNetMinor: num(r['subtotal_net_minor']),
    discountMinor: num(r['discount_minor']),
    shippingNetMinor: num(r['shipping_net_minor']),
    taxTotalMinor: num(r['tax_total_minor']),
    totalGrossMinor: totalGross,
    paidMinor: num(r['paid_minor']),
    creditedMinor: credited,
    creditableMinor: Math.max(totalGross - credited, 0),
    taxBreakdown: mapTaxRows(r['tax_breakdown']),
    paymentTerms: str(r['payment_terms']),
    notes: str(r['notes']),
    items: ((items.data ?? []) as Row[]).map(mapLine),
    createdAt: r['created_at'] as string,
    issuedAt: str(r['issued_at']),
    voidReason: str(r['void_reason']),
    files: ((files.data ?? []) as Row[]).map(mapFile),
    creditNotes: cnRows.map((c) =>
      mapCreditNote(
        c,
        (cnItems as Row[]).filter((i) => i['credit_note_id'] === c['id']),
      ),
    ),
  };
}

export async function loadOrderDocuments(organizationId: string, orderId: string) {
  const admin = await getAdmin();
  const [invoices, deliveryNotes] = await Promise.all([
    admin
      .from("invoices")
      .select("id, invoice_number, status, total_gross_minor, credited_minor, currency_code, issue_date, created_at")
      .eq("organization_id", organizationId)
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    admin
      .from("delivery_notes")
      .select("id, document_number, status, fulfillment_id, items, created_at, issued_at")
      .eq("organization_id", organizationId)
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
  ]);

  const invoiceRows = (invoices.data ?? []) as Row[];
  const files = invoiceRows.length
    ? ((await admin.from("document_files").select("document_id, format").in("document_id", invoiceRows.map((i) => i['id'] as string))).data ?? [])
    : [];
  const pdfSet = new Set(((files as Row[]) ?? []).filter((f) => f['format'] === "pdf").map((f) => f['document_id'] as string));

  return {
    invoices: invoiceRows.map((r) => ({
      id: r['id'] as string,
      invoiceNumber: str(r['invoice_number']),
      status: r['status'] as InvoiceStatus,
      currencyCode: String(r['currency_code'] ?? "EUR"),
      totalGrossMinor: num(r['total_gross_minor']),
      creditedMinor: num(r['credited_minor']),
      issueDate: str(r['issue_date']),
      createdAt: r['created_at'] as string,
      hasPdf: pdfSet.has(r['id'] as string),
    })),
    deliveryNotes: ((deliveryNotes.data ?? []) as Row[]).map((r) => ({
      id: r['id'] as string,
      documentNumber: str(r['document_number']),
      status: r['status'] as DeliveryNoteView["status"],
      orderId,
      orderNumber: null,
      fulfillmentId: str(r['fulfillment_id']),
      itemCount: Array.isArray(r['items']) ? (r['items'] as unknown[]).length : 0,
      createdAt: r['created_at'] as string,
      issuedAt: str(r['issued_at']),
    })) as DeliveryNoteView[],
  };
}

export async function listDeliveryNotes(organizationId: string, shopId?: string | null): Promise<DeliveryNoteView[]> {
  const admin = await getAdmin();
  let query = admin
    .from("delivery_notes")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (shopId) query = query.eq("shop_id", shopId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  const orderIds = [...new Set(rows.map((r) => r['order_id'] as string))];
  const orders = orderIds.length
    ? ((await admin.from("orders").select("id, order_number").in("id", orderIds)).data ?? [])
    : [];
  const orderMap = new Map(((orders as Row[]) ?? []).map((o) => [o['id'] as string, o['order_number'] as string]));

  return rows.map((r) => ({
    id: r['id'] as string,
    documentNumber: str(r['document_number']),
    status: r['status'] as DeliveryNoteView["status"],
    orderId: r['order_id'] as string,
    orderNumber: orderMap.get(r['order_id'] as string) ?? null,
    fulfillmentId: str(r['fulfillment_id']),
    itemCount: Array.isArray(r['items']) ? (r['items'] as unknown[]).length : 0,
    createdAt: r['created_at'] as string,
    issuedAt: str(r['issued_at']),
  }));
}

/* ───────────────────────── settings & setup ───────────────────────── */

export async function loadSetup(organizationId: string, shopId: string): Promise<DocumentSetup> {
  const admin = await getAdmin();
  const [settings, branding, sequences] = await Promise.all([
    admin.from("invoice_settings").select("*").eq("shop_id", shopId).maybeSingle(),
    admin.from("document_branding").select("*").eq("shop_id", shopId).maybeSingle(),
    admin.from("document_sequences").select("*").eq("shop_id", shopId).order("document_type"),
  ]);
  void organizationId;

  const s = settings.data as Row | null;
  const b = branding.data as Row | null;

  const missing: string[] = [];
  if (!s || !String(s['company_name'] ?? "").trim()) missing.push("company");
  if (!s || !String(s['address_line1'] ?? "").trim() || !String(s['postal_code'] ?? "").trim() || !String(s['city'] ?? "").trim())
    missing.push("address");
  if (!s || (!String(s['tax_number'] ?? "").trim() && !String(s['vat_id'] ?? "").trim())) missing.push("tax");
  if (!((sequences.data ?? []) as Row[]).some((q) => q['document_type'] === "invoice")) missing.push("sequence");

  return {
    settings: s
      ? {
          shopId,
          companyName: str(s['company_name']),
          legalForm: str(s['legal_form']),
          addressLine1: str(s['address_line1']),
          addressLine2: str(s['address_line2']),
          postalCode: str(s['postal_code']),
          city: str(s['city']),
          countryCode: String(s['country_code'] ?? "DE"),
          taxNumber: str(s['tax_number']),
          vatId: str(s['vat_id']),
          registerCourt: str(s['register_court']),
          registerNumber: str(s['register_number']),
          managingDirector: str(s['managing_director']),
          contactEmail: str(s['contact_email']),
          contactPhone: str(s['contact_phone']),
          website: str(s['website']),
          bankAccountHolder: str(s['bank_account_holder']),
          bankIban: str(s['bank_iban']),
          bankBic: str(s['bank_bic']),
          bankName: str(s['bank_name']),
          paymentTermsDays: num(s['payment_terms_days']),
          paymentTermsText: str(s['payment_terms_text']),
          invoiceCreationStrategy: s['invoice_creation_strategy'] as InvoiceSettings["invoiceCreationStrategy"],
          automaticallyCreateInvoice: !!s['automatically_create_invoice'],
          automaticallyIssueInvoice: !!s['automatically_issue_invoice'],
          creditNoteDraftOnRefund: !!s['credit_note_draft_on_refund'],
          einvoiceZugferdEnabled: !!s['einvoice_zugferd_enabled'],
          einvoiceXrechnungEnabled: !!s['einvoice_xrechnung_enabled'],
          leitwegId: str(s['leitweg_id']),
        }
      : null,
    branding: b
      ? {
          shopId,
          preset: String(b['preset'] ?? "clean"),
          logoMediaId: str(b['logo_media_id']),
          primaryColor: String(b['primary_color'] ?? "#1F2937"),
          secondaryColor: str(b['secondary_color']),
          fontFamily: String(b['font_family'] ?? "helvetica"),
          senderBlock: str(b['sender_block']),
          paymentDetails: str(b['payment_details']),
          footerText: str(b['footer_text']),
          legalFooter: str(b['legal_footer']),
          showProductSku: !!b['show_product_sku'],
          showProductImages: !!b['show_product_images'],
          showTaxBreakdown: !!b['show_tax_breakdown'],
          bankDetails: (b['bank_details'] ?? {}) as Record<string, string | number | boolean | null>,
        }
      : null,
    sequences: ((sequences.data ?? []) as Row[]).map((q) => ({
      id: q['id'] as string,
      documentType: q['document_type'] as DocumentSequence["documentType"],
      prefix: String(q['prefix'] ?? ""),
      suffix: str(q['suffix']),
      nextNumber: num(q['next_number']),
      padding: num(q['padding']),
      resetPolicy: q['reset_policy'] as DocumentSequence["resetPolicy"],
      currentPeriod: str(q['current_period']),
      includePeriod: !!q['include_period'],
    })),
    missing,
  };
}

export async function saveInvoiceSettings(input: {
  organizationId: string;
  shopId: string;
  values: Partial<Record<string, unknown>>;
  actorId: string;
}) {
  const admin = await getAdmin();
  const { error } = await admin
    .from("invoice_settings")
    .upsert(
      { organization_id: input.organizationId, shop_id: input.shopId, ...input.values } as never,
      { onConflict: "shop_id" },
    );
  if (error) throw new Error(error.message);
  const { writeAudit } = await import("../core.server");
  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "invoice_settings.updated",
    entityType: "invoice_settings",
    entityId: input.shopId,
  });
  return { ok: true };
}

export async function saveBranding(input: {
  organizationId: string;
  shopId: string;
  values: Partial<Record<string, unknown>>;
  actorId: string;
}) {
  const admin = await getAdmin();
  const { error } = await admin
    .from("document_branding")
    .upsert(
      { organization_id: input.organizationId, shop_id: input.shopId, ...input.values } as never,
      { onConflict: "shop_id" },
    );
  if (error) throw new Error(error.message);
  const { writeAudit } = await import("../core.server");
  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "document_branding.updated",
    entityType: "document_branding",
    entityId: input.shopId,
  });
  return { ok: true };
}

export async function saveSequence(input: {
  organizationId: string;
  shopId: string;
  documentType: string;
  prefix: string;
  suffix: string | null;
  padding: number;
  resetPolicy: string;
  includePeriod: boolean;
  nextNumber?: number | null;
  actorId: string;
}) {
  const admin = await getAdmin();
  const existing = await admin
    .from("document_sequences")
    .select("id, next_number")
    .eq("shop_id", input.shopId)
    .eq("document_type", input.documentType as never)
    .maybeSingle();

  const current = existing.data as Row | null;
  if (current && input.nextNumber != null && input.nextNumber < num(current['next_number'])) {
    throw new Error("Ein Nummernkreis darf nicht rückwärts gesetzt werden.");
  }

  const payload = {
    organization_id: input.organizationId,
    shop_id: input.shopId,
    document_type: input.documentType,
    prefix: input.prefix,
    suffix: input.suffix,
    padding: input.padding,
    reset_policy: input.resetPolicy,
    include_period: input.includePeriod,
    ...(input.nextNumber != null ? { next_number: input.nextNumber } : {}),
  };

  const { error } = await admin
    .from("document_sequences")
    .upsert(payload as never, { onConflict: "shop_id,document_type" });
  if (error) throw new Error(error.message);

  const { writeAudit } = await import("../core.server");
  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "document_sequence.updated",
    entityType: "document_sequence",
    entityId: input.shopId,
    metadata: { documentType: input.documentType },
  });
  return { ok: true };
}

/* ───────────────────────── lifecycle ───────────────────────── */

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const admin = await getAdmin();
  const { data, error } = await admin.rpc(fn as never, args as never);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function createInvoiceFromOrder(input: {
  organizationId: string;
  orderId: string;
  actorId: string;
  idempotencyKey?: string | null;
}) {
  return await rpc<{ invoice_id: string; created: boolean }>("invoice_create_from_order", {
    _org: input.organizationId,
    _order: input.orderId,
    _actor: input.actorId,
    _idem: input.idempotencyKey ?? null,
  });
}

export async function issueInvoice(input: {
  organizationId: string;
  invoiceId: string;
  actorId: string;
  idempotencyKey?: string | null;
}) {
  const result = await rpc<{ invoice_id: string; invoice_number: string; issued: boolean }>("invoice_issue", {
    _org: input.organizationId,
    _invoice: input.invoiceId,
    _actor: input.actorId,
    _idem: input.idempotencyKey ?? null,
  });
  await generateInvoicePdf({ ...input, force: true });
  if (result.issued) await publishInvoiceEvent(input.invoiceId, "invoice.issued");
  return result;
}

export async function voidInvoice(input: {
  organizationId: string;
  invoiceId: string;
  actorId: string;
  reason?: string | null;
}) {
  return await rpc<{ invoice_id: string; deleted: boolean }>("invoice_void", {
    _org: input.organizationId,
    _invoice: input.invoiceId,
    _actor: input.actorId,
    _reason: input.reason ?? null,
  });
}

export async function createCreditNote(input: {
  organizationId: string;
  invoiceId: string;
  amountMinor: number;
  reason?: string | null;
  refundId?: string | null;
  actorId: string;
  idempotencyKey?: string | null;
}) {
  return await rpc<{ credit_note_id: string; total_gross_minor: number }>("credit_note_create", {
    _org: input.organizationId,
    _invoice: input.invoiceId,
    _actor: input.actorId,
    _amount_minor: input.amountMinor,
    _reason: input.reason ?? null,
    _refund: input.refundId ?? null,
    _idem: input.idempotencyKey ?? null,
  });
}

export async function issueCreditNote(input: {
  organizationId: string;
  creditNoteId: string;
  actorId: string;
  idempotencyKey?: string | null;
}) {
  const result = await rpc<{ credit_note_id: string; credit_note_number: string; issued: boolean }>(
    "credit_note_issue",
    {
      _org: input.organizationId,
      _credit_note: input.creditNoteId,
      _actor: input.actorId,
      _idem: input.idempotencyKey ?? null,
    },
  );
  await generateCreditNotePdf(input);
  return result;
}

export async function createDeliveryNote(input: {
  organizationId: string;
  fulfillmentId: string;
  actorId: string;
  notes?: string | null;
  idempotencyKey?: string | null;
}) {
  const result = await rpc<{ delivery_note_id: string; document_number: string }>("delivery_note_create", {
    _org: input.organizationId,
    _fulfillment: input.fulfillmentId,
    _actor: input.actorId,
    _notes: input.notes ?? null,
    _idem: input.idempotencyKey ?? null,
  });
  await generateDeliveryNotePdf({
    organizationId: input.organizationId,
    deliveryNoteId: result.delivery_note_id,
    actorId: input.actorId,
  });
  return result;
}

/* ───────────────────────── PDF generation ───────────────────────── */

async function sha256(bytes: Uint8Array) {
  const buffer = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function storeFile(input: {
  organizationId: string;
  shopId: string;
  documentType: string;
  documentId: string;
  number: string;
  bytes: Uint8Array;
  actorId: string;
}) {
  const admin = await getAdmin();
  const { data: existing } = await admin
    .from("document_files")
    .select("version")
    .eq("document_id", input.documentId)
    .eq("format", "pdf")
    .order("version", { ascending: false })
    .limit(1);
  const version = ((existing ?? []) as Row[]).length ? num(((existing ?? []) as Row[])[0]!['version']) + 1 : 1;

  const safeNumber = input.number.replace(/[^A-Za-z0-9._-]/g, "_");
  const path = `${input.organizationId}/${input.documentType}/${input.documentId}/${safeNumber}-v${version}.pdf`;

  const upload = await admin.storage
    .from("documents")
    .upload(path, input.bytes as unknown as ArrayBuffer, { contentType: "application/pdf", upsert: true });
  if (upload.error) throw new Error(upload.error.message);

  const { error } = await admin.from("document_files").insert({
    organization_id: input.organizationId,
    shop_id: input.shopId,
    document_type: input.documentType,
    document_id: input.documentId,
    format: "pdf",
    status: "generated",
    version,
    renderer_version: DOCUMENT_RENDERER_VERSION,
    storage_path: path,
    mime_type: "application/pdf",
    file_size: input.bytes.byteLength,
    checksum: await sha256(input.bytes),
    created_by: input.actorId,
  } as never);
  if (error) throw new Error(error.message);
  return { path, version };
}

export async function generateInvoicePdf(input: {
  organizationId: string;
  invoiceId: string;
  actorId: string;
  force?: boolean;
}) {
  const invoice = await loadInvoice(input.organizationId, input.invoiceId);
  if (!input.force && invoice.files.some((f) => f.format === "pdf")) {
    return { path: invoice.files.find((f) => f.format === "pdf")!.storagePath!, version: invoice.files[0]!.version };
  }
  const { invoiceToRenderable } = await import("./document.viewmodel");
  const { renderDocumentPdf } = await import("./pdf.server");
  const bytes = await renderDocumentPdf(invoiceToRenderable(invoice));
  return await storeFile({
    organizationId: input.organizationId,
    shopId: invoice.shopId,
    documentType: "invoice",
    documentId: invoice.id,
    number: invoice.invoiceNumber ?? `entwurf-${invoice.id.slice(0, 8)}`,
    bytes,
    actorId: input.actorId,
  });
}

export async function generateCreditNotePdf(input: {
  organizationId: string;
  creditNoteId: string;
  actorId: string;
}) {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("credit_notes")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("id", input.creditNoteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Gutschrift nicht gefunden.");
  const row = data as Row;
  const items = (await admin.from("credit_note_items").select("*").eq("credit_note_id", input.creditNoteId).order("position"))
    .data ?? [];
  const invoice = await loadInvoice(input.organizationId, row['invoice_id'] as string);

  const { creditNoteToRenderable } = await import("./document.viewmodel");
  const { renderDocumentPdf } = await import("./pdf.server");
  const view = mapCreditNote(row, items as Row[]);
  const bytes = await renderDocumentPdf(creditNoteToRenderable(view, invoice));
  return await storeFile({
    organizationId: input.organizationId,
    shopId: row['shop_id'] as string,
    documentType: "credit_note",
    documentId: input.creditNoteId,
    number: view.creditNoteNumber ?? `entwurf-${input.creditNoteId.slice(0, 8)}`,
    bytes,
    actorId: input.actorId,
  });
}

export async function generateDeliveryNotePdf(input: {
  organizationId: string;
  deliveryNoteId: string;
  actorId: string;
}) {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("delivery_notes")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("id", input.deliveryNoteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lieferschein nicht gefunden.");
  const row = data as Row;
  const orderNumber =
    ((row['metadata'] ?? {}) as Record<string, unknown>)['order_number'] as string | undefined;

  const { deliveryNoteToRenderable } = await import("./document.viewmodel");
  const { renderDocumentPdf } = await import("./pdf.server");
  const bytes = await renderDocumentPdf(
    deliveryNoteToRenderable({
      note: {
        id: row['id'] as string,
        documentNumber: str(row['document_number']),
        status: row['status'] as DeliveryNoteView["status"],
        orderId: row['order_id'] as string,
        orderNumber: orderNumber ?? null,
        fulfillmentId: str(row['fulfillment_id']),
        itemCount: Array.isArray(row['items']) ? (row['items'] as unknown[]).length : 0,
        createdAt: row['created_at'] as string,
        issuedAt: str(row['issued_at']),
      },
      recipient: (row['recipient_snapshot'] ?? {}) as DocumentAddress,
      seller: (row['seller_snapshot'] ?? {}) as never,
      branding: (row['branding_snapshot'] ?? {}) as never,
      items: (Array.isArray(row['items']) ? (row['items'] as Row[]) : []).map((i) => ({
        productName: String(i['productName'] ?? ""),
        variantName: str(i['variantName']),
        sku: str(i['sku']),
        quantity: num(i['quantity']),
      })),
      notes: str(row['notes']),
    }),
  );

  return await storeFile({
    organizationId: input.organizationId,
    shopId: row['shop_id'] as string,
    documentType: "delivery_note",
    documentId: input.deliveryNoteId,
    number: str(row['document_number']) ?? `ls-${input.deliveryNoteId.slice(0, 8)}`,
    bytes,
    actorId: input.actorId,
  });
}

export async function signDocumentFile(organizationId: string, documentId: string) {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("document_files")
    .select("storage_path")
    .eq("organization_id", organizationId)
    .eq("document_id", documentId)
    .eq("format", "pdf")
    .order("version", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const path = ((data ?? []) as Row[])[0]?.['storage_path'] as string | undefined;
  if (!path) return { url: null };
  const signed = await admin.storage.from("documents").createSignedUrl(path, 300);
  if (signed.error) throw new Error(signed.error.message);
  return { url: signed.data?.signedUrl ?? null };
}

export { mapCreditNote };
