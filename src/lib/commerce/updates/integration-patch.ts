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
import { parse as parseTsx } from "@babel/parser";

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
    (end !== -1 && source.indexOf(CSS_MARKER_END, end + 1) !== -1) ||
    (start === -1) !== (end === -1) ||
    (start !== -1 && end < start)
  ) {
    throw new IntegrationPatchError(
      "CSS_MARKERS_INVALID",
      "CSS-Scope-Marker mehrfach, unvollständig oder in falscher Reihenfolge — kein Blind-Patch.",
    );
  }
  if (start === -1) {
    const trimmed = source.trimEnd();
    const content = trimmed.length > 0 ? `${trimmed}\n\n${next}\n` : `${next}\n`;
    validateCss(content);
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
 * Marker müssen JSX-Kommentare sein. Die rc.5-Rohform stand ungeschützt in
 * JSX und landete als sichtbarer Text im DOM.
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

/** Normalisiert rc.5/rc.6-Rohmarker in die maskierte JSX-Form. */
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

function ensureBoundaryImport(source: string): string {
  const existing = namedImportFrom(source, "@/eyis/shell/EyisRouteBoundary");
  if (existing) {
    const group = existing[1] ?? "";
    if (/\bEyisRouteBoundary\b/.test(group)) return source;
    const names = group.replace(/\s+$/, "");
    const merged = `import { ${names ? `${names.trim()}, ` : ""}EyisRouteBoundary } from "@/eyis/shell/EyisRouteBoundary"`;
    return source.replace(existing[0], merged);
  }
  if (/import\s+EyisRouteBoundary\b/.test(source)) return source;
  return `${ROOT_BOUNDARY_IMPORT}\n${source}`;
}

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

// ------------------------------------------------- Quelltext-Scanner (roh-TS)

const PAIR: Record<string, string> = { "(": ")", "{": "}", "[": "]" };

/**
 * Findet zum Trennzeichen an `open` das passende Gegenstück. Strings,
 * Template-Literale sowie Zeilen- und Blockkommentare werden übersprungen.
 */
function matchDelimiter(source: string, open: number): number {
  const closeCh = PAIR[source[open] ?? ""];
  if (!closeCh) return -1;
  const openCh = source[open]!;
  let depth = 0;
  let inString: string | null = null;
  let line = false;
  let block = false;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (line) {
      if (ch === "\n") line = false;
      continue;
    }
    if (block) {
      if (ch === "*" && next === "/") {
        block = false;
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
      line = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      block = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }
    if (ch === openCh) depth += 1;
    else if (ch === closeCh) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Nächstes nicht-leeres, nicht-kommentiertes Zeichen ab `from`. */
function nextMeaningful(source: string, from: number): number {
  let i = from;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === undefined) return -1;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      if (end === -1) return -1;
      i = end + 2;
      continue;
    }
    return i;
  }
  return -1;
}

/**
 * Spanne eines JSX-Elements oder -Fragments, das bei `start` (`<`) beginnt.
 * Liefert den Index HINTER dem schließenden Tag.
 */
function jsxElementEnd(source: string, start: number): number {
  let i = start;
  let depth = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "{") {
      const close = matchDelimiter(source, i);
      if (close === -1) return -1;
      i = close + 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < source.length && source[i] !== quote) i += source[i] === "\\" ? 2 : 1;
      i++;
      continue;
    }
    if (ch === "<") {
      const closing = source[i + 1] === "/";
      // Tag bis zum zugehörigen `>` überspringen (Attribute können `{}` enthalten).
      let j = i + 1;
      let selfClosing = false;
      while (j < source.length) {
        const c = source[j];
        if (c === "{") {
          const close = matchDelimiter(source, j);
          if (close === -1) return -1;
          j = close + 1;
          continue;
        }
        if (c === '"' || c === "'") {
          const quote = c;
          j++;
          while (j < source.length && source[j] !== quote) j++;
          j++;
          continue;
        }
        if (c === ">") {
          selfClosing = source[j - 1] === "/";
          break;
        }
        j++;
      }
      if (j >= source.length) return -1;
      if (closing) {
        depth -= 1;
        if (depth === 0) return j + 1;
      } else if (!selfClosing) {
        depth += 1;
      } else if (depth === 0) {
        return j + 1;
      }
      i = j + 1;
      continue;
    }
    i++;
  }
  return -1;
}

