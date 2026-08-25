/* Phase 8 acceptance run: settings → invoice → issue → PDF → credit note → delivery note. */
import { admin, check, expectThrow, summary } from "./lib";
import {
  loadSetup,
  saveInvoiceSettings,
  saveSequence,
  createInvoiceFromOrder,
  issueInvoice,
  loadInvoice,
  createCreditNote,
  issueCreditNote,
  voidInvoice,
  createDeliveryNote,
  signDocumentFile,
  generateInvoicePdf,
} from "../src/lib/commerce/documents/document.server";

const ORG = "ba039523-f8ec-44ff-bb9d-2b5b86b0c0a6";
const ORG_B = "29cb83d1-2f6a-42ff-8bb5-413463402b07";
const SHOP = "a9751182-2f3a-4f9a-a2e6-73b6ffd48974";
const ACTOR = "0e0aa7a8-7f55-4474-96dc-542f438b16ee";
const ORDER = process.env['QA_ORDER_ID'] ?? "435b4193-5ac7-45d7-a596-380640f25291";

/* ── clean slate ─────────────────────────────────────────────── */
const { data: prior } = await admin.from("invoices").select("id").eq("order_id", ORDER);
for (const row of (prior ?? []) as { id: string }[]) {
  await admin.from("credit_note_items").delete().eq("credit_note_id", row.id);
  await admin.from("credit_notes").delete().eq("invoice_id", row.id);
  await admin.from("document_files").delete().eq("document_id", row.id);
  await admin.rpc("invoice_void" as never, {
    _org: ORG, _invoice: row.id, _actor: ACTOR, _reason: "qa-reset",
  } as never);
  await admin.from("invoices").delete().eq("id", row.id).eq("status", "voided");
}
await admin.from("idempotency_keys").delete().eq("organization_id", ORG).like("key", "qa8:%");

/* ── 1. setup guard ──────────────────────────────────────────── */
await admin.from("invoice_settings").delete().eq("shop_id", SHOP);
await expectThrow(
  "Rechnung ohne Unternehmensdaten abgelehnt",
  () => createInvoiceFromOrder({ organizationId: ORG, orderId: ORDER, actorId: ACTOR }),
  /unvollständig/i,
);

await saveInvoiceSettings({
  organizationId: ORG,
  shopId: SHOP,
  actorId: ACTOR,
  values: {
    company_name: "Muster Handel GmbH",
    legal_form: "GmbH",
    address_line1: "Musterstraße 1",
    postal_code: "10115",
    city: "Berlin",
    country_code: "DE",
    tax_number: "30/123/45678",
    vat_id: "DE123456789",
    managing_director: "Erika Mustermann",
    register_court: "Amtsgericht Berlin",
    register_number: "HRB 12345",
    contact_email: "rechnung@muster.example",
    bank_name: "Musterbank",
    bank_iban: "DE02120300000000202051",
    bank_bic: "BYLADEM1001",
    payment_terms_days: 14,
  },
});
await saveSequence({
  organizationId: ORG,
  shopId: SHOP,
  actorId: ACTOR,
  documentType: "invoice",
  prefix: "RE",
  suffix: null,
  padding: 5,
  resetPolicy: "yearly",
  includePeriod: true,
});
const setup = await loadSetup(ORG, SHOP);
check("Setup vollständig", setup.missing.length === 0, setup.missing.join(","));

await expectThrow(
  "Nummernkreis kann nicht rückwärts gesetzt werden",
  () =>
    saveSequence({
      organizationId: ORG, shopId: SHOP, actorId: ACTOR, documentType: "invoice",
      prefix: "RE", suffix: null, padding: 5, resetPolicy: "yearly",
      includePeriod: true, nextNumber: 0,
    }),
  /rückwärts/i,
);

/* ── 2. draft ────────────────────────────────────────────────── */
const created = await createInvoiceFromOrder({
  organizationId: ORG, orderId: ORDER, actorId: ACTOR, idempotencyKey: "qa8:create",
});
check("Rechnungsentwurf erstellt", created.created === true, created.invoice_id);

const again = await createInvoiceFromOrder({
  organizationId: ORG, orderId: ORDER, actorId: ACTOR, idempotencyKey: "qa8:create",
});
check("Keine Doppelrechnung", again.invoice_id === created.invoice_id);

