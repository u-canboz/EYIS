import { describe, expect, it } from "vitest";
import { activeNavItem, activeGroupId, NAV_GROUPS } from "../nav-registry";

describe("merchant navigation", () => {
  it("selects a child settings page instead of also marking its parent", () => {
    expect(activeNavItem("/app/dokumente/einstellungen")?.to).toBe("/app/dokumente/einstellungen");
    expect(activeNavItem("/app/preise/testen")?.to).toBe("/app/preise/testen");
  });
  it("keeps record details in their owning area", () => {
    expect(activeNavItem("/app/produkte/product-123")?.to).toBe("/app/produkte");
    expect(activeGroupId("/app/bestellungen/order-123")).toBe("sales");
  });
  it("does not select the dashboard for an unknown route", () => {
    expect(activeNavItem("/app/unknown")).toBeUndefined();
  });
  it("keeps every navigation destination unique", () => {
    const paths = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.to));
    expect(new Set(paths).size).toBe(paths.length);
  });
});
