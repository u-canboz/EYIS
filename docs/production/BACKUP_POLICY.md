# Backup Policy — Commerce OS V1

Stand: 2026-08-26 (Gate A6). Gilt ab V1-Freeze.

## Verantwortlichkeiten

| Ebene | Mechanismus | Verantwortlich |
| --- | --- | --- |
| Plattform-Backups (physische DB-Snapshots) | automatisiert durch die verwaltete Cloud-Plattform | Plattformbetreiber |
| Logische Exporte (JSONL/CSV je Tabelle) | QA-Harness `qa/phase14-restore.ts` bzw. manueller Export über Cloud → Advanced settings → Export data | Betreiber |
| Schema (Migrationen) | Git-Repository, `supabase/migrations/` | Betreiber |
| Secrets | Secret-Register (`SECRET_REGISTER_TEMPLATE.md`), plattformverwaltete Secret-Ablage | Betreiber |

## Aufbewahrung und Ziele

| Zielgröße | Wert | Begründung |
| --- | --- | --- |
| RPO (Recovery Point Objective) | ≤ 24 h | Plattform-Snapshots täglich; zusätzlich logischer Export vor jedem Release |
| RTO (Recovery Time Objective) | ≤ 8 h | Neuaufsetzen = Migrationen replayen (≤ 1 h) + logischer Reimport + Verifikation |
| Aufbewahrung logischer Exporte | 90 Tage, wöchentlich | Exporte enthalten personenbezogene Daten → begrenzte Aufbewahrung, verschlüsselte Ablage |
| Aufbewahrung Plattform-Snapshots | plattformseitig festgelegt | außerhalb der Kontrolle des Betreibers |

## Was gesichert wird

1. **Datenbank**: alle 112 Tabellen des `public`-Schemas. Die 65 geschäftskritischen Tabellen
   sind in `qa/phase14-restore.ts` (`CRITICAL_TABLES`) in Restore-Reihenfolge gelistet.
2. **Storage-Buckets**: `media`, `shipping-labels`, `documents` (alle privat). Dateien werden
   plattformseitig gesichert; die Metadaten (`media_assets`, `document_files`, `shipping_labels`)
   sind Teil des logischen Exports.
3. **Schema**: vollständig reproduzierbar aus `supabase/migrations/` (siehe MIGRATION_RUNBOOK.md).
4. **Secrets**: nicht im Backup. Wiederherstellung ausschließlich über das Secret-Register
   und Rotation (SECRET_ROTATION_RUNBOOK.md).

## Was bewusst NICHT gesichert wird

- `audit_log`-Einträge älter als die Aufbewahrungsfrist des letzten Exports (append-only,
  Plattform-Snapshot ist Primärquelle).
- Flüchtige Laufzeitdaten: `store_api_rate_counters`, abgelaufene `checkout_reservations`,
  abgelaufene `store_confirmation_tokens`. Diese sind ohne Restore-Wert.
- Secrets und API-Key-Klartexte (existieren nirgends; nur Hashes in `store_api_keys`).

## Restore-Drill-Pflicht

- **Vor jedem Go-live und danach quartalsweise**: `bun qa/phase14-restore.ts` ausführen.
  Erwartung: 8/8 PASS. Ergebnis landet in `qa/results-phase14-restore.json`.
- Der Drill prüft: vollständigen logischen Export, Export-Treue (Stichproben feldweise),
  bitidentischen Einzel-Restore, Reimport-Lesbarkeit inkl. SHA-256-Manifest.
- Ein physischer Full-Restore in eine getrennte Umgebung ist aktuell **BLOCKED**
  (kein zweites Projekt auf der verwalteten Plattform) und wird mit Einrichtung der
  Staging-/Produktionsprojekte (ENVIRONMENT_MATRIX.md, Schritt 1 und 6) nachgeholt.

## Ablage und Schutz der Exporte

- Exporte enthalten Kunden-, Bestell- und Zahlungsdaten → Ablage ausschließlich
  verschlüsselt und zugriffsbeschränkt. `qa/backups/` ist ein lokales Drill-Artefakt
  und darf **nicht** committet oder öffentlich abgelegt werden.
- Löschung von Exporten nach 90 Tagen ist Teil des Drills (Vernichtungsnachweis im Protokoll).
