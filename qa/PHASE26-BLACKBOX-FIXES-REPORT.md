# Phase 26 — Behebung der Blackbox-Installationsdefekte

Status der Phase: **PASS** (Upstream-Fixes vollständig)
Status des Blackbox-Tests selbst: **OFFEN** — der Durchlauf im neuen Projekt muss wiederholt
werden. Bis er ohne eine einzige Handkorrektur besteht, wird **kein Stable Release** getaggt.

Nachweislauf: `bun run verify` → docs:validate PASS, Pack-Sync PASS, Route Contract PASS,
typecheck PASS, 153 Tests PASS, build PASS.

---

## 1. Database Pack war veraltet — PASS

Der Fresh-Install-Pack kannte 54 Migrationen, das Repository hatte 57. Eine Neuinstallation
erzeugte ein Schema ohne die drei jüngsten Änderungen.

- Neuer, deterministischer Forward-Port ohne Live-Datenbank: `bun run eyis:database:forward-port`
  (`scripts/installer/forward-port.ts`). Jede fehlende Migration wird als eigene, in sich
  abgeschlossene Installation Unit ans Ende der Baseline gestellt.
- Ergänzte Units: `043_forward_20260830131955`, `044_forward_20260830200835`,
  `045_forward_20260830200942`.
- `schema_version` = `20260830200942`, `migration_head` = `057`.
- Die Migration-History-Reconciliation registriert jetzt alle 57 Versionen. Ein anschließendes
  `supabase db push` spielt nichts nach.

**OFFEN:** `installer/database/verification/fingerprint.json` enthält weiterhin den strukturellen
Fingerprint aus der letzten Live-Introspektion. Er ist im Manifest ausdrücklich als
`schema_fingerprint_state: REQUIRES_REINTROSPECTION` markiert und wird beim nächsten
`bun run eyis:database:baseline` gegen eine verbundene Datenbank neu berechnet. Er wird nirgends
als gültig ausgegeben.

## 2. Automatisches Sync-Gate — PASS

`bun run eyis:database:sync-check` vergleicht Migrationsmenge und Inhalts-Fingerprint
(`migration_set_fingerprint`) mit dem Pack und ist fester Bestandteil von `bun run verify`.
Ein veralteter Pack kann das Repository nicht mehr verlassen.

Regressionstests: `src/lib/commerce/__tests__/pack-sync.test.ts` (zusätzliche Migration,
inhaltlich geänderte Migration, fehlender Fingerprint).

## 3. Bootstrap V2 — preflight-first und wiederholbar — PASS

Vorher wurde die Administrator-E-Mail erst **nach** dem Anlegen des Installations-Singletons
geprüft. Eine ungültige Eingabe hinterließ eine halb registrierte Installation, die jeden
weiteren Versuch dauerhaft mit `INSTALLATION_ALREADY_INITIALIZED` blockierte — nur per
Hand-Reparatur in der Datenbank lösbar.

- Alle Prüfungen laufen jetzt **vor** dem ersten Schreibzugriff.
- Schlägt ein Schritt nach der Registrierung fehl (`SYSTEM_SEED_INCOMPLETE`,
  `BOOTSTRAP_INCOMPLETE`), wird die Registrierung zurückgenommen. Der Bootstrap bleibt
  wiederholbar; die dauerhafte Sperre gilt nur für eine tatsächlich abgeschlossene Installation.

## 4. Datenbank-Transport ohne SQL-Bridge — PASS (verifiziert)

Geprüft: es existiert keine `exec_sql`-artige Service-Role-Bridge im Installer. DDL läuft
ausschließlich über die Plattform-Migrationswerkzeuge. Der Befund wurde nicht durch eine
Änderung erzeugt, sondern durch Codeprüfung bestätigt.

## 5. Code-Distribution gehärtet — PASS

`installer/distribution/eyis-code-distribution.manifest.json` auf **5.0.0**:

- Neue Kategorie `generated`: `src/integrations/lovable/**` und die generierten
  Supabase-Dateien werden vorausgesetzt, nie kopiert, nie überschrieben.
