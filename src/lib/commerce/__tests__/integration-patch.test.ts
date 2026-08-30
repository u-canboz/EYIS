/**
 * Phase 26 — Regressionstests der Integration-Patch-Engine.
 *
 * Im Blackbox-Test entstand ein Buildfehler durch einen doppelten, verwaisten
 * `.eyis-admin`-Block in `src/styles.css`. Zweimaliges Anwenden muss exakt
 * dasselbe Ergebnis liefern wie einmaliges Anwenden.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CSS_MARKER_END,
  CSS_MARKER_START,
  IntegrationPatchError,
  applyCssAdminScope,
  applyRootGuard,
  validateCss,
} from "../updates/integration-patch";

const CUSTOMER_CSS = `:root {\n  --brand: #123456;\n}\n\nbody {\n  color: var(--brand);\n}\n`;
const BLOCK = `.eyis-admin {\n  --primary: #ED4800;\n}`;

const CUSTOMER_ROOT = `import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";

function RootLayout() {
  return (
    <div>
      <Header />
      <Outlet />
      <Footer />
    </div>
  );
}
`;

describe("CSS Integration Patch", () => {
  it("fügt den Admin-Scope genau einmal ein", () => {
    const first = applyCssAdminScope(CUSTOMER_CSS, BLOCK);
    expect(first.outcome).toBe("INSERTED");
    expect(first.content).toContain(CSS_MARKER_START);
    expect(first.content).toContain(CSS_MARKER_END);
  });

  it("ist idempotent — zweiter Lauf ist ein NOOP", () => {
    const first = applyCssAdminScope(CUSTOMER_CSS, BLOCK);
    const second = applyCssAdminScope(first.content, BLOCK);
    expect(second.outcome).toBe("NOOP");
    expect(second.content).toBe(first.content);
    expect(second.content.split(CSS_MARKER_START).length - 1).toBe(1);
    validateCss(second.content);
  });

  it("aktualisiert innerhalb der Marker statt anzuhängen", () => {
    const first = applyCssAdminScope(CUSTOMER_CSS, BLOCK);
    const updated = applyCssAdminScope(first.content, `.eyis-admin {\n  --primary: #000000;\n}`);
    expect(updated.outcome).toBe("UPDATED");
    expect(updated.content.split(CSS_MARKER_START).length - 1).toBe(1);
    expect(updated.content).toContain("#000000");
    validateCss(updated.content);
  });

  it("lässt Kunden-CSS ausserhalb des Blocks unverändert", () => {
    const patched = applyCssAdminScope(CUSTOMER_CSS, BLOCK).content;
    const outside = patched.slice(0, patched.indexOf(CSS_MARKER_START));
    expect(outside.trim()).toBe(CUSTOMER_CSS.trim());
  });

  it("verweigert die Arbeit bei bereits doppeltem Block", () => {
    const doubled = `${CUSTOMER_CSS}\n${CSS_MARKER_START}\n${BLOCK}\n${CSS_MARKER_END}\n${CSS_MARKER_START}\n${BLOCK}\n${CSS_MARKER_END}\n`;
    expect(() => applyCssAdminScope(doubled, BLOCK)).toThrow(IntegrationPatchError);
  });

  it("hält das eigene styles.css markiert und einfach", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css.split(CSS_MARKER_START).length - 1).toBe(1);
    expect(css.split(CSS_MARKER_END).length - 1).toBe(1);
    validateCss(css);
  });
});

describe("Root Guard Patch", () => {
  it("integriert den Guard genau einmal", () => {
    const first = applyRootGuard(CUSTOMER_ROOT);
    expect(first.outcome).toBe("INSERTED");
    expect(first.content).toContain("isEyisInternalRoute");
  });

  it("ist idempotent", () => {
    const first = applyRootGuard(CUSTOMER_ROOT);
    const second = applyRootGuard(first.content);
    expect(second.outcome).toBe("NOOP");
    expect(second.content).toBe(first.content);
    expect(second.content.split("isEyisInternalRoute").length - 1).toBe(2); // Import + Aufruf
  });

  it("bricht ab, wenn die Root-Komponente fehlt", () => {
    expect(() => applyRootGuard("export const x = 1;")).toThrow(IntegrationPatchError);
  });
});
