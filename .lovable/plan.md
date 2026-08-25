# Phase 14 — Production Hardening (Gate A)

Feature Freeze. Keine neuen Commerce-Funktionen. Gate A umfasst: V1-Freeze-Dokumentation, Umgebungstrennung, Secret-Inventur, Security-Audit (OWASP), Security-Header, RLS/Datenbank-Matrix, Datenintegritäts-Engine, Backup/Restore-Drill, Migrations-Runbook, Job-Härtung und Monitoring-Grundlage.

Gate B (Performance, Accessibility, Datenschutz, Provider Readiness, Staging-E2E) und Gate C (Release Readiness, Incident Response, Rollback, Go-live) folgen erst nach Abnahme von Gate A.

Grundregel für jeden Status: PASS nur mit Nachweis (Testlauf, Codestelle, SQL-Abfrage, Konfigurationsauszug). Nicht Geprüftes bleibt `OFFEN` oder `BLOCKED`. Stripe, echter E-Mail-Versand und Carrier bleiben durchgehend `BLOCKED`.

## A1 — V1 einfrieren

Dokumente unter `docs/production/`:
- `V1_SCOPE.md` — Funktionsumfang Phase 0–12, abgeleitet aus den archivierten Phasenplänen und dem tatsächlichen Code.
- `ARCHITECTURE_CURRENT.md` — Schichten (Server Functions, Public Store API, SDK, Storefront, Backoffice), Datenflüsse, Vertrauensgrenzen.
- `KNOWN_LIMITATIONS.md` — bekannte Einschränkungen inkl. blockierter Provider.
- `RELEASE_NOTES_RC1.md` — Version `1.0.0-rc.1`, Build-/Teststand, Schema-Stand (Migrationsliste bis zur letzten angewandten Datei).

Public Store API bleibt `/api/public/store/v1`; DTO-Änderungen nur versioniert.

## A2 — Umgebungen und Secrets

- `docs/production/ENVIRONMENT_MATRIX.md` — Development / Staging / Production mit Datenbank, Auth, Storage, Secrets, Cron, API-URL, Storefront-URL, Stripe-Modus, Providern, Publishable Keys, CORS, Logging, Monitoring. Für jede Zeile: tatsächlicher Ist-Zustand oder `OFFEN`.
- `.env.example` — ausschließlich Variablennamen, aus dem Code erhoben (alle `process.env[...]`- und `import.meta.env`-Zugriffe).
- `docs/production/SECRET_REGISTER_TEMPLATE.md` und `SECRET_ROTATION_RUNBOOK.md` — Inventur ohne Werte, Rotations- und Widerrufsablauf.
- Prüfung: Secrets nie im Client-Bundle, nie in Audit-/Outbox-Payloads, nie in Logs. Nachweis über Suche im gebauten Bundle und über die Redaction-Pfade im Code.
- Umgebungskennzeichnung: prüfen, ob Payment-, Order-, Communication- und Shipping-Datensätze ihre Umgebung erkennen lassen; fehlende Kennzeichnung wird als Finding erfasst und, wenn nötig, per Migration ergänzt.

## A3 — Security-Audit (OWASP ASVS L2 + API Top 10)

Automatisierte Prüf-Harness `qa/phase14-security.ts` (gleiche Struktur wie `qa/phase12.ts`) plus manuelle Codeprüfung. Geprüft werden:
- Auth: Login/Logout/Reset/Session/Token-Widerruf, Account-Enumeration, Rate-Limits, Trennung Admin- vs. Customer-Auth, MFA-Status der Plattform.
- Autorisierung: jede Server Function, jede Store-API-Route, Portal- und Guest-Token-Funktionen, Dokument-Downloads, Refund/Invoice/Return/Inventory-Aktionen — Object-, Function- und Property-Level, Mass Assignment.
- Mandantentrennung: Matrix über zwei Organisationen und zwei Shops für alle Domänen inkl. API-Keys, Logs und Storage.
- Eingaben: Injection, XSS/Stored XSS, Template-/Header-Injection, Path Traversal, SSRF, Open Redirect, ReDoS, Oversized Payloads, Datei-/MIME-Manipulation.
- API: Rate-Limit-Umgehung, Key-Revoke, Origin-Manipulation, ID-Manipulation, Overexposure, Idempotency-Missbrauch, Replay.

Ergebnisse: `qa/PHASE14-SECURITY-REPORT.md` und `qa/results-phase14-security.json` mit Schweregrad, Komponente, Reproduktion, Ursache, Korrektur, Retest. Zusätzlich Deep Security Scan und Datenbank-Linter. Kritische und hohe Findings werden in dieser Phase behoben und erneut getestet — nicht ausgeblendet.

Header/Transport: tatsächlich ausgelieferte Header messen (HTTPS, HSTS, CSP, frame-ancestors, X-Content-Type-Options, Referrer- und Permissions-Policy, CORS, Cookie-Attribute, keine Stack Traces) und in `qa/PHASE14-SECURITY-HEADERS.md` dokumentieren; fehlende Header werden gesetzt, soweit die Plattform es zulässt.

## A4 — Datenbank- und RLS-Inventur