type ComponentDef = {
  name: string;
  start: number;
  end: number;
  /** Inhaltsbereich des Render-Ausdrucks (JSX-Baum ohne umgebende Klammern). */
  render: { start: number; end: number } | null;
};

/** Render-Ausdruck einer Komponente ab dem Rumpf-Beginn bestimmen. */
function renderRangeInBlock(source: string, bodyOpen: number, bodyClose: number) {
  const pattern = /\breturn\b/g;
  pattern.lastIndex = bodyOpen;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    if (match.index > bodyClose) break;
    const after = nextMeaningful(source, match.index + match[0].length);
    if (after === -1) break;
    const ch = source[after];
    if (ch === "(") {
      const close = matchDelimiter(source, after);
      if (close === -1 || close > bodyClose) return null;
      // Nur JSX-Rückgaben sind patchbar — `return (1 + 2)` wird übersprungen.
      const inner = source.slice(after + 1, close);
      if (!/<\s*[A-Za-z>]/.test(inner)) continue;
      return { start: after + 1, end: close };
    }
    if (ch === "<") {
      const end = jsxElementEnd(source, after);
      if (end === -1 || end > bodyClose) return null;
      return { start: after, end };
    }
  }
  return null;
}

/** Alle Komponentendefinitionen (PascalCase) der Datei mit Render-Bereich. */
function componentDefinitions(source: string): ComponentDef[] {
  const defs: ComponentDef[] = [];

  const fnPattern = /(?:^|\n)[ \t]*(?:export\s+)?(?:default\s+)?function\s+([A-Z][\w$]*)\s*[(<]/g;
  let match: RegExpExecArray | null;
  while ((match = fnPattern.exec(source))) {
    const nameStart = source.indexOf(match[1]!, match.index);
    const paren = source.indexOf("(", nameStart);
    if (paren === -1) continue;
    const parenEnd = matchDelimiter(source, paren);
    if (parenEnd === -1) continue;
    const braceRel = source.indexOf("{", parenEnd);
    if (braceRel === -1) continue;
    const braceEnd = matchDelimiter(source, braceRel);
    if (braceEnd === -1) continue;
    defs.push({
      name: match[1]!,
      start: match.index,
      end: braceEnd,
      render: renderRangeInBlock(source, braceRel, braceEnd),
    });
  }

  const varPattern = /(?:^|\n)[ \t]*(?:export\s+)?(?:const|let|var)\s+([A-Z][\w$]*)\s*(?::[^=\n]*)?=/g;
  while ((match = varPattern.exec(source))) {
    const eq = source.indexOf("=", match.index + match[0].length - 1);
    let i = nextMeaningful(source, eq + 1);
    if (i === -1) continue;
    // Parameterliste bzw. einzelner Parameter vor `=>` überspringen.
    if (source[i] === "(") {
      const close = matchDelimiter(source, i);
      if (close === -1) continue;
      i = nextMeaningful(source, close + 1);
    } else if (/[A-Za-z_$]/.test(source[i] ?? "")) {
      while (i < source.length && /[\w$]/.test(source[i] ?? "")) i++;
      i = nextMeaningful(source, i);
    }
    if (i === -1) continue;
    // Optionale Rückgabetyp-Annotation.
    if (source[i] === ":") {
      const arrow = source.indexOf("=>", i);
      if (arrow === -1) continue;
      i = arrow;
    }
    if (source.slice(i, i + 2) !== "=>") continue;
    const bodyStart = nextMeaningful(source, i + 2);
    if (bodyStart === -1) continue;
    const ch = source[bodyStart];
    if (ch === "{") {
      const close = matchDelimiter(source, bodyStart);
      if (close === -1) continue;
      defs.push({
        name: match[1]!,
        start: match.index,
        end: close,
        render: renderRangeInBlock(source, bodyStart, close),
      });
      continue;
    }
    if (ch === "(") {
      const close = matchDelimiter(source, bodyStart);
      if (close === -1) continue;
      const inner = source.slice(bodyStart + 1, close);
      defs.push({
        name: match[1]!,
        start: match.index,
        end: close,
        render: /<\s*[A-Za-z>]/.test(inner) ? { start: bodyStart + 1, end: close } : null,
      });
      continue;
    }
    if (ch === "<") {
      const end = jsxElementEnd(source, bodyStart);
      if (end === -1) continue;
      defs.push({
        name: match[1]!,
        start: match.index,
        end,
        render: { start: bodyStart, end },
      });
    }
  }

  return defs.sort((a, b) => a.start - b.start);
}

/** Im Routen-Setup referenzierter Root-Komponentenname, falls eindeutig. */
function declaredRootComponentName(source: string): string | null {
  const names = new Set<string>();
  const pattern = /createRootRoute(?:WithContext)?\s*[<(][\s\S]*?\)\s*;?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const block = match[0];
    const comp = /\bcomponent\s*:\s*([A-Z][\w$]*)/.exec(block);
    const shell = /\bshellComponent\s*:\s*([A-Z][\w$]*)/.exec(block);
    if (comp?.[1]) names.add(comp[1]);
    if (shell?.[1]) names.add(shell[1]);
  }
  if (names.size === 1) return [...names][0]!;
  return null;
}

