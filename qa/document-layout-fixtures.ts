import type {
  RenderableDocument,
  DocumentLine,
} from "../src/lib/commerce/documents/document.types";
export const fixtureLine = (position = 1): DocumentLine => ({
  position,
  itemType: "product",
  productName: "Keramikbecher Atelier – handgefertigt, sandfarben",
  variantName: "350 ml",
  sku: "EYIS-TEST-350",
  description: "Synthetischer Prüfdatenbestand. Kein echter Verkauf.",
  quantity: 2,
  unitNetMinor: 2490,
  discountMinor: 0,
  lineNetMinor: 4980,
  taxRateBasisPoints: 1900,
  taxReasonCode: "standard_rate",
  taxMinor: 946,
  lineGrossMinor: 5926,
});
export function invoiceFixture(): RenderableDocument {
  return {
    kind: "invoice",
    title: "Rechnung",
    number: "TEST-2026-000042",
    isDraft: true,
    issueDate: "2026-09-17",
    serviceDate: "2026-09-17",
    dueDate: "2026-10-01",
    currencyCode: "EUR",
    seller: {
      company_name: "Atelier Musterhandel GmbH",
      address_line1: "Musterstraße 12",
      postal_code: "10115",
      city: "Berlin",
      country_code: "DE",
      contact_email: "service@example.test",
      website: "https://example.test",
      tax_number: "TEST – keine gültige Steuernummer",
      vat_id: "DE-TEST",
      register_court: "Testregister Berlin",
      register_number: "TEST-42",
      managing_director: "Erika Beispiel",
      bank_name: "Musterbank – Testdaten",
      bank_iban: "TEST-IBAN – keine Zahlung",
      bank_bic: "TESTBIC",
    },
    branding: {
      primary_color: "#263E46",
      sender_block: "Atelier Musterhandel GmbH · Musterstraße 12 · 10115 Berlin",
      legal_footer:
        "Dieses Dokument dient ausschließlich der lokalen Layoutprüfung und ist keine gültige Rechnung.",
    },
    recipient: {
      company: "Beispielunternehmen mit einer besonders langen Firmenbezeichnung GmbH",
      firstName: "Max",
      lastName: "Mustermann",
      street: "Beispielweg 45",
      postalCode: "20095",
      city: "Hamburg",
      countryCode: "DE",
    },
    recipientVatId: null,
    reference: [{ label: "Bestellung", value: "TEST-ORDER-42" }],
    lines: [fixtureLine()],
    showAmounts: true,
    totals: {
      netMinor: 5470,
      taxMinor: 1039,
      grossMinor: 6509,
      discountMinor: 0,
      shippingNetMinor: 490,
    },
    taxRows: [
      {
        rateBasisPoints: 1900,
        netMinor: 5470,
        taxMinor: 1039,
        grossMinor: 6509,
        reasonCode: "standard_rate",
      },
    ],
    taxNotes: [],
    paymentTerms:
      "Zahlbar innerhalb von 14 Tagen. Bitte die Rechnungsnummer als Verwendungszweck angeben.",
    notes: "Vielen Dank für Ihren Einkauf.",
  };
}
export function stressFixture(): RenderableDocument {
  const doc = invoiceFixture();
  doc.number = "TEST-LANG-000043";
  doc.lines = Array.from({ length: 35 }, (_, i) => ({
    ...fixtureLine(i + 1),
    productName:
      i % 3 === 0
        ? "Produkt mit einer sehr langen vollständigen Bezeichnung, die in mehreren Zeilen lesbar bleiben muss"
        : fixtureLine().productName,
    sku: i === 0 ? "SKU".repeat(65) : `TEST-${i}`,
    description: i === 4 ? "Langer Positionstext. ".repeat(230) : fixtureLine().description,
    quantity: 123.456,
    unitNetMinor: 123456789,
    lineNetMinor: 987654321,
    taxRateBasisPoints: 1900,
  }));
  doc.notes = "Hinweis über mehrere Seiten: ".repeat(180);
  return doc;
}
