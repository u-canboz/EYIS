/**
 * Integration-Patch-Engine (Phase 26).
 *
 * Genau zwei kundeneigene Dateien werden bei einer Dedicated-Installation additiv
 * angefasst: `src/styles.css` (Admin-Scope) und `src/routes/__root.tsx` (Route
 * Guard). Im Blackbox-Test entstand dort ein Buildfehler, weil der CSS-Block ein
 * zweites Mal angehängt wurde.
 *
 * Diese Engine ist deshalb rein und markerbasiert: zweimaliges Anwenden erzeugt
 * exakt dasselbe Ergebnis wie einmaliges Anwenden. Kein Anhängen ohne
 * Zustandsprüfung, niemals ein zweiter Block.
 */

export const CSS_MARKER_START = "/* EYIS:ADMIN_SCOPE:START */";
export const CSS_MARKER_END = "/* EYIS:ADMIN_SCOPE:END */";

export const ROOT_GUARD_IMPORT =
  'import { isEyisInternalRoute } from "@/lib/eyis/route-boundary";';
export const ROOT_GUARD_MARKER_START = "/* EYIS:ROUTE_GUARD:START */";
export const ROOT_GUARD_MARKER_END = "/* EYIS:ROUTE_GUARD:END */";

export type PatchOutcome = "INSERTED" | "UPDATED" | "NOOP";
export type PatchResult = { content: string; outcome: PatchOutcome };

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

export class IntegrationPatchError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "IntegrationPatchError";
    this.code = code;
  }
}

/** Der markierte Block inklusive Markern. */
export function wrapCssBlock(block: string): string {
  return `${CSS_MARKER_START}\n${block.trim()}\n${CSS_MARKER_END}`;
}

/**
 * Fügt den EYIS-Admin-Scope in eine kundeneigene `styles.css` ein.
 *  - Block fehlt        → einmal am Ende einfügen
 *  - Block identisch    → NOOP
 *  - Block abweichend   → innerhalb der Marker ersetzen
 *  - mehrere Blöcke     → harter Fehler statt stillem Anhängen
 */
export function applyCssAdminScope(css: string, block: string): PatchResult {
  const starts = countOccurrences(css, CSS_MARKER_START);
  const ends = countOccurrences(css, CSS_MARKER_END);
  if (starts !== ends) {
    throw new IntegrationPatchError(
      "CSS_MARKER_UNBALANCED",
      "Unvollständiger EYIS-Marker in styles.css — Patch wird nicht angewendet.",
    );
  }
  if (starts > 1) {
    throw new IntegrationPatchError(
      "CSS_MARKER_DUPLICATE",
      "Mehrere EYIS-Admin-Scope-Blöcke in styles.css gefunden — Patch wird nicht angewendet.",
    );
  }

  const desired = wrapCssBlock(block);

  if (starts === 0) {
    const separator = css.endsWith("\n") ? "\n" : "\n\n";
    return { content: `${css}${separator}${desired}\n`, outcome: "INSERTED" };
  }

  const from = css.indexOf(CSS_MARKER_START);
  const to = css.indexOf(CSS_MARKER_END) + CSS_MARKER_END.length;
  const current = css.slice(from, to);
  if (current === desired) return { content: css, outcome: "NOOP" };
  return { content: `${css.slice(0, from)}${desired}${css.slice(to)}`, outcome: "UPDATED" };
}

/** Sehr einfache Strukturprüfung: ausgeglichene Klammern, kein leerer Block. */
export function validateCss(css: string): void {
  let depth = 0;
  for (const char of css) {
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth < 0) {
      throw new IntegrationPatchError("CSS_INVALID", "styles.css hat unausgeglichene Klammern.");
    }
  }
  if (depth !== 0) {
    throw new IntegrationPatchError("CSS_INVALID", "styles.css hat unausgeglichene Klammern.");
  }
  if (countOccurrences(css, CSS_MARKER_START) > 1) {
    throw new IntegrationPatchError("CSS_INVALID", "Doppelter EYIS-Admin-Scope-Block.");
  }
}

export const ROOT_BOUNDARY_IMPORT =
  'import { EyisRouteBoundary } from "@/eyis/shell/EyisRouteBoundary";';
