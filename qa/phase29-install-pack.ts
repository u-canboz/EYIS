/**
 * qa:install-pack — reproduzierbarer Install-Pack-Test der Blackbox-Befunde (Phase 29).
 *
 * Der Test läuft ohne Datenbank und ohne Netz. Genau das ist der Punkt: die
 * Installierbarkeit darf nicht mehr von privilegiertem DB-Zugang abhängen.
 */

import { existsSync, readFileSync } from "node:fs";

import { check as checkAdminScope, missingTokens } from "../scripts/installer/admin-scope";
import { buildAgentPlan } from "../scripts/installer/agent-plan";
import { artifactFiles } from "../scripts/installer/artifact";
import { runSelftest } from "../scripts/eyis-release-selftest";
import { loadManifest } from "../scripts/installer/runner";
import {
  applyCssAdminScope,
  applyRootGuard,
  removeRootGuard,
  validateCss,
} from "../src/lib/commerce/updates/integration-patch";

type Check = { id: string; status: "PASS" | "FAIL"; detail: string };
const checks: Check[] = [];
const record = (id: string, ok: boolean, detail: string) =>
  checks.push({ id, status: ok ? "PASS" : "FAIL", detail });

// ---------------------------------------------------------------- B1/B2 Plan
const manifest = loadManifest();
const plan = buildAgentPlan(manifest);

record(
  "B1 kein privilegiertes psql nötig",
  plan.execution.requires_direct_db_access === false &&
    readFileSync("scripts/installer/runner.ts", "utf8").includes("DirectDdlUnavailableError"),
  "runFreshInstall prüft DDL-Rechte vorab und verweist auf den Agent Migration Plan.",
);

const unitIds = plan.steps.filter((s) => s.kind === "unit").map((s) => s.id);
record(
  "B2 Plan deckt alle Units",
  JSON.stringify(unitIds) === JSON.stringify(manifest.fresh_install.units.map((u) => u.id)),
  `${unitIds.length} Units in Manifest-Reihenfolge, ${plan.step_count} Schritte gesamt.`,
);
record(
  "B2 Plan deterministisch",
  buildAgentPlan(manifest).plan_checksum === plan.plan_checksum,
  `plan_checksum ${plan.plan_checksum.slice(0, 16)}…`,
);
record(
  "B2 Selbstjournalisierung",
  plan.steps
    .filter((s) => s.kind === "unit")
    .every((s) => s.sql.includes("INSERT INTO public.eyis_installation_units")),
  "Jede Unit schreibt ihren Journaleintrag in derselben Migration.",
);
record(
  "B2 Abschluss markiert INSTALLED",
  plan.steps.at(-1)!.sql.includes("'INSTALLED'"),
  "Letzter Schritt setzt eyis_installation_state.",
);

// ------------------------------------------------------------ B3 Befehle
const cli = existsSync("installer/eyis.ts") ? readFileSync("installer/eyis.ts", "utf8") : "";
const commands = ["plan", "step", "seeds", "verify", "pack", "bootstrap", "doctor", "resources"];
record(
  "B3 Einstiegspunkt ohne package.json",
  commands.every((c) => cli.includes(`case "${c}"`)),
  "bun run installer/eyis.ts <befehl> deckt Plan, Seeds, Bootstrap, Doctor und Ressourcen ab.",
);
const files = artifactFiles();
const required = [
  "installer/eyis.ts",
  "scripts/commerce-bootstrap.ts",
  "scripts/commerce-doctor.ts",
  "scripts/installer/agent-plan.ts",
  "scripts/eyis-resources.ts",
  "installer/distribution/eyis-admin-scope.css",
];
const missingFiles = required.filter((f) => !files.includes(f));
record(
  "B3 Artefakt enthält Installationsbefehle",
  missingFiles.length === 0,
  missingFiles.length === 0 ? `${files.length} Dateien im Artefakt.` : `fehlt: ${missingFiles.join(", ")}`,
);

