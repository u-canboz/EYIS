/**
 * Integration Patch — __root.tsx und styles.css (Phase 26, Hotfix rc.6).
 *
 * Das Distribution-Manifest erlaubt an kundeneigenen Dateien genau zwei
 * additive Eingriffe. Diese Datei enthält die einzige geprüfte Umsetzung.
 * Schlägt ein Patch strukturell fehl, wird ein Fehler geworfen — niemals
 * geraten, niemals halb gepatcht.
 *
 * rc.6: Marker sind JSX-Kommentare (`{/* EYIS:ROUTE_GUARD:START *‍/}`). Die
 * rc.5-Form `/* … *‍/` stand ungeschützt innerhalb von JSX und landete als
 * sichtbarer Text im DOM. Bestehende rc.5-Patches werden erkannt und beim
 * nächsten Lauf in die JSX-Form überführt (Outcome UPDATED).
 * `removeRootGuard` macht den Eingriff exakt rückgängig (Rollback-Pfad).
 */
export class IntegrationPatchError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "IntegrationPatchError";
    this.code = code;
  }
}

export type PatchOutcome = "INSERTED" | "UPDATED" | "NOOP";
export type PatchResult = { content: string; outcome: PatchOutcome };

// ------------------------------------------------------------------ CSS-Scope

export const CSS_MARKER_START = "/* EYIS:ADMIN_SCOPE:START */";
export const CSS_MARKER_END = "/* EYIS:ADMIN_SCOPE:END */";

/**
 * Fügt den Admin-Scope markerbasiert an oder ersetzt den Block zwischen den
 * Markern vollständig. Außerhalb der Marker bleibt die Datei byteweise
 * unverändert. `anchor` ist ein eindeutiger Bezeichner des Blocks.
 */
export function applyCssAdminScope(
  source: string,
  block: string,
  anchor = ".eyis-admin",
): PatchResult {
  const scoped = block.trim();
  if (!scoped.includes(anchor)) {
    throw new IntegrationPatchError(
      "CSS_SCOPE_INVALID",
      `Scope-Block ohne ${anchor}-Regel — der Patch würde Tokens auf :root verschieben.`,
    );
  }
  const next = `${CSS_MARKER_START}\n${scoped}\n${CSS_MARKER_END}`;
  const start = source.indexOf(CSS_MARKER_START);
  const end = source.indexOf(CSS_MARKER_END);
  if (
    (start !== -1 && source.indexOf(CSS_MARKER_START, start + 1) !== -1) ||
    (end !== -1 && source.indexOf(CSS_MARKER_END, end + 1) !== -1)
  ) {
    throw new IntegrationPatchError(
      "CSS_MARKERS_AMBIGUOUS",
      "Admin-Scope-Marker kommen mehrfach vor — manuelle Klärung nötig, kein Blind-Patch.",
    );
  }
  if ((start === -1) !== (end === -1) || (start !== -1 && end < start)) {
    throw new IntegrationPatchError(
      "CSS_MARKERS_INVALID",
      "CSS-Scope-Marker unvollständig oder in falscher Reihenfolge — kein Blind-Patch.",
    );
  }
  if (start === -1) {
    const trimmed = source.trimEnd();
    const content = trimmed.length > 0 ? `${trimmed}\n\n${next}\n` : `${next}\n`;
    return { content, outcome: "INSERTED" };
  }
  const before = source.slice(0, start).trimEnd();
  const after = source.slice(end + CSS_MARKER_END.length).trimStart();
  const content = before.length > 0 ? `${before}\n\n${next}\n${after}` : `${next}\n${after}`;
  const outcome: PatchOutcome = source === content ? "NOOP" : "UPDATED";
  return { content, outcome };
}

/**
 * Strukturelle CSS-Prüfung: ausbalancierte Klammern, keine HTML-Reste, kein
 * ungeschlossener Kommentar. Kein CSS-Parser — bewusst nur Belastbarkeit
 * des Patches, nicht der Kundensemantik.
 */
export function validateCss(source: string): void {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  if (/\/\*|\*\//.test(withoutComments)) {
    throw new IntegrationPatchError("CSS_INVALID", "Ungeschlossener CSS-Kommentar.");
  }
  let depth = 0;
  for (const ch of withoutComments) {
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    if (depth < 0) {
      throw new IntegrationPatchError("CSS_INVALID", "CSS-Klammerung unausgeglichen.");
    }
  }
  if (depth !== 0) {
    throw new IntegrationPatchError("CSS_INVALID", "CSS-Klammerung unausgeglichen.");
  }
  if (/<\/?[a-zA-Z]/.test(withoutComments)) {
    throw new IntegrationPatchError("CSS_INVALID", "HTML-Reste in der Stylesheet-Datei.");
  }
}

