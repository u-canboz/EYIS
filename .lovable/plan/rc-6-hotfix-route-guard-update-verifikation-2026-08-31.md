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

## 9. Blackbox-Preflight gegen absehbare Folgeblocker

Ziel dieses Abschnitts ist nicht, neue Features zu entwickeln. Vor Veröffentlichung von `rc.7` sollen ausschließlich konkrete, bereits aus dem Installationsmodell ableitbare Folgeblocker geprüft werden.

Keine Architekturänderungen auf Verdacht.

Wenn ein Punkt nachweislich PASS ist, wird nichts verändert.

Wenn ein reproduzierbarer Release-Blocker gefunden wird, darf ausschließlich der minimal notwendige Fix umgesetzt werden.

Wenn ein Punkt nur in einer echten Lovable-Cloud-Umgebung abschließend geprüft werden kann, wird er als `OFFEN` oder `BLOCKED` dokumentiert und nicht künstlich als PASS bewertet.

### 9.1 Abhängigkeiten des Kundenprojekts

Das EYIS-Paket installiert Quellcode, überschreibt aber bewusst nicht die kundeneigene `package.json`.

Deshalb muss vor `rc.7` geprüft werden, ob alle Imports der Installationskategorie in einem frischen Lovable-Projekt auflösbar sind.

Prüfung:

1. Import-Graph aller Pfade aus der Kategorie `install` erzeugen.
2. Externe Runtime-Abhängigkeiten vollständig ermitteln.
3. Abgleich mit einer minimalen frischen Lovable-Projektstruktur.
4. Fehlende Pakete eindeutig auflisten.
5. Versionen und Peer Dependencies prüfen.
6. Prüfen, dass insbesondere `pdf-lib` und weitere nicht standardmäßig vorhandene Pakete nicht erneut erst während des Blackbox-Laufs entdeckt werden.
7. Alle benötigten `src/components/ui/**`-Primitive prüfen.
8. Kundeneigene `package.json` niemals ersetzen.

Das Install-Pack muss einen deterministischen Dependency-Plan enthalten oder aus dem bestehenden Manifest ableiten können:

```text
vorhanden
fehlend
inkompatibel
zu installieren
```

Das Installieren einer im offiziellen Dependency-Plan aufgeführten Abhängigkeit gilt als regulärer Installationsschritt.

Das spontane Reparieren eines fehlenden Imports während des Blackbox-Tests gilt als FAIL.

Verbindlicher Nachweis:

```text
Install-Code Import Scan: PASS
Runtime Dependencies vollständig: PASS
Peer Dependencies: PASS
UI Primitives: PASS
Kunden-package.json überschrieben: NEIN
```

### 9.2 Build vor jeder Datenbankänderung

Nach Codeübernahme, Dependency-Abgleich, CSS-Patch und Route-Guard-Patch muss ein Build-Gate stattfinden, bevor eine einzige Datenbankmigration angewendet wird.

Reihenfolge:

```text
Release prüfen
Code installieren
Dependencies abgleichen
Integration Patches anwenden
Route Tree regenerieren
Typecheck
Build
erst danach Datenbankmigrationen
```

Prüfen:

1. `@/`-Alias funktioniert.
2. Alle EYIS-Imports sind auflösbar.
3. Keine Server-only-Datei landet versehentlich im Client-Bundle.
4. Keine Secrets landen im Client-Bundle.
5. Neue EYIS-Routen werden in den generierten Route Tree übernommen.
6. Bestehende Kundenrouten bleiben erhalten.
7. Keine Route kollidiert mit `/`, vorhandenen Kundenrouten oder anderen reservierten Präfixen.
8. SSR-Build funktioniert.
9. Kundenseite rendert nach dem Patch unverändert.
10. `/app` wird korrekt isoliert.

Wenn das Kundenprojekt keine EYIS-spezifische Typecheck-Konfiguration besitzt, darf kein nicht vorhandenes Skript vorausgesetzt werden. Es muss klar zwischen Kunden-Build und EYIS-Installer-Prüfung unterschieden werden.

