# RC.6 Hotfix — Route-Guard-Integration

Einziges Ziel: Der Integration-Patch für `src/routes/__root.tsx` darf keine sichtbaren EYIS-Marker mehr im Kunden-DOM erzeugen und muss syntaktisch sauberes, idempotentes und rücknehmbares JSX schreiben. Keine weiteren Änderungen.

## Ursache

`src/lib/commerce/updates/integration-patch.ts` fügt die Marker als JS-Blockkommentare (`/* EYIS:ROUTE_GUARD:START */`) direkt in den JSX-Baum ein. In JSX-Kindposition ist das reiner Text und landet im gerenderten HTML.

## Änderungen

### 1. Marker-Konstanten trennen (`integration-patch.ts`)
- Interne Kennung: `ROUTE_GUARD_ID_START = "EYIS:ROUTE_GUARD:START"` / `..._END`.
- In JSX eingefügt wird ausschließlich `{/* EYIS:ROUTE_GUARD:START */}` bzw. `{/* EYIS:ROUTE_GUARD:END */}`.
- `ROOT_GUARD_MARKER_START/END` bleiben als Export erhalten (Erkennung bestehender Patches), zeigen aber auf die JSX-Kommentarform; die Erkennung akzeptiert zusätzlich die alte Form, damit ein bereits mit rc.6 gepatchtes Projekt erkannt und beim nächsten Lauf auf die korrekte Form aktualisiert wird (Outcome `UPDATED`).

### 2. Einfügung strukturell sauber
- Boundary weiterhin innerhalb des innersten Providers; Provider-Reihenfolge unverändert.
- Ohne Provider (z. B. Fragment-Root) wird der Rückgabebaum gekapselt.
- Einrückung: eingefügte Zeilen übernehmen die Einrückung der Fundstelle, das schließende Provider-Tag bleibt unverschoben (Fix für das gemeldete `</QueryClientProvider>`-Problem).

### 3. Import-Handling
- Genau ein Import `EyisRouteBoundary` aus `@/eyis/shell/EyisRouteBoundary`, nur wenn nicht vorhanden.
- Bestehende Imports werden erkannt (auch Mehrfachnamen-Imports), nichts wird entfernt oder umformatiert.
- Kein `useRouterState`-Import mehr nötig — der Hook lebt in `EyisRouteBoundary`.

### 4. Rollback
- Neue reine Funktion `removeRootGuard(source)`: entfernt Markerpaar, Wrapper-Tags und den EYIS-Import; alles andere bleibt byte-identisch. Ohne Marker: NOOP.

### 5. Manifest-Abgleich
- `installer/distribution/eyis-code-distribution.manifest.json`: `markers` des `__root.tsx`-Eintrags auf die JSX-Kommentarform korrigieren, Snippet bleibt inhaltlich gleich. Manifeste danach regenerieren, falls generiert.

### 6. Regressionstests
- `src/lib/commerce/__tests__/integration-patch.test.ts` erweitern um Varianten A–E (ein Provider, verschachtelte Provider, Fragment-Root, bereits gepatchte Datei, Datei mit vorhandenem Import) plus Rollback- und Idempotenz-Prüfung.
- Neuer Render-Test: gepatchte Quelle mit esbuild zu JS transformieren, Stub-Komponenten einsetzen und mit `react-dom/server` zu HTML rendern. Assertions: `EyisRouteBoundary` gerendert, Provider-Verschachtelung erhalten, und die Strings `EYIS:ROUTE_GUARD:START` / `:END` kommen im HTML **nicht** vor.
- `qa/phase29-install-pack.ts` (B4): zusätzlicher Check „keine EYIS-Marker im gerenderten DOM" und „Marker liegen als JSX-Kommentar vor", damit `qa:install-pack` ein Release mit diesem Defekt ablehnt.

### 7. Verifikation
`bun install --frozen-lockfile`, `bun run verify`, `bun run qa:install-pack`, neue Route-Guard-Tests. Kein Tag, kein Release.

## Nicht angefasst
Commerce-Engines, Store API/SDK, Datenmodell, RLS, Migrationen, Seeds, Bootstrap, Doctor, Admin-CSS-Scope und -Tokens, Signing, Trust Anchor, Release-Packaging, Update Center, Portal, Provider.