// --------------------------------------------------------------- Route-Guard

/**
 * Marker müssen JSX-Kommentare sein. `/* … *‍/` ist innerhalb von JSX
 * sichtbarer Text — genau das war der rc.5-Befund.
 *
 * ROOT_GUARD_MARKER_*  — kanonische, maskierte Form: `{/* … *​/}`
 * LEGACY_GUARD_MARKER_* — rc.5-Rohform ohne Klammern, nur zur Erkennung.
 */
export const ROOT_GUARD_MARKER_START = "{/* EYIS:ROUTE_GUARD:START */}";
export const ROOT_GUARD_MARKER_END = "{/* EYIS:ROUTE_GUARD:END */}";
const LEGACY_GUARD_MARKER_START = "/* EYIS:ROUTE_GUARD:START */";
const LEGACY_GUARD_MARKER_END = "/* EYIS:ROUTE_GUARD:END */";

export const ROOT_BOUNDARY_IMPORT =
  'import { EyisRouteBoundary } from "@/eyis/shell/EyisRouteBoundary";';
export const ROOT_BOUNDARY_OPEN = `${ROOT_GUARD_MARKER_START}<EyisRouteBoundary>`;
export const ROOT_BOUNDARY_CLOSE = `</EyisRouteBoundary>${ROOT_GUARD_MARKER_END}`;

function countOccurrences(source: string, needle: string): number {
  let count = 0;
  let index = source.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = source.indexOf(needle, index + needle.length);
  }
  return count;
}

/**
 * Anzahl unmaskierter Legacy-Marker: die Rohform, der NICHT direkt `{`
 * vorausgeht und `}` folgt (die maskierte JSX-Form enthält die Rohform als
 * Teilzeichenkette — ohne Lookaround würde sie doppelt gezählt).
 */
function countLegacyMarkers(source: string, marker: string): number {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (source.match(new RegExp(`(?<!\\{)${escaped}(?!\\})`, "g")) ?? []).length;
}

function legacyMarkersPresent(source: string): boolean {
  return (
    countLegacyMarkers(source, LEGACY_GUARD_MARKER_START) > 0 ||
    countLegacyMarkers(source, LEGACY_GUARD_MARKER_END) > 0
  );
}

/** Normalisiert rc.5-Rohmarker in die maskierte JSX-Form. */
function upgradeLegacyMarkers(source: string): string {
  return source
    .replace(/(?<!\{)\/\* EYIS:ROUTE_GUARD:START \*\/(?!\})/g, ROOT_GUARD_MARKER_START)
    .replace(/(?<!\{)\/\* EYIS:ROUTE_GUARD:END \*\/(?!\})/g, ROOT_GUARD_MARKER_END);
}

/** Eindeutiges benanntes `import { … } from "<module>"` — auch mehrzeilig. */
function namedImportFrom(source: string, module: string): RegExpMatchArray | null {
  const escaped = module.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*["']${escaped}["']`));
}

/**
 * Stellt sicher, dass genau ein Import von EyisRouteBoundary existiert:
 * - fehlt er ganz → neue Zeile am Dateianfang,
 * - Modul bereits importiert, Bezeichner fehlt → in die Klammern mergen,
 * - bereits vorhanden → unverändert.
 */
function ensureBoundaryImport(source: string): string {
  const existing = namedImportFrom(source, "@/eyis/shell/EyisRouteBoundary");
  if (existing) {
    const group = existing[1] ?? "";
    if (/\bEyisRouteBoundary\b/.test(group)) return source;
    const names = group.replace(/\s+$/, "");
    const merged = `import { ${names ? `${names.trim()}, ` : ""}EyisRouteBoundary } from "@/eyis/shell/EyisRouteBoundary"`;
    return source.replace(existing[0], merged);
  }
  if (/import\s+EyisRouteBoundary\b/.test(source)) {
    // Default-Import o.ä. — kein zweiter Import desselben Bezeichners.
    return source;
  }
  return `${ROOT_BOUNDARY_IMPORT}\n${source}`;
}

/**
 * Markerpaar suchen. Liefert Indizes direkt hinter dem öffnenden bzw. vor
 * dem schließenden Marker.
 */
function lookupMarkerIndex(
  source: string,
  startMarker: string,
  endMarker: string,
): { start: number; end: number } | null {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start !== -1 && end !== -1 && start < end) {
    return { start: start + startMarker.length, end };
  }
  return null;
}

