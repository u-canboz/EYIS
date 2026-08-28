# Disaster Recovery Runbook — EYIS V1

Stand: 2026-08-26 (Gate A6). Voraussetzung: BACKUP_POLICY.md ist gelesen.

## Szenario-Übersicht

| Szenario | Verfahren | Nachweis |
| --- | --- | --- |
| S1: Einzelne Datensätze versehentlich gelöscht/verändert | Wiederherstellung aus letztem logischem Export (Mini-Restore-Verfahren, unten) | drill-getestet (A6, PASS) |
| S2: Datenbank korrupt / Datenverlust im Projekt | Neuaufsetzen: Migrationen replayen + logischer Reimport | teilweise drill-getestet; physischer Teil BLOCKED |
| S3: Gesamtes Cloud-Projekt verloren | Neues Projekt, Migrationen, Reimport, Secrets neu setzen, DNS/URLs umbiegen | BLOCKED — kein zweites Projekt vorhanden |
| S4: Secret kompromittiert | SECRET_ROTATION_RUNBOOK.md | dokumentiert (A2) |
| S5: Fehlerhafte Migration in Production | ROLLBACK_PLAN.md | dokumentiert (A7) |

## S1 — Einzeldatensatz-Wiederherstellung (drill-getestet)

1. Letzten Export öffnen (`qa/backups/restore-drill-<datum>/<tabelle>.jsonl`).
2. Zeile anhand der `id` suchen; SHA-256 der Datei gegen `manifest.json` prüfen.
3. Zeile als JSON parsen und mit Service-Rolle einfügen:
   `insert into public.<tabelle> select * from jsonb_populate_record(null::public.<tabelle>, '<json>');`
4. Nachweis: Zeile erneut lesen und feldweise mit dem Export vergleichen
   (der A6-Drill macht genau das automatisiert: anlegen → löschen → restore → Identität).
5. `audit_log`-Eintrag der Wiederherstellung prüfen.

## S2/S3 — Neuaufsetzen einer Umgebung

1. Neues/leeres Cloud-Projekt bereitstellen.
2. **Schema**: alle Migrationen aus `supabase/migrations/` in Dateinamen-Reihenfolge anwenden
   (siehe MIGRATION_RUNBOOK.md). Erwartung: 42 Migrationen, 112 Tabellen, RLS auf allen Tabellen.
3. **Verifikation Schema**: `bun qa/phase14-migrations.ts` → muss PASS sein.
4. **Daten**: logischen Reimport in der Reihenfolge von `CRITICAL_TABLES`
   (qa/phase14-restore.ts) — Eltern vor Kindern, damit Fremdschlüssel greifen.
   Danach Zeilenzahlen gegen `manifest.json` prüfen.
5. **Secrets** neu setzen gemäß Secret-Register; **keine** Secrets aus dem verlorenen
   Projekt wiederverwenden — alle rotieren.
6. **Storage**: Dateien aus der Plattform-Sicherung wiederherstellen; Metadaten-Tabellen
   (`media_assets`, `document_files`, `shipping_labels`) wurden in Schritt 4 importiert.
   Stichprobe: 5 Dateien über die App herunterladen.
7. **Funktionsverifikation**: Health Engine laufen lassen (`/app/system/health` bzw.
   `bun qa/phase14-health.ts`) → Erwartung: keine kritischen Befunde.
8. **Regression**: `bun qa/e2e.ts`, `bun qa/phase12.ts`, `bun qa/phase14-security.ts`.
9. Cron-Zeitpläne für `/api/public/jobs/automation`, `/api/public/jobs/communications`,
   `/api/public/jobs/expiration` einrichten (JOB_RUNBOOK.md).

## BLOCKED — offene Voraussetzungen

- **Physischer Full-Restore / PITR**: auf der verwalteten Plattform ohne zweites Projekt
  nicht durchführbar. Wird mit der Umgebungstrennung (ENVIRONMENT_MATRIX.md, Schritte 1+6)
  nachgeholt. Bis dahin gilt der logische Export + Reimport als maximaler, drill-getesteter
  Wiederherstellungspfad.
- **Storage-Datei-Restore** wurde nicht drill-getestet (kein Zweitprojekt); nur die
  Metadaten-Integrität ist abgedeckt.

## Eskalation und Rollen

| Rolle | Aufgabe im Ernstfall |
| --- | --- |
| Owner/Administrator | Entscheidung Restore, Ausführung S1 |
| Developer | Neuaufsetzen S2/S3, Migrations-Replay |
| Plattformbetreiber | Physische Snapshots, PITR |
