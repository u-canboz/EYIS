# Gate B6/B7 — Staging-Trennung und Staging-E2E

Status: **BLOCKED**

## Grund

Es existiert genau ein Cloud-Projekt. Eine zweite, isolierte Umgebung kann der Agent auf der
verwalteten Plattform nicht anlegen; das ist eine manuelle Entscheidung des Betreibers.
Damit sind alle Prüfungen, die eine echte Umgebungstrennung voraussetzen, nicht durchführbar
und werden nicht als PASS geführt.

Ist-Zustand belegt in `docs/production/ENVIRONMENT_MATRIX.md`: Datenbank, Auth-Nutzer,
Buckets, Store-API-Keys und Logging werden heute geteilt.

## Nicht durchführbare Prüfungen

| ID | Prüfung | Status |
| --- | --- | --- |
| B6.1 | Getrennte Datenbank je Umgebung | BLOCKED |
| B6.2 | Getrennte Auth-Nutzer je Umgebung | BLOCKED |
| B6.3 | Getrennte Buckets je Umgebung | BLOCKED |
| B6.4 | Getrennte Secrets, inkl. Cron-Secret | BLOCKED |
| B6.5 | Getrennte Store-API-Keys mit umgebungsgebundener Origin | BLOCKED |
| B7.1 | Vollständiger E2E-Durchlauf gegen isolierte Staging-Umgebung | BLOCKED |
| B7.2 | Staging-Konto kann sich nicht in Production anmelden | BLOCKED |
| B7.3 | Staging-API-Key wird in Production abgewiesen | BLOCKED |
| B7.4 | Jobs einer Umgebung berühren keine Datensätze der anderen | BLOCKED |
| B7.5 | Restore-Drill gegen Staging | BLOCKED |

## Was stattdessen belegt ist

- Der E2E-Durchlauf Katalog → Warenkorb → Checkout → Zahlung → Bestellung läuft grün gegen
  die Dev-Umgebung (`qa/PHASE5-QA-REPORT.md`).
- Mandantentrennung innerhalb einer Datenbank ist umfassend nachgewiesen
  (`qa/PHASE14-RLS-REPORT.md`, 52/52; Storage 35/35).
- Migrations-Integrität und Drift-Freiheit: `qa/PHASE14-MIGRATION-REPORT.md` 10/10.
- Ein Restore-Drill wurde gegen Dev durchgeführt: `qa/PHASE14-RESTORE-REPORT.md`.

Mandantentrennung ersetzt keine Umgebungstrennung. Der Punkt bleibt Go-live-Blocker.

## Nächster Schritt

`docs/production/STAGING_SETUP_RUNBOOK.md` abarbeiten. Danach ist dieser Bericht mit den
tatsächlichen Läufen zu füllen.
