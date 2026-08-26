# Phase 14 / Gate A8 — Jobs, Queues, Cron & Monitoring: QA-Report

Datum: 2026-08-26
Harness: `qa/phase14-jobs.ts` · Rohdaten: `qa/results-phase14-jobs.json`
Ergebnis: **21/21 PASS**

## Geprüfte Bereiche

### 1. Cron-Authentifizierung (6/6 PASS)

Alle drei Job-Endpunkte (`automation`, `communications`, `expiration`) nutzen
die zentrale `authenticateCronRequest` (timing-safe, Vorgänger-Secret-fähig):

- ohne Token → HTTP 401
- mit falschem Token → HTTP 401
- mit `LOVABLE_CRON_SECRET` → HTTP 200, `{"ok": true, ...}` mit fachlichem
  Ergebnis (`claimed`, `processed`, `expired_*`)

### 2. Queue-Verhalten (4/4 PASS)

| Test | Ergebnis | Nachweis |
| --- | --- | --- |
| Stuck-Job-Reclaim | PASS | Job mit `locked_at` −30 min und totem Worker wurde im selben Lauf freigegeben und von einem neuen Worker abgeschlossen (`locked_by` gewechselt) |
| Unbekannter Job-Typ | PASS | `failed` + `invalid_configuration` |
| Retryable Fehler → Backoff | PASS | `webhook.send` auf unerreichbares Ziel (TEST-NET-3, Timeout) → Engine plant `resume_execution`-Job mit `available_at` > +30 s; ursprünglicher Job `completed` |
| Execution-Wartezustand | PASS | Execution bleibt `queued` (wartet auf Resume), nicht `failed` |

### 3. Monitoring-Zugriff und Mandantentrennung (5/5 PASS)

- Cross-Tenant: User B (Owner Org B) → `getSystemStatus` für Org A →
  abgelehnt („Keine Berechtigung").
- Owner Org A erhält Systemstatus: DB-Latenz 52 ms, Counts, 3 Provider,
  3 Cron-Endpunkte.
- Jobs-Übersicht aggregiert Jobs, Outbox und Kommunikations-Queue.
- Fehler-Feed aggregiert 53 Einträge aus allen Quellen, sortiert, max 100.
- Org-B-Übersicht enthält keinen einzigen Org-A-Job.

### 4. UI-Oberflächen (6/6 PASS)

- Anonyme SSR-Aufrufe von `/app/system/jobs`, `/app/system/status`,
  `/app/system/errors` liefern HTTP 200 als leere Shell **ohne** geschützte
  Daten (kein Org-Bezug, keine Tabelleninhalte im HTML).
- Playwright-Nachweis: anonyme Besucher werden nach Hydration auf `/auth`
  umgeleitet (alle drei Routen).
- Playwright-Nachweis: authentifiziert rendern alle drei Seiten mit
  Echtdaten (Outbox-Aggregate, Provider-Modi, Cron-Endpunkte).

## Neue Komponenten

- `src/lib/commerce/system/system.server.ts` — read-only Aggregatoren
  (Rollenprüfung via `has_org_role` mit User-Client, danach org-scoped Reads)
- `src/lib/commerce/system/system.functions.ts` — drei Server Functions
- `src/lib/commerce/system/system.types.ts` — client-safe Typen + Cron-Katalog
- Routen `/app/system/jobs`, `/app/system/status`, `/app/system/errors`
  (in Navigation aufgenommen)
- `docs/production/JOB_RUNBOOK.md` — Zeitpläne, Queue-Semantik, Störungsfälle

## Findings

| ID | Schwere | Befund | Status |
| --- | --- | --- | --- |
| A8-F1 | Info | Keine aktive Alarmierung (E-Mail/Webhook bei Schwellen) — V1 nutzt die vier Systemoberflächen als Kontrollinstanz | OFFEN → Post-V1-Backlog |
| A8-F2 | Info | 195 ältere `pending`-Outbox-Events in Org A stammen aus QA-Phasen ohne laufenden Worker; kein Integritätsproblem, werden vom Worker abgearbeitet | Beobachtet |
| A8-F3 | Info | Queue-Level-Backoff (Catch-Zweig in `processAutomationJobs`) ist nur bei Infrastrukturausnahmen erreichbar und daher nicht end-to-end testbar; Code-Inspektion + Engine-Level-Backoff (getestet) decken das Verhalten ab | Dokumentiert |

## Blocker

Keine neuen. Der aus A2 bekannte Go-live-Blocker (geteilte
Dev/Prod-Umgebung) bleibt bestehen.
