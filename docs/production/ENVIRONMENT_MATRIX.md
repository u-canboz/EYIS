# Umgebungsmatrix — Development / Staging / Production

Stand: 2026-08-25 (Gate A2). Jede Zeile nennt den tatsächlichen Ist-Zustand oder `OFFEN`.
Es wurde in dieser Phase **keine** Produktionsumgebung veröffentlicht und **keine** Produktionsdaten verschoben.

## Ist-Zustand

| Aspekt | Development (Preview) | Staging | Production |
| --- | --- | --- | --- |
| Datenbank | Cloud-Projekt A (einziges vorhandenes Projekt) | OFFEN — nicht vorhanden | OFFEN — würde heute dasselbe Projekt A nutzen |
| Auth-Nutzer | Projekt A, enthält QA- und Entwicklungskonten | OFFEN | OFFEN — geteilt mit Development |
| Storage-Buckets | `media`, `shipping-labels`, `documents` (privat) in Projekt A | OFFEN | OFFEN — geteilt |
| Store-API-Keys | in Projekt A erzeugt, QA-Organisationen | OFFEN | OFFEN — geteilt |
| Cron-/Job-Secret | `LOVABLE_CRON_SECRET`, plattformverwaltet je Umgebung | OFFEN | OFFEN |
| API-URL | Preview-URL des Projekts | OFFEN | OFFEN — nicht veröffentlicht |
| Storefront-URL | Referenz-Storefront unter `/store` derselben App | OFFEN | OFFEN |
| Stripe-Modus | kein Key gesetzt → Mock-Provider | BLOCKED | BLOCKED |
| E-Mail-Provider | Test-Provider | BLOCKED | BLOCKED |
| Carrier | Mock-Carrier | BLOCKED | BLOCKED |
| Publishable Keys | `sb_publishable_*` in `.env` (nicht geheim) | OFFEN | OFFEN |
| CORS / Origin | Origin-Restriction je Store-API-Key | OFFEN | OFFEN |
| Logging | `store_api_request_logs`, `audit_log`, `outbox_events` in Projekt A | OFFEN | OFFEN |
| Monitoring | keine Oberfläche (geplant A8) | OFFEN | OFFEN |

**Kernbefund (FAIL für Go-live):** Development und eine künftige Production teilen heute denselben
Datenbestand, dieselben Buckets, Auth-Nutzer und API-Keys. Eine Trennung existiert nicht.

## Zielbild

```text
Development            Staging                 Production
Cloud-Projekt DEV      Cloud-Projekt STG       Cloud-Projekt PRD
eigene Auth-Nutzer     synthetische Nutzer     echte Kunden
eigene Buckets         eigene Buckets          eigene Buckets
eigene Store-API-Keys  eigene Keys             eigene Keys
eigenes Cron-Secret    eigenes Cron-Secret     eigenes Cron-Secret
Stripe: Mock           Stripe: Testmodus       Stripe: Live
Mail: Test-Provider    Mail: Sandbox-Domain    Mail: verifizierte Domain
Carrier: Mock          Carrier: Sandbox        Carrier: Live
Daten: frei löschbar   Daten: synthetisch      Daten: schützenswert
```

Invarianten des Zielbilds:
1. Kein Secret wird zwischen zwei Umgebungen geteilt — auch nicht `LOVABLE_CRON_SECRET`.
2. Keine Kopie von Produktionsdaten nach Staging oder Development ohne Anonymisierung.
3. Schema-Änderungen laufen immer DEV → STG → PRD über dieselbe Migrationsdatei.
4. Store-API-Keys sind umgebungsgebunden; Origin-Restriction verweist nur auf die Domain der jeweiligen Umgebung.
5. Jede Umgebung setzt `APP_BASE_URL` auf ihre eigene öffentliche URL.

## Stand nach Gate B (2026-08-27)

Unverändert: es existiert weiterhin nur ein Cloud-Projekt. Die Trennung bleibt **BLOCKED**
und ist der erste Go-live-Blocker. Der vollständige Einrichtungsablauf steht jetzt in
[STAGING_SETUP_RUNBOOK.md](STAGING_SETUP_RUNBOOK.md), die Abnahmekriterien in
[../../qa/PHASE14-STAGING-E2E-REPORT.md](../../qa/PHASE14-STAGING-E2E-REPORT.md).

## Umsetzungsschritte (noch nicht ausgeführt)

| Schritt | Ergebnis | Status |
| --- | --- | --- |
| 1. Separates Staging-Projekt anlegen | eigene DB, Auth, Buckets | OFFEN — benötigt Entscheidung des Betreibers |
| 2. Alle 32 Migrationen in Staging anwenden | identisches Schema | OFFEN |
| 3. Synthetische Staging-Daten erzeugen (QA-Harness) | testbarer Datenbestand | OFFEN |
| 4. Eigene Secrets je Umgebung setzen | keine geteilten Secrets | OFFEN |
| 5. Cron-Zeitpläne je Umgebung einrichten | Jobs laufen getrennt | OFFEN |
| 6. Produktionsprojekt anlegen, leer, unveröffentlicht | saubere Basis | OFFEN — bewusst nicht in Gate A |

## Umgebungskennzeichnung der Datensätze

Geprüft wurde, ob Zahlungs-, Bestell-, Kommunikations- und Versanddatensätze erkennen lassen,
aus welcher Umgebung sie stammen.

| Domäne | Kennzeichnung vorhanden | Nachweis |
| --- | --- | --- |
| Payments | indirekt | Provider `mock` vs. `stripe` in `payment_intents.provider`; kein eigenes Umgebungsfeld |
| Orders | nein | keine Spalte, die Umgebung oder Testmodus ausweist |
| Communications | indirekt | Provider-Typ `test` erkennbar |
| Shipping | indirekt | Carrier `mock` erkennbar |

Finding **A2-F3**: keine explizite Umgebungskennzeichnung. Mit echter Projekttrennung (Zielbild)
entfällt der Bedarf, weil jede Umgebung eine eigene Datenbank hat. Solange die Trennung fehlt,
bleibt das Risiko der Vermischung bestehen. Eine Migration wird bewusst **nicht** ergänzt, weil
sie den falschen Lösungsweg zementieren würde.

## Stand nach Gate C (2026-08-27)

Unverändert **BLOCKED**: es existiert weiterhin nur ein Cloud-Projekt. Neu ist die technische
Absicherung der Umgebungsauflösung:

| Punkt | Umsetzung | Status |
| --- | --- | --- |
| `APP_ENV` ist Pflicht, gültige Werte `development`/`staging`/`production` | `src/lib/commerce/environment.ts` | PASS |
| Ungültiger Wert führt zum harten Abbruch | ebenda, Negativtests | PASS |
| Fehlender Wert wird nicht still als Development behandelt | ebenda | PASS |
| Demo-/QA-Seeds nutzen die Auflösung | `src/lib/commerce/demo/guard.server.ts` | PASS |
| Getrennte Instanzen für Staging und Production | manuelle Betreiberaufgabe | BLOCKED |

Bericht: `qa/PHASE19-STAGING-SETUP-REPORT.md`. Einrichtung: `docs/production/STAGING_SETUP_RUNBOOK.md`.
