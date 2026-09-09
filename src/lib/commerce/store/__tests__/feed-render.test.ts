import { describe, expect, it } from "vitest";
import { renderGoogleCsv, renderGoogleXml, type FeedItem } from "../feed.server";

const item = (overrides: Partial<FeedItem> = {}): FeedItem => ({
  id: "SKU-1",
  itemGroupId: "produkt-a",
  title: "Produkt A",
  description: "Beschreibung",
  link: "https://shop.example/produkt/produkt-a",
  imageLink: "https://cdn.example/a.jpg",
  additionalImageLinks: [],
  availability: "in_stock",
  quantity: 4,
  price: "19.90 EUR",
  salePrice: null,
  brand: "Marke",
  gtin: "4006381333931",
  mpn: "SKU-1",
  condition: "new",
  productType: "Kategorie",
  googleProductCategory: null,
  ...overrides,
});

describe("Google Shopping Feed", () => {
  it("erzeugt gültiges RSS mit dem Google-Namensraum", () => {
    const xml = renderGoogleXml({
      shopName: "Testshop",
      baseUrl: "https://shop.example",
      items: [item()],
    });
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(xml).toContain("<g:id>SKU-1</g:id>");
    expect(xml).toContain("<g:price>19.90 EUR</g:price>");
    expect(xml).toContain("<g:availability>in_stock</g:availability>");
  });

  it("maskiert Sonderzeichen und lässt leere Felder weg", () => {
    const xml = renderGoogleXml({
      shopName: "Shop & Co",
      baseUrl: "https://shop.example",
      items: [item({ title: "A < B & \"C\"", brand: null, gtin: null, mpn: null })],
    });
    expect(xml).toContain("Shop &amp; Co");
    expect(xml).toContain("A &lt; B &amp; &quot;C&quot;");
    expect(xml).not.toContain("<g:brand>");
    expect(xml).toContain("<g:identifier_exists>no</g:identifier_exists>");
  });

  it("schreibt den Angebotspreis nur, wenn er gesetzt ist", () => {
    const xml = renderGoogleXml({
      shopName: "Shop",
      baseUrl: "https://shop.example",
      items: [item({ salePrice: "14.90 EUR" })],
    });
    expect(xml).toContain("<g:sale_price>14.90 EUR</g:sale_price>");
  });

  it("erzeugt CSV mit Kopfzeile und maskierten Trennzeichen", () => {
    const csv = renderGoogleCsv([item({ title: 'Produkt, "A"' })]);
    const [header, row] = csv.trim().split("\n");
    expect(header?.startsWith("id,item_group_id,title")).toBe(true);
    expect(row).toContain('"Produkt, ""A"""');
  });
});