const draft = await loadInvoice(ORG, created.invoice_id);
check("Entwurf ohne Nummer", draft.invoiceNumber === null && draft.status === "draft");
check("Positionen übernommen", draft.items.length > 0, String(draft.items.length));

const { data: order } = await admin
  .from("orders").select("total_minor, gross_total_minor").eq("id", ORDER).maybeSingle();
const orderGross = Number((order as { gross_total_minor: number; total_minor: number }).gross_total_minor) ||
  Number((order as { total_minor: number }).total_minor);
check("Bruttosumme = Bestellsumme", draft.totalGrossMinor === orderGross,
  `${draft.totalGrossMinor} vs ${orderGross}`);
const lineSum = draft.items.reduce((s, i) => s + i.lineNetMinor, 0) + draft.taxTotalMinor;
check("Positionen + Steuer = Brutto", lineSum === draft.totalGrossMinor, `${lineSum}`);

await expectThrow(
  "Gutschrift auf Entwurf abgelehnt",
  () => createCreditNote({ organizationId: ORG, invoiceId: draft.id, amountMinor: 100, actorId: ACTOR }),
  /ausgestellte Rechnungen/i,
);

/* ── 3. issue ────────────────────────────────────────────────── */
const issued = await issueInvoice({
  organizationId: ORG, invoiceId: draft.id, actorId: ACTOR, idempotencyKey: "qa8:issue",
});
check("Rechnung ausgestellt", issued.issued === true, issued.invoice_number);
check("Nummernformat", /^RE-\d{4}-\d{5}$/.test(issued.invoice_number), issued.invoice_number);

const issuedTwice = await issueInvoice({
  organizationId: ORG, invoiceId: draft.id, actorId: ACTOR, idempotencyKey: "qa8:issue",
});
check("Ausstellen ist idempotent", issuedTwice.invoice_number === issued.invoice_number);

const inv = await loadInvoice(ORG, draft.id);
check("Rechnungsdatum gesetzt", !!inv.issueDate && !!inv.dueDate, `${inv.issueDate} / ${inv.dueDate}`);
check("Verkäuferdaten eingefroren", inv.seller.company_name === "Muster Handel GmbH");
check("PDF erzeugt", inv.files.some((f) => f.format === "pdf" && (f.fileSize ?? 0) > 1000),
  String(inv.files[0]?.fileSize));
check("Prüfsumme gespeichert", (inv.files[0]?.checksum ?? "").length === 64);

/* ── 4. immutability ─────────────────────────────────────────── */
const numberEdit = await admin.from("invoices").update({ invoice_number: "RE-HACK" }).eq("id", inv.id);
check("Nummer nach Ausstellung unveränderbar", !!numberEdit.error, numberEdit.error?.message ?? "");
const totalEdit = await admin.from("invoices").update({ total_gross_minor: 1 }).eq("id", inv.id);
check("Betrag nach Ausstellung unveränderbar", !!totalEdit.error, totalEdit.error?.message ?? "");
const itemEdit = await admin.from("invoice_items").update({ line_net_minor: 1 }).eq("invoice_id", inv.id);
check("Positionen unveränderbar", !!itemEdit.error, itemEdit.error?.message ?? "");
const del = await admin.from("invoices").delete().eq("id", inv.id);
check("Ausgestellte Rechnung nicht löschbar", !!del.error, del.error?.message ?? "");
const fileEdit = await admin.from("document_files").update({ checksum: "x" }).eq("document_id", inv.id);
check("Dokumentdatei unveränderbar", !!fileEdit.error, fileEdit.error?.message ?? "");

/* ── 5. credit notes ─────────────────────────────────────────── */
await expectThrow(
  "Gutschrift über Rechnungsbetrag abgelehnt",
  () => createCreditNote({
    organizationId: ORG, invoiceId: inv.id, amountMinor: inv.totalGrossMinor + 1, actorId: ACTOR,
  }),
  /Maximal/i,
);

