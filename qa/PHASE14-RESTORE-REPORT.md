# Phase 14 / Gate A6 — Backup- und Restore-Report

Datum: 2026-08-26 · Harness: `qa/phase14-restore.ts` · Ergebnis: **8/8 PASS**
Rohdaten: `qa/results-phase14-restore.json` · Export: `qa/backups/restore-drill-2026-08-26T08-51-26-892Z/`

## Durchgeführter Drill

| # | Test | Ergebnis | Nachweis |
| --- | --- | --- | --- |
| 1 | Logischer Export aller 65 geschäftskritischen Tabellen (JSONL + SHA-256-Manifest) | PASS | 1.071 Zeilen, Manifest mit Hash je Tabelle |
| 2 | Export-Treue: Stichproben (bis 5 Zeilen/Tabelle) feldweise identisch zur Live-DB | PASS | kanonischer JSON-Vergleich |
| 3 | Mini-Restore-Drill: Datensatz anlegen → exportieren → löschen → aus Export wiederherstellen | PASS | bitidentisch (stabiler Hash-Vergleich der kompletten Zeile) |
| 4 | Reimport-Test: alle Export-Dateien erneut eingelesen, Zeilenzahl + SHA-256 == Manifest, jede Zeile parsebar | PASS | 65/65 Dateien |
| 5 | Vollständigkeit: für jede kritische Tabelle existiert eine Export-Datei | PASS | 65/65 |
| 6 | Konsistenz: Zeilenzahlen Export == Live-DB (Nachkontrolle) | PASS | 65/65 |
| 7 | Physischer Full-Restore / PITR in getrennte Umgebung | **BLOCKED** | siehe unten |

## Bewertung

- Der **logische Wiederherstellungspfad** (Export → Verifikation → Einzel- oder Voll-Reimport)
  ist drill-getestet und reproduzierbar: `bun qa/phase14-restore.ts`.
- Der Mini-Restore-Drill beweist, dass ein Datensatz ausschließlich aus dem Export-Payload
  bitidentisch wiederhergestellt werden kann — inklusive `id` und Zeitstempeln.
- Der vollständige Reimport in eine leere Datenbank (S2/S3 des Runbooks) ist vorbereitet
  (Restore-Reihenfolge = `CRITICAL_TABLES`, Eltern vor Kindern), aber ohne zweites Projekt
  nicht ausführbar.

## BLOCKED

- **Physischer Full-Restore / Point-in-Time-Recovery**: Die verwaltete Plattform stellt
  kein zweites Projekt und keinen direkten Snapshot-Zugriff bereit. Nachholung zusammen mit
  der Umgebungstrennung (ENVIRONMENT_MATRIX.md, Schritte 1 und 6). Bis dahin ist der
  logische Pfad der maximale, drill-getestete Nachweis.
- **Storage-Datei-Restore**: Bucket-Dateien (`media`, `shipping-labels`, `documents`) wurden
  nicht in eine Zweitumgebung wiederhergestellt; abgedeckt ist die Metadaten-Integrität.

## Artefakte

- `docs/production/BACKUP_POLICY.md` — RPO ≤ 24 h, RTO ≤ 8 h, Aufbewahrung 90 Tage
- `docs/production/DISASTER_RECOVERY_RUNBOOK.md` — Szenarien S1–S5
- `qa/phase14-restore.ts`, `qa/results-phase14-restore.json`
