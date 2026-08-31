/**
 * BB-RC7-01/05/06 — Regressionsmatrix des Route-Guards (Fälle A–L).
 *
 * Der rc.7-Blackbox-Test fand einen Patch, der die erste beliebige
 * `return (`-Stelle der Datei traf (dort: `NotFoundComponent`) und damit die
 * Kunden-Root-Komponente unangetastet ließ. Diese Matrix prüft für jede reale
 * Schreibweise einer `__root.tsx`, dass genau die Root-Komponente gepatcht
 * wird, der Guard der innerste Wrapper um `<Outlet />` ist, das Ergebnis
 * parsebar bleibt und das Rollback byte-exakt zurückführt.
 */
import { describe, expect, it } from "vitest";

import {
  IntegrationPatchError,
  ROOT_GUARD_MARKER_END,
  ROOT_GUARD_MARKER_START,
  applyRootGuard,
  locateRootComponent,
  providerChain,
  removeRootGuard,
  validateRoot,
} from "../updates/integration-patch";

const HEAD = `import { Outlet, createRootRoute } from "@tanstack/react-router";\n\n`;

/** A — NotFound-Komponente steht VOR der Root-Komponente. */
const A = `${HEAD}function NotFoundComponent() {
  return (
    <div className="p-8">Seite nicht gefunden</div>
  );
}

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <Header />
      <Outlet />
    </QueryClientProvider>
  );
}

export const Route = createRootRoute({ component: RootComponent, notFoundComponent: NotFoundComponent });
`;

/** B — Hilfsfunktion mit Nicht-JSX-Return vor der Root-Komponente. */
const B = `${HEAD}function buildMeta() {
  return (
    { title: "Shop" }
  );
}

function RootComponent() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

export const Route = createRootRoute({ component: RootComponent });
`;

/** C — mehrere verschachtelte Provider. */
const C = `${HEAD}function RootComponent() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Layout>
            <Outlet />
          </Layout>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export const Route = createRootRoute({ component: RootComponent });
`;

/** D — Root-Komponente ohne Referenz im Routen-Setup. */
const D = `${HEAD}function RootLayout() {
  return (
    <div>
      <Header />
      <Outlet />
      <Footer />
    </div>
  );
}
`;

/** E — impliziter Arrow-Return mit Klammern. */
const E = `${HEAD}const RootComponent = () => (
  <QueryClientProvider client={queryClient}>
    <Outlet />
  </QueryClientProvider>
);

export const Route = createRootRoute({ component: RootComponent });
`;

/** F — Arrow mit Blockrumpf. */
const F = `${HEAD}const RootComponent = () => {
  const x = usePathname();
  return (
    <Shell value={x}>
      <Outlet />
    </Shell>
  );
};

export const Route = createRootRoute({ component: RootComponent });
`;

/** G — Root-Komponente mit Typ-Annotation und JSX ohne Klammern. */
const G = `${HEAD}const RootComponent: React.FC = () => {
  return <Shell><Outlet /></Shell>;
};

export const Route = createRootRoute({ component: RootComponent });
`;

/** H — createRootRouteWithContext. */
const H = `${HEAD}function AppRoot() {
  return (
    <Providers>
      <Outlet />
    </Providers>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({ component: AppRoot });
`;

/** I — Root mit frühem `return <Outlet />` (nicht patchbar). */
const I = `${HEAD}function RootComponent() {
  if (isEyis) return <Outlet />;
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}
`;

/** J — kein Outlet in der Datei. */
const J = `${HEAD}function RootComponent() {
  return (
    <Shell />
  );
}
`;

/** K — zwei Komponenten rendern Outlet, keine Referenz. */
const K = `${HEAD}function LayoutA() {
  return (<div><Outlet /></div>);
}

function LayoutB() {
  return (<section><Outlet /></section>);
}
`;

/** L — bereits gepatchte Datei. */
const L = applyRootGuard(A).content;

const PATCHABLE: [string, string, string][] = [
  ["A NotFound zuerst", A, "RootComponent"],
  ["B Nicht-JSX-Return zuerst", B, "RootComponent"],
  ["C verschachtelte Provider", C, "RootComponent"],
  ["D ohne Routen-Referenz", D, "RootLayout"],
  ["E impliziter Arrow-Return", E, "RootComponent"],
  ["F Arrow mit Blockrumpf", F, "RootComponent"],
  ["G JSX ohne Klammern", G, "RootComponent"],
  ["H createRootRouteWithContext", H, "AppRoot"],
];

