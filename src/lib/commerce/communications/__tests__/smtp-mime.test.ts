import { describe, expect, it } from "vitest";
import { buildMimeMessage } from "../providers/smtp.server";

const base = {
  to: "kundin@example.com",
  senderName: "Mein Shop",
  senderAddress: "shop@example.com",
  replyTo: null,
  subject: "Ihre Bestellung",
  html: "<p>Danke!</p>",
  text: "Danke!",
  tags: {},
  idempotencyKey: "test-1",
};

describe("SMTP MIME", () => {
  it("baut eine mehrteilige Nachricht mit beiden Formaten", () => {
    const mime = buildMimeMessage(base, "shop@example.com").body;
    expect(mime).toContain("multipart/alternative");
    expect(mime).toContain("text/plain");
    expect(mime).toContain("text/html");
    expect(mime).toContain("To: kundin@example.com");
  });

  it("kodiert Nicht-ASCII-Betreffs nach RFC 2047", () => {
    const mime = buildMimeMessage({ ...base, subject: "Grüße aus München" }, "shop@example.com").body;
    expect(mime).toContain("=?UTF-8?B?");
    expect(mime).not.toContain("Subject: Grüße");
  });

  it("verhindert Header-Injection über Betreff und Empfänger", () => {
    const mime = buildMimeMessage(
      {
        ...base,
        subject: "Hallo\r\nBcc: angreifer@example.com",
        to: "kundin@example.com\r\nBcc: angreifer@example.com",
      },
      "shop@example.com",
    ).body;
    expect(mime).not.toContain("Bcc: angreifer@example.com");
  });
});