Verbindlicher Nachweis:

```text
Pre-Database Typecheck: PASS
Pre-Database Build: PASS
Route Tree: PASS
Customer Routes unverändert: PASS
SSR: PASS
```

### 9.3 Generierte Supabase-Typen und generierte Dateien

Folgende Dateien gehören laut Distribution nicht zum Install-Pack und dürfen nicht aus dem EYIS-Hauptrepository kopiert werden:

```text
src/integrations/supabase/types.ts
src/routeTree.gen.ts
weitere plattformgenerierte Integrationsdateien
```

Prüfen:

1. Wann und wie die Supabase-Typen nach den 53 Datenbankschritten regeneriert werden.
2. Ob der installierte EYIS-Code vor der Regeneration bereits auf neue Tabellentypen angewiesen ist.
3. Ob der Kunden-Build mit den zunächst vorhandenen Typen funktioniert.
4. Ob die Regeneration ohne Zugriff auf das EYIS-Entwicklungsrepository möglich ist.
5. Ob `routeTree.gen.ts` nach Installation automatisch neu erzeugt wird.
6. Ob generierte Dateien nicht versehentlich aus dem Release kopiert werden.

Falls eine Regeneration zwingend erforderlich ist, muss sie als offizieller Installationsschritt dokumentiert und vom Agenten ausführbar sein.

Verbindlicher Nachweis:

```text
Supabase Type Generation: PASS oder klarer offizieller Installationsschritt
Route Tree Generation: PASS
Generierte Hauptrepo-Dateien kopiert: NEIN
```

### 9.4 Migration-Plan und Wiederaufnahme nach Fehler

Der 53-Schritte-Agent-Migration-Plan wurde bisher noch nicht vollständig in einer echten frischen Lovable-Cloud-Datenbank durchlaufen.

Vor `rc.7` statisch und soweit möglich gegen eine frische Testdatenbank prüfen:

1. Jeder Schritt besitzt eine eindeutige ID.
2. Reihenfolge ist deterministisch.
3. Jeder Schritt journalisiert sich erst nach erfolgreicher Ausführung.
4. Kein Schritt wird vorzeitig als abgeschlossen markiert.
5. Ein fehlgeschlagener Schritt kann erneut ausgeführt werden.
6. Bereits erfolgreiche Schritte werden nicht doppelt angewendet.
7. Teilweise ausgeführte Schritte werden erkannt.
8. Keine Abhängigkeit von direktem privilegiertem `psql`.
9. Keine unkontrollierte Voraussetzung von Superuser-Rechten.
10. Keine SQL-Unit verlässt die Datenbank in einem halbfertigen Zustand.
11. Schema-Fingerprint und Seed-Fingerprint werden nach Abschluss geprüft.
12. Ein Fehler in Schritt `n` führt nicht dazu, dass Schritt `n+1` ausgeführt wird.

Zusätzlicher Failure-Injection-Test:

```text
Schritt ausführen
Ausführung kontrolliert unterbrechen
denselben Schritt erneut starten
Journal und Schema prüfen
Installation fortsetzen
```

Verbindlicher Nachweis:

```text
Migration Order: PASS
Journal Integrity: PASS
Retry/Resume: PASS
Schema Fingerprint: PASS
Seed Fingerprint: PASS
Direktes psql erforderlich: NEIN
```

### 9.5 Bootstrap, Auth und Owner-Zuordnung

Der reale Fremdprojekt-Test muss folgende Reihenfolge eindeutig unterstützen:

```text
Migrationen abgeschlossen
Admin-E-Mail als pending owner setzen
echten Auth-Benutzer registrieren
E-Mail normalisieren und abgleichen
Owner-Mitgliedschaft atomar erstellen
Organisation und Main Shop verfügbar
/app erreichbar
```

Prüfen:

1. Kein künstlicher Auth-Benutzer wird erzeugt.
2. E-Mail-Abgleich ist case-insensitive und normalisiert.
3. Ein falscher Benutzer kann den Owner nicht übernehmen.
4. Die Owner-Zuordnung ist atomar.
5. Ein zweiter Aufruf erzeugt keine doppelte Membership.
6. Eine fehlende Auth-Session führt zu klarer Anweisung statt Teilinstallation.
7. E-Mail-Bestätigung und Redirect-Verhalten der Plattform blockieren den Ablauf nicht unerklärt.
8. Bootstrap funktioniert ausschließlich mit den Secrets und Ressourcen der neuen Dedicated-Instanz.
9. Keine Abfrage an eine zentrale EYIS-Datenbank oder zentrale EYIS-Auth.
10. Bootstrap ist idempotent und meldet den vorhandenen Zustand korrekt.

Verbindlicher Nachweis:

```text
Auth User echt: PASS
Owner Claim: PASS
Cross-User Claim: REJECTED
Idempotenz: PASS
Central Dependency: NONE
```

### 9.6 Storage, Resources, Jobs und Cron

Vor dem nächsten Blackbox-Test muss die Benennung und Bereitstellung aller Runtime-Ressourcen eindeutig sein.

Insbesondere prüfen:

1. Welcher Cron-Secret-Name tatsächlich kanonisch ist.
2. `CRON_SECRET` und `LOVABLE_CRON_SECRET` dürfen nicht widersprüchlich dokumentiert oder im Code unterschiedlich erwartet werden.
3. Installer, Job-Endpunkte, Doctor und Dokumentation müssen denselben Secret-Namen verwenden.
4. Storage-Buckets und Policies müssen über den erlaubten Plattformweg erstellt werden.
5. Keine Voraussetzung von `permission denied for schema cron` erzeugenden direkten Datenbankrechten.
6. Die drei benötigten Zeitpläne werden tatsächlich eingerichtet oder mit einem exakten Operator-Schritt versehen.
7. Job-Endpunkte akzeptieren ausschließlich authentifizierte Cron-Anfragen.
8. Ohne Secret erfolgt `401`.
9. Mit korrektem Secret erfolgt ein fachlich gültiger Lauf.
10. `installer/eyis.ts resources` und `installer/eyis.ts doctor` bewerten denselben Zustand konsistent.

Keine stille Umbenennung von Secrets.

Eine kanonische Environment-Matrix muss für Dedicated-Installationen festlegen:

```text
Name
Pflicht oder optional
Server-only
Verwendungsstelle
Doctor-Prüfung
Remediation
```

Verbindlicher Nachweis:

```text
Canonical Cron Secret: PASS
Storage Buckets: PASS
Job Endpoints: PASS
Cron Schedules: PASS oder ehrlich BLOCKED mit exaktem Operator-Schritt
Secret Leakage: NONE
```

### 9.7 Gültiger Verify-Vertrag im Kundenprojekt

Die bisherige Blackbox-Anleitung verlangt `bun run verify` im Kundenprojekt.

Das ist nur zulässig, wenn das Kundenprojekt dieses Skript nach der Installation tatsächlich besitzt und alle dafür benötigten Dateien mitgeliefert wurden.

Prüfen:

1. Welche Verifikationsbefehle im installierten Kundenprojekt real verfügbar sind.
2. Ob `package.json` absichtlich nicht verteilt wird.
3. Ob `scripts/**`, `qa/**` und `docs/**` absichtlich nicht verteilt werden.
4. Ob `bun run verify` deshalb im Kundenprojekt überhaupt ein gültiger Befehl ist.
5. Kein Befehl darf ausschließlich im EYIS-Hauptrepository funktionieren und dennoch im Kunden-Runbook vorausgesetzt werden.

Der gültige Kundenprüfpfad muss package.json-unabhängig sein oder über reguläre vorhandene Kundenskripte laufen.

Beispiel des erwarteten Prinzips:

```text
bun installer/eyis.ts pack
bun installer/eyis.ts status
bun installer/eyis.ts resources
bun installer/eyis.ts doctor
bun run build
```

Die tatsächlichen Befehle müssen aus dem vorhandenen Installer stammen und dürfen nicht erfunden werden.

Falls `bun run verify` im Kundenprojekt nicht real verfügbar ist, muss es aus der Blackbox-Abnahme entfernt und durch nachweislich vorhandene Befehle ersetzt werden.

Verbindlicher Nachweis:

```text
Kunden-Verifikationsbefehle existieren: PASS
Keine Hauptrepo-only-Befehle im Runbook: PASS
Build: PASS
Doctor: PASS
```

### 9.8 Blackbox-Anleitung und Release-Pinning

Die Blackbox-Anleitung darf nicht dauerhaft auf einen alten Release Candidate fest verdrahtet bleiben.

Vor `rc.7` prüfen:

1. Kein aktueller Installationsauftrag verweist noch auf `v1.0.0-rc.4`, `rc.5` oder `rc.6`.
2. Dateigrößen, Digests, Dateienanzahl, Migration Head und Fingerprints passen zum tatsächlich getesteten Release.
3. Die Anleitung wird entweder releasebezogen generiert oder verwendet eindeutig ersetzbare Versionsparameter.
4. Der Agent kann nicht versehentlich ein altes Tarball installieren.
5. Die Anleitung nennt die aktuell gültigen Secret-Namen.
6. Die Anleitung verwendet ausschließlich Befehle, die im ausgelieferten Paket vorhanden sind.
7. Externe Blocker werden nicht als Installationsfehler bewertet.
8. Keine veralteten RC1-, rc.4- oder Phase-Bezeichnungen beeinflussen die Abnahme.

Verbindlicher Nachweis:

```text
Blackbox Runbook aktuell: PASS
Release Tag konsistent: PASS
SHA-256 konsistent: PASS
Migration Count konsistent: PASS
Secret-Namen konsistent: PASS
```

### 9.9 Update-Verifikation gegen ein reales Release-Artefakt

Die Update-Center-Tests dürfen nicht ausschließlich mit künstlichen Fixtures beweisen, dass die Verifikation funktioniert.

Zusätzlich muss ein Integrationstest das reale Release-Format nachbilden oder ein unveränderliches, checksummengeprüftes Release-Fixture verwenden.

Prüfen:

1. `eyis-release.json` wird als exakt signierte Bytefolge verifiziert.
2. JSON wird nicht vor der Signaturprüfung neu serialisiert.
3. Zeilenumbrüche oder Formatierung verändern die Verifikation nicht unbemerkt.
4. Die tatsächliche Quelle der `key_id` wird aus dem realen Release-Format gelesen.
5. Es wird nicht angenommen, dass die `key_id` in einer Datei steht, in der sie tatsächlich nicht enthalten ist.
6. Die separate `.sig`-Datei wird korrekt dem Manifest zugeordnet.
7. Der Trust Anchor wird im SSR-/Server-Build tatsächlich mit ausgeliefert.
8. Die Verifikation funktioniert ohne `EYIS_RELEASE_PUBLIC_KEY`.
9. Kein privater Key wird benötigt.
10. Der Trust Anchor oder Public Key landet nicht versehentlich als Secret-Behandlung in der UI.
11. Manipuliertes Manifest wird abgelehnt.
12. Manipuliertes Tarball wird abgelehnt.
13. Revoked und unbekannte Keys werden abgelehnt.

Wichtig für `EYIS_RELEASE_PUBLIC_KEY`:

Der optionale Override darf in Production nicht still einen beliebigen neuen Vertrauensschlüssel anstelle des gepinnten Trust Anchors akzeptieren.

Zulässige Varianten:

1. Override nur in Dev/Test.
2. Override muss ebenfalls zu einer im Trust Anchor bekannten und aktiven `key_id` gehören.
3. Production lehnt unbekannte Override-Keys ab.