export const ROOT_BOUNDARY_OPEN = `${ROOT_GUARD_MARKER_START}<EyisRouteBoundary>`;
export const ROOT_BOUNDARY_CLOSE = `</EyisRouteBoundary>${ROOT_GUARD_MARKER_END}`;

/** Öffnendes Tag des innersten Providers, falls vorhanden. */
function innermostProvider(jsx: string): { name: string; openEnd: number; closeStart: number } | null {
  const openTag = /<([A-Z][A-Za-z0-9_]*Provider)\b[^>]*?>/g;
  let last: { name: string; openEnd: number } | null = null;
  let match: RegExpExecArray | null;
  while ((match = openTag.exec(jsx)) !== null) {
    if (match[0].endsWith("/>")) continue;
    last = { name: match[1]!, openEnd: match.index + match[0].length };
  }
  if (!last) return null;
  const closeStart = jsx.lastIndexOf(`</${last.name}>`);
  if (closeStart <= last.openEnd) {
    throw new IntegrationPatchError(
      "ROOT_PROVIDER_UNBALANCED",
      `Schließendes Tag für <${last.name}> nicht gefunden — Patch wird nicht angewendet.`,
    );
  }
  return { ...last, closeStart };
}

/**
 * Integriert die Route-Boundary in ein kundeneigenes Root-Layout.
 *
 * Zwei harte Anforderungen aus dem Blackbox-Test:
 *  - Der Eingriff darf keine Provider des Kundenprojekts umgehen. Deshalb wird
 *    NICHT früh aus der Komponente zurückgekehrt, sondern der Inhalt INNERHALB
 *    des innersten Providers gekapselt.
 *  - Es wird kein Hook eingefügt, dessen Import fehlen könnte. Der einzige neue
 *    Bezeichner ist `EyisRouteBoundary`, und genau dessen Import wird gesetzt.
 *
 * Bestehende Integration ⇒ NOOP.
 */
export function applyRootGuard(source: string, componentName = "RootLayout"): PatchResult {
  if (countOccurrences(source, ROOT_GUARD_MARKER_START) > 1) {
    throw new IntegrationPatchError(
      "ROOT_GUARD_DUPLICATE",
      "Mehrere EYIS-Route-Guards in __root.tsx gefunden — Patch wird nicht angewendet.",
    );
  }
  const hasBoundary = source.includes(ROOT_GUARD_MARKER_START);
  const hasImport = source.includes("EyisRouteBoundary") && /import\s[^\n]*EyisRouteBoundary/.test(source);
  if (hasBoundary && hasImport) return { content: source, outcome: "NOOP" };

  const anchor = new RegExp(`function ${componentName}\\s*\\([^)]*\\)\\s*\\{`);
  const match = anchor.exec(source);
  if (!match) {
    throw new IntegrationPatchError(
      "ROOT_ANCHOR_MISSING",
      `Root-Komponente ${componentName} nicht gefunden — Patch wird nicht angewendet.`,
    );
  }

  let content = source;
  if (!hasBoundary) {
    const bodyStart = match.index + match[0].length;
    const returnIndex = content.indexOf("return (", bodyStart);
    if (returnIndex === -1) {
      throw new IntegrationPatchError(
        "ROOT_RETURN_MISSING",
        `Kein "return (" in ${componentName} gefunden — Patch wird nicht angewendet.`,
      );
    }
    const jsxStart = returnIndex + "return (".length;
    const jsxEnd = content.lastIndexOf(")", content.length);
    const jsx = content.slice(jsxStart, jsxEnd);
    const provider = innermostProvider(jsx);

    // Ohne Provider wird der gesamte Rückgabebaum gekapselt, mit Provider nur
    // dessen Inhalt — die Provider selbst bleiben in jedem Fall aktiv.
    const from = provider ? jsxStart + provider.openEnd : jsxStart;
    const to = provider ? jsxStart + provider.closeStart : jsxEnd;
    const inner = content.slice(from, to);
    content = `${content.slice(0, from)}\n      ${ROOT_BOUNDARY_OPEN}${inner}${ROOT_BOUNDARY_CLOSE}\n      ${content.slice(to)}`;
  }
  if (!hasImport) {
    content = `${ROOT_BOUNDARY_IMPORT}\n${content}`;
  }
  return { content, outcome: "INSERTED" };
}
