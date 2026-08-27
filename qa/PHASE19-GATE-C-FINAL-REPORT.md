# Gate C — Abschlussbericht (Staging, Provider-Aktivierung, Go-live-Vorbereitung)

Release: **Commerce OS 1.0.0-rc.2**. Stand: 2026-08-27. Umgebung: Development/Preview
(`APP_ENV=development`). Kein Live-Launch, keine Live-Provider-Aktivierung, keine echten Zahlungen.

Rohergebnisse: `qa/results-phase19-gate-c.json`.
Weitere Berichte: `qa/PHASE19-STAGING-SETUP-REPORT.md`, `qa/PHASE19-STAGING-E2E-REPORT.md`,
`qa/PHASE19-ROLLBACK-REPORT.md`. Blocker: `docs/production/V1_GO_LIVE_BLOCKERS.md`.

## 1. Release-Stand

| Angabe | Wert |
| --- | --- |
| Release-Version | 1.0.0-rc.2 |
| Git-Commit (Basis) | 624eafd |
| Letzte Migration | `20260827143513_c0ae8993-af5a-43ac-b8ff-f64ccf818793.sql` |
| Schema-Stand | kein Drift, `qa:migrations` 10/10 |
| Store-API-Version | v1 (stabil, additiv erweitert um `GET /payment-methods`) |
| SDK-Version | 1.0.0, im Repository unter `src/lib/store-sdk` |
| Buildstand | Client + SSR + Nitro grün |
| Teststand | Vitest 80/80 grün, inkl. 5 neuer Guard-Negativtests |
| Funktionsumfang | eingefroren, keine neuen Commerce-Funktionen in Gate C |

Grundlagen übernommen aus: `qa/PHASE14-GATE-A-FINAL-REPORT.md`, `qa/PHASE14-GATE-B-FINAL-REPORT.md`,
`qa/PHASE16-UI-REPORT.md`, `qa/PHASE17-AGENT-READINESS.md`,
`qa/PHASE18-INTEGRATION-CENTER-REPORT.md`, `docs/production/PROVIDER_READINESS_MATRIX.md`.

## 2. Gesamtmatrix