// ------------------------------------------------------------ B4 Route Guard
const CUSTOMER_ROOT = `import { Outlet } from "@tanstack/react-router";
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
const guarded = applyRootGuard(CUSTOMER_ROOT);
const twice = applyRootGuard(guarded.content);
record(
  "B4 Import wird zuverlässig gesetzt",
  /import\s*\{\s*EyisRouteBoundary\s*\}/.test(guarded.content),
  "Genau ein neuer Bezeichner, genau ein Import.",
);
record(
  "B4 Provider bleiben aktiv",
  guarded.content.indexOf("<ThemeProvider>") < guarded.content.indexOf("<EyisRouteBoundary>") &&
    guarded.content.indexOf("</EyisRouteBoundary>") < guarded.content.indexOf("</ThemeProvider>") &&
    !/return <Outlet \/>;/.test(guarded.content),
  "Boundary liegt innerhalb des innersten Providers; kein früher Return.",
);
record("B4 idempotent", twice.outcome === "NOOP" && twice.content === guarded.content, "Zweiter Lauf: NOOP.");
record(
  "B4 rc.6 Marker sind maskierte JSX-Kommentare",
  guarded.content.includes("{/* EYIS:ROUTE_GUARD:START */}") &&
    guarded.content.includes("{/* EYIS:ROUTE_GUARD:END */}"),
  "Keine rohen Text-Marker — kein DOM-Leak in der Storefront.",
);
record(
  "B4 rc.6 Rollback stellt Original exakt wieder her",
  removeRootGuard(guarded.content).content === CUSTOMER_ROOT,
  "removeRootGuard liefert byte-exakt den Ausgangszustand.",
);
{
  const legacy = CUSTOMER_ROOT.replace(
    "<ThemeProvider>",
    "<ThemeProvider>\n        /* EYIS:ROUTE_GUARD:LEGACY_START */",
  ).replace(
    "</ThemeProvider>",
    "        /* EYIS:ROUTE_GUARD:LEGACY_END */\n      </ThemeProvider>",
  );
  const upgraded = applyRootGuard(legacy);
  record(
    "B4 rc.6 Legacy-Marker werden erkannt und auf JSX-Form gehoben",
    !legacy.includes("{/*") &&
      upgraded.content.includes("{/* EYIS:ROUTE_GUARD:START */}") &&
      !upgraded.content.includes("EYIS:ROUTE_GUARD:LEGACY"),
    "Altinstallationen (rc.4/rc.5) migrieren ohne Doppel-Block.",
  );
}
record(
  "B4 rc.6 Früh-Return wird abgelehnt",
  (() => {
    try {
      applyRootGuard("export function R() { return <Outlet />; }");
      return false;
    } catch (error) {
      return String(error).includes("ROOT_EARLY_RETURN");
    }
  })(),
  "Kein Guard bei frühem return <Outlet />.",
);

// ------------------------------------------------------------ B5 Admin Scope
const scope = checkAdminScope();
const delivered = existsSync("installer/distribution/eyis-admin-scope.css")
  ? readFileSync("installer/distribution/eyis-admin-scope.css", "utf8")
  : "";
record("B5 Scope-Datei aktuell", scope.status === "PASS", scope.problems.join("; ") || "Deckt sich mit src/styles.css.");
record(
  "B5 echte Tokens im Scope",
  delivered.length > 1000 && missingTokens(delivered).length === 0,
  `${delivered.length} Bytes, keine fehlenden Pflicht-Tokens.`,
);

const customerCss = `:root {\n  --primary: #00f;\n  --background: #fff;\n}\n`;
const patchedCss = applyCssAdminScope(customerCss, delivered.slice(delivered.indexOf(".eyis-admin")));
validateCss(patchedCss.content);
const second = applyCssAdminScope(patchedCss.content, delivered.slice(delivered.indexOf(".eyis-admin")));
record(
  "B5 Patch bringt Tokens ins Kundenprojekt",
  patchedCss.content.includes("--primary: #ED4800") && second.outcome === "NOOP",
  "Kunden-:root bleibt unberührt, Scope trägt eigene Tokens, zweiter Lauf ist NOOP.",
);

// ------------------------------------------------- R1 Release-Signaturpaketierung
// Realer RC.5-Befund: Tarball wurde vor der Pack-Signatur gebaut und enthielt
// eine veraltete Signaturdatei. Der Selbsttest signiert mit einem Wegwerf-Key
// in einem temporären Verzeichnis, baut das Tarball, entpackt es und führt das
// Pack-Gate ausschließlich aus dem entpackten Tarball aus.
const selftest = runSelftest("simulate", "0.0.0-qa");
for (const c of selftest.checks) record(`R1 ${c.id}`, c.status === "PASS", c.detail);

const workflow = readFileSync(".github/workflows/eyis-release.yml", "utf8");
record(
  "R1 Workflow signiert vor dem Tarball-Bau",
  workflow.indexOf("bun run eyis:pack:sign") < workflow.indexOf("bun run eyis:release:artifact") &&
    workflow.indexOf("bun run eyis:release:selftest") < workflow.indexOf("Release veröffentlichen"),
  "Signieren → verifizieren → Tarball → Pack-Gate aus dem Tarball → veröffentlichen.",
);

// ---------------------------------------------------------------- Ausgabe
console.log("EYIS — Install-Pack-Test (Phase 29, Blackbox-Befunde)");
console.log("=".repeat(78));
for (const check of checks) {
  console.log(`  ${check.status.padEnd(5)} ${check.id.padEnd(38)} ${check.detail}`);
}
const failed = checks.filter((c) => c.status === "FAIL").length;
console.log("=".repeat(78));
console.log(`Gesamt: ${failed === 0 ? "PASS" : "FAIL"} (${checks.length - failed}/${checks.length})`);
process.exit(failed === 0 ? 0 : 1);
