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
  ROOT_BOUNDARY_CLOSE,
  ROOT_BOUNDARY_OPEN,
  ROOT_GUARD_MARKER_END,
  ROOT_GUARD_MARKER_START,
  applyCssAdminScope,
  applyRootGuard,
  removeRootGuard,
  validateCss,
  validateRoot,
} from "../updates/integration-patch";

const CUSTOMER_CSS = `:root {\n  --brand: #123456;\n}\n\nbody {\n  color: var(--brand);\n}\n`;
const BLOCK = `.eyis-admin {\n  --primary: #ED4800;\n}`;

const CUSTOMER_ROOT = `import { Outlet, createRootRoute } from "@tanstack/react-router";

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
    expect(first.content).toContain("<EyisRouteBoundary>");
    expect(first.content).toMatch(/import\s*\{\s*EyisRouteBoundary\s*\}/);
  });

  it("ist idempotent", () => {
    const first = applyRootGuard(CUSTOMER_ROOT);
    const second = applyRootGuard(first.content);
    expect(second.outcome).toBe("NOOP");
    expect(second.content).toBe(first.content);
    expect(second.content.split("EyisRouteBoundary").length - 1).toBe(4); // Import (2x) + Auf + Zu
  });

  it("bricht ab, wenn die Root-Komponente fehlt", () => {
    expect(() => applyRootGuard("export const x = 1;")).toThrow(IntegrationPatchError);
  });
});

// ------------------------------------------------------------ rc.6-Hotfix

const PROVIDER_ROOT = `import { Outlet } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/theme";

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SiteHeader />
        <Outlet />
        <SiteFooter />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
`;

describe("Root Guard — rc.6 Marker-Sicherheit", () => {
  it("Marker sind JSX-Kommentare und nie sichtbarer Text", () => {
    const patched = applyRootGuard(PROVIDER_ROOT);
    expect(patched.content).toContain(ROOT_GUARD_MARKER_START);
    expect(patched.content).toContain(ROOT_GUARD_MARKER_END);
    // Rohform ohne JSX-Klammern darf nicht vorkommen — sie würde im DOM rendern.
    expect(patched.content).not.toMatch(/(?<!\{)\/\* EYIS:ROUTE_GUARD:START \*\/(?!\})/);
    expect(patched.content).not.toMatch(/(?<!\{)\/\* EYIS:ROUTE_GUARD:END \*\/(?!\})/);
    validateRoot(patched.content);
  });

  it("Legacy-Markierung (rc.5) wird als UPDATED in die JSX-Form überführt", () => {
    const legacy = applyRootGuard(PROVIDER_ROOT).content
      .split(ROOT_GUARD_MARKER_START)
      .join("/* EYIS:ROUTE_GUARD:START */")
      .split(ROOT_GUARD_MARKER_END)
      .join("/* EYIS:ROUTE_GUARD:END */");
    const upgraded = applyRootGuard(legacy);
    expect(upgraded.outcome).toBe("UPDATED");
    expect(upgraded.content).toContain(ROOT_GUARD_MARKER_START);
    expect(upgraded.content).not.toMatch(/(?<!\{)\/\* EYIS:ROUTE_GUARD:START \*\/(?!\})/);
    validateRoot(upgraded.content);
    // Danach: stabil idempotent.
    expect(applyRootGuard(upgraded.content).outcome).toBe("NOOP");
  });

  it("rollback entfernt den Guard byteweise exakt", () => {
    const patched = applyRootGuard(PROVIDER_ROOT).content;
    const removed = removeRootGuard(patched);
    expect(removed.outcome).toBe("UPDATED");
    expect(removed.content).toBe(PROVIDER_ROOT);
    expect(removeRootGuard(removed.content).outcome).toBe("NOOP");
  });

  it("rollback entfernt auch eine rc.5-Markierung vollständig", () => {
    const legacy = applyRootGuard(CUSTOMER_ROOT).content
      .split(ROOT_GUARD_MARKER_START)
      .join("/* EYIS:ROUTE_GUARD:START */")
      .split(ROOT_GUARD_MARKER_END)
      .join("/* EYIS:ROUTE_GUARD:END */");
    const removed = removeRootGuard(legacy);
    expect(removed.content).toBe(CUSTOMER_ROOT);
  });

  it("Import wird in bestehende Klammern gemergt statt dupliziert", () => {
    const withModuleImport = PROVIDER_ROOT.replace(
      'import { Outlet } from "@tanstack/react-router";',
      'import { Outlet } from "@tanstack/react-router";\nimport { formatReleaseTag } from "@/eyis/shell/EyisRouteBoundary";',
    );
    const patched = applyRootGuard(withModuleImport);
    const imports = patched.content.match(/from "@\/eyis\/shell\/EyisRouteBoundary"/g) ?? [];
    expect(imports.length).toBe(1);
    expect(patched.content).toMatch(/import\s*\{[^}]*EyisRouteBoundary[^}]*\}\s*from/);
    validateRoot(patched.content);
  });
});

describe("Root Guard — Root-Varianten A–E", () => {
  it("A: ohne Provider (Fragment um Outlet)", () => {
    const source = `import { Outlet } from "@tanstack/react-router";

