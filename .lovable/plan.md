# Gate B — Production Hardening (B1–B9)

Ein zusammenhängender Durchlauf. Keine neuen Commerce-Funktionen. Bestehende Commerce-, API-, SDK-,
RLS- und Sicherheitslogik wird nur bei nachgewiesenem Fehler angefasst. Alle Prüfungen laufen gegen
die befüllte Demo-Organisation und isolierte QA-Fixtures, nie gegen Production.

Status ausschließlich PASS / FAIL / OFFEN / BLOCKED. Kein PASS ohne Nachweisdatei.

## B1 — Visuelle Regression und Touch-Ziele

- Neuer Harness `qa/phase14-visual.py` (Playwright) auf Basis des bestehenden `qa/phase16-ui.py`.
- Touch-Ziel-Schwelle wird verbindlich von 40 px auf **44 × 44 px** angehoben. Der Harness meldet
  jedes Element unter 44 px mit Route, Selektor und gemessener Größe; gefundene Verstöße werden in
  UI-Komponenten (Buttons, Icon-Buttons, Tabs, Checkbox, Switch, Menü, Pagination, Filter,
  Record-Card-Links, Dialogaktionen) korrigiert — ausschließlich Präsentationsebene.
- Viewport-Matrix: 320, 375, 390, 430, 768, 834, 1024, 1280, 1440 und 375 Querformat.
- Zusätzliche Achsen: Light/Dark, 200 % Zoom, Demo-Modus, Empty/Loading/Error, eingeschränkte
  Berechtigung, lange Produktnamen, lange Gast-E-Mails, lange SKUs, große Beträge, viele Badges,
  geöffnete mobile Tastatur (simuliert über verkleinerte Viewporthöhe).
- Screenshot-Diff-Gate: `qa/baselines/` wird auf die neue Matrix erweitert; Vergleich per
  Pixel-Diff mit fester Toleranz. Abweichungen oberhalb der Toleranz sind FAIL und werden **nicht**
  automatisch als neue Baseline übernommen; Baseline-Update nur über expliziten `--approve`-Lauf.
- Zusätzlich geprüft: horizontale Überläufe, abgeschnittene Inhalte, überdeckte Aktionen,
  verschwundene Navigation, gebrochene Typografie.
- Ausgabe: `qa/PHASE14-VISUAL-REGRESSION-REPORT.md`, `qa/results-phase14-visual.json`.

## B2 — Accessibility

- Automatisiert: axe-core über Playwright auf Backoffice, Kundenportal und Reference Storefront
  (`qa/phase14-a11y.py`). Prüft semantisches HTML, Labels, ARIA, Kontraste, Heading-Struktur,
  genau eine H1 je Inhaltsseite, Alt-Texte, Dialognamen, Fokusreihenfolge, Touch-Ziele ≥ 44 px,
  Status nicht nur über Farbe.
- Manuell/scriptgesteuert: Tastaturbedienung, sichtbarer Fokus, Skip-Link, Mobil-Navigation per
  Tastatur, Focus-Trap in Dialog/Sheet, Escape schließt, Fokus-Rückgabe, Ankündigung von
  Formularfehlern, Return-Wizard, Checkout, Portal, Dokumentdownload, Tabellen und Record Cards,
  200 % Zoom, Reduced Motion, mobile Tastatur verdeckt keine Primäraktion.
- Behoben werden gefundene Verstöße in der Präsentationsschicht (Labels, ARIA, Fokus, Skip-Link,
  Kontrast-Token).
- Screenreader-Stichprobe: technisch nicht als echter AT-Lauf durchführbar → wird als **OFFEN**
  dokumentiert, ersatzweise Accessibility-Tree-Snapshot als Teilnachweis.
- Ausgabe: `qa/PHASE14-ACCESSIBILITY-REPORT.md`, `qa/results-phase14-accessibility.json`.

## B3 — Performance und Last

- Lastdatensatz ausschließlich in einer isolierten QA-Organisation über die bestehenden
  Demo-/Fixture-Funktionen (Production-Guard bleibt aktiv), Größenordnung mehrere tausend Produkte
  samt Varianten, Kategorien, Preisen, Beständen, Kunden, Bestellungen, Tracking, Dokumenten,
  Communications, Automationen. Danach vollständiger Purge.
