# RC.6 Hotfix — Route-Guard + Update-Verifikation

Dieser Hotfix hat genau zwei freigegebene Ziele:

1. Der Integration-Patch für `src/routes/__root.tsx` darf keine sichtbaren EYIS-Marker mehr im Kunden-DOM erzeugen und muss syntaktisch sauberes, idempotentes und rücknehmbares JSX schreiben.
2. Das Update Center muss veröffentlichte EYIS-Releases über den vorhandenen gepinnten Public Trust Anchor verifizieren können, ohne `EYIS_RELEASE_PUBLIC_KEY` zwingend als Runtime-Umgebungsvariable vorauszusetzen.

Außer diesen beiden konkret beschriebenen Fehlern werden keine weiteren Funktionen oder Architekturbereiche geändert.

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

## Nicht angefasst

- Commerce-Engines
- Store API / SDK
- Datenmodell
- RLS
- Migrationen
- Seeds
- Bootstrap
- Doctor
- Admin-CSS-Scope
- Admin Design Tokens
- privater Signing Key
- GitHub Release Signing
- Trust-Anchor-Keymaterial und Key-Status
- Release-Packaging
- Portal
- Provider außerhalb der Update-Verifikation

Das Update Center darf ausschließlich soweit verändert werden, wie es für die in Punkt 8 beschriebene Public-Key-/Trust-Anchor-Verifikation erforderlich ist.

## 8. Update-Center: fehlender Release-Signaturschlüssel

Befund im Code: `src/lib/commerce/updates/providers.server.ts` liest den Verifikationsschlüssel ausschließlich aus der Umgebungsvariable `EYIS_RELEASE_PUBLIC_KEY` (roher 32-Byte-Ed25519-Key, base64). Ist sie nicht gesetzt, bricht `fetchSignedReleases` in `registry.server.ts` mit „Kein Release-Signaturschlüssel konfiguriert — Releases können nicht verifiziert werden." ab. Der gepinnte Trust Anchor `installer/distribution/eyis-trust-anchor.json` (aktiver Key `4e7f55e68fa9a1b934ce2d04719c9177`, SPKI-PEM) wird vom Update Center gar nicht gelesen. Es fehlt also der Public Key, nicht der private Signing Key.

Änderungen:
- Der Trust Anchor wird als gepinnte Konstante in die Runtime übernommen (nur öffentliche Schlüssel, keine Secrets) und dient als Standardquelle der Verifikation. `EYIS_RELEASE_PUBLIC_KEY` bleibt optionaler Override und wird nicht mehr vorausgesetzt.
- `verifyManifestSignature` akzeptiert zusätzlich SPKI-PEM (Import über `spki`), damit der Anchor-Key ohne Formatumwandlung nutzbar ist; das bestehende Rohformat bleibt unterstützt.
- Single Source of Truth: Es wird keine zweite manuell gepflegte Kopie des Public Keys erzeugt. Die Runtime-Repräsentation des Trust Anchors wird deterministisch aus derselben kanonischen Quelle `installer/distribution/eyis-trust-anchor.json` erzeugt bzw. importiert, damit Installer und Update Center niemals unterschiedliche Schlüsselstände verwenden.
- Die Signaturprüfung wählt anhand der `key_id` der Signaturdatei den passenden Key aus dem Anchor und prüft danach dessen Status: `active` → Verifikation erlaubt; `revoked` → zwingend ablehnen; unbekannte `key_id` → zwingend ablehnen. Es wird nicht pauschal „der aktuell aktive Key" für jede Signatur verwendet.
- Keine Rotation, keine Änderung am aktiven Key (`4e7f55e68fa9a1b934ce2d04719c9177`), der widerrufene Key (`e796e719…`) bleibt widerrufen.
- Die Setup-Meldung/Remediation in `providers.server.ts` erscheint nur noch, wenn weder Anchor-Key noch Override verfügbar sind.
- Kein privater Schlüssel in Runtime, Client-Bundle oder Logs; `EYIS_PACK_SIGNING_KEY` bleibt ausschließlich im GitHub-Release-Workflow.

Regressionstests (Vitest, ohne Netzwerk; signierte Fixtures mit Wegwerf-Keys plus Anchor-Fixture):
1. Gültig signiertes Release mit aktivem Anchor-Key → PASS.
2. Manipuliertes Manifest → FAIL.
3. Signatur mit unbekanntem oder widerrufenem Key → FAIL.
4. Kein privater Signing Key in der Runtime → Verifikation funktioniert trotzdem.
5. Bei vorhandenem Anchor erscheint `REGISTRY_SETUP_REQUIRED` nicht mehr.

Ergänzte Verifikationspunkte:
- Update-Center Release-Verifikation: PASS
- Trust-Anchor-Verifikation ohne privaten Runtime-Key: PASS
- Manipulierte/ungültige Signaturen werden abgelehnt: PASS