Ein beliebiger Environment-Key darf die gepinnte Vertrauenswurzel nicht umgehen.

Verbindlicher Nachweis:

```text
Reales Release-Format: PASS
Raw-Byte Signature Verification: PASS
Key-ID-Auflösung: PASS
Trust Anchor im Server-Build: PASS
Private Key erforderlich: NEIN
Unbekannter Override-Key: REJECTED
```

### 9.10 Ergebnis des Preflights

Am Ende muss eine kompakte Tabelle entstehen:

| Bereich                     | Status                  | Nachweis | Änderung nötig |
| --------------------------- | ----------------------- | -------- | -------------- |
| Dependencies                | PASS/FAIL/OFFEN/BLOCKED | ...      | ja/nein        |
| Pre-DB Build                | PASS/FAIL/OFFEN/BLOCKED | ...      | ja/nein        |
| Generated Types/Routes      | PASS/FAIL/OFFEN/BLOCKED | ...      | ja/nein        |
| Migration Plan              | PASS/FAIL/OFFEN/BLOCKED | ...      | ja/nein        |
| Bootstrap/Auth              | PASS/FAIL/OFFEN/BLOCKED | ...      | ja/nein        |
| Storage/Cron                | PASS/FAIL/OFFEN/BLOCKED | ...      | ja/nein        |
| Customer Verify Contract    | PASS/FAIL/OFFEN/BLOCKED | ...      | ja/nein        |
| Blackbox Runbook            | PASS/FAIL/OFFEN/BLOCKED | ...      | ja/nein        |
| Update Release Verification | PASS/FAIL/OFFEN/BLOCKED | ...      | ja/nein        |

`rc.7` darf erst vorbereitet werden, wenn:

1. alle lokal und statisch beweisbaren Punkte PASS sind,
2. kein bestätigter Release-Blocker offen ist,
3. ausschließlich echte Plattformprüfungen als OFFEN oder BLOCKED verbleiben,
4. für jeden Plattformpunkt ein klarer Testschritt im nächsten Blackbox-Lauf existiert.

## 10. Gesamtverifikation

Nach Umsetzung beider Hotfixes vollständig ausführen:

- `bun install --frozen-lockfile`
- `bun run verify`
- `bun run qa:install-pack`
- Route-Guard Regressionstests
- Update-Center Signaturtests

Verbindliche Ergebnisse:

- Typecheck: PASS
- Tests: PASS
- Build: PASS
- Install-Pack-QA: PASS
- Route-Guard Render-Test: PASS
- Marker im DOM: NONE
- Provider-Hierarchie: PASS
- Import-Handling: PASS
- Idempotenz: PASS
- Rollback: PASS
- Update-Center Release-Verifikation: PASS
- Trust-Anchor-Verifikation ohne privaten Runtime-Key: PASS
- Manipulierte Signaturen: REJECTED
- Revoked Key: REJECTED
- Unknown Key: REJECTED
- `REGISTRY_SETUP_REQUIRED` bei vorhandenem Trust Anchor: NONE
- Dependency- und Import-Scan: PASS
- Pre-Database Build: PASS
- Generated Types/Route Tree Contract: PASS
- Migration Resume/Idempotency: PASS
- Bootstrap/Auth Preflight: PASS
- Cron-/Secret-Namen konsistent: PASS
- Kunden-Verifikationsbefehle real vorhanden: PASS
- Blackbox-Runbook auf aktuellen Release vorbereitet: PASS
- Update-Verifikation gegen reales Release-Format: PASS
- Unbekannter Public-Key-Override in Production: REJECTED

Kein Tag und kein Release erstellen.

Abschlussmeldung:

RC6 HOTFIX COMPLETE — READY FOR RC.7

Commit: <FINALER_SHA>
Verify: PASS
Install-Pack-QA: PASS
Route-Guard: PASS
Update-Verifikation: PASS