/**
 * Bestimmt die tatsächliche Root-Komponente.
 *
 * Reihenfolge: der im `createRootRoute`-Aufruf referenzierte Bezeichner,
 * sonst genau die eine Komponente, die `<Outlet` rendert. NotFound-, Error-
 * und Hilfsfunktionen werden dadurch niemals gepatcht.
 */
export function locateRootComponent(source: string): ComponentDef {
  const defs = componentDefinitions(source);
  const declared = declaredRootComponentName(source);
  if (declared) {
    const named = defs.filter((d) => d.name === declared);
    if (named.length === 1) return named[0]!;
    if (named.length > 1) {
      throw new IntegrationPatchError(
        "ROOT_COMPONENT_AMBIGUOUS",
        `Mehrere Definitionen von ${declared} — keine heuristische Reparatur.`,
      );
    }
    throw new IntegrationPatchError(
      "ROOT_COMPONENT_NOT_FOUND",
      `Im Routen-Setup referenzierte Komponente ${declared} ist in der Datei nicht definiert.`,
    );
  }
  const withOutlet = defs.filter((d) => {
    const body = source.slice(d.start, d.end);
    return /<Outlet[\s/>]/.test(body);
  });
  if (withOutlet.length === 1) return withOutlet[0]!;
  if (withOutlet.length > 1) {
    throw new IntegrationPatchError(
      "ROOT_COMPONENT_AMBIGUOUS",
      `Mehrere Komponenten rendern <Outlet /> (${withOutlet.map((d) => d.name).join(", ")}) — manuelle Klärung nötig.`,
    );
  }
  throw new IntegrationPatchError(
    "ROOT_COMPONENT_NOT_FOUND",
    "Keine Root-Komponente mit <Outlet /> gefunden — Patch abgebrochen statt geraten.",
  );
}

/**
 * Innerster Wrapper um <Outlet /> im Render-Baum. Liefert die Spanne des
 * Wrapper-INHALTS (zwischen öffnendem und schließendem Tag).
 */