/** Spanne des JSX-Rückgabewerts einer Komponente: erstes `(` nach `return`. */
function findJsxRange(source: string, fromIndex = 0): { open: number; close: number } | null {
  const returnMatch = /return\s*\(/.exec(source.slice(fromIndex));
  if (!returnMatch) return null;
  const open = fromIndex + returnMatch.index + returnMatch[0].length - 1;
  let depth = 0;
  let inString: string | null = null;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") {
      depth -= 1;
      if (depth === 0) return { open, close: i };
    }
  }
  return null;
}

/**
 * Innerster Wrapper um <Outlet /> im Layout-Return. Erkennt Element- und
 * Fragment-Formen (`<X …>…</X>`, `<>…</>`) und liefert die Spanne des
 * Wrapper-INHALTS (zwischen öffnendem und schließendem Tag).
 */
function findInnermostProvider(jsx: string): { start: number; end: number } | null {
  const outlet = jsx.indexOf("<Outlet");
  if (outlet === -1) return null;
  const tags: { name: string; openEnd: number; closing: boolean; selfClosing: boolean; index: number }[] = [];
  const tagPattern = /<\/?([A-Za-z][A-Za-z0-9_.]*)?[^>]*?>/g;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(jsx))) {
    const raw = match[0];
    if (/^<!--/.test(raw)) continue;
    tags.push({
      name: match[1] ?? "",
      openEnd: match.index + raw.length,
      closing: raw.startsWith("</"),
      selfClosing: !raw.startsWith("</") && raw.endsWith("/>"),
      index: match.index,
    });
  }
  const stack: { name: string; contentStart: number }[] = [];
  let innermost: { start: number; end: number } | null = null;
  for (const tag of tags) {
    if (!tag.closing) {
      if (!tag.selfClosing) stack.push({ name: tag.name, contentStart: tag.openEnd });
      continue;
    }
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i]!.name === tag.name) {
        const entry = stack.splice(i, 1)[0]!;
        // Das erste schließende Tag, das <Outlet /> umschließt, gehört zum
        // INNERSTEN Wrapper — äußere dürfen es nicht überschreiben.
        if (innermost === null && entry.contentStart <= outlet && outlet < tag.index) {
          innermost = { start: entry.contentStart, end: tag.index };
        }
        break;
      }
    }
  }
  return innermost;
}

/** Einrückung des ersten Kind-Elements einer Region. */
function childIndentOf(region: string): string {
  const firstLine = /\n([ \t]*)\S/.exec(region);
  return firstLine ? firstLine[1] : "  ";
}

/**
 * Fügt die EyisRouteBoundary markerbasiert um das Layout-Outlet ein.
 *
 * Regeln:
 * - Genau ein neuer Bezeichner (EyisRouteBoundary), genau ein Import.
 * - Die Boundary liegt innerhalb des innersten Providers — nie davor.
 * - Kein früher `return <Outlet />`; der bisherige Rückgabewert bleibt die
 *   einzige Rückgabe. Einrückung und schließende Tags bleiben unverändert.
 * - Idempotent: korrekt gepatchte Dateien → NOOP. rc.5-Markierung → UPDATED.
 */
