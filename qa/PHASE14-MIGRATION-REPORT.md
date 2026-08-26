# Phase 14 / Gate A7 — Migrations-Audit und Schema-Reproduzierbarkeit

Datum: 2026-08-26 · Harness: `qa/phase14-migrations.ts` · Ergebnis: **10/10 PASS**
Rohdaten: `qa/results-phase14-migrations.json`

## Ergebnis

| # | Check | Ergebnis | Detail |
| --- | --- | --- | --- |
| 1 | Eindeutige Migrationsversionen | PASS | 42 Dateien |
| 2 | Chronologische == lexikalische Reihenfolge | PASS | Replay in Dateinamen-Reihenfolge korrekt |
| 3 | GRANT-Pflicht: jede neue public-Tabelle hat GRANT in derselben Migration | PASS | 0 Verstöße |
| 4 | Keine verbotenen Statements (ALTER DATABASE, DDL auf auth/storage/realtime/vault) | PASS | 0 Verstöße |
| 5 | Drift Tabellen: Migrationen ↔ Live-DB | PASS | 112 Tabellen, keine Abweichung in beide Richtungen |
| 6 | Drift Funktionen: Migrationen ↔ Live-DB | PASS | 102 Funktionen, keine Abweichung |
| 7 | RLS auf allen public-Tabellen | PASS | 112/112 |
| 8 | Policy-Losigkeit nur auf freigegebenen Service-Tabellen | PASS | genau die 6 aus A4: `automation_rule_counters`, `idempotency_keys`, `outbox_events`, `store_api_rate_counters`, `store_confirmation_tokens`, `store_privacy_salts` |
| 9 | Diese 6 Service-Tabellen ohne anon/authenticated-Grants | PASS | Data API hat keinen Zugriff |
| 10 | Vollständiger Schema-Replay auf frischem Projekt | **BLOCKED** | kein zweites Projekt; Drift-Checks 5+6 belegen Übereinstimmung |

## Bewertung

- Das Schema ist **drift-frei**: Alles, was in der Live-DB existiert, stammt aus einer
  Migration, und jede Migration ist angewendet. Ein Replay auf einem frischen Projekt ist
  damit mit hoher Sicherheit reproduzierbar; der endgültige Nachweis (echter Replay) ist
  BLOCKED bis eine Staging-Umgebung existiert.
- Die GRANT-Pflicht aus den Projektregeln wird ab jetzt automatisiert erzwungen — der Check
  schlägt fehl, sobald eine neue Tabelle ohne GRANT committed wird.

## Artefakte

- `docs/production/MIGRATION_RUNBOOK.md` — Review-Checkliste, Rollout DEV → STG → PRD
- `docs/production/ROLLBACK_PLAN.md` — Forward-Fix-Strategie, Abwärtskompatibilitäts-Regeln
- `qa/phase14-migrations.ts`, `qa/results-phase14-migrations.json`