const partial = Math.floor(inv.totalGrossMinor / 2);
const cn = await createCreditNote({
  organizationId: ORG, invoiceId: inv.id, amountMinor: partial,
  reason: "Teilretoure", actorId: ACTOR, idempotencyKey: "qa8:cn1",
});
check("Gutschriftbetrag exakt", cn.total_gross_minor === partial, `${cn.total_gross_minor}`);
const cnIssued = await issueCreditNote({ organizationId: ORG, creditNoteId: cn.credit_note_id, actorId: ACTOR });
check("Gutschriftnummer vergeben", /^GS-\d{4}-\d{6}$/.test(cnIssued.credit_note_number), cnIssued.credit_note_number);

const afterCredit = await loadInvoice(ORG, inv.id);
check("Rechnung teilweise gutgeschrieben", afterCredit.status === "partially_credited", afterCredit.status);
check("Restbetrag korrekt", afterCredit.creditableMinor === inv.totalGrossMinor - partial,
  String(afterCredit.creditableMinor));
check("Gutschrift-PDF erzeugt",
  (await admin.from("document_files").select("id").eq("document_id", cn.credit_note_id)).data?.length === 1);

await expectThrow(
  "Stornieren nach Gutschrift abgelehnt",
  () => voidInvoice({ organizationId: ORG, invoiceId: inv.id, actorId: ACTOR, reason: "test" }),
  /Gutschriften/i,
);

const rest = await createCreditNote({
  organizationId: ORG, invoiceId: inv.id, amountMinor: afterCredit.creditableMinor,
  reason: "Restgutschrift", actorId: ACTOR,
});
await issueCreditNote({ organizationId: ORG, creditNoteId: rest.credit_note_id, actorId: ACTOR });
const fullyCredited = await loadInvoice(ORG, inv.id);
check("Rechnung vollständig gutgeschrieben", fullyCredited.status === "credited", fullyCredited.status);
await expectThrow(
  "Keine Gutschrift über Restbetrag hinaus",
  () => createCreditNote({ organizationId: ORG, invoiceId: inv.id, amountMinor: 100, actorId: ACTOR }),
  /ausgestellte Rechnungen|Maximal/i,
);

/* ── 6. tenant isolation ─────────────────────────────────────── */
await expectThrow(
  "Fremde Organisation sieht Rechnung nicht",
  () => loadInvoice(ORG_B, inv.id),
  /nicht gefunden/i,
);
await expectThrow(
  "Fremde Organisation kann nicht ausstellen",
  () => issueInvoice({ organizationId: ORG_B, invoiceId: inv.id, actorId: ACTOR }),
  /Berechtigung|nicht gefunden/i,
);

/* ── 7. delivery note ────────────────────────────────────────── */
const { data: ful } = await admin
  .from("fulfillments").select("id").eq("organization_id", ORG).limit(1).maybeSingle();
if (ful) {
  const dn = await createDeliveryNote({
    organizationId: ORG, fulfillmentId: (ful as { id: string }).id, actorId: ACTOR,
    notes: "QA", idempotencyKey: "qa8:dn",
  });
  check("Lieferschein erstellt", /^LS-\d{4}-\d{6}$/.test(dn.document_number), dn.document_number);
  const dnFiles = await admin.from("document_files").select("file_size").eq("document_id", dn.delivery_note_id);
  check("Lieferschein-PDF erzeugt", (dnFiles.data?.[0] as { file_size: number } | undefined)?.file_size! > 800);
  const dnAgain = await createDeliveryNote({
    organizationId: ORG, fulfillmentId: (ful as { id: string }).id, actorId: ACTOR, idempotencyKey: "qa8:dn",
  });
  check("Lieferschein idempotent", dnAgain.delivery_note_id === dn.delivery_note_id);
} else {
  check("Lieferschein erstellt", false, "kein Fulfillment vorhanden");
}

/* ── 8. files ────────────────────────────────────────────────── */
const regenerated = await generateInvoicePdf({ organizationId: ORG, invoiceId: inv.id, actorId: ACTOR, force: true });
check("Neue PDF-Version", regenerated.version >= 2, String(regenerated.version));
const signed = await signDocumentFile(ORG, inv.id);
check("Signierte URL erzeugt", !!signed.url?.startsWith("http"));
const foreign = await signDocumentFile(ORG_B, inv.id);
check("Fremde Organisation erhält keine Datei-URL", foreign.url === null);

summary();
