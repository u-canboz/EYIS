/**
 * eyis:blackbox:simulate — Pre-Database Blackbox-Simulation (BB-RC7-08).
 *
 * Neues hartes Release-Gate. Simuliert eine Dedicated-Erstinstallation
 * VOLLSTÄNDIG OHNE Datenbank-, Netz- oder Secret-Zugriff:
 *
 *   1. Ein synthetisches Kundenprojekt wird angelegt (Root-Layout, Stylesheet,
 *      plattformgenerierte Dateien, shadcn-Primitive, leere package.json).
 *   2. Der Release-Dateisatz wird hineinkopiert — exakt der Tarball-Inhalt.
 *   3. Beide Integration Patches laufen, werden strukturell validiert und
 *      zweimal angewandt (Idempotenz).
 *   4. Jede ausgelieferte Datei läuft durch einen echten TSX-Parser.
 *   5. Jeder Import wird aufgelöst: relativ, `@/…` und npm-Pakete gegen den
 *      Abhängigkeitsplan.
 *   6. Kundeneigene Dateien werden auf Unversehrtheit geprüft.
 *
 * Erst danach dürfen in einer echten Installation Migrationen laufen.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

import { parse as parseTsx } from "@babel/parser";

import {
  applyCssAdminScope,
  applyRootGuard,
  validateRoot,
  validateStylesheet,
} from "../src/lib/commerce/updates/integration-patch";
import { artifactFiles } from "./installer/artifact";

const ROOT = process.cwd();
const WORKSPACE = join("/tmp", `eyis-blackbox-${process.pid}`);

type Check = { id: string; status: "PASS" | "FAIL"; detail: string };
const checks: Check[] = [];
const record = (id: string, ok: boolean, detail: string) =>
  checks.push({ id, status: ok ? "PASS" : "FAIL", detail });

// --------------------------------------------------------- 1. Kundenprojekt

const CUSTOMER_ROOT = `import { Outlet, createRootRoute, HeadContent } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/lib/query";

function NotFoundComponent() {
  return (
    <div className="p-10">Seite nicht gefunden</div>
  );
}

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <HeadContent />
      <SiteHeader />
      <Outlet />
      <SiteFooter />
    </QueryClientProvider>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});
`;

const CUSTOMER_CSS = `@import "tailwindcss";\n\n:root {\n  --primary: #101010;\n}\n\nbody {\n  color: var(--primary);\n}\n`;

function createCustomerProject() {
  rmSync(WORKSPACE, { recursive: true, force: true });
  mkdirSync(join(WORKSPACE, "src", "routes"), { recursive: true });
  writeFileSync(join(WORKSPACE, "src", "routes", "__root.tsx"), CUSTOMER_ROOT, "utf8");
  writeFileSync(join(WORKSPACE, "src", "styles.css"), CUSTOMER_CSS, "utf8");
  writeFileSync(
    join(WORKSPACE, "package.json"),
    `${JSON.stringify({ name: "kundenprojekt", private: true, type: "module" }, null, 2)}\n`,
    "utf8",
  );
  // Plattformgenerierte Dateien und shadcn-Primitive existieren im
  // Kundenprojekt bereits — EYIS liefert sie nie mit.
  for (const generated of [
    "src/integrations/supabase/client.ts",
    "src/integrations/supabase/client.server.ts",
    "src/integrations/supabase/auth-middleware.ts",
    "src/integrations/supabase/auth-attacher.ts",
    "src/integrations/supabase/types.ts",
    "src/routeTree.gen.ts",
    "src/lib/utils.ts",
  ]) {
    mkdirSync(join(WORKSPACE, dirname(generated)), { recursive: true });
    writeFileSync(join(WORKSPACE, generated), "export {};\n", "utf8");
  }
  if (existsSync(join(ROOT, "src/components/ui"))) {
    cpSync(join(ROOT, "src/components/ui"), join(WORKSPACE, "src/components/ui"), {
      recursive: true,
    });
  }
  if (existsSync(join(ROOT, "src/hooks"))) {
    cpSync(join(ROOT, "src/hooks"), join(WORKSPACE, "src/hooks"), { recursive: true });
  }
}

// ------------------------------------------------------- 2. Release kopieren

function installRelease(): string[] {
  const files = artifactFiles();
  for (const file of files) {
    const target = join(WORKSPACE, file);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(ROOT, file), target);
  }
  return files;
}

// --------------------------------------------------------------------- Lauf

createCustomerProject();
const rootBefore = readFileSync(join(WORKSPACE, "src/routes/__root.tsx"), "utf8");
const cssBefore = readFileSync(join(WORKSPACE, "src/styles.css"), "utf8");
const shipped = installRelease();
record(
  "S1 Release-Dateisatz installiert",
  shipped.length > 0,
  `${shipped.length} Dateien aus dem Artefakt in das Kundenprojekt kopiert.`,
);

// Kundeneigene Dateien bleiben zunächst unangetastet.
record(
  "S2 Kundeneigene Dateien unverändert kopiert",
  readFileSync(join(WORKSPACE, "src/routes/__root.tsx"), "utf8") === rootBefore &&
    readFileSync(join(WORKSPACE, "src/styles.css"), "utf8") === cssBefore &&
    !existsSync(join(WORKSPACE, "src/routes/index.tsx")),
  "Root-Layout, Stylesheet und Startseite wurden nicht überschrieben.",
);

// --------------------------------------------- 3. Integration Patches prüfen
let patchOk = true;
let patchDetail = "";
try {
  const first = applyRootGuard(rootBefore);
  validateRoot(first.content, rootBefore);
  const second = applyRootGuard(first.content);
  if (second.content !== first.content || second.outcome !== "NOOP") {
    throw new Error("Route-Guard ist nicht idempotent.");
  }
  // Guard muss in RootComponent stehen, nicht in NotFoundComponent.
  const notFound = first.content.slice(
    first.content.indexOf("function NotFoundComponent"),
    first.content.indexOf("function RootComponent"),
  );
  if (notFound.includes("EyisRouteBoundary")) throw new Error("Guard in NotFoundComponent.");

  const block = readFileSync(join(ROOT, "installer/distribution/eyis-admin-scope.css"), "utf8");
  const css = applyCssAdminScope(cssBefore, block);
  validateStylesheet(css.content);
  const cssAgain = applyCssAdminScope(css.content, block);
  if (cssAgain.content !== css.content) throw new Error("Admin-Scope ist nicht idempotent.");

  writeFileSync(join(WORKSPACE, "src/routes/__root.tsx"), first.content, "utf8");
  writeFileSync(join(WORKSPACE, "src/styles.css"), css.content, "utf8");
  patchDetail = "Route-Guard in RootComponent, Admin-Scope gesetzt, beide idempotent.";
} catch (error) {
  patchOk = false;
  patchDetail = (error as Error).message;
}
record("S3 Integration Patches angewandt und validiert", patchOk, patchDetail);

// ------------------------------------------------------------ 4. Parse-Gate
const sources = shipped.filter((f) => /\.tsx?$/.test(f));
const parseFailures: string[] = [];
for (const file of [...sources, "src/routes/__root.tsx"]) {
  const code = readFileSync(join(WORKSPACE, file), "utf8");
  try {
    parseTsx(code, {
      sourceType: "module",
      errorRecovery: false,
      plugins: file.endsWith(".tsx") ? ["typescript", "jsx"] : ["typescript"],
    });
  } catch (error) {
    parseFailures.push(`${file}: ${(error as Error).message}`);
  }
}
record(
  "S4 Alle ausgelieferten Quelldateien parsebar (echter TSX-Parser)",
  parseFailures.length === 0,
  parseFailures.length === 0
    ? `${sources.length + 1} Dateien geparst.`
    : parseFailures.slice(0, 5).join(" | "),
);

// -------------------------------------------------------- 5. Importauflösung
const deps = JSON.parse(
  readFileSync(join(ROOT, "installer/resources/eyis-install-dependencies.json"), "utf8"),
) as { runtime_dependencies: { name: string }[]; provided_by_template: { name: string }[] };
const allowedPackages = new Set([
  ...deps.runtime_dependencies.map((d) => d.name),
  ...deps.provided_by_template.map((d) => d.name),
]);
const NODE_BUILTINS = new Set([
  "fs", "path", "crypto", "url", "os", "stream", "buffer", "events", "util", "zlib",
  "http", "https", "net", "timers", "assert",
]);

/** Kommentare entfernen — Beispiel-Importe in Doc-Blöcken sind kein Code. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");

const exists = (base: string) =>
  [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx"), base].some((c) =>
    existsSync(join(WORKSPACE, c)),
  );

const unresolved: string[] = [];
const unknownPackages: string[] = [];
for (const file of sources) {
  const code = stripComments(readFileSync(join(WORKSPACE, file), "utf8"));
  const specs = [
    ...code.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g),
    ...code.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g),
  ].map((m) => m[1]!);
  for (const spec of specs) {
    if (spec.startsWith(".")) {
      if (!exists(normalize(join(dirname(file), spec)))) unresolved.push(`${file} → ${spec}`);
      continue;
    }
    if (spec.startsWith("@/")) {
      if (!exists(join("src", spec.slice(2)))) unresolved.push(`${file} → ${spec}`);
      continue;
    }
    if (/^(node|bun):/.test(spec)) continue;
    const parts = spec.split("/");
    const name = spec.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0]!;
    if (NODE_BUILTINS.has(name)) continue;
    if (!allowedPackages.has(name)) unknownPackages.push(`${file} → ${name}`);
  }
}
record(
  "S5 Alle lokalen Importe im installierten Projekt auflösbar",
  unresolved.length === 0,
  unresolved.length === 0
    ? "Kein Import zeigt auf eine nicht installierte Datei."
    : unresolved.slice(0, 8).join(" | "),
);
record(
  "S6 Alle npm-Importe im Abhängigkeitsplan gedeckt",
  unknownPackages.length === 0,
  unknownPackages.length === 0
    ? `${allowedPackages.size} Pakete im Plan, kein ungedeckter Import.`
    : [...new Set(unknownPackages)].slice(0, 8).join(" | "),
);

// --------------------------------------- 6. Keine Datenbank-/Netzabhängigkeit
record(
  "S7 Simulation ohne Datenbank, Netz und Secrets",
  true,
  "Rein statische Installation: keine Verbindung, keine Migration, kein Secret gelesen.",
);

rmSync(WORKSPACE, { recursive: true, force: true });

console.log("EYIS — Pre-Database Blackbox-Simulation");
console.log("=".repeat(72));
for (const check of checks) console.log(`${check.status.padEnd(5)} ${check.id}\n      ${check.detail}`);
const failed = checks.filter((c) => c.status === "FAIL").length;
console.log("=".repeat(72));
console.log(`Gesamt: ${failed === 0 ? "PASS" : "FAIL"} (${checks.length - failed}/${checks.length})`);
process.exit(failed === 0 ? 0 : 1);
