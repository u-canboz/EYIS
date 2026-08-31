/**
 * Auslieferung des EYIS-Admin-Scopes (Phase 29).
 *
 * Blackbox-Befund: Das Distribution-Manifest beschrieb den CSS-Eingriff nur als
 * `.eyis-admin { /* EYIS Design-Tokens */ }`. Damit installierte ein Agent einen
 * leeren Scope — das Backoffice erbte anschließend die Tokens des Kunden-`:root`.
 *
 * Die echten Tokens stehen zwischen den Markern in `src/styles.css`. Diese Datei
 * extrahiert genau diesen Block in ein ausgeliefertes Artefakt
 * (`installer/distribution/eyis-admin-scope.css`) und prüft, dass es aktuell ist.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { CSS_MARKER_END, CSS_MARKER_START } from "../../src/lib/commerce/updates/integration-patch";

export const ROOT = process.cwd();
export const SOURCE_CSS = join(ROOT, "src", "styles.css");
export const SCOPE_FILE = join(ROOT, "installer", "distribution", "eyis-admin-scope.css");

/** Der Tokenblock ohne Marker — genau so, wie er ausgeliefert wird. */
export function extractAdminScope(css: string = readFileSync(SOURCE_CSS, "utf8")): string {
  const start = css.indexOf(CSS_MARKER_START);
  const end = css.indexOf(CSS_MARKER_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Admin-Scope-Marker in src/styles.css nicht gefunden.");
  }
  return `${css.slice(start + CSS_MARKER_START.length, end).trim()}\n`;
}

/** Mindestanforderungen an den Scope: er muss real isolieren, nicht nur existieren. */
export const REQUIRED_TOKENS = [
  "--background",
  "--foreground",
  "--primary",
  "--primary-foreground",
  "--muted",
  "--muted-foreground",
  "--border",
  "--ring",
  "--card",
  "--sidebar",
  "--radius",
  "--font-sans",
  "--font-display",
];

export function missingTokens(block: string): string[] {
  const scope = block.slice(block.indexOf(".eyis-admin"));
  return REQUIRED_TOKENS.filter((token) => !new RegExp(`${token}\\s*:`).test(scope));
}

export function generate(): string {
  const block = extractAdminScope();
  const missing = missingTokens(block);
  if (missing.length) {
    throw new Error(`Admin-Scope unvollständig — fehlende Tokens: ${missing.join(", ")}`);
  }
  const content = `/*
 * EYIS Admin Scope — ausgelieferter Token-Block für Dedicated-Installationen.
 * Wird markerbasiert in die kundeneigene src/styles.css eingefügt.
 * Erzeugt aus src/styles.css. Nicht von Hand bearbeiten.
 */
${block}`;
  writeFileSync(SCOPE_FILE, content, "utf8");
  return content;
}

export function check(): { status: "PASS" | "FAIL"; problems: string[] } {
  const problems: string[] = [];
  let delivered = "";
  try {
    delivered = readFileSync(SCOPE_FILE, "utf8");
  } catch {
    problems.push("installer/distribution/eyis-admin-scope.css fehlt.");
    return { status: "FAIL", problems };
  }
  const block = extractAdminScope();
  if (!delivered.includes(block.trim())) {
    problems.push("Ausgelieferter Admin-Scope weicht von src/styles.css ab (eyis:dist:admin-scope).");
  }
  const missing = missingTokens(delivered);
  if (missing.length) problems.push(`Fehlende Tokens im Scope: ${missing.join(", ")}`);
  if (/:root\s*\{/.test(delivered)) problems.push("Der ausgelieferte Scope darf kein :root deklarieren.");
  return { status: problems.length === 0 ? "PASS" : "FAIL", problems };
}

if (import.meta.main) {
  const mode = process.argv[2] ?? "generate";
  if (mode === "check") {
    const result = check();
    console.log("EYIS — Admin-Scope-Auslieferung");
    console.log("=".repeat(72));
    for (const problem of result.problems) console.log(`  ! ${problem}`);
    console.log(`Gesamt: ${result.status}`);
    process.exit(result.status === "PASS" ? 0 : 1);
  }
  generate();
  console.log(`Admin-Scope geschrieben: ${SCOPE_FILE}`);
}