- API-Messung (`qa/phase14-performance.ts`) über die offizielle Store API v1 und die Server-
  Funktionen: Store Config, Catalog List, Product Detail, Search, Pricing Resolve, Cart Read,
  Add to Cart, Checkout Validate, Payment Session (Test-Provider), Order List/Detail,
  Customer Orders, Document List, Return List. Erfasst Median, p95, p99, Error Rate,
  Response-Größe; ergänzend `pg_stat_statements`-Auswertung für langsame Queries, Query-Anzahl,
  N+1-Muster und Index-Nutzung.
- UI-Messung über Playwright-Tracing: Bundle-Größen, Bildgrößen, Lazy Loading, Layout Shifts,
  blockierende Requests, Listen-Rendering, Such-/Filterlatenz.
- Concurrency: parallele Catalog Reads, Cart Mutations, Checkout Starts, letzter verfügbarer
  Artikel (Oversell-Test), Webhook-Deduplizierung, parallele Order-Finalisierung, Eindeutigkeit von
  Rechnungs-, RMA- und Dokumentnummern, Queue Worker, Rate Limits, Key-Revoke während laufender
  Requests.
- Budgets werden aus den gemessenen Werten abgeleitet (p95 der Messung als Budget-Basis), nicht
  erfunden.
- Ausgabe: `qa/PHASE14-PERFORMANCE-REPORT.md`, `qa/results-phase14-performance.json`,
  `docs/production/PERFORMANCE_BUDGETS.md`.

## B4 — Datenschutz und Datenlebenszyklus

- Datenlandkarte über alle genannten Datenklassen mit Zweck, Speicherort, Zugriff, Mandantenbezug,
  Löschbarkeit, Anonymisierung, Export, Aufbewahrung, Backup-Verhalten und Sperren. Nicht belegbare
  rechtliche Angaben werden mit `[FACHLICH/RECHTLICH PRÜFEN]` markiert statt erfunden.
- Praktische Prüfung (`qa/phase14-privacy.ts`): Kundendatenexport, Session-Widerruf,
  Guest-Token-Widerruf, API-Key-Widerruf, Account-Deaktivierung, kontrollierte Anonymisierung,
  Löschung unnötiger technischer Logs, Unveränderlichkeit historischer Order-/Invoice-Snapshots,
  QA-/Demo-Cleanup.
- Fehlende Fähigkeiten (z. B. kein Export- oder Anonymisierungspfad) werden als OFFEN mit
  Umsetzungsvorschlag dokumentiert, nicht stillschweigend nachgebaut.
- Ausgabe: `docs/production/PRIVACY_DATA_MAP.md`, `docs/production/DATA_RETENTION_POLICY.md`,
  `qa/PHASE14-PRIVACY-REPORT.md`.

## B5 — Storage- und Upload-Sicherheit

- Negativtests (`qa/phase14-storage.ts`) gegen `media`, `documents`, `shipping-labels` sowie
  Return-Medien, Logos, Produktbilder, Rechnungen, Gutschriften, Lieferscheine, Labels.
- Geprüft: privat/öffentlich, Storage-Policies, Cross-Tenant-Zugriff, signierte URLs und deren
  Ablauf, MIME-Allowlist, Dateigröße, Endungen, Dateinamen-Normalisierung, Path Traversal,
  gefährliche SVG/HTML, MIME-Spoofing, Überschreiben historischer Dateien, erratbare Pfade,
  verwaiste Dateien, Fixture-Cleanup.
- Echte Uploads mit Angriffs-Payloads; jeder Test erwartet eine konkrete Ablehnung.
- Ausgabe: `qa/PHASE14-STORAGE-SECURITY.md`, `qa/results-phase14-storage.json`.

## B6 — Staging-Trennung

- Ein zweites Cloud-Projekt kann aus diesem Repository heraus nicht angelegt werden; das ist eine
  Plattform-/Betreiberaktion. Ergebnis daher **BLOCKED**.
- Geliefert wird ein exaktes, nummeriertes Runbook (`docs/production/STAGING_SETUP_RUNBOOK.md`)
  für eigene Datenbank, Auth-Nutzer, Buckets, Secrets, Cron-Secret, Publishable Keys, API- und
  Storefront-URL, Origins, Test-Provider, Logs und synthetische Demo-/QA-Daten — inklusive
  Migrationsreihenfolge und Verifikationsschritten. Keine Produktionsdaten.