| Bereich | Status | Nachweis | Offene Aktion | Verantwortlich |
| --- | --- | --- | --- | --- |
| Release-Stand dokumentiert | PASS | dieser Bericht | — | Agent |
| Getrennte Staging-Umgebung | BLOCKED | `qa/PHASE19-STAGING-SETUP-REPORT.md` | zweites Cloud-Projekt anlegen | Betreiber |
| Production Guard gehärtet | PASS | `src/lib/commerce/__tests__/environment.test.ts` | — | Agent |
| Stripe Testbetrieb | BLOCKED | keine Testkeys im Secret Store | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` hinterlegen | Betreiber |
| Stripe Live | BLOCKED | Voraussetzungen nicht erfüllt | erst nach Test-E2E und Owner-Freigabe | Owner |
| Stripe Connect | OFFEN | `docs/production/INTEGRATION_CONNECT_GAPS.md` | als V1.1 dokumentiert, keine Fake-Verbindung | Agent |
| Test-Payment-Provider E2E | PASS | `qa/PHASE18-INTEGRATION-CENTER-REPORT.md` (21/21) | — | Agent |
| E-Mail-Provider (API) | BLOCKED | kein echter Adapter, kein Vertrag | Provider bereitstellen | Betreiber |
| Absenderdomain, SPF/DKIM/DMARC | BLOCKED | DNS-Werte kommen vom Provider, werden nicht erfunden | Domain bereitstellen | Betreiber |
| SMTP | BLOCKED | Laufzeit ohne verlässliche TCP/TLS-Sockets | dauerhaft, API-Provider verwenden | — |
| Carrier echt | BLOCKED | nur Mock-Adapter | Carrier-Vertrag | Betreiber |
| Manueller Versandprozess | OFFEN | nicht abgenommen | Prozess prüfen und abnehmen | Betreiber |
| Shop Readiness Matrix | PASS | Integration Center, 6 Bereiche serverseitig abgeleitet | Erweiterung auf Domain/Legal/Backup/Monitoring als V1.1 | Agent |
| Domain und DNS | OFFEN | `docs/production/DOMAIN_AND_DNS_RUNBOOK.md` | Domains verbinden | Betreiber |
| CSP durchsetzend | OFFEN | Report-Only aktiv | Verstöße aus Staging auswerten | Betreiber |
| Screenreader-Stichprobe | OFFEN | keine Screenreader-Umgebung verfügbar | manuellen Prüfplan abarbeiten | Betreiber |
| Retention-Löschjobs | OFFEN | Fristen fachlich unbestätigt | [FACHLICH/RECHTLICH PRÜFEN] | Fachlich/Rechtlich |
| Upload-Virenscan | BLOCKED | keine Scan-Fähigkeit in der Laufzeit | MIME-/Größenhärtung bleibt aktiv | Betreiber |
| Production-Performance-Budgets | OFFEN | nur Dev-Werte | nach Staging-Lauf festlegen | Betreiber |
| Staging-E2E | BLOCKED | `qa/PHASE19-STAGING-E2E-REPORT.md` | nach Einrichtung ausführen | Betreiber |
| Incident Runbooks | PASS | `docs/production/INCIDENT_RESPONSE.md` (20 Szenarien) | — | Agent |
| Operations Runbook | PASS | `docs/production/OPERATIONS_RUNBOOK.md` | — | Agent |
| Maintenance Mode | OFFEN | kein zentral schaltbarer Wartungszustand in V1 | Ersatzverfahren dokumentiert, echte Schaltung V1.1 | Betreiber |
| Rollback-Test | BLOCKED | `qa/PHASE19-ROLLBACK-REPORT.md` | in Staging durchführen | Betreiber |
| Rechtliche Freigabematrix | OFFEN | `docs/production/LEGAL_GO_LIVE_CHECKLIST.md` | Pflichtpunkte bestätigen | Fachlich/Rechtlich |
| Release-Readiness-Dashboard | PASS | `/app/system/release-readiness` | — | Agent |
| Go-live-Freigabe | OFFEN | Ablauf in `docs/production/GO_LIVE_RUNBOOK.md` | Owner-Freigabe steht aus | Owner |
| Cutover Runbook | PASS | `docs/production/GO_LIVE_RUNBOOK.md` | — | Agent |
| Regression | PASS | `bun run verify` grün | — | Agent |
| Monitoring/Alarmierung | OFFEN | Health, Status, Fehler, Jobs vorhanden; keine externe Alarmierung | Alarmierungsziel festlegen | Betreiber |
| Carrier für digitale Shops | NOT REQUIRED | keine physischen Waren | — | Betreiber |

Keine **FAIL**.

## 3. Production Guard (Punkt 3)

Neu: `src/lib/commerce/environment.ts` löst die Umgebung aus `APP_ENV` (Fallback `LOVABLE_ENV`) auf.

- Gültige Werte: `development`, `staging`, `production`.
- Ungültiger Wert → harter Fehler.
- Fehlender Wert → `unknown` → alle geschützten Operationen werden abgebrochen.
- Geschützt sind zehn Operationen: Demo-Seed, QA-Fixtures, Fixture-Reset, QA-Harnesses,
  Test-Payment-Provider, Test-E-Mail-Provider, Test-Carrier, synthetische Testbestellungen,
  Debug-Endpunkte, Test-Publishable-Keys im Live-Checkout.
- `src/lib/commerce/demo/guard.server.ts` nutzt die Auflösung zusätzlich zu den bestehenden
  Signalen (Live-Zahlungsanbieter, Live-Store-API-Key) und schreibt weiterhin ein Security-Audit.
- Negativtests: `src/lib/commerce/__tests__/environment.test.ts`, Teil von `bun run test`.
- `APP_ENV` ist in `.env.example` als Pflichtwert dokumentiert.

## 4. Provider — ehrlicher Stand

Es wurde **keine** Verbindung simuliert und **kein** Provider ohne echten Adapter als verfügbar
dargestellt. Stripe-Adapter, Webhook-Signaturprüfung, Refund-Pfad und Test-/Live-Trennung sind im
Code vorhanden; ohne hinterlegte Testkeys sind sie nicht nachweisbar und bleiben BLOCKED.
PayPal und Mollie bleiben „Noch nicht verfügbar". Stripe Connect bleibt V1.1.

Benötigte Werte (ausschließlich über die sichere Secret-Verwaltung des Projekts, niemals im Chat):

| Secret | Zweck | Umgebung |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Stripe-Testbetrieb | Staging |
| `STRIPE_WEBHOOK_SECRET` | Signaturprüfung Test-Webhook | Staging |
| `STRIPE_SECRET_KEY` (Live) | Livebetrieb | Production, getrennt |
| `STRIPE_WEBHOOK_SECRET` (Live) | eigener Live-Webhook | Production, getrennt |
| E-Mail-Provider-API-Key | transaktionaler Versand | je Umgebung |
| Carrier-Zugangsdaten | Labels und Tracking | je Umgebung |

## 5. Regression (Punkt 19)

`bun run verify`: docs:validate OK (24 Pflichtdateien, 75 Markdown-Dateien), typecheck OK, Tests 80/80, Build (Client + SSR + Nitro) OK. Zusätzlich `bun run qa:demo` 44/44 PASS nach der Guard-Härtung (die Demo-Harness stellte `APP_ENV` nach dem Negativtest nicht wieder her; minimal korrigiert, keine Prüfung abgeschwächt). Die QA-Suiten Security, RLS,
Health, Jobs, Migrationen, Demo, UI, Accessibility, Performance, Privacy, Storage, Provider,
Integration Center, Store API und SDK-Contract sind mit ihren jeweiligen Berichten aus Gate A,
Gate B und Phase 18 unverändert gültig; in Gate C wurden keine Tests entfernt oder abgeschwächt.
Staging-E2E und Rollback sind BLOCKED (siehe oben).

## 6. Abschließende Einstufung

| Bereich | Ergebnis | Begründung |
| --- | --- | --- |
| **SOFTWARE READY** | **JA** | Build, Typecheck, Tests, Security, RLS, Migrationen, Jobs, Integration Center grün; Funktionsumfang eingefroren |
| **STAGING READY** | **NEIN** | keine getrennte Umgebung, kein Staging-E2E, kein Rollback-Test |
| **PROVIDER READY** | **NEIN** | Stripe, E-Mail und Carrier ohne Zugangsdaten und ohne echte Adapterabnahme |
| **LEGAL READY** | **NEIN** | keine bestätigten Pflichttexte, Fristen und Verträge |
| **PRODUCTION READY** | **NEIN** | Go-live-Freigabe steht aus; zwingende Blocker offen |

Gate C ist damit auf dem automatisierbaren Anteil abgeschlossen. Der Go-live bleibt bis zur
ausdrücklichen Owner-Freigabe und zur Auflösung der Blocker in
`docs/production/V1_GO_LIVE_BLOCKERS.md` gesperrt.
