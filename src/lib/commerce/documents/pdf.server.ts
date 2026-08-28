/**
 * Server-only PDF renderer for commerce documents.
 *
 * Uses pdf-lib with the standard WinAnsi fonts, which cover German umlauts
 * without embedding font files — important for the Worker runtime where the
 * bundle must stay small and no filesystem is available.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { DOCUMENT_RENDERER_VERSION, type RenderableDocument } from "./document.types";
import { formatAddressLines } from "./document.viewmodel";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const BOTTOM = 90;

function hexToRgb(hex: string | null | undefined) {
  const value = (hex ?? "#1F2937").replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const n = Number.parseInt(full.slice(0, 6) || "1F2937", 16);
  if (Number.isNaN(n)) return rgb(0.12, 0.16, 0.22);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Standard fonts are WinAnsi — strip anything they cannot encode. */
function safe(text: string) {
  return (text ?? "")
    .replace(/\u20AC/g, "EUR")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2212/g, "-")
    .replace(/[^\u0000-\u00FF]/g, "");
}

function money(minor: number, currency: string) {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const s = `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
  const withDots = s.replace(/\B(?=(\d{3})+(?!\d)(?=.*,))/g, ".");
  return `${sign}${withDots} ${currency === "EUR" ? "EUR" : currency}`;
}

function date(value: string | null) {
  if (!value) return "—".replace("—", "-");
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}

function rate(bp: number) {
  const v = bp / 100;
  return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(2).replace(".", ",")} %`;
}