Vollständige Tabellenmatrix (alle ~115 Tabellen) per SQL erhoben:
Organisation-/Shop-Scope, RLS aktiv, Policies je Operation, GRANTs, server-only/append-only/immutable, Foreign Keys, Unique- und CHECK-Constraints, Indizes.
Zusätzlich Prüfung der SECURITY-DEFINER-Funktionen auf fixierten `search_path`, dynamisches SQL, RLS-Rekursion, Trigger-Reihenfolge und Sperrreihenfolge.

Ergebnis: `docs/production/DATABASE_SECURITY_MATRIX.md` und `qa/PHASE14-RLS-REPORT.md`. Lücken werden per Migration geschlossen.

## A5 — Commerce Health Check

Neues Modul `src/lib/commerce/health/` mit read-only Checks (keine stillen Reparaturen) für Orders/Payments, Inventory, Taxes, Documents, Shipping, Returns, Communications/Automations — genau die im Auftrag genannten Invarianten.

Geschützte Backoffice-Route `/app/system/health`: Statusübersicht je Gruppe, betroffene Datensätze mit technischer Referenz, Schweregrad, Zeitpunkt des Laufs. Reparaturen nur als explizite, auditierte Maintenance-Aktionen (in Gate A nur vorbereitet, nicht automatisch ausgeführt).

Bericht: `qa/PHASE14-DATA-INTEGRITY-REPORT.md`.

## A6 — Backup und Restore-Drill

Tatsächlich verfügbare Backup-Konfiguration der Cloud-Datenbank erheben (Frequenz, Aufbewahrung, Restore-Optionen, Abdeckung von Storage, Auth-Nutzern, Dokumenten, PDFs, Medien, Labels).

Echter Drill in isolierter QA-Organisation: konsistenten Datensatz erzeugen (Produkt, Preis, Bestand, Order, Rechnung, Dokument), Sicherungspunkt festhalten, Daten kontrolliert verändern, Wiederherstellung in isolierte Umgebung, Vergleich von Datenintegrität, Dateien, Prüfsummen sowie Auth-/RLS-Funktion. RPO und RTO werden aus dem gemessenen Lauf abgeleitet, nicht behauptet.

Ergebnisse: `docs/production/BACKUP_POLICY.md`, `docs/production/DISASTER_RECOVERY_RUNBOOK.md`, `qa/PHASE14-RESTORE-REPORT.md`. Falls die Plattform eine vollständige Wiederherstellung in eine isolierte Umgebung nicht zulässt, wird der maximal mögliche Umfang durchgeführt und die Lücke ausdrücklich als Go-live-Blocker vermerkt.

## A7 — Migrationen produktionssicher

Alle vorhandenen Migrationen auf Reproduzierbarkeit, Reihenfolge, destruktive Schritte, lange Sperren und Backfill-Trennung prüfen.
Ergebnis: `docs/production/MIGRATION_RUNBOOK.md` und `docs/production/ROLLBACK_PLAN.md` (Forward-Fix-Strategie, API-Kompatibilität während Migrationen).

## A8 — Jobs, Queue und Monitoring

- Inventur aller Jobs (Communications, Automations, Checkout-/Cart-/Reservation-Expiration, Tracking-Refresh, Provider-Events, Retry, Dead Letter) mit Auth, Intervall, Batch, Timeout, Locking, Retry, Idempotency, Dead Letter, Monitoring, manueller Wiederholung.
- Tests: parallele Aufrufe, abgebrochener Worker, Timeout mitten in der Verarbeitung, Retry, veralteter Lock, großer Backlog, Provider-Ausfall.
- Backoffice `/app/system/jobs`: Queue-Zustand, gesperrte und fehlgeschlagene Jobs, Dead Letters, manuelle Wiederholung (auditiert).
- Backoffice `/app/system/status` und `/app/system/errors`: Request-Rate, Fehlerquote, Latenz, Rate-Limits, Auth-/Permission-Fehler, Payment-, Webhook-, Order-, Inventory-, Communication-, Automation-, Shipping-, Dokument- und Storage-Fehler — mit Zeit, Komponente, Schweregrad, Request-/Correlation-ID, Shop, bereinigter Meldung, Status. Keine personenbezogenen Daten, keine Secrets.
- Alerts als interne Operational-Inbox-Regeln (keine erfundene externe Benachrichtigung), inklusive der geforderten Schwellen.

Berichte: `docs/production/JOB_RUNBOOK.md`, `qa/PHASE14-JOBS-REPORT.md`.

## Technische Hinweise

- Health-, Job- und Status-Logik als `*.server.ts` mit dünnen `*.functions.ts`-Wrappern; Backoffice-Routen unter `_authenticated/app/system/` mit Rollenprüfung (nur Owner/Administrator/Operations).
- Neue Tabellen nur, wo für Monitoring/Health-Läufe zwingend nötig (z. B. Health-Run-Journal), jeweils mit GRANTs, RLS und org-Scoping.
- Alle Prüf-Harnesses laufen gegen die vorhandene QA-Organisation aus `qa/state.json`, niemals gegen Produktionsdaten.
- Abschluss von Gate A: Build und Typecheck grün, alle Tests aus Phase 0–12 unverändert grün, Berichte erstellt, offene Findings priorisiert.

## Ausdrücklich nicht Teil von Gate A

Live-Provider einrichten, Domains veröffentlichen, echte Zahlungen, Produktionsdaten erzeugen, Phase-13-Funktionen, Performance-Baseline, Accessibility-Audit, Datenschutzkonzept, Release-Dashboard.
