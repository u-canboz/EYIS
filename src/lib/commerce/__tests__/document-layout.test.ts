import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  renderDocumentPdf,
  wrapDocumentText,
  type DocumentTextPlacement,
} from "../documents/pdf.server";
import { invoiceFixture, stressFixture } from "../../../../qa/document-layout-fixtures";
describe("document layout", () => {
  it("wraps an unbroken SKU inside its cell without losing text", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const value = "SKU0123456789".repeat(30);
    const lines = wrapDocumentText(value, font, 9, 90);
    expect(lines.join("")).toBe(value);
    expect(lines.every((line) => font.widthOfTextAtSize(line, 9) <= 90)).toBe(true);
  });
  it("keeps descriptions, numeric columns and footer apart on long documents", async () => {
    const placements: DocumentTextPlacement[] = [];
    const bytes = await renderDocumentPdf(stressFixture(), { onText: (p) => placements.push(p) });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(3);
    for (const p of placements) {
      expect(p.x, p.text).toBeGreaterThanOrEqual(47.9);
      expect(p.x + p.width, p.text).toBeLessThanOrEqual(547.4);
      expect(p.y, p.text).toBeGreaterThanOrEqual(24.9);
    }
    for (const p of placements.filter((p) => p.region.endsWith("description"))) {
      expect(p.x + p.width).toBeLessThanOrEqual(279.1);
      expect(p.y).toBeGreaterThan(110);
    }
    for (const p of placements.filter((p) => p.region.includes("-col-"))) {
      const collision = placements.find(
        (other) =>
          other.page === p.page &&
          other !== p &&
          other.region.endsWith("description") &&
          Math.abs(other.y - p.y) < 2 &&
          other.x < p.x + p.width &&
          other.x + other.width > p.x,
      );
      expect(collision).toBeUndefined();
    }
  });
  it("renders invoice, credit and quantity-only delivery note with page numbering", async () => {
    for (const kind of ["invoice", "credit_note", "delivery_note"] as const) {
      const placements: DocumentTextPlacement[] = [];
      const doc = { ...invoiceFixture(), kind, showAmounts: kind !== "delivery_note" };
      const pdf = await PDFDocument.load(
        await renderDocumentPdf(doc, { onText: (p) => placements.push(p) }),
      );
      expect(pdf.getPageCount()).toBeGreaterThan(0);
      expect(placements.some((p) => p.text.startsWith("Seite 1 von"))).toBe(true);
      if (kind === "delivery_note")
        expect(placements.some((p) => p.region === "totals-value")).toBe(false);
    }
  });
});
