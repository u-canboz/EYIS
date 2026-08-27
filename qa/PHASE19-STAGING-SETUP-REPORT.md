# Phase 19 — Getrennte Staging-Umgebung: Bericht

Status: **BLOCKED**

## Befund

Es existiert weiterhin genau ein Cloud-Projekt. Die Plattform bietet dem Agenten keine sichere
Projektduplizierung; das Anlegen einer zweiten Instanz ist eine manuelle Entscheidung des
Betreibers. Es wird deshalb **kein** PASS gemeldet.

Ist-Zustand belegt in `docs/production/ENVIRONMENT_MATRIX.md`: Datenbank, Auth-Nutzer, Buckets,
Store-API-Keys, Secrets und Logs werden von Development und einer künftigen Production geteilt.

## Was in diesem Durchlauf tatsächlich erledigt wurde

| Punkt | Ergebnis | Status |
| --- | --- | --- |
| Umgebungsauflösung mit hartem Abbruch bei fehlendem/ungültigem `APP_ENV` | `src/lib/commerce/environment.ts` | **PASS** |
| Automatisierte Negativtests des Production Guards | `src/lib/commerce/__tests__/environment.test.ts` | **PASS** |
| Demo-Guard nutzt die neue Auflösung, unbekannte Umgebung blockiert Seeds | `src/lib/commerce/demo/guard.server.ts` | **PASS** |
| `APP_ENV` als Pflichtwert dokumentiert | `.env.example` | **PASS** |
| Vollständiges Einrichtungs-Runbook | `docs/production/STAGING_SETUP_RUNBOOK.md` | **PASS** |
| Domain-, URL- und Webhook-Plan je Umgebung | `docs/production/DOMAIN_AND_DNS_RUNBOOK.md` | **PASS** |
| Zweite Instanz erstellt | nicht möglich | **BLOCKED** |
| Migrationen in Staging angewendet | Folge des Blockers | **BLOCKED** |
| Eigene Secrets, Buckets, Keys, Cron in Staging | Folge des Blockers | **BLOCKED** |
| Demo-Datensystem gegen Staging | Folge des Blockers | **BLOCKED** |

## Production-Guard — Negativtests

Geprüfte Operationen: `demo_seed`, `qa_fixtures`, `fixture_reset`, `qa_harness`,
`test_payment_provider`, `test_email_provider`, `test_carrier`, `synthetic_orders`,
`debug_endpoint`, `test_publishable_key_checkout`.

| Fall | Erwartung | Ergebnis |
| --- | --- | --- |
| `APP_ENV=production` | alle zehn Operationen abgewiesen | **PASS** |
| `APP_ENV` fehlt | alle zehn Operationen abgewiesen (kein stilles Development) | **PASS** |
| `APP_ENV` ungültig (z. B. `prod`, `live`) | harter Fehler | **PASS** |
| `APP_ENV=development` / `staging` | erlaubt | **PASS** |
| Live-Zahlungsanbieter oder Live-API-Key in der Organisation | Seed abgewiesen | **PASS** (bestehender Guard, unverändert) |

## Nächster Schritt

`docs/production/STAGING_SETUP_RUNBOOK.md` Schritt 1 bis 10. Danach sind
`qa/PHASE19-STAGING-E2E-REPORT.md` und `qa/PHASE19-ROLLBACK-REPORT.md` mit echten Läufen zu füllen.
