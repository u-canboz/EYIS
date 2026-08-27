import { describe, expect, it } from "vitest";
import { maskSecret, referenceFor } from "../credentials.server";

describe("Zugangsdaten-Tresor", () => {
  it("maskiert Geheimnisse bis auf die letzten vier Zeichen", () => {
    const secret = "sk_test_51ABCDEFGHIJKLMNOP";
    const masked = maskSecret(secret);
    expect(masked).toBe("••••MNOP");
    expect(masked).not.toContain("sk_test");
    expect(secret.includes(masked)).toBe(false);
  });

  it("maskiert sehr kurze Werte vollständig", () => {
    expect(maskSecret("ab")).toBe("••••");
  });

  it("bindet die Referenz an Shop, Kategorie, Anbieter und Umgebung", () => {
    const base = {
      organizationId: "org-1",
      category: "payment" as const,
      provider: "stripe",
      environment: "live" as const,
    };
    const a = referenceFor({ ...base, shopId: "shop-a" });
    const b = referenceFor({ ...base, shopId: "shop-b" });
    expect(a).not.toBe(b);
    expect(a).toContain("shop-a");
    expect(referenceFor({ ...base, shopId: "shop-a", environment: "test" })).not.toBe(a);
  });
});