describe("Route-Guard Regressionsmatrix", () => {
  it.each(PATCHABLE)("%s — Root-Komponente korrekt erkannt", (_name, source, expected) => {
    expect(locateRootComponent(source).name).toBe(expected);
  });

  it.each(PATCHABLE)("%s — Guard sitzt in der Root-Komponente", (_name, source, expected) => {
    const patched = applyRootGuard(source);
    expect(patched.outcome).toBe("INSERTED");
    validateRoot(patched.content, source);

    const root = locateRootComponent(patched.content);
    expect(root.name).toBe(expected);
    const guard = patched.content.indexOf(ROOT_GUARD_MARKER_START);
    expect(guard).toBeGreaterThan(root.start);
    expect(patched.content.indexOf(ROOT_GUARD_MARKER_END)).toBeLessThan(root.end);
  });

  it.each(PATCHABLE)("%s — Boundary ist innerster Wrapper um Outlet", (_name, source) => {
    const chain = providerChain(applyRootGuard(source).content);
    expect(chain[chain.length - 1]).toBe("EyisRouteBoundary");
  });

  it.each(PATCHABLE)("%s — idempotent und byte-exakt rückführbar", (_name, source) => {
    const first = applyRootGuard(source);
    const second = applyRootGuard(first.content);
    expect(second.outcome).toBe("NOOP");
    expect(second.content).toBe(first.content);
    expect(removeRootGuard(first.content).content).toBe(source);
  });

  it("A — NotFoundComponent bleibt unangetastet (BB-RC7-01)", () => {
    const patched = applyRootGuard(A).content;
    const notFound = patched.slice(
      patched.indexOf("function NotFoundComponent"),
      patched.indexOf("function RootComponent"),
    );
    expect(notFound).not.toContain("EyisRouteBoundary");
    expect(notFound).not.toContain("EYIS:ROUTE_GUARD");
  });

  it("I — früher Outlet-Return wird abgelehnt", () => {
    expect(() => applyRootGuard(I)).toThrowError(
      expect.objectContaining({ code: "ROOT_EARLY_RETURN" }),
    );
  });

  it("J — Datei ohne Outlet wird abgelehnt", () => {
    expect(() => applyRootGuard(J)).toThrowError(
      expect.objectContaining({ code: "ROOT_COMPONENT_NOT_FOUND" }),
    );
  });

  it("K — mehrdeutige Root-Komponente wird abgelehnt", () => {
    expect(() => applyRootGuard(K)).toThrowError(
      expect.objectContaining({ code: "ROOT_COMPONENT_AMBIGUOUS" }),
    );
  });

  it("L — bereits gepatchte Datei ist NOOP und valide", () => {
    const again = applyRootGuard(L);
    expect(again.outcome).toBe("NOOP");
    validateRoot(again.content, A);
  });

  it("validateRoot erkennt Patch in der falschen Komponente (BB-RC7-06)", () => {
    const mispatched = A.replace(
      `  return (\n    <div className="p-8">Seite nicht gefunden</div>\n  );`,
      `  return (\n    ${ROOT_GUARD_MARKER_START}<EyisRouteBoundary><div className="p-8">Seite nicht gefunden</div></EyisRouteBoundary>${ROOT_GUARD_MARKER_END}\n  );`,
    );
    expect(() => validateRoot(mispatched)).toThrowError(IntegrationPatchError);
    try {
      validateRoot(mispatched);
    } catch (error) {
      expect((error as IntegrationPatchError).code).toBe("ROOT_GUARD_MISPLACED");
    }
  });

  it("validateRoot erkennt Outlet außerhalb der Boundary", () => {
    const broken = `${HEAD}function RootComponent() {
  return (
    <Shell>
      ${ROOT_GUARD_MARKER_START}<EyisRouteBoundary><Sidebar /></EyisRouteBoundary>${ROOT_GUARD_MARKER_END}
      <Outlet />
    </Shell>
  );
}
`;
    try {
      validateRoot(broken);
      throw new Error("erwarteter Fehler blieb aus");
    } catch (error) {
      expect((error as IntegrationPatchError).code).toBe("ROOT_OUTLET_OUTSIDE_GUARD");
    }
  });

  it("Parse-Gate lehnt syntaktisch kaputtes TSX ab", () => {
    const patched = applyRootGuard(C).content;
    const broken = patched.replace("</EyisRouteBoundary>", "</EyisRouteBoundar>");
    try {
      validateRoot(broken);
      throw new Error("erwarteter Fehler blieb aus");
    } catch (error) {
      expect((error as IntegrationPatchError).code).toBeDefined();
      expect((error as IntegrationPatchError).name).toBe("IntegrationPatchError");
    }
  });

  it("Provider-Hierarchie bleibt unverändert (nur Boundary ergänzt)", () => {
    const patched = applyRootGuard(C).content;
    expect(providerChain(C)).toEqual([
      "ThemeProvider",
      "QueryClientProvider",
      "AuthProvider",
      "Layout",
    ]);
    expect(providerChain(patched)).toEqual([
      "ThemeProvider",
      "QueryClientProvider",
      "AuthProvider",
      "Layout",
      "EyisRouteBoundary",
    ]);
  });
});