- `docs/production/ENVIRONMENT_MATRIX.md` wird auf den Stand von Gate B aktualisiert.

## B7 — Staging-E2E

- Ohne getrennte Staging-Umgebung nicht durchführbar → **BLOCKED**. Der Dev-/gemeinsame Lauf wird
  ausdrücklich **nicht** als Staging-Test ausgegeben.
- Geliefert wird das vollständige, ausführbare Testskript plus Berichtsgerüst, damit der Lauf
  startet, sobald Staging existiert.
- Ausgabe: `qa/PHASE14-STAGING-E2E-REPORT.md` (Status BLOCKED mit Begründung),
  `qa/results-phase14-staging.json`.

## B8 — Provider Readiness

- Matrix je Provider mit Status READY / BLOCKED / FAILED / NOT REQUIRED FOR FIRST LAUNCH.
- Stripe: ohne Test-Secret und Webhook-Secret **BLOCKED**; dokumentiert werden die Prüfpunkte
  (Testkauf, fehlgeschlagene Zahlung, Pending, Duplicate Webhook, Refund, Test/Live-Trennung,
  Live-Webhook, Secret-Handling) und der bereits vorhandene Mock-Pfad als Ersatznachweis.
- E-Mail: geprüft wird im Code, ob je Mandant eigene Absenderidentität und -domain samt
  Verifikation, SPF, DKIM, Reply-To konfigurierbar sind. Ergebnis wird faktisch berichtet; echter
  Versand, Delivery, Bounce, Complaint bleiben ohne Provider-Zugang **BLOCKED**.
- Carrier: ohne Zugangsdaten **BLOCKED**; Mock-Pfad dokumentiert.
- Ausgabe: `docs/production/PROVIDER_READINESS_MATRIX.md`, `qa/PHASE14-PROVIDER-REPORT.md`.

## B9 — Vollständige Regression und Abschluss

- `bun run verify` (docs:validate → typecheck → test → build) plus alle `qa:*`-Harnesses:
  Demo (Phase 15), UI (Phase 16), Security, RLS, Health, Store API, SDK-Contract, Storefront-E2E,
  Pricing, Tax, Inventory, Cart, Payments/Orders, Shipping, Documents, Returns, Communications,
  Automations sowie die neuen Storage-, Performance-, A11y- und Visual-Läufe.
- Neue `qa:*`-Skripte werden in `package.json` ergänzt und in `docs/agent/TESTING_AND_QA.md`
  eingetragen; danach `bun run generate:manifests`.
- Kein Test wird entfernt, übersprungen oder abgeschwächt.
- Abschluss: `qa/PHASE14-GATE-B-FINAL-REPORT.md`, `qa/results-phase14-gate-b.json`,
  `docs/production/GATE_B_OPEN_BLOCKERS.md` mit der geforderten Matrix
  (Bereich | Status | Nachweis | Offene Punkte) über Visual Regression, Touch-Ziele 44 px,
  Accessibility, Performance, Concurrency, Datenschutz, Storage, Staging-Trennung, Staging-E2E,
  Stripe, E-Mail, Carrier, Build, Typecheck, Tests, Regression.

## Technische Hinweise

- Neue Dateien: `qa/phase14-visual.py`, `qa/phase14-a11y.py`, `qa/phase14-performance.ts`,
  `qa/phase14-privacy.ts`, `qa/phase14-storage.ts`, `qa/phase14-staging-e2e.ts` plus Berichte.
- Code-Änderungen beschränken sich auf `src/components/**` und `src/routes/**` (Touch-Ziele,
  A11y-Attribute, Lazy Loading) sowie auf nachgewiesene Fehler in Storage-/Privacy-Pfaden.
- Migrationen nur, falls ein Negativtest eine echte Policy-Lücke belegt — dann nach der Reihenfolge
  CREATE → GRANT → RLS → POLICY.
- Production-Guard (`src/lib/commerce/demo/guard.server.ts`) bleibt unangetastet; Lastdaten laufen
  über eine eigene QA-Organisation und werden am Ende vollständig gepurgt.

## Erwartete Endblocker

Staging-Trennung, Staging-E2E, Stripe Live, echter E-Mail-Versand und Carrier-Labels bleiben nach
heutigem Stand BLOCKED, weil sie externe Zugangsdaten bzw. eine Plattformaktion erfordern.