function truncate(text: string, font: PDFFont, size: number, maxWidth: number) {
  let out = text;
  while (out.length > 1 && font.widthOfTextAtSize(out, size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return out.length < text.length ? `${out.slice(0, -1)}…`.replace("…", "...") : out;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

type Ctx = {
  pdf: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  accent: ReturnType<typeof hexToRgb>;
  doc: RenderableDocument;
  pages: PDFPage[];
};

function newPage(ctx: Ctx) {
  const page = ctx.pdf.addPage(A4);
  ctx.pages.push(page);
  return page;
}

export async function renderDocumentPdf(doc: RenderableDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = {
    pdf,
    regular,
    bold,
    accent: hexToRgb(doc.branding.primary_color),
    doc,
    pages: [],
  };

  pdf.setTitle(safe(`${doc.title} ${doc.number}`));
  pdf.setProducer("EYIS");
  pdf.setCreator(`EYIS ${DOCUMENT_RENDERER_VERSION}`);

  let page = newPage(ctx);
  const width = A4[0];
  const contentWidth = width - MARGIN * 2;
  let y = A4[1] - MARGIN;
  const grey = rgb(0.42, 0.45, 0.5);
  const black = rgb(0.1, 0.11, 0.13);

  const text = (
    p: PDFPage,
    value: string,
    x: number,
    yy: number,
    opts?: { size?: number; font?: PDFFont; color?: ReturnType<typeof hexToRgb> },
  ) =>
    p.drawText(safe(value), {
      x,
      y: yy,
      size: opts?.size ?? 9.5,
      font: opts?.font ?? regular,
      color: opts?.color ?? black,
    });

  // ── Header ────────────────────────────────────────────────────────────
  const seller = doc.seller;
  text(page, seller.company_name ?? "", MARGIN, y, { size: 16, font: bold, color: ctx.accent });
  y -= 16;
  const sellerLines = [
    [seller.address_line1, seller.address_line2].filter(Boolean).join(", "),
    `${seller.postal_code ?? ""} ${seller.city ?? ""}`.trim(),
    seller.country_code ?? "",
    seller.contact_email ?? "",
    seller.website ?? "",
  ].filter((l) => (l ?? "").trim().length > 0) as string[];
  for (const line of sellerLines) {
    text(page, line, MARGIN, y, { size: 8.5, color: grey });
    y -= 11;
  }

  // Document title block (right)
  let ry = A4[1] - MARGIN;
  const rightX = width - MARGIN;
  const drawRight = (value: string, size: number, font: PDFFont, color = black) => {
    const w = font.widthOfTextAtSize(safe(value), size);
    page.drawText(safe(value), { x: rightX - w, y: ry, size, font, color });
    ry -= size + 4;
  };
  drawRight(doc.title, 18, bold, ctx.accent);
  drawRight(doc.number, 11, bold);
  if (doc.issueDate) drawRight(`Datum: ${date(doc.issueDate)}`, 9, regular, grey);
  if (doc.serviceDate) drawRight(`Leistungsdatum: ${date(doc.serviceDate)}`, 9, regular, grey);
  if (doc.dueDate) drawRight(`Fällig: ${date(doc.dueDate)}`, 9, regular, grey);
  for (const ref of doc.reference) drawRight(`${ref.label}: ${ref.value}`, 9, regular, grey);

  y = Math.min(y, ry) - 24;

  // ── Recipient ─────────────────────────────────────────────────────────
  if (doc.branding.sender_block) {
    text(page, doc.branding.sender_block, MARGIN, y, { size: 7.5, color: grey });
    y -= 12;
  }
  text(page, doc.kind === "delivery_note" ? "Lieferanschrift" : "Rechnungsanschrift", MARGIN, y, {
    size: 8,
    font: bold,
    color: grey,
  });
  y -= 13;
  for (const line of formatAddressLines(doc.recipient)) {
    text(page, line, MARGIN, y, { size: 10 });
    y -= 12.5;
  }
  if (doc.recipientVatId) {
    text(page, `USt-IdNr.: ${doc.recipientVatId}`, MARGIN, y, { size: 8.5, color: grey });
    y -= 12;
  }
  y -= 18;

  if (doc.isDraft) {
    page.drawRectangle({
      x: MARGIN,
      y: y - 4,
      width: contentWidth,
      height: 20,
      color: rgb(0.98, 0.9, 0.7),
    });
    text(page, "ENTWURF - noch nicht ausgestellt, keine gültige Rechnung", MARGIN + 8, y + 2, {
      size: 9,
      font: bold,
      color: rgb(0.45, 0.3, 0.05),
    });
    y -= 30;
  }

  // ── Table ─────────────────────────────────────────────────────────────
  const showAmounts = doc.showAmounts;
  // Column values are the RIGHT edge of each right-aligned column.
  const cols = showAmounts
    ? {
        pos: MARGIN,
        desc: MARGIN + 26,
        qty: MARGIN + 292,
        unit: MARGIN + 374,
        tax: MARGIN + 414,
        total: width - MARGIN - 2,
      }
    : { pos: MARGIN, desc: MARGIN + 26, qty: width - MARGIN - 2, unit: 0, tax: 0, total: 0 };

  const drawTableHeader = (p: PDFPage, yy: number) => {
    p.drawRectangle({
      x: MARGIN,
      y: yy - 5,
      width: contentWidth,
      height: 18,
      color: rgb(0.95, 0.96, 0.97),
    });
    text(p, "Pos", cols.pos + 4, yy, { size: 8, font: bold, color: grey });
    text(p, "Beschreibung", cols.desc + 4, yy, { size: 8, font: bold, color: grey });
    const right = (label: string, x: number) => {
      const w = bold.widthOfTextAtSize(label, 8);
      p.drawText(label, { x: x - w, y: yy, size: 8, font: bold, color: grey });
    };
    if (showAmounts) {
      right("Menge", cols.qty);
      right("Einzel netto", cols.unit);
      right("USt", cols.tax);
      right("Gesamt netto", cols.total);
    } else {
      right("Menge", cols.qty);
    }
    return yy - 22;
  };

  y = drawTableHeader(page, y);

  for (const line of doc.lines) {
    const descWidth = cols.qty - 44 - cols.desc - 6;
    const nameParts = [line.productName, line.variantName].filter(Boolean).join(" · ");
    const subParts = [
      doc.branding.show_product_sku !== false && line.sku ? `SKU ${line.sku}` : "",
      line.description ?? "",
    ]
      .filter(Boolean)
      .join(" · ");
    const subLines = subParts ? wrap(safe(subParts), regular, 7.5, descWidth) : [];
    const rowHeight = 14 + subLines.length * 9.5;

    if (y - rowHeight < BOTTOM) {
      page = newPage(ctx);
      y = A4[1] - MARGIN;
      y = drawTableHeader(page, y);
    }

    text(page, String(line.position), cols.pos + 4, y, { size: 9 });
    text(page, truncate(safe(nameParts), regular, 9.5, descWidth), cols.desc + 4, y, { size: 9.5 });
    let subY = y - 10;
    for (const sub of subLines) {
      text(page, sub, cols.desc + 4, subY, { size: 7.5, color: grey });
      subY -= 9.5;
    }

    const qty = Number.isInteger(line.quantity)
      ? String(line.quantity)
      : String(line.quantity).replace(".", ",");
    const right = (value: string, x: number, size = 9) => {
      const w = regular.widthOfTextAtSize(safe(value), size);
      page.drawText(safe(value), { x: x - w, y, size, font: regular, color: black });
    };
    if (showAmounts) {
      right(qty, cols.qty);
      right(money(line.unitNetMinor, doc.currencyCode), cols.unit);
      right(rate(line.taxRateBasisPoints), cols.tax);
      right(money(line.lineNetMinor, doc.currencyCode), cols.total);
    } else {
      right(qty, cols.qty);
    }

    y -= rowHeight;
    page.drawLine({
      start: { x: MARGIN, y: y + 6 },
      end: { x: width - MARGIN, y: y + 6 },
      thickness: 0.4,
      color: rgb(0.9, 0.91, 0.93),
    });
  }

  y -= 12;

  // ── Totals ────────────────────────────────────────────────────────────
  if (showAmounts) {
    const needed = 70 + doc.taxRows.length * 13;
    if (y - needed < BOTTOM) {
      page = newPage(ctx);
      y = A4[1] - MARGIN;
    }
    const labelX = width - MARGIN - 200;
    const valueX = width - MARGIN;
    const row = (label: string, value: string, strong = false) => {
      const font = strong ? bold : regular;
      const size = strong ? 11 : 9.5;
      text(page, label, labelX, y, { size, font, color: strong ? black : grey });
      const w = font.widthOfTextAtSize(safe(value), size);
      page.drawText(safe(value), { x: valueX - w, y, size, font, color: black });
      y -= size + 5;
    };

    row(
      "Zwischensumme netto",
      money(doc.totals.netMinor - doc.totals.shippingNetMinor, doc.currencyCode),
    );
    if (doc.totals.shippingNetMinor > 0)
      row("Versand netto", money(doc.totals.shippingNetMinor, doc.currencyCode));
    if (doc.branding.show_tax_breakdown !== false) {
      for (const t of doc.taxRows) {
        row(
          `USt ${rate(t.rateBasisPoints)} auf ${money(t.netMinor, doc.currencyCode)}`,
          money(t.taxMinor, doc.currencyCode),
        );
      }
    }
    row("Umsatzsteuer gesamt", money(doc.totals.taxMinor, doc.currencyCode));
    page.drawLine({
      start: { x: labelX, y: y + 8 },
      end: { x: valueX, y: y + 8 },
      thickness: 0.8,
      color: ctx.accent,
    });
    y -= 4;
    row(
      doc.kind === "credit_note" ? "Gutschriftbetrag" : "Gesamtbetrag",
      money(doc.totals.grossMinor, doc.currencyCode),
      true,
    );
    y -= 10;
  }

  // ── Notes ─────────────────────────────────────────────────────────────
  const paragraphs = [
    ...doc.taxNotes,
    doc.paymentTerms ?? "",
    doc.notes ?? "",
    doc.branding.payment_details ?? "",
  ].filter((p) => p.trim().length > 0);

  for (const paragraph of paragraphs) {
    const lines = wrap(safe(paragraph), regular, 8.5, contentWidth);
    if (y - lines.length * 11 < BOTTOM) {
      page = newPage(ctx);
      y = A4[1] - MARGIN;
    }
    for (const line of lines) {
      text(page, line, MARGIN, y, { size: 8.5, color: grey });
      y -= 11;
    }
    y -= 6;
  }

  // ── Footer on every page ──────────────────────────────────────────────
  const footerCols = [
    [
      seller.company_name ?? "",
      [seller.address_line1, `${seller.postal_code ?? ""} ${seller.city ?? ""}`.trim()]
        .filter(Boolean)
        .join(", "),
      seller.managing_director ? `Geschäftsführung: ${seller.managing_director}` : "",
    ],
    [
      seller.tax_number ? `Steuernummer: ${seller.tax_number}` : "",
      seller.vat_id ? `USt-IdNr.: ${seller.vat_id}` : "",
      [seller.register_court, seller.register_number].filter(Boolean).join(" "),
    ],
    [
      seller.bank_name ? `Bank: ${seller.bank_name}` : "",
      seller.bank_iban ? `IBAN: ${seller.bank_iban}` : "",
      seller.bank_bic ? `BIC: ${seller.bank_bic}` : "",
    ],
  ];

  const total = ctx.pages.length;
  ctx.pages.forEach((p, index) => {
    p.drawLine({
      start: { x: MARGIN, y: BOTTOM - 14 },
      end: { x: width - MARGIN, y: BOTTOM - 14 },
      thickness: 0.5,
      color: rgb(0.88, 0.89, 0.91),
    });
    footerCols.forEach((col, ci) => {
      let fy = BOTTOM - 26;
      for (const line of col.filter((l) => l.trim().length > 0)) {
        p.drawText(safe(truncate(line, regular, 7, contentWidth / 3 - 10)), {
          x: MARGIN + ci * (contentWidth / 3),
          y: fy,
          size: 7,
          font: regular,
          color: grey,
        });
        fy -= 9;
      }
    });
    const legal = doc.branding.legal_footer ?? doc.branding.footer_text ?? "";
    if (legal) {
      p.drawText(safe(truncate(legal, regular, 7, contentWidth - 80)), {
        x: MARGIN,
        y: 26,
        size: 7,
        font: regular,
        color: grey,
      });
    }
    const label = `Seite ${index + 1} von ${total}`;
    const w = regular.widthOfTextAtSize(label, 7.5);
    p.drawText(label, { x: width - MARGIN - w, y: 26, size: 7.5, font: regular, color: grey });
  });

  return await pdf.save();
}