function findInnermostProvider(jsx: string): { start: number; end: number } | null {
  const outlet = jsx.search(/<Outlet[\s/>]/);
  if (outlet === -1) return null;
  const tags: {
    name: string;
    openEnd: number;
    closing: boolean;
    selfClosing: boolean;
    index: number;
  }[] = [];
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
        if (innermost === null && entry.contentStart <= outlet && outlet < tag.index) {
          innermost = { start: entry.contentStart, end: tag.index };
        }
        break;
      }
    }
  }
  return innermost;
}

/** Kette der öffnenden Tags, die <Outlet /> umschließen (äußerste zuerst). */
export function providerChain(jsx: string): string[] {
  const outlet = jsx.search(/<Outlet[\s/>]/);
  if (outlet === -1) return [];
  const chain: string[] = [];
  const stack: { name: string; index: number }[] = [];
  const tagPattern = /<\/?([A-Za-z][A-Za-z0-9_.]*)?[^>]*?>/g;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(jsx))) {
    const raw = match[0];
    const closing = raw.startsWith("</");
    const selfClosing = !closing && raw.endsWith("/>");
    const name = match[1] ?? "";
    if (match.index > outlet) {
      if (closing) {
        const open = stack.pop();
        if (open) chain.unshift(open.name);
        if (stack.length === 0) break;
      }
      continue;
    }
    if (closing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]!.name === name) {
          stack.splice(i, 1);
          break;
        }
      }
    } else if (!selfClosing) {
      stack.push({ name, index: match.index });
    }
  }
  return [...stack.map((s) => s.name), ...chain].filter((n, i, all) => all.indexOf(n) === i);
}

function childIndentOf(region: string): string {
  const firstLine = /\n([ \t]*)\S/.exec(region);
  return firstLine?.[1] ?? "  ";
}

/**
 * Parse-Gate: der gepatchte Quelltext muss durch einen echten TSX-Parser
 * laufen. Ein syntaktisch ungültiger Patch meldet niemals Erfolg.
 */
export function assertParsableTsx(source: string, code = "ROOT_PATCH_PARSE_FAILED"): void {
  try {
    parseTsx(source, {
      sourceType: "module",
      errorRecovery: false,
      plugins: ["typescript", "jsx"],
    });
  } catch (error) {
    throw new IntegrationPatchError(
      code,
      `Gepatchter TSX-Quelltext ist nicht parsebar: ${(error as Error).message}`,
    );
  }
}

/**
 * Fügt die EyisRouteBoundary markerbasiert um das Outlet der Root-Komponente
 * ein — ausschließlich dort, niemals in NotFound-, Error- oder Hilfsfunktionen.
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
    assertParsableTsx(withImport);
    return { content: withImport, outcome: withImport === source ? "NOOP" : "UPDATED" };
  }

  const root = locateRootComponent(source);
  const rootBody = source.slice(root.start, root.end);
  if (/return\s*<Outlet\s*\/>/.test(rootBody)) {
    throw new IntegrationPatchError(
      "ROOT_EARLY_RETURN",
      "Früher `return <Outlet />` im Root-Layout — ein Guard würde EYIS-Routen nicht zuverlässig kapseln. Manuelle Klärung nötig.",
    );
  }
  if (!root.render) {
    throw new IntegrationPatchError(
      "ROOT_RETURN_NOT_FOUND",
      `Kein JSX-Render-Ausdruck in ${root.name} gefunden — Patch abgebrochen statt geraten.`,
    );
  }

  const body = source.slice(root.render.start, root.render.end);
  const provider = findInnermostProvider(body);
  const wrapStart = provider ? root.render.start + provider.start : root.render.start;
  const wrapEnd = provider ? root.render.start + provider.end : root.render.end;

  const inner = source.slice(wrapStart, wrapEnd);
  const indent = childIndentOf(inner);
  const trailing = /\n[ \t]*$/.exec(inner);
  const innerBody = trailing ? inner.slice(0, trailing.index) : inner;
  const tail = trailing ? trailing[0] : "";
  const patched =
    `${source.slice(0, wrapStart)}\n${indent}${ROOT_BOUNDARY_OPEN}${innerBody}\n${indent}${ROOT_BOUNDARY_CLOSE}${tail}` +
    source.slice(wrapEnd);

  const content = ensureBoundaryImport(patched);
  assertParsableTsx(content);
  return { content, outcome: "INSERTED" };
}

/** Rollback: entfernt die Guard exakt und byte-genau. */
export function removeRootGuard(source: string): PatchResult {
  if (!source.includes("<EyisRouteBoundary>") && !source.includes("EYIS:ROUTE_GUARD")) {
    return { content: source, outcome: "NOOP" };
  }

  let content = source;
  content = content.replace(
    /\n[ \t]*\{?\/\* EYIS:ROUTE_GUARD:START \*\/\}?<EyisRouteBoundary>/,
    "",
  );
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

  if (content.startsWith(`${ROOT_BOUNDARY_IMPORT}\n`)) {
    content = content.slice(ROOT_BOUNDARY_IMPORT.length + 1);
  }
  return { content, outcome: source === content ? "NOOP" : "UPDATED" };
}

