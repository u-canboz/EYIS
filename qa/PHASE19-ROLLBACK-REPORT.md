# Phase 19 — Rollback- und Forward-Fix-Test: Bericht

Status: **BLOCKED**

## Grund

Ein realistischer Release-Rollback verändert Datenbestand, laufende Carts, offene Checkouts,
Jobs und Webhook-Verarbeitung. Ein solcher Test darf ausschließlich in einer getrennten
Staging-Umgebung laufen. Diese existiert nicht (`qa/PHASE19-STAGING-SETUP-REPORT.md`).
Ein Test gegen Development würde die einzige vorhandene Datenbank gefährden und wird bewusst
nicht ausgeführt.

## Geplante Prüfungen

| ID | Prüfung | Verfahren | Status |
| --- | --- | --- | --- |
| C14.1 | App-Release zurücksetzen | vorherige Veröffentlichung erneut ausrollen | BLOCKED |
| C14.2 | Store-API-Kompatibilität nach Rücksetzung | `bun run qa:store-api` gegen Staging | BLOCKED |
| C14.3 | Migrationen | **Forward Fix**, keine destruktive Rückmigration | BLOCKED |
| C14.4 | Aktive Warenkörbe bleiben gültig | Cart vor und nach Rücksetzung abrufen | BLOCKED |
| C14.5 | Offene Checkout-Sessions | Session weiterführen oder kontrolliert ablaufen lassen | BLOCKED |
| C14.6 | Jobs laufen weiter | `bun run qa:jobs` | BLOCKED |
| C14.7 | Webhooks werden weiter verarbeitet, keine Doppelverarbeitung | Duplicate-Event-Test | BLOCKED |
| C14.8 | Dokumente bleiben abrufbar | Rechnungs-Download | BLOCKED |
| C14.9 | Storefront funktioniert | Smoke Test | BLOCKED |

## Festlegung zum Verfahren

Eine destruktive Rückmigration wird **nicht** behauptet und ist nicht vorgesehen. Verbindlich ist:

1. **Forward Fix** als Regelweg (`docs/production/MIGRATION_RUNBOOK.md`).
2. **Restore aus Backup** nur bei Datenverlust oder inkonsistentem Schema
   (`docs/production/DISASTER_RECOVERY_RUNBOOK.md`), mit Datenverlustfenster laut
   `docs/production/BACKUP_POLICY.md`.
3. App-Rollback ohne Schemaänderung ist jederzeit möglich, solange die Store API v1 stabil bleibt.

## Bereits belegt

Ein Restore-Drill wurde gegen Development durchgeführt: `qa/PHASE14-RESTORE-REPORT.md`.
Das ersetzt den Rollback-Test in Staging nicht.
