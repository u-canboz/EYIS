# Runbook — getrennte Staging-Umgebung einrichten

Status: **BLOCKED** — die Anlage eines zweiten Projekts ist eine manuelle Entscheidung des
Betreibers und kann vom Agenten nicht ausgeführt werden. Dieses Runbook beschreibt den
vollständigen Ablauf, damit die Einrichtung ohne weitere Rückfragen erfolgen kann.

Ausgangslage: `docs/production/ENVIRONMENT_MATRIX.md` — heute teilen Development und eine
künftige Production denselben Datenbestand. Das ist ein Go-live-Blocker.

## Schritte

1. **Projekte anlegen.** Zwei zusätzliche Cloud-Projekte: `commerce-os-stg`,
   `commerce-os-prd`. Production bleibt zunächst unveröffentlicht und leer.
2. **Schema übertragen.** Alle Migrationen aus `supabase/migrations/` in exakt derselben
   Reihenfolge und byte-identisch anwenden. Danach `bun run qa:migrations` gegen Staging —
   erwartet 10/10 PASS ohne Drift.
3. **Secrets je Umgebung setzen.** Kein Secret wird geteilt, auch nicht
   `LOVABLE_CRON_SECRET`. Register: `docs/production/SECRET_REGISTER_TEMPLATE.md`.
4. **`APP_ENV` setzen** — `staging` bzw. `production`. Der Demo-Guard
   (`src/lib/commerce/demo/guard.server.ts`) bricht bei `production` hart ab.
5. **`APP_BASE_URL`** je Umgebung auf die eigene öffentliche URL setzen.
6. **Buckets anlegen:** `media` (25 MB, Bild-/PDF-Allowlist), `documents` (20 MB, PDF/XML),
   `shipping-labels` (20 MB, PDF/PNG/JPEG) — alle privat. Prüfung: `bun run qa:storage`.
7. **Synthetische Staging-Daten** ausschließlich über `bun run qa:demo`. Niemals eine Kopie
   von Produktionsdaten.
8. **Store-API-Keys neu erzeugen**, Origin-Restriction auf die Domain der jeweiligen
   Umgebung. Keys werden nicht zwischen Umgebungen übernommen.
9. **Cron-Zeitpläne** je Umgebung getrennt einrichten (`docs/production/JOB_RUNBOOK.md`),
   Authentifizierung über `authenticateCronRequest`.
10. **Provider** in Staging auf Sandbox/Testmodus: Stripe Testmodus, E-Mail-Sandbox-Domain,
    Carrier-Sandbox. Prüfung: `bun run qa:providers`.

## Abnahme der Staging-Umgebung (Gate B7)

Erst nach Schritt 10 ausführbar, jeweils mit `QA_APP_BASE` auf die Staging-URL:

```bash
bun run qa:demo && bun run qa:e2e && bun run qa:store-api \
  && bun run qa:security && bun run qa:rls && bun run qa:health \
  && bun run qa:jobs && bun run qa:migrations
```

Zusätzlich manuell zu belegen:

- Ein Backoffice-Konto aus Staging kann sich nicht in Production anmelden.
- Ein Staging-Store-API-Key wird in Production mit 401 abgewiesen.
- Der Ablaufjob in Staging berührt keine Production-Datensätze.
- Ein Restore-Drill gegen Staging nach `docs/production/DISASTER_RECOVERY_RUNBOOK.md`.

Ergebnis wird in `qa/PHASE14-STAGING-E2E-REPORT.md` eingetragen.

## Trennungsregeln (dauerhaft)

1. Schema-Änderungen laufen immer DEV → STG → PRD über dieselbe Migrationsdatei.
2. Keine Produktionsdaten in Staging oder Development, auch nicht anonymisiert ohne Freigabe.
3. Kein Secret, kein API-Key und kein Cron-Secret wird zwischen Umgebungen geteilt.
4. Bei unbekannter Umgebung: keine schreibende Aktion.

## Ergänzung Gate C (2026-08-27)

11. **`APP_ENV` in jeder Umgebung setzen.** Fehlender oder ungültiger Wert führt jetzt zum
    sicheren Abbruch aller geschützten Operationen (`src/lib/commerce/environment.ts`).
    Geschützt sind: Demo-Seed, QA-Fixtures, Fixture-Reset, QA-Harnesses, Test-Payment-Provider,
    Test-E-Mail-Provider, Test-Carrier, synthetische Testbestellungen, Debug-Endpunkte und
    Test-Publishable-Keys im Live-Checkout.
12. **URLs, Origins und Webhooks** je Umgebung nach `docs/production/DOMAIN_AND_DNS_RUNBOOK.md`.
13. Abnahmebericht: `qa/PHASE19-STAGING-SETUP-REPORT.md`.
