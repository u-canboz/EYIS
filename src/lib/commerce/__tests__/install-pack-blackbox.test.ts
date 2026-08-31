/**
 * Phase 29 — Regressionstests der fünf Blackbox-Installationsdefekte.
 *
 * 1. Fresh Install setzt keinen privilegierten psql-Zugang mehr voraus.
 * 2. Es existiert ein deterministischer Agent Migration Plan über alle Units.
 * 3. Die Installationsbefehle sind ohne package.json des Kunden erreichbar.
 * 4. Der Route-Guard bringt seinen Import mit und umgeht keine Provider.
 * 5. Der ausgelieferte `.eyis-admin`-Scope enthält echte Tokens.
 */
import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildAgentPlan } from "../../../../scripts/installer/agent-plan";
import { check as checkAdminScope, missingTokens } from "../../../../scripts/installer/admin-scope";
import { loadManifest } from "../../../../scripts/installer/runner";
import {
  ROOT_GUARD_MARKER_END,
  ROOT_GUARD_MARKER_START,
  applyRootGuard,
} from "../updates/integration-patch";

const CUSTOMER_ROOT_WITH_PROVIDER = `import { Outlet } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Header />
      <Outlet />
      <Footer />
    </QueryClientProvider>
  );
}
`;

describe("Blackbox 1+2 — Agent Migration Plan statt direktem psql", () => {
  const manifest = loadManifest();
  const plan = buildAgentPlan(manifest);

  it("deckt alle Units, Seeds, Reconciliation und Abschluss ab", () => {
    const units = plan.steps.filter((s) => s.kind === "unit");
    expect(units).toHaveLength(manifest.fresh_install.units.length);
    expect(plan.steps.filter((s) => s.kind === "seed")).toHaveLength(manifest.system_seeds.length);
    expect(plan.steps.filter((s) => s.kind === "reconcile")).toHaveLength(1);
    expect(plan.steps.filter((s) => s.kind === "finalize")).toHaveLength(1);
  });

  it("hält die Manifest-Reihenfolge strikt ein", () => {
    const units = plan.steps.filter((s) => s.kind === "unit").map((s) => s.id);
    expect(units).toEqual(manifest.fresh_install.units.map((u) => u.id));
    expect(plan.steps.map((s) => s.step)).toEqual(plan.steps.map((_, i) => i + 1));
  });

  it("journalisiert jede Unit in derselben Migration", () => {
    for (const step of plan.steps.filter((s) => s.kind === "unit")) {
      expect(step.sql).toContain("INSERT INTO public.eyis_installation_units");
      expect(step.sql).toContain("'PASS'");
    }
  });

  it("ist deterministisch", () => {
    expect(buildAgentPlan(manifest).plan_checksum).toBe(plan.plan_checksum);
    expect(plan.execution.requires_direct_db_access).toBe(false);
  });

  it("markiert die Installation zum Schluss als INSTALLED", () => {
    const finalize = plan.steps.at(-1)!;
    expect(finalize.sql).toContain("public.eyis_installation_state");
    expect(finalize.sql).toContain("'INSTALLED'");
  });

  it("verweist bei fehlendem DDL-Recht auf den Plan statt abzubrechen", () => {
    const runner = readFileSync("scripts/installer/runner.ts", "utf8");
    expect(runner).toContain("DirectDdlUnavailableError");
    expect(runner).toContain("preflightDirectDdl");
  });
});

describe("Blackbox 3 — Befehle ohne kundeneigene package.json", () => {
  it("liefert einen eigenständigen Einstiegspunkt aus", () => {
    expect(existsSync("installer/eyis.ts")).toBe(true);
    const cli = readFileSync("installer/eyis.ts", "utf8");
    for (const command of ["plan", "step", "bootstrap", "doctor", "resources", "verify"]) {
      expect(cli).toContain(`case "${command}"`);
    }
  });

  it("packt Einstiegspunkt, Bootstrap und Doctor ins Release-Artefakt", () => {
    // BB-RC7-03: Die Liste steht nur noch im Distribution-Manifest
    // (Kategorie install_tooling) — nicht mehr doppelt im Builder-Code.
    const dist = JSON.parse(
      readFileSync("installer/distribution/eyis-code-distribution.manifest.json", "utf8"),
    ) as { install: string[]; install_tooling: string[] };
    const shipped = new Set([...dist.install, ...dist.install_tooling]);
    for (const file of [
      "installer/eyis.ts",
      "scripts/commerce-bootstrap.ts",
      "scripts/commerce-doctor.ts",
      "scripts/installer/agent-plan.ts",
    ]) {
      expect(shipped.has(file)).toBe(true);
    }
    const artifact = readFileSync("scripts/installer/artifact.ts", "utf8");
    expect(artifact).toContain("install_tooling");
  });
});

describe("Blackbox 4 — Route Guard", () => {
  it("fügt den Import der Boundary zuverlässig ein", () => {
    const patched = applyRootGuard(CUSTOMER_ROOT_WITH_PROVIDER).content;
    expect(patched).toMatch(/import\s*\{\s*EyisRouteBoundary\s*\}/);
    expect(patched).toContain(ROOT_GUARD_MARKER_START);
    expect(patched).toContain(ROOT_GUARD_MARKER_END);
  });

  it("kapselt innerhalb des Providers und kehrt nicht früh zurück", () => {
    const patched = applyRootGuard(CUSTOMER_ROOT_WITH_PROVIDER).content;
    const providerAt = patched.indexOf("<QueryClientProvider");
    const boundaryAt = patched.indexOf("<EyisRouteBoundary>");
    expect(providerAt).toBeLessThan(boundaryAt);
    expect(patched.indexOf("</EyisRouteBoundary>")).toBeLessThan(
      patched.indexOf("</QueryClientProvider>"),
    );
    expect(patched).not.toMatch(/return <Outlet \/>;/);
  });

  it("ist idempotent", () => {
    const first = applyRootGuard(CUSTOMER_ROOT_WITH_PROVIDER);
    const second = applyRootGuard(first.content);
    expect(second.outcome).toBe("NOOP");
    expect(second.content).toBe(first.content);
  });

  it("liefert die Boundary-Komponente mit aus", () => {
    const component = readFileSync("src/eyis/shell/EyisRouteBoundary.tsx", "utf8");
    expect(component).toContain("useRouterState");
    expect(component).toContain("isEyisInternalRoute");
  });
});

describe("Blackbox 5 — echte Admin-Scope-Tokens", () => {
  it("liefert einen vollständigen Tokenblock aus", () => {
    expect(checkAdminScope().status).toBe("PASS");
    const delivered = readFileSync("installer/distribution/eyis-admin-scope.css", "utf8");
    expect(missingTokens(delivered)).toEqual([]);
    expect(delivered).not.toMatch(/:root\s*\{/);
  });

  it("nennt die Scope-Datei im Distribution-Manifest", () => {
    const manifest = JSON.parse(
      readFileSync("installer/distribution/eyis-code-distribution.manifest.json", "utf8"),
    ) as { integration_patch: { path: string; source_file?: string }[] };
    const css = manifest.integration_patch.find((p) => p.path === "src/styles.css")!;
    expect(css.source_file).toBe("installer/distribution/eyis-admin-scope.css");
  });
});
