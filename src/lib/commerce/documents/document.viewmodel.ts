/**
 * Pure mapping from stored documents to the renderable view model.
 * No IO, no framework imports — safe to unit test and to import anywhere.
 */
import type {
  CreditNoteView,
  DeliveryNoteView,
  DocumentAddress,
  DocumentLine,
  InvoiceView,
  RenderableDocument,
} from "./document.types";

export const TAX_NOTE_BY_REASON: Record<string, string> = {
  reverse_charge:
    "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, Art. 196 MwStSystRL).",
  small_business_exemption:
    "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).",
  zero_rate: "Steuerfreie Lieferung.",
  oss_destination_rate:
    "Besteuerung im Bestimmungsland (One-Stop-Shop-Verfahren).",
};

export function formatAddressLines(a: DocumentAddress): string[] {
  const name = `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim();
  return [
    a.company ?? "",
    name,
    a.street ?? "",
    a.street2 ?? "",
    `${a.postalCode ?? ""} ${a.city ?? ""}`.trim(),
    a.countryCode ?? "",
  ].filter((l) => l.trim().length > 0);
}

export function taxNotesFor(lines: { taxReasonCode: string }[]): string[] {
  const seen = new Set<string>();
  const notes: string[] = [];
  for (const line of lines) {
    const note = TAX_NOTE_BY_REASON[line.taxReasonCode];
    if (note && !seen.has(line.taxReasonCode)) {
      seen.add(line.taxReasonCode);
      notes.push(note);
    }
  }
  return notes;
}

export function invoiceToRenderable(inv: InvoiceView): RenderableDocument {
  const reference: { label: string; value: string }[] = [];
  if (inv.orderNumber) reference.push({ label: "Bestellnummer", value: inv.orderNumber });
  if (inv.customerEmail) reference.push({ label: "E-Mail", value: inv.customerEmail });
  if (inv.customerVatId) reference.push({ label: "USt-IdNr. Kunde", value: inv.customerVatId });

  return {
    kind: "invoice",
    title: inv.status === "draft" ? "Rechnungsentwurf" : "Rechnung",
    number: inv.invoiceNumber ?? "ENTWURF",
    isDraft: inv.status === "draft",
    issueDate: inv.issueDate,
    serviceDate: inv.serviceDate,
    dueDate: inv.dueDate,
    currencyCode: inv.currencyCode,
    seller: inv.seller,
    branding: inv.branding,
    recipient: inv.billingAddress,
    recipientVatId: inv.customerVatId,
    reference,
    lines: inv.items,
    showAmounts: true,
    totals: {
      netMinor: inv.subtotalNetMinor + inv.shippingNetMinor,
      taxMinor: inv.taxTotalMinor,
      grossMinor: inv.totalGrossMinor,
      discountMinor: inv.discountMinor,
      shippingNetMinor: inv.shippingNetMinor,
    },
    taxRows: inv.taxBreakdown,
    taxNotes: taxNotesFor(inv.items),
    paymentTerms: inv.paymentTerms,
    notes: inv.notes,
  };
}

export function creditNoteToRenderable(
  cn: CreditNoteView,
  inv: InvoiceView,
): RenderableDocument {
  const reference: { label: string; value: string }[] = [];
  if (inv.invoiceNumber) reference.push({ label: "Rechnungsnummer", value: inv.invoiceNumber });
  if (inv.orderNumber) reference.push({ label: "Bestellnummer", value: inv.orderNumber });
  if (cn.reason) reference.push({ label: "Grund", value: cn.reason });

  return {
    kind: "credit_note",
    title: cn.status === "draft" ? "Gutschriftentwurf" : "Gutschrift",
    number: cn.creditNoteNumber ?? "ENTWURF",
    isDraft: cn.status === "draft",
    issueDate: cn.issuedAt ? cn.issuedAt.slice(0, 10) : null,
    serviceDate: inv.serviceDate,
    dueDate: null,
    currencyCode: cn.currencyCode,
    seller: inv.seller,
    branding: inv.branding,
    recipient: inv.billingAddress,
    recipientVatId: inv.customerVatId,
    reference,
    lines: cn.items,
    showAmounts: true,
    totals: {
      netMinor: cn.subtotalNetMinor,
      taxMinor: cn.taxTotalMinor,
      grossMinor: cn.totalGrossMinor,
      discountMinor: 0,
      shippingNetMinor: 0,
    },
    taxRows: cn.taxBreakdown,
    taxNotes: taxNotesFor(cn.items),
    paymentTerms: "Der Betrag wird auf dem ursprünglichen Zahlweg erstattet.",
    notes: null,
  };
}

export function deliveryNoteToRenderable(input: {
  note: DeliveryNoteView;
  recipient: DocumentAddress;
  seller: RenderableDocument["seller"];
  branding: RenderableDocument["branding"];
  items: { productName: string; variantName: string | null; sku: string | null; quantity: number }[];
  notes: string | null;
}): RenderableDocument {
  const lines: DocumentLine[] = input.items.map((i, idx) => ({
    position: idx + 1,
    itemType: "product",
    productName: i.productName,
    variantName: i.variantName,
    sku: i.sku,
    description: null,
    quantity: i.quantity,
    unitNetMinor: 0,
    discountMinor: 0,
    lineNetMinor: 0,
    taxRateBasisPoints: 0,
    taxReasonCode: "standard_rate",
    taxMinor: 0,
    lineGrossMinor: 0,
  }));

  const reference: { label: string; value: string }[] = [];
  if (input.note.orderNumber) reference.push({ label: "Bestellnummer", value: input.note.orderNumber });

  return {
    kind: "delivery_note",
    title: "Lieferschein",
    number: input.note.documentNumber ?? "ENTWURF",
    isDraft: input.note.status === "draft",
    issueDate: input.note.issuedAt ? input.note.issuedAt.slice(0, 10) : null,
    serviceDate: null,
    dueDate: null,
    currencyCode: "EUR",
    seller: input.seller,
    branding: input.branding,
    recipient: input.recipient,
    recipientVatId: null,
    reference,
    lines,
    showAmounts: false,
    totals: { netMinor: 0, taxMinor: 0, grossMinor: 0, discountMinor: 0, shippingNetMinor: 0 },
    taxRows: [],
    taxNotes: [],
    paymentTerms: null,
    notes: input.notes,
  };
}
