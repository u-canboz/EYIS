# Migration Runbook — EYIS V1

Stand: 2026-08-26 (Gate A7). Quelle der Wahrheit: `supabase/migrations/` (42 Dateien).

## Grundprinzipien

1. **Schema-Änderungen nur über Migrationen.** Keine manuellen Eingriffe in die Datenbank.
2. **Eine Richtung: DEV → STG → PRD** mit derselben, byte-identischen Migrationsdatei
   (Invariante 3 aus ENVIRONMENT_MATRIX.md).
3. **Jede Migration ist append-only im Repository.** Einmal angewendete Dateien werden
   niemals geändert; Korrekturen erfolgen als neue Migration.
4. **GRANT-Pflicht**: jede `CREATE TABLE public.*` wird in derselben Datei von `GRANT`-,
   `ENABLE ROW LEVEL SECURITY`- und `CREATE POLICY`-Statements gefolgt (automatisiert
   geprüft in `qa/phase14-migrations.ts`).

## Neue Migration anlegen und ausrollen

1. Migration über das Migrations-Tool erstellen; Datei landet in `supabase/migrations/`
   mit Zeitstempel-Version (`YYYYMMDDHHMMSS_<uuid>.sql`).
2. **Vor dem Anwenden** Review-Checkliste:
   - [ ] GRANTs für jede neue Tabelle (Rollen passend zu den Policies, `service_role` immer)
   - [ ] RLS aktiviert + mindestens eine Policy (außer freigegebene Service-Tabellen)
   - [ ] `created_at`/`updated_at` + Update-Trigger bei veränderbaren Tabellen
   - [ ] Kein `ALTER DATABASE`, kein DDL auf `auth`/`storage`/`realtime`/`vault`
   - [ ] `SECURITY DEFINER`-Funktionen mit `SET search_path = public`
   - [ ] Zeitabhängige Regeln als Trigger, nicht als CHECK-Constraint
3. **Nach dem Anwenden** Verifikation:
   - `bun qa/phase14-migrations.ts` → 10/10 PASS (Drift, RLS, Grants)
   - Betroffene QA-Suiten laufen lassen (mindestens `qa/phase14-rls.ts`)
4. Rollout auf Folgeumgebungen: dieselbe Datei, unverändert, in Versionsreihenfolge.

## Verifikation der Reproduzierbarkeit

`qa/phase14-migrations.ts` prüft automatisiert:

| Check | Inhalt |
| --- | --- |
| Datei-Integrität | eindeutige Versionen, chronologische = lexikalische Reihenfolge |
| GRANT-Pflicht | jede neue public-Tabelle hat GRANT in derselben Datei |
| Verbotene Statements | kein ALTER DATABASE, kein DDL auf geschützten Schemas |
| Drift Tabellen | Menge der `CREATE TABLE public.*` (minus Drops) == Live-DB (112) |
| Drift Funktionen | Menge der `create function public.*` == Live-DB (102) |
| RLS | `rowsecurity` auf allen 112 Tabellen |
| Policy-Losigkeit | nur 6 freigegebene Service-Tabellen ohne Policy |
| Service-Grants | diese 6 Tabellen haben keine anon/authenticated-Grants |

**BLOCKED**: Vollständiger Replay aller 42 Migrationen auf einem frischen Projekt ist ohne
zweites Cloud-Projekt nicht durchführbar. Die Drift-Checks belegen die Übereinstimmung der
Migrationen mit der Live-DB; der Replay-Nachweis wird mit der Staging-Umgebung
(ENVIRONMENT_MATRIX.md, Schritt 2) nachgeholt.

## Bekannte Altlasten

- Die ersten Migrationen stammen aus der Aufbauphase; die GRANT-Pflicht wurde rückwirkend
  in Gate A4 verifiziert und wird seitdem automatisiert erzwungen.
- `supabase/config.toml` ist plattformverwaltet und nicht Teil des Migrationspfads.
