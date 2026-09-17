import { describe, it, expect } from "vitest";
import { renderEmail } from "../renderer";
import { buildMimeMessage } from "../providers/smtp.server";
import { validateMailBlocks } from "../mail-design";
import type { CommunicationContext } from "../communication.types";
const context: CommunicationContext = {
  shop: {
    name: "Atelier",
    support_email: "hello@example.test",
    website_url: "https://example.test",
  },
  customer: {
    first_name: "Anna",
    last_name: "Muster",
    full_name: "Anna Muster",
    email: "anna@example.test",
  },
  links: {
    order: "",
    tracking: "",
    document: "",
    return: "",
    portal: "",
    guest_access: "",
    unsubscribe: "https://example.test/unsubscribe?token=test",
  },
};
describe("Shared mail design", () => {
  it("adds one logo and footer to every template and escapes personal data", () => {
    const result = renderEmail({
      subject: "Hallo {{customer.first_name}}",
      blocks: [
        { type: "logo" },
        { type: "logo" },
        { type: "text", text: "{{customer.first_name}}" },
        { type: "footer" },
      ],
      context: {
        ...context,
        customer: { ...context.customer, first_name: "<script>alert(1)</script>" },
      },
      branding: { footerText: "Firma\nAnschrift" },
    });
    expect(result.html.match(/Newsletter abmelden/g)).toHaveLength(1);
    expect(result.html).toContain("Firma<br/>Anschrift");
    expect(result.html).not.toContain("<script>");
    expect(result.text).toContain("Newsletter abmelden:");
  });
  it("rejects CSS injection and unsafe links while preserving shop colors", () => {
    const result = renderEmail({
      subject: "Test",
      blocks: [{ type: "button", label: "Bad", url: "javascript:alert(1)" }],
      context,
      branding: {
        primaryColor: "#123456",
        fontFamily: "Arial; background:url(https://evil.test)",
        textColor: 'red"><script>x</script>',
      },
    });
    expect(result.html).not.toContain("evil.test");
    expect(result.html).not.toContain("javascript:");
    expect(result.html).toContain("#123456");
  });
  it("uses server product context and includes a plain-text alternative", () => {
    const result = renderEmail({
      subject: "Neuheiten",
      blocks: [{ type: "products", productIds: ["p1"] }],
      context: {
        ...context,
        products: [
          {
            id: "p1",
            name: "Becher & Teller",
            price: "49,90 €",
            url: "https://example.test/produkt/becher",
          },
        ],
      },
    });
    expect(result.html).toContain("Becher &amp; Teller");
    expect(result.text).toContain("49,90 €");
    expect(result.text).toContain("/produkt/becher");
  });
  it("uses the logo as CID and includes a legal text block", () => {
    const result = renderEmail({
      subject: "Test",
      blocks: [{ type: "legal" }],
      context,
      branding: { logoUrl: "cid:eyis-shop-logo", legalText: "Rechtstext\nZweite Zeile" },
    });
    expect(result.html).toContain('src="cid:eyis-shop-logo"');
    expect(result.text).toContain("Rechtstext\nZweite Zeile");
  });
  it("builds MIME PDF and inline logo attachments without header injection", () => {
    const content = btoa("%PDF-1.7\nexample");
    const mime = buildMimeMessage(
      {
        to: "anna@example.test",
        senderName: "Atelier",
        senderAddress: "hello@example.test",
        replyTo: null,
        subject: "Test",
        html: '<img src="cid:eyis-shop-logo">',
        text: "Test",
        idempotencyKey: "qa",
        tags: {},
        unsubscribeUrl: "https://example.test/unsubscribe?token=test",
        attachments: [
          { filename: "Rechtstext.pdf\r\nBcc: bad", contentType: "application/pdf", content },
          {
            filename: "Logo.png",
            contentType: "image/png",
            content: btoa("image"),
            contentId: "eyis-shop-logo",
          },
        ],
      },
      "hello@example.test",
    ).body;
    expect(mime).toContain("multipart/mixed");
    expect(mime).toContain("multipart/alternative");
    expect(mime).toContain("Content-ID: <eyis-shop-logo>");
    expect(mime).toContain(content);
    expect(mime).not.toContain("\r\nBcc:");
    expect(mime).toContain("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
  });
  it("validates new block structures and maximum message size", () => {
    expect(() => validateMailBlocks([{ type: "button", url: "javascript:alert(1)" }])).toThrow();
    expect(() =>
      validateMailBlocks(Array.from({ length: 61 }, () => ({ type: "text" as const, text: "x" }))),
    ).toThrow();
    expect(() =>
      validateMailBlocks([{ type: "button", url: "{{shop.website_url}}" }]),
    ).not.toThrow();
  });
});
