/** Server-only, measured A4 layout for invoices, credit notes and delivery notes. */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { DOCUMENT_RENDERER_VERSION, type RenderableDocument } from "./document.types";
import { formatAddressLines } from "./document.viewmodel";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const RIGHT = A4[0] - MARGIN;
const WIDTH = RIGHT - MARGIN;
const INK = rgb(0.12, 0.14, 0.17);
const MUTED = rgb(0.38, 0.41, 0.45);
const RULE = rgb(0.86, 0.88, 0.9);

/** Useful for geometric QA without inspecting compressed PDF internals. */
export type DocumentTextPlacement = {
  page: number;
  text: string;
  x: number;
  y: number;
  width: number;
  size: number;
  region: string;
};

function safe(value: string) {
  return (value ?? "")
    .replace(/€/g, "EUR")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");
}
function accent(hex: string | null | undefined) {
  const source = /^#[\da-f]{6}$/i.test(hex ?? "") ? hex! : "#243746";
  const n = Number.parseInt(source.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
function money(minor: number, currency: string, includeCurrency = false) {
  const value = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
  return includeCurrency ? `${value} ${currency}` : value;
}
function date(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : new Intl.DateTimeFormat("de-DE", { timeZone: "UTC" }).format(d);
}
function rate(value: number) {
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value / 100)} %`;
}

/** Preserves paragraphs and splits long SKUs/URLs instead of overflowing a cell. */
export function wrapDocumentText(
  value: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  const out: string[] = [];
  for (const paragraph of safe(value).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && font.widthOfTextAtSize(`${line} ${word}`, size) <= width) {
        line += ` ${word}`;
        continue;
      }
      if (line) {
        out.push(line);
        line = "";
      }
      for (const character of word) {
        if (line && font.widthOfTextAtSize(line + character, size) > width) {
          out.push(line);
          line = "";
        }
        line += character;
      }
    }
    out.push(line);
  }
  return out.length ? out : [""];
}

export async function renderDocumentPdf(
  doc: RenderableDocument,
  options?: { onText?: (placement: DocumentTextPlacement) => void },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const color = accent(doc.branding.primary_color);
  pdf.setTitle(safe(`${doc.title} ${doc.number}`));
  pdf.setProducer("EYIS");
  pdf.setCreator(`EYIS ${DOCUMENT_RENDERER_VERSION}`);
  const pages: PDFPage[] = [];
  const seller = doc.seller;
  const footerColumns = [
    [
      seller.company_name,
      [seller.address_line1, seller.address_line2].filter(Boolean).join(", "),
      `${seller.postal_code ?? ""} ${seller.city ?? ""}`.trim(),
      seller.managing_director ? `Geschäftsführung: ${seller.managing_director}` : "",
    ],
    [
      seller.tax_number ? `Steuernummer: ${seller.tax_number}` : "",
      seller.vat_id ? `USt-IdNr.: ${seller.vat_id}` : "",
      [seller.register_court, seller.register_number].filter(Boolean).join(" "),
    ],
    [
      seller.bank_name,
      seller.bank_account_holder ? `Kontoinhaber: ${seller.bank_account_holder}` : "",
      seller.bank_iban ? `IBAN: ${seller.bank_iban}` : "",
      seller.bank_bic ? `BIC: ${seller.bank_bic}` : "",
    ],
  ].map((col) =>
    col
      .filter((v): v is string => Boolean(v))
      .flatMap((v) => wrapDocumentText(v, regular, 7, WIDTH / 3 - 14)),
  );
  // Exceptionally long legal company details continue in the document body, never disappear.
  const footerLines = footerColumns.map((col) => col.slice(0, 7));
  const extraFooter = footerColumns.flatMap((col) => col.slice(7));
  const footerHeight = Math.max(3, ...footerLines.map((col) => col.length)) * 9 + 34;
  const bottom = 30 + footerHeight;
  let page: PDFPage;
  let y = A4[1] - MARGIN;

  const draw = (
    value: string,
    x: number,
    baseline: number,
    width: number,
    opts: { font?: PDFFont; size?: number; right?: boolean; muted?: boolean; region?: string } = {},
  ) => {
    const font = opts.font ?? regular;
    const valueSafe = safe(value);
    let size = opts.size ?? 9;
    // Numbers stay on one line, contained inside their own column.
    while (font.widthOfTextAtSize(valueSafe, size) > width && size > 5) size -= 0.2;
    const measured = font.widthOfTextAtSize(valueSafe, size);
    const dx = opts.right ? x + width - measured : x;
    page.drawText(valueSafe, { x: dx, y: baseline, size, font, color: opts.muted ? MUTED : INK });
    options?.onText?.({
      page: pages.indexOf(page) + 1,
      text: valueSafe,
      x: dx,
      y: baseline,
      width: measured,
      size,
      region: opts.region ?? "body",
    });
  };
  const line = (baseline: number, from = MARGIN, to = RIGHT, strong = false) =>
    page.drawLine({
      start: { x: from, y: baseline },
      end: { x: to, y: baseline },
      thickness: strong ? 1 : 0.5,
      color: strong ? color : RULE,
    });
  const startPage = (continuation = true) => {
    page = pdf.addPage(A4);
    pages.push(page);
    y = A4[1] - MARGIN;
    if (continuation) {
      draw(`${doc.title} ${doc.number}`, MARGIN, y, WIDTH - 100, { font: bold, size: 10 });
      draw("Fortsetzung", RIGHT - 90, y, 90, { right: true, muted: true, size: 8 });
      line(y - 12);
      y -= 38;
    }
  };
  const ensure = (height: number) => {
    if (y - height < bottom) startPage();
  };
  const paragraph = (value: string, size = 9, muted = false) => {
    for (const valueLine of wrapDocumentText(value, regular, size, WIDTH)) {
      ensure(size + 7);
      draw(valueLine, MARGIN, y, WIDTH, { size, muted });
      y -= size + 4;
    }
    y -= 8;
  };
  startPage(false);
  page!.drawRectangle({ x: MARGIN, y: A4[1] - 29, width: 34, height: 3, color });
  const leftWidth = 230;
  for (const name of wrapDocumentText(seller.company_name ?? "", bold, 17, leftWidth)) {
    draw(name, MARGIN, y, leftWidth, { font: bold, size: 17 });
    y -= 21;
  }
  y -= 4;
  const sellerContact = [
    [seller.address_line1, seller.address_line2].filter(Boolean).join(", "),
    `${seller.postal_code ?? ""} ${seller.city ?? ""}`.trim(),
    seller.country_code,
    seller.contact_email,
    seller.website,
  ].filter((v): v is string => Boolean(v));
  for (const value of sellerContact.flatMap((v) => wrapDocumentText(v, regular, 8.5, leftWidth))) {
    draw(value, MARGIN, y, leftWidth, { size: 8.5, muted: true });
    y -= 12;
  }
  let ry = A4[1] - MARGIN;
  const rx = MARGIN + 260,
    rw = WIDTH - 260;
  const rightBlock = (value: string, size = 9, strong = false) => {
    for (const text of wrapDocumentText(value, strong ? bold : regular, size, rw)) {
      draw(text, rx, ry, rw, { size, font: strong ? bold : regular, right: true, muted: !strong });
      ry -= size + 5;
    }
  };
  rightBlock(doc.title, 21, true);
  ry -= 3;
  rightBlock(doc.number, 11, true);
  ry -= 8;
  if (doc.issueDate) rightBlock(`Rechnungsdatum: ${date(doc.issueDate)}`);
  if (doc.serviceDate) rightBlock(`Leistungsdatum: ${date(doc.serviceDate)}`);
  if (doc.dueDate) rightBlock(`Fällig am: ${date(doc.dueDate)}`);
  for (const ref of doc.reference) rightBlock(`${ref.label}: ${ref.value}`);
  y = Math.min(y, ry) - 26;
  if (doc.branding.sender_block) paragraph(doc.branding.sender_block, 7.5, true);
  draw(doc.kind === "delivery_note" ? "LIEFERANSCHRIFT" : "RECHNUNGSANSCHRIFT", MARGIN, y, WIDTH, {
    font: bold,
    size: 7.5,
    muted: true,
  });
  y -= 17;
  for (const value of formatAddressLines(doc.recipient).flatMap((v) =>
    wrapDocumentText(v, regular, 10, WIDTH),
  )) {
    ensure(16);
    draw(value, MARGIN, y, WIDTH, { size: 10 });
    y -= 14;
  }
  if (doc.recipientVatId) {
    draw(`USt-IdNr.: ${doc.recipientVatId}`, MARGIN, y - 2, WIDTH, { size: 8, muted: true });
    y -= 16;
  }
  y -= 24;
  if (doc.isDraft) {
    ensure(38);
    page!.drawRectangle({
      x: MARGIN,
      y: y - 8,
      width: WIDTH,
      height: 28,
      color: rgb(1, 0.96, 0.88),
    });
    draw("ENTWURF - noch nicht ausgestellt", MARGIN + 10, y + 2, WIDTH - 20, {
      font: bold,
      size: 9,
    });
    y -= 42;
  }

  const cols = doc.showAmounts
    ? [
        { x: 48, w: 22, label: "Pos." },
        { x: 78, w: 201, label: "Artikel / Beschreibung" },
        { x: 287, w: 34, label: "Menge" },
        { x: 333, w: 70, label: "Einzel netto" },
        { x: 415, w: 32, label: "USt." },
        { x: 459, w: RIGHT - 459, label: "Gesamt netto" },
      ]
    : [
        { x: 48, w: 22, label: "Pos." },
        { x: 78, w: 380, label: "Artikel / Beschreibung" },
        { x: 480, w: RIGHT - 480, label: "Menge" },
      ];
  const tableHeader = () => {
    ensure(60);
    if (doc.showAmounts) {
      draw(`Alle Beträge in ${doc.currencyCode}`, MARGIN, y, WIDTH, {
        size: 7.5,
        muted: true,
        right: true,
      });
      y -= 18;
    }
    page!.drawRectangle({
      x: MARGIN - 5,
      y: y - 8,
      width: WIDTH + 10,
      height: 25,
      color: rgb(0.95, 0.96, 0.97),
    });
    cols.forEach((c, i) =>
      draw(c.label, c.x, y, c.w, { size: 7.5, font: bold, right: i > 1, region: "table-heading" }),
    );
    y -= 29;
  };
  tableHeader();
  for (const item of doc.lines) {
    const desc = cols[1]!;
    const title = [item.productName, item.variantName].filter(Boolean).join(" / ");
    const details = [
      doc.branding.show_product_sku !== false && item.sku ? `SKU: ${item.sku}` : "",
      item.description ?? "",
    ]
      .filter(Boolean)
      .join("\n");
    const rows = [
      ...wrapDocumentText(title, bold, 9, desc.w).map((value) => ({
        value,
        size: 9,
        strong: true,
      })),
      ...(details
        ? wrapDocumentText(details, regular, 8, desc.w).map((value) => ({
            value,
            size: 8,
            strong: false,
          }))
        : []),
    ];
    if (y - Math.min(rows.length * 12 + 16, 100) < bottom) {
      startPage();
      tableHeader();
    }
    const values = [
      String(item.position),
      "",
      new Intl.NumberFormat("de-DE", { maximumFractionDigits: 6 }).format(item.quantity),
      ...(doc.showAmounts
        ? [
            money(item.unitNetMinor, doc.currencyCode),
            rate(item.taxRateBasisPoints),
            money(item.lineNetMinor, doc.currencyCode),
          ]
        : []),
    ];
    cols.forEach((c, i) => {
      if (i !== 1)
        draw(values[i] ?? "", c.x, y, c.w, {
          size: 8.5,
          right: i > 1,
          region: `row-${item.position}-col-${i}`,
        });
    });
    for (const row of rows) {
      if (y - 13 < bottom) {
        startPage();
        tableHeader();
        draw(`${item.position} ...`, cols[0]!.x, y, cols[0]!.w, { size: 7, muted: true });
      }
      draw(row.value, desc.x, y, desc.w, {
        font: row.strong ? bold : regular,
        size: row.size,
        muted: !row.strong,
        region: `row-${item.position}-description`,
      });
      y -= 12;
    }
    y -= 7;
    line(y);
    y -= 15;
  }
  y -= 6;
  if (doc.showAmounts) {
    const totals: { label: string; value: string; strong?: boolean }[] = [
      {
        label: "Zwischensumme netto",
        value: money(doc.totals.netMinor - doc.totals.shippingNetMinor, doc.currencyCode),
      },
      ...(doc.totals.shippingNetMinor
        ? [{ label: "Versand netto", value: money(doc.totals.shippingNetMinor, doc.currencyCode) }]
        : []),
      ...(doc.branding.show_tax_breakdown !== false
        ? doc.taxRows.map((t) => ({
            label: `USt. ${rate(t.rateBasisPoints)} auf ${money(t.netMinor, doc.currencyCode)}`,
            value: money(t.taxMinor, doc.currencyCode),
          }))
        : []),
      { label: "Umsatzsteuer gesamt", value: money(doc.totals.taxMinor, doc.currencyCode) },
      {
        label: doc.kind === "credit_note" ? "Gutschriftbetrag" : "Gesamtbetrag",
        value: money(doc.totals.grossMinor, doc.currencyCode, true),
        strong: true,
      },
    ];
    const tx = 260,
      labelWidth = 170,
      valueX = 442,
      valueWidth = RIGHT - valueX;
    const totalHeight = totals.reduce(
      (h, row) =>
        h + wrapDocumentText(row.label, regular, 9, labelWidth).length * 13 + (row.strong ? 22 : 7),
      0,
    );
    ensure(totalHeight);
    for (const row of totals) {
      if (row.strong) {
        line(y + 5, tx, RIGHT, true);
        y -= 16;
      }
      const labels = wrapDocumentText(
        row.label,
        row.strong ? bold : regular,
        row.strong ? 10 : 9,
        labelWidth,
      );
      const baseline = y;
      for (const label of labels) {
        draw(label, tx, y, labelWidth, {
          size: row.strong ? 10 : 9,
          font: row.strong ? bold : regular,
          muted: !row.strong,
          region: "totals-label",
        });
        y -= 13;
      }
      draw(row.value, valueX, baseline, valueWidth, {
        font: row.strong ? bold : regular,
        size: row.strong ? 11 : 9,
        right: true,
        region: "totals-value",
      });
      y -= 7;
    }
    y -= 17;
  }
  const legal = doc.branding.legal_footer ?? doc.branding.footer_text ?? "";
  for (const value of [
    ...doc.taxNotes,
    doc.paymentTerms,
    doc.notes,
    doc.branding.payment_details,
    legal,
    ...extraFooter,
  ].filter((v): v is string => Boolean(v?.trim())))
    paragraph(value, 8.5, true);
  pages.forEach((p, index) => {
    page = p;
    line(bottom - 14);
    footerLines.forEach((col, ci) =>
      col.forEach((value, ri) =>
        draw(value, MARGIN + (ci * WIDTH) / 3, bottom - 29 - ri * 9, WIDTH / 3 - 14, {
          size: 7,
          muted: true,
          region: "footer",
        }),
      ),
    );
    draw(`${doc.title} ${doc.number}`, MARGIN, 25, WIDTH - 100, {
      size: 7,
      muted: true,
      region: "footer",
    });
    draw(`Seite ${index + 1} von ${pages.length}`, RIGHT - 90, 25, 90, {
      size: 7,
      right: true,
      muted: true,
      region: "footer",
    });
  });
  return pdf.save();
}