function RootLayout() {
  return (
    <>
      <Outlet />
    </>
  );
}
`;
    const patched = applyRootGuard(source);
    expect(patched.outcome).toBe("INSERTED");
    // Fragment ist der innerste Wrapper — Boundary liegt innerhalb.
    expect(patched.content.indexOf("<>")).toBeLessThan(patched.content.indexOf(ROOT_GUARD_MARKER_START));
    expect(patched.content.indexOf(ROOT_GUARD_MARKER_END)).toBeLessThan(patched.content.indexOf("</>"));
    validateRoot(patched.content);
  });

  it("B: einzelner Provider", () => {
    const source = `import { Outlet } from "@tanstack/react-router";

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SiteHeader />
      <Outlet />
    </QueryClientProvider>
  );
}
`;
    const patched = applyRootGuard(source);
    expect(patched.content.indexOf("<QueryClientProvider")).toBeLessThan(
      patched.content.indexOf(ROOT_GUARD_MARKER_START),
    );
    expect(patched.content.indexOf(ROOT_GUARD_MARKER_END)).toBeLessThan(
      patched.content.indexOf("</QueryClientProvider>"),
    );
    validateRoot(patched.content);
  });

  it("C: verschachtelte Provider — Boundary im innersten, Einrückung intakt", () => {
    const patched = applyRootGuard(PROVIDER_ROOT);
    const content = patched.content;
    expect(content.indexOf("<QueryClientProvider")).toBeLessThan(content.indexOf("<ThemeProvider>"));
    expect(content.indexOf("<ThemeProvider>")).toBeLessThan(content.indexOf(ROOT_GUARD_MARKER_START));
    expect(content.indexOf(ROOT_GUARD_MARKER_END)).toBeLessThan(content.indexOf("</ThemeProvider>"));
    // Schließender Provider-Tag bleibt auf seiner ursprünglichen Einrückung.
    expect(content).toContain("    </QueryClientProvider>");
    expect(content).toContain("      </ThemeProvider>");
    // Schließender Boundary-Tag sitzt auf Kind-Einrückung, Marker ist maskiert,
    // danach folgt der Provider-Schluss unverändert auf eigener Zeile.
    expect(content).toMatch(
      /\n {8}<\/EyisRouteBoundary>\{\/\* EYIS:ROUTE_GUARD:END \*\/\}\n {6}<\/ThemeProvider>/,
    );
    validateRoot(content);
  });

  it("D: früher Return <Outlet /> wird nicht gepatcht", () => {
    const source = `import { Outlet } from "@tanstack/react-router";

function RootLayout() {
  if (isEyis) return <Outlet />;
  return (
    <div>
      <Outlet />
    </div>
  );
}
`;
    expect(() => applyRootGuard(source)).toThrow(IntegrationPatchError);
    expect(() => validateRoot(source)).toThrow(IntegrationPatchError);
  });

  it("E: Header/Footer bleiben vollständig innerhalb der Boundary", () => {
    const patched = applyRootGuard(PROVIDER_ROOT).content;
    const start = patched.indexOf(ROOT_GUARD_MARKER_START);
    const end = patched.indexOf(ROOT_GUARD_MARKER_END);
    const inner = patched.slice(start, end);
    expect(inner).toContain("<SiteHeader />");
    expect(inner).toContain("<SiteFooter />");
    expect(inner).toContain("<Outlet />");
  });

  it("doppelte Guards sind ein harter Fehler, kein Blind-Patch", () => {
    const once = applyRootGuard(PROVIDER_ROOT).content;
    const doubled = once.replace("</QueryClientProvider>", `${ROOT_BOUNDARY_OPEN}<Outlet />${ROOT_BOUNDARY_CLOSE}\n    </QueryClientProvider>`);
    expect(() => applyRootGuard(doubled)).toThrow(IntegrationPatchError);
  });
});

describe("Root Guard — Render-Nachweis (kein Marker im DOM)", () => {
  it("gerendertes HTML enthält Boundary, aber keinen Markertext", async () => {
    const { default: ts } = await import("typescript");
    const React = await import("react");
    const { renderToString } = await import("react-dom/server");

    const patched = applyRootGuard(PROVIDER_ROOT).content;
    // Importzeilen entfernen — die Stubs werden dem Funktionskörper übergeben.
    const withoutImports = patched
      .split("\n")
      .filter((line) => !line.startsWith("import "))
      .join("\n");
    const js = ts.transpileModule(withoutImports, {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;

    const Outlet = () => React.createElement("main", null, "Seiteninhalt");
    const EyisRouteBoundary = ({ children }: { children?: unknown }) =>
      React.createElement("div", { "data-eyis-boundary": true }, children);
    const passthrough = ({ children }: { children?: unknown }) =>
      React.createElement(React.Fragment, null, children);

    const factory = new Function(
      "React",
      "Outlet",
      "EyisRouteBoundary",
      "QueryClientProvider",
      "ThemeProvider",
      "SiteHeader",
      "SiteFooter",
      "queryClient",
      `${js}\nreturn RootLayout;`,
    );
    const RootLayout = factory(
      React,
      Outlet,
      EyisRouteBoundary,
      passthrough,
      passthrough,
      () => React.createElement("header", null, "Kopf"),
      () => React.createElement("footer", null, "Fuß"),
      {},
    ) as () => ReturnType<typeof Outlet>;

    const html = renderToString(React.createElement(RootLayout));
    expect(html).toContain("data-eyis-boundary");
    expect(html).toContain("Seiteninhalt");
    expect(html).not.toContain("EYIS:ROUTE_GUARD");
    expect(html).not.toContain("/*");
  });
});
