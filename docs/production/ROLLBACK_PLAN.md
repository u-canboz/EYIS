# Rollback Plan — Commerce OS V1

Stand: 2026-08-26 (Gate A7). Gilt für fehlerhafte Migrationen und fehlerhafte Releases.

## Grundsatz

Datenbank-Migrationen werden **nicht rückwärts** ausgeführt (kein `down`-Migrationssystem).
Rollback bedeutet: **Forward-Fix** — eine neue Migration, die den fehlerhaften Zustand
korrigiert. Ausnahmen siehe unten.

## Entscheidungsmatrix

| Schadensfall | Verfahren |
| --- | --- |
| Neue Tabelle/Spalte fehlerhaft, noch keine Daten darauf | Forward-Fix-Migration: `DROP`/`ALTER` der fehlerhaften Objekte |
| Fehlerhafte Datenänderung durch Migration | Betroffene Zeilen aus letztem logischem Export wiederherstellen (DISASTER_RECOVERY_RUNBOOK S1) |
| Fehlerhafte RLS-Policy / Grants | Sofortige Forward-Fix-Migration mit korrigierter Policy; danach `bun qa/phase14-rls.ts` |
| Fehlerhafte `SECURITY DEFINER`-Funktion | `CREATE OR REPLACE` mit korrigiertem Body als neue Migration |
| Migration bricht mittendrin ab | Postgres-Transaktion: nichts wurde angewendet; Datei korrigieren, erneut anwenden |
| Release (App-Code) fehlerhaft | Vorherigen veröffentlichten Stand erneut veröffentlichen; DB bleibt unverändert, sofern kompatibel |
| Schema inkompatibel zum alten Code-Stand | Alten Code nur veröffentlichen, wenn das Schema abwärtskompatibel ist; sonst Forward-Fix |

## Abwärtskompatibilitäts-Regeln für Migrationen

Damit ein Code-Rollback jederzeit möglich ist, müssen Migrationen abwärtskompatibel sein:

1. **Niemals** Spalten/Tabellen löschen, die der aktuell veröffentlichte Code noch liest —
   stattdessen zweistufig: (a) Code umstellen, (b) in einem späteren Release löschen.
2. Neue `NOT NULL`-Spalten nur mit `DEFAULT` oder als nullable + Backfill + später Constraint.
3. Enum-Werte nur hinzufügen, nie entfernen oder umbenennen.
4. Funktionssignaturen erweitern (neue Parameter mit Defaults), nicht ändern.

## Ablauf bei einem fehlerhaften Produktiv-Release

1. **Stoppen**: kein weiteres Deployment, keine weiteren Migrationen.
2. **Bewerten**: betrifft der Fehler Daten (→ S1-Restore erwägen) oder nur Verhalten?
3. **Code-Rollback**: letzten funktionierenden Stand veröffentlichen, sofern schema-kompatibel.
4. **Forward-Fix**: neue Migration mit Korrektur; Review-Checkliste aus MIGRATION_RUNBOOK.md.
5. **Verifikation**: `qa/phase14-migrations.ts`, `qa/phase14-rls.ts`, betroffene Fach-Suiten,
   Health Engine (`/app/system/health`).
6. **Nachbereitung**: Eintrag in RELEASE_NOTES und, bei Datenkorrektur, Audit-Eintrag prüfen.

## Was es bewusst nicht gibt

- Kein automatisiertes `down`-Replay: bei 42 append-only Migrationen mit Datenänderungen
  wäre ein generisches Down-Migrationssystem nicht verlässlich testbar.
- Kein Zurücksetzen der Datenbank auf einen Snapshot als Standardverfahren — das ist
  S2/S3 des Disaster Recovery Runbooks und nur für katastrophale Fälle vorgesehen.