/**
 * Strukturelle Prüfung einer __root.tsx nach dem Patch.
 *
 * Beweist: genau eine Root-Komponente, genau ein Guard-Paar, Guard innerhalb
 * dieser Komponente, Outlet innerhalb der Boundary, kein Guard in
 * NotFound-/Error-/Hilfskomponenten, maskierte Marker, parsebares TSX und
 * erhaltene Provider-Hierarchie.
 */
export function validateRoot(source: string, original?: string): void {
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

  // 1) Genau eine Root-Komponente — wirft ROOT_COMPONENT_NOT_FOUND/AMBIGUOUS.
  const root = locateRootComponent(source);

  // 2) Guard liegt innerhalb genau dieser Komponente.
  const guardStart = source.indexOf(ROOT_GUARD_MARKER_START);
  const guardEnd = source.indexOf(ROOT_GUARD_MARKER_END);
  if (guardStart < root.start || guardEnd > root.end) {
    throw new IntegrationPatchError(
      "ROOT_GUARD_MISPLACED",
      `Route-Guard liegt außerhalb der Root-Komponente ${root.name} — falsche Komponente gepatcht.`,
    );
  }

  // 3) Outlet liegt innerhalb der Boundary.
  const outletAt = source.search(/<Outlet[\s/>]/);
  if (!(guardStart < outletAt && outletAt < guardEnd)) {
    throw new IntegrationPatchError(
      "ROOT_OUTLET_OUTSIDE_GUARD",
      "<Outlet /> liegt nicht innerhalb der EyisRouteBoundary.",
    );
  }

  // 4) Kein früher Return vor dem Guard innerhalb der Root-Komponente.
  if (source.slice(root.start, guardStart).search(/return\s*<Outlet\s*\/>/) !== -1) {
    throw new IntegrationPatchError(
      "ROOT_EARLY_RETURN",
      "Früher Return vor dem Route-Guard — Kunden-Chrome würde für EYIS-Routen verloren gehen.",
    );
  }

  // 5) Parse-Gate.
  assertParsableTsx(source);

  // 6) Provider-Hierarchie erhalten: dieselbe Kette wie vorher, ergänzt um
  //    die Boundary als innerster Wrapper.
  if (original) {
    const before = providerChain(original);
    const after = providerChain(source).filter((n) => n !== "EyisRouteBoundary");
    if (before.join(">") !== after.join(">")) {
      throw new IntegrationPatchError(
        "ROOT_PROVIDER_CHAIN_CHANGED",
        `Provider-Hierarchie verändert: "${before.join(">")}" → "${after.join(">")}".`,
      );
    }
    const chain = providerChain(source);
    if (chain[chain.length - 1] !== "EyisRouteBoundary") {
      throw new IntegrationPatchError(
        "ROOT_GUARD_MISPLACED",
        "EyisRouteBoundary ist nicht der innerste Wrapper um <Outlet />.",
      );
    }
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