- Neue Kategorie `optional`: `src/eyis/portal/**`, `src/routes/portal/**`.
- Neues Feld `exclude_from_install` — die Basisinstallation liefert Portal- und
  Plattformdateien nicht mit.
- Spiegelbildlich in `src/lib/commerce/updates/ownership.ts` (`GENERATED_PATHS`,
  `OPTIONAL_PATHS`, erweiterte `classifyPath`).

## 6. Route Boundary korrigiert — PASS

`/portal` ist kein Basis-Präfix mehr. `EYIS_BASE_PREFIXES` enthält nur garantierte Pfade;
optionale Module werden über `isEyisInternalRoute(path, ["portal"])` ausdrücklich aktiviert.
Ohne installiertes Portal bleibt `/portal` eine ganz normale Kundenroute und behält das
Kunden-Chrome.

## 7. Route Contract gegen tote Links — PASS

Neu: `bun run eyis:routes:verify` (`scripts/installer/route-contract.ts`) prüft jeden
statischen Link im `install`-Graph gegen die garantierten Ziele.

Gefunden und behoben (5 Verstöße):

| Datei | vorher | nachher |
| --- | --- | --- |
| `src/eyis/shell/nav-registry.ts` | `/portal` | Eintrag entfernt (optional) |
| `src/eyis/shell/nav-registry.ts` | `/store` | Eintrag entfernt (reference_only) |
| `src/routes/_authenticated/app/setup/index.tsx` | `/auth` | `/app/login` |
| `.../system/einrichtung/index.tsx` | `/store` | `/` |
| `.../system/einrichtung/index.tsx` | `/dokumentation` | `/app/system/status` |

Das Gate läuft in `bun run verify` und als Test (`route-contract.test.ts`), inklusive Prüfung,
dass keine Basis-Datei aus `@/eyis/portal/**` importiert.

## 8. Integration Patch Engine idempotent — PASS

`src/lib/commerce/updates/integration-patch.ts` arbeitet markerbasiert
(`/* EYIS:ADMIN_SCOPE:START|END */`, `/* EYIS:ROUTE_GUARD:START|END */`):
einfügen, zwischen den Markern aktualisieren oder NOOP. Ein doppelt vorhandener Block wird
als Fehler gemeldet statt vergrößert; CSS wird auf Klammerbalance geprüft. Kundeninhalt
außerhalb der Marker bleibt Byte-für-Byte unverändert.

Regressionstests: `integration-patch.test.ts` (9 Fälle, inklusive doppeltem Lauf und dem
realen `src/styles.css`).

## 9. Signatur-Trust-Root gepinnt — PASS

Der öffentliche Schlüssel wird **nicht** mehr aus der Signaturdatei gelesen. Vertrauenswurzel
ist ausschließlich `installer/distribution/eyis-trust-anchor.json`; die Signaturdatei nennt nur
noch eine `key_id`. Unbekannte `key_id` → FAIL. Fehlende Signatur → BLOCKED (nie PASS).
`eyis:pack:sign` verweigert das Signieren mit einem Schlüssel, der nicht im Trust Anchor steht.

## 10. Release-Artefakt vollständig — PASS

Der signierte Digest umfasst jetzt 313 Dateien: SQL-Pack, alle Manifeste **und** den
ausgelieferten Laufzeit-Code der Basisinstallation. Fehlende signaturrelevante Dateien werden
nicht mehr still übersprungen, sondern brechen hart ab.

**BLOCKED:** Eine echte Signatur entsteht erst mit `EYIS_PACK_SIGNING_KEY` im CI und einem
Eintrag des zugehörigen öffentlichen Schlüssels im Trust Anchor. Bis dahin meldet das Gate
korrekt BLOCKED.

## 11. Regressionsabdeckung — PASS

153 Tests (vorher 134). Neu: Pack-Sync (4), Integration Patch (9), Route Contract und
Verteilungsgrenzen (5), erweiterte Route-Boundary-Tests inklusive optionalem Portal.

---

## Nächster Schritt

Blackbox-Durchlauf nach `docs/production/BLACKBOX_INSTALL_TEST.md` in einem frischen
Lovable-Projekt wiederholen. Erst ein Durchlauf ohne Handkorrektur rechtfertigt den Stable Tag.