export function applyRootGuard(source: string): PatchResult {
  const tagCount = countOccurrences(source, "<EyisRouteBoundary>");
  if (tagCount > 1) {
    throw new IntegrationPatchError(
      "ROOT_GUARD_AMBIGUOUS",
      "EyisRouteBoundary kommt mehrfach vor — manuelle Klärung nötig, kein Blind-Patch.",
    );
  }

  const hasMasked =
    source.includes(ROOT_GUARD_MARKER_START) && source.includes(ROOT_GUARD_MARKER_END);
  const hasLegacy = legacyMarkersPresent(source);

  if (hasMasked && !hasLegacy) {
    const start = source.indexOf(ROOT_GUARD_MARKER_START);
    const end = source.indexOf(ROOT_GUARD_MARKER_END);
    if (start < end) return { content: source, outcome: "NOOP" };
    throw new IntegrationPatchError(
      "ROOT_MARKERS_INVALID",
      "Route-Guard-Marker in falscher Reihenfolge — manuelle Klärung nötig.",
    );
  }

  if (hasMasked || hasLegacy) {
    // Teilweise oder Legacy-Markierung: in die JSX-Form überführen, dann prüfen.
    const upgraded = upgradeLegacyMarkers(source);
    const start = upgraded.indexOf(ROOT_GUARD_MARKER_START);
    const end = upgraded.indexOf(ROOT_GUARD_MARKER_END);
    if (start === -1 || end === -1 || end < start) {
      throw new IntegrationPatchError(
        "ROOT_MARKERS_INVALID",
        "Route-Guard-Marker unvollständig oder in falscher Reihenfolge — manuelle Klärung nötig.",
      );
    }
    if (tagCount === 0) {
      throw new IntegrationPatchError(
        "ROOT_MARKERS_INVALID",
        "Route-Guard-Marker ohne EyisRouteBoundary — manuelle Klärung nötig.",
      );
    }
    const withImport = ensureBoundaryImport(upgraded);
    return { content: withImport, outcome: withImport === source ? "NOOP" : "UPDATED" };
  }

  if (/return\s*<Outlet\s*\/>/.test(source)) {
    throw new IntegrationPatchError(
      "ROOT_EARLY_RETURN",
      "Früher `return <Outlet />` im Root-Layout — ein Guard würde EYIS-Routen nicht zuverlässig kapseln. Manuelle Klärung nötig.",
    );
  }
  const returnIndex = source.search(/return\s*\(/);
  if (returnIndex === -1) {
    throw new IntegrationPatchError(
      "ROOT_RETURN_NOT_FOUND",
      "Kein JSX-Return im Root-Layout gefunden — Patch abgebrochen statt geraten.",
    );
  }
  const jsx = findJsxRange(source, returnIndex);
  if (!jsx) {
    throw new IntegrationPatchError(
      "ROOT_JSX_RANGE",
      "Die Klammerung des Root-Returns konnte nicht zuverlässig bestimmt werden.",
    );
  }
  const body = source.slice(jsx.open + 1, jsx.close);
  const provider = findInnermostProvider(body);
  const wrapStart = provider ? jsx.open + 1 + provider.start : jsx.open + 1;
  const wrapEnd = provider ? jsx.open + 1 + provider.end : jsx.close;

  const inner = source.slice(wrapStart, wrapEnd);
  const indent = childIndentOf(inner);
  // Abschließendes "\n<einrückung>" gehört zur Zeile des schließenden Tags —
  // es bleibt erhalten, der Boundary-Schluss bekommt eine eigene Zeile.
  const trailing = /\n[ \t]*$/.exec(inner);
  const innerBody = trailing ? inner.slice(0, trailing.index) : inner;
  const tail = trailing ? trailing[0] : "";
  const patched =
    `${source.slice(0, wrapStart)}\n${indent}${ROOT_BOUNDARY_OPEN}${innerBody}\n${indent}${ROOT_BOUNDARY_CLOSE}${tail}` +
    source.slice(wrapEnd);

  return { content: ensureBoundaryImport(patched), outcome: "INSERTED" };
}

/**
 * Rollback: entfernt die Guard exakt. Löscht ausschließlich die eingefügten
 * Marker, die beiden Boundary-Tags und — falls von EYIS gesetzte — die
 * Importzeile. Kundeninhalte zwischen den Markern bleiben byteweise
 * unverändert. Kein Guard vorhanden → NOOP.
 */
export function removeRootGuard(source: string): PatchResult {
  if (
    !source.includes("<EyisRouteBoundary>") &&
    !source.includes("EYIS:ROUTE_GUARD")
  ) {
    return { content: source, outcome: "NOOP" };
  }

  let content = source;
  // Öffnende Seite: die eingefügte Zeile "\n<einrückung>{/*START*/}<EyisRouteBoundary>".
  content = content.replace(
    /\n[ \t]*\{?\/\* EYIS:ROUTE_GUARD:START \*\/\}?<EyisRouteBoundary>/,
    "",
  );
  // Schließende Seite: eingefügte Zeile "\n<einrückung></EyisRouteBoundary>{/*END*/}".
  content = content.replace(
    /\n[ \t]*<\/EyisRouteBoundary>\{?\/\* EYIS:ROUTE_GUARD:END \*\/\}?/,
    "",
  );

  if (content.includes("<EyisRouteBoundary>") || content.includes("EYIS:ROUTE_GUARD")) {
    throw new IntegrationPatchError(
      "ROOT_GUARD_ROLLBACK_INCOMPLETE",
      "Route-Guard konnte nicht vollständig entfernt werden — manuelle Klärung nötig.",
    );
  }

  // Importzeile nur entfernen, wenn es exakt die von EYIS gesetzte Zeile ist.
  if (content.startsWith(`${ROOT_BOUNDARY_IMPORT}\n`)) {
    content = content.slice(ROOT_BOUNDARY_IMPORT.length + 1);
  }
  return { content, outcome: source === content ? "NOOP" : "UPDATED" };
}

/**
 * Strukturelle Prüfung einer __root.tsx nach dem Patch. Prüft nur Belastbarkeit:
 * genau ein Guard, Marker vollständig und maskiert, Outlet weiterhin
 * gerendert, kein früher Return vor dem Guard.
 */
export function validateRoot(source: string): void {
  const starts = countOccurrences(source, ROOT_GUARD_MARKER_START);
  const ends = countOccurrences(source, ROOT_GUARD_MARKER_END);
  if (starts !== 1 || ends !== 1) {
    throw new IntegrationPatchError(
      "ROOT_MARKERS_INVALID",
      `Route-Guard-Marker müssen je genau einmal vorkommen (START: ${starts}, END: ${ends}).`,
    );
  }
  if (countOccurrences(source, "<EyisRouteBoundary>") !== 1) {
    throw new IntegrationPatchError(
      "ROOT_GUARD_AMBIGUOUS",
      "EyisRouteBoundary muss genau einmal gerendert werden.",
    );
  }
  // Unmaskierte Rohmarker würden als sichtbarer Text im DOM landen.
  if (
    countLegacyMarkers(source, LEGACY_GUARD_MARKER_START) > 0 ||
    countLegacyMarkers(source, LEGACY_GUARD_MARKER_END) > 0
  ) {
    throw new IntegrationPatchError(
      "ROOT_MARKERS_NOT_JSX",
      "Route-Guard-Marker sind keine JSX-Kommentare — sie würden als sichtbarer Text rendern.",
    );
  }
  if (!source.includes("<Outlet")) {
    throw new IntegrationPatchError("ROOT_OUTLET_MISSING", "<Outlet /> fehlt im Root-Layout.");
  }
  const guardAt = source.indexOf(ROOT_GUARD_MARKER_START);
  const earlyReturn = source.slice(0, guardAt).search(/return\s*<Outlet\s*\/>/);
  if (earlyReturn !== -1) {
    throw new IntegrationPatchError(
      "ROOT_EARLY_RETURN",
      "Früher Return vor dem Route-Guard — Kunden-Chrome würde für EYIS-Routen verloren gehen.",
    );
  }
}

/** Stylesheet-Prüfung nach dem Scope-Patch: Marker vorhanden, Scope nicht leer. */
export function validateStylesheet(source: string): void {
  validateCss(source);
  const marker = lookupMarkerIndex(source, CSS_MARKER_START, CSS_MARKER_END);
  if (!marker) {
    throw new IntegrationPatchError("CSS_MARKERS_INVALID", "Admin-Scope-Marker fehlen.");
  }
  const block = source.slice(marker.start, marker.end);
  if (!block.includes(".eyis-admin") || !block.includes("--primary")) {
    throw new IntegrationPatchError(
      "CSS_SCOPE_EMPTY",
      "Admin-Scope ist leer oder ohne Tokens — das Backoffice würde Kunden-:root erben.",
    );
  }
}

/** Lesbarer Diff für den Freigabe-Dialog des Update Centers. */
export function createStylesheetDiff(before: string, after: string): string {
  if (before === after) return "Keine Änderung.";
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const added = afterLines.filter((line) => !beforeLines.includes(line));
  const removed = beforeLines.filter((line) => !afterLines.includes(line));
  const parts: string[] = [];
  if (added.length > 0) parts.push(`+ ${added.length} Zeilen (Scope/Token-Block)`);
  if (removed.length > 0) parts.push(`− ${removed.length} Zeilen`);
  return parts.join(" · ") || "Formatierung geändert.";
}
