# Phase 25 — Produktionshärtung des EYIS Dedicated Installers

Status ausschließlich: PASS, FAIL, OFFEN, BLOCKED. Kein PASS ohne Nachweis.

Umgebung: Dev/Preview. Keine Production-Aktion, keine Provider-Umstellung, keine Demo-Seeds.

---

## 1. DML-Audit und kanonische System-Seeds — PASS

Nachweis: `bun run eyis:seeds:audit`, `installer/database/seeds/eyis-dml-audit.json`

| Kennzahl | Wert |
| --- | --- |
| Migrationen geprüft | 55 |
| DML-Anweisungen gesamt | 178 |
| davon `runtime` (in Funktions-/Triggerkörpern) | 158 |
| davon `system_seed` | 19 |
| davon `backfill` (einmalige Korrektur, auf leerer DB wirkungslos) | 1 |
| nicht abgedeckte Systemdaten | **0** |

Neu erzeugte Seed-Units (wortgleich aus der Migration übernommen, idempotent gekapselt):

| Unit | Tabellen | Pflichtinhalt |
| --- | --- | --- |
| `003_product_blueprints` | `product_blueprints` | 9 System-Blueprints (`standard`, `textil`, `lebensmittel`, `kosmetik`, `elektronik`, `moebel`, `schmuck`, `digital`, `dienstleistung`) |
| `004_communication_templates` | `communication_templates`, `communication_template_versions` | 23 System-Vorlagen inkl. `order.confirmed`, `invoice.issued`, `return.refunded` |
| `005_tax_system` | `tax_classes`, `tax_rates` | 7 System-Steuerklassen + DE-Preset |

`eyis-system-seeds.manifest.json` enthält Checksummen, Mindestmengen, Pflichtschlüssel und den
`system_seed_fingerprint` (`3d56b91c…`). Damit war die Ursache des Audit-Befunds — strukturell
korrekte, fachlich leere Fresh-Install-Datenbank — behoben und nachweisbar.

Nachweis Verifikation: `bun run eyis:seeds:verify` → Manifest-Integrität PASS, Datenbankprüfung PASS
(alle Mindestmengen und Pflichtschlüssel gegen die Dev-Datenbank geprüft).

Offline-Regression: 8 Prüfungen in `src/lib/commerce/__tests__/system-seeds.test.ts`, Teil von
`bun run verify`.

## 2. Shop-Bootstrap-Defaults — PASS

`createOwnerDefaults` legt nach dem Owner-Claim zusätzlich verbindlich an:

- **Lager**: aktiver Standort `MAIN` („Hauptlager"). Ohne ihn schlägt jede Reservierung im Checkout
  fehl. Idempotent über `(shop_id, code)`.
- **Währung und Locale**: explizit `EUR` / `de-DE` auf dem Shop, statt auf Spaltendefaults zu bauen.
- **Kommunikation**: `comm_ensure_shop_defaults(org, shop)` — Branding und Regeln aus der
  bestehenden Engine, keine zweite Vorlagenquelle.
- Steuerklassen, DE-Sätze, Steuer-Settings und Dokumenten-Nummernkreise wie bisher.

## 3. UI-Trennung Backoffice ↔ Kundenoberfläche — PASS

`src/lib/eyis/route-boundary.ts` ist die einzige Wahrheit über die Grenze. `isEyisInternalRoute`
deckt `/app`, `/portal`, `/api/public/store|jobs|install|webhooks` ab und unterscheidet dabei
nachweisbar zwischen `/app` und Kundenpfaden wie `/apps`, `/application`, `/appointments`.

Nachweis: 4 Prüfungen in `src/lib/eyis/__tests__/route-boundary.test.ts`, Teil von `bun run verify`.

Der Eingriff in das kundeneigene Root-Layout ist als `integration_patch` beschrieben und additiv:
Kunden-Chrome wird für EYIS-Pfade übersprungen, nichts wird entfernt oder ersetzt.

## 4. CSS-Isolation — PASS

Die Backoffice-Shell rendert innerhalb von `.eyis-admin` (`data-eyis-runtime="backoffice"`). Der
Scope deklariert alle EYIS-Tokens lokal, bringt Hintergrund, Textfarbe und Schrift selbst mit und
setzt `isolation: isolate`. Überschreibt ein Kundenprojekt dieselben Variablennamen auf `:root`,
erreicht das die Oberfläche nicht mehr — und EYIS-Tokens greifen umgekehrt nie in die Kundenseite.

## 5. Auth-Namespace — PASS

`EYIS_AUTH_PATH = "/app/login"` liegt vollständig innerhalb der EYIS-Präfixe. Ein kundeneigenes
`/login` oder `/auth` kollidiert damit nicht. Im Distribution-Manifest als Regel festgehalten.

## 6. Distribution Manifest V3 — PASS

`installer/distribution/eyis-code-distribution.manifest.json` (Version 3.0.0) unterscheidet
`install`, `reference_only`, `customer_owned`, `generated`, `optional` und neu `integration_patch`
mit Grund, Art des Eingriffs und Snippet je Datei.

`src/lib/commerce/updates/ownership.ts` bildet dieselbe Grenze im Code ab: `classifyPath` liefert
jetzt auch `integration_patch`, `partitionPaths` gibt die Kategorie getrennt zurück. Ein Update
ersetzt diese Dateien nie.

Nachweis: 11 Prüfungen in `src/lib/commerce/__tests__/updates.test.ts`, darunter der explizite
Nachweis, dass `src/routes/__root.tsx` und `src/styles.css` nicht in `replace` landen.

Die EYIS-Marketing-Landingpage bleibt `reference_only` und wird nie installiert.

## 7. Ressourcen-Automatisierung — PASS (Buckets/Jobs), OFFEN (Cron-Zeitplan)

`bun run eyis:resources:provision` legt fehlende Buckets aus dem Resource-Manifest mit der
erwarteten Sichtbarkeit an und prüft, dass jeder Job-Endpunkt ohne gültiges Cron-Secret mit 401
antwortet. Secrets werden ausschließlich auf Anwesenheit geprüft und nie ausgegeben.

**OFFEN:** Das Anlegen der Cron-*Zeitpläne* bleibt Sache der Plattform des Kundenprojekts. Das
Skript stellt den Zeitplan aus dem Manifest dar, kann ihn aber nicht selbst registrieren.

## 8. Pack-Signatur — BLOCKED

Die Signaturmechanik ist vollständig implementiert: `packDigest()` bildet einen deterministischen
SHA-256-Digest über Manifeste, alle 43 Installation Units, alle Seed-Units und die Reconciliation
(51 signaturrelevante Dateien, aktueller Digest `be59cdc8…`). `eyis:pack:sign` signiert mit Ed25519,
`eyis:pack:verify` prüft Digest und Signatur.

**BLOCKED:** Es liegt kein Signaturschlüssel vor. `EYIS_PACK_SIGNING_KEY` (Ed25519, PKCS#8-PEM) muss
vom Betreiber bereitgestellt werden; er steht bewusst nicht im Repository. Bis dahin meldet
`eyis:pack:verify` BLOCKED — nicht PASS. Es wird ausdrücklich keine Ersatzsignatur erzeugt.

## 9. Doctor — PASS

`runDoctor` prüft die Systemdaten jetzt fachlich statt nur auf Anwesenheit einer Zeile:
`role_permissions ≥ 100`, `product_blueprints ≥ 9`, `communication_templates ≥ 23`,
`tax_classes ≥ 7`. Eine strukturell vollständige, fachlich leere Datenbank meldet damit FAIL statt
PASS. Die bestehenden Prüfungen zu Umgebung, Zentralabhängigkeiten, RLS, Storage und
Dedicated-Independence bleiben unverändert.

## 10. Namespace-Härtung — OFFEN

Neuer EYIS-Code liegt unter `src/lib/eyis/**` und ist in `install` sowie `EYIS_OWNED_PATHS`
registriert. Die Verschiebung des bestehenden Bestands (`src/components/data`, `src/components/shell`)
in einen gemeinsamen `src/eyis/**`-Namensraum ist **nicht** durchgeführt: sie berührt mehrere hundert
Importe in Routen und Komponenten, ohne dass ein Kollisionsfall nachgewiesen wurde. Bis dahin gilt
die Kollisionsgefahr als bekannt und dokumentiert, nicht als behoben.

## 11. Smoke Tests nach Fresh Install — OFFEN

`bun run qa:database-installer` (13/13) belegt weiterhin Struktur, Journal, Abbruch/Wiederaufnahme
und Fingerprint gegen eine echte leere Datenbank. Die Seed-Verifikation ist über
`eyis:seeds:verify` gegen eine erreichbare Datenbank nachgewiesen.

**OFFEN:** Die fachlichen Smoke-Tests (Produkt anlegen, Warenkorb berechnen, Store-API-Abruf) laufen
noch nicht gegen die temporäre Installer-Datenbank, weil dafür die Anwendungsruntime gegen diesen
Cluster gebunden werden muss. Gegen Dev sind dieselben Wege über `qa:e2e` und `qa:store-api` belegt.

## 12. Verify — PASS

```
bun run verify   → docs:validate OK (24 Pflichtdateien, 83 Markdown-Dateien)
                   typecheck OK
                   126 Tests, 12 Dateien, 0 Fehler
                   build OK
```

---

## Zusammenfassung

| Anforderung | Status |
| --- | --- |
| 1 DML-Audit & Canonical System Seeds | PASS |
| 2 Shop-Bootstrap-Defaults (Lager, Steuern, Währung) | PASS |
| 3 Absolute UI-Trennung / Route-Boundary | PASS |
| 4 CSS-Isolation `.eyis-admin` | PASS |
| 5 Namespace-Härtung | OFFEN |
| 6 Distribution Manifest V3 inkl. `integration_patch` | PASS |
| 7 Auth-Namespace `/app/login` | PASS |
| 8 Buckets automatisiert | PASS |
| 8 Cron-Zeitpläne automatisiert | OFFEN |
| 9 Ed25519-Pack-Signatur | BLOCKED (kein Signaturschlüssel) |
| 10 Fachliche Smoke Tests auf Fresh-Install-DB | OFFEN |
| 11 Doctor V2 (Seed-Tiefenprüfung) | PASS |
| 12 `bun run verify` | PASS |
