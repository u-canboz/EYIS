# Demo- und QA-Datensystem (Commerce OS)

## Ziel

Zwei getrennte Datenwelten: eine dauerhafte **Demo-Organisation** ("Commerce OS Demo" / "Demo Store") für Präsentation und manuelle Prüfung, und automatisch erzeugbare, vollständig entfernbare **QA-Fixtures** für technische Tests. Alle Daten synthetisch, Seeds idempotent, Production hart gesperrt.

## Architektur

Neues Modul `src/lib/commerce/demo/`:

```text
demo.types.ts        client-sicher: SEED_VERSION, Szenario-Namen, Status-Typen
guard.server.ts      Production Guard (Mehrfachsignale, harter Abbruch + Audit)
seed.server.ts       seedDemoEnvironment / resetDemoEnvironment /
                     verifyDemoEnvironment / seedDemoScenario
fixtures.server.ts   createQaFixture / destroyQaFixture / resetQaFixture / listQaFixtures
builders/*.server.ts Daten-Builder je Commerce-Modul (katalog, pricing, inventory,
                     kunden, orders, shipping, dokumente, retouren, kommunikation,
                     automation, monitoring)
demo.functions.ts    dünne createServerFn-Wrapper (requireSupabaseAuth + Permission)
```

- Engine läuft serverseitig mit Admin-Client, in **Batches mit Fortschrittsprotokoll** (jeder Batch ein eigener Aufruf → timeout-sicher, wiederaufnehmbar).
- Aufruf über Backoffice-UI **und** über QA-Skript (`qa/demo.ts`), gleiche Engine.
- **Domain-Services zuerst:** Orders entstehen über den echten Fluss (Cart → Checkout → Mock-Payment → `order_finalize_from_payment`), Retouren über `ret_*`, Dokumente über `invoice_*`/`credit_note_*`/`delivery_note_*`, Inventory über `inv_*`. Direkte Inserts nur, wo keine Domain-Funktion existiert (z. B. Kategorien, Collections, Kommunikations-Historie, Health-Zustände) — jede Abkürzung wird in `docs/production/DEMO_DATA_SYSTEM.md` dokumentiert.

## Migration (eine)

- `public.demo_environments`: organization_id (unique), seed_version, seeded_at, last_reset_at, status. GRANT SELECT an authenticated, ALL an service_role, RLS: Lesen für Org-Mitglieder.
- `public.qa_fixtures`: id, organization_id, shop_id, scenario, run_ref, status (active/destroyed/failed), manifest (jsonb mit allen erzeugten IDs), destroyed_at, residual_notes. Gleiche Grants/RLS.
- Neue Permissions in `role_permissions`: `demo.read`, `demo.seed`, `demo.reset`, `qa.create`, `qa.destroy`, `qa.run` — Owner/Admin: alle; Developer: qa.* + demo.read; Operations/Read Only: demo.read; übrige: keine.
- Demo-/QA-Erkennung über Tabellen + Slug-Konvention (`commerce-os-demo`, `qa-fixture-*`), keine Schemaänderung an organizations/shops nötig.

## Production Guard

`assertNotProduction()` prüft vor JEDEM Seed/Reset/Destroy:
1. Environment-Flag (`APP_ENV=production` / Lovable-Prod-Host)
2. Live-Payment-Config in der Ziel-Org (`payment_provider_configs.environment='live'` aktiv)
3. Live-API-Key-Präfixe (`store_api_keys` live-Präfix)
4. Org-Slug muss Demo-/QA-Muster tragen

Bei Treffer: harter Abbruch (`DEMO_SEED_FORBIDDEN`), Audit-Eintrag `security.demo_seed_blocked`, keine Datenänderung. Kein UI-Schalter.

## Demo-Datenumfang (SEED_VERSION 1.0.0)

- **Org/Shop/Team:** 1 Org, Hauptshop + Zweitshop, 10 Rollenkonten `*.demo@example.invalid` (Auth-User via Admin API, Passwort dokumentiert im QA-Handbuch).
- **Katalog:** 9 Blueprints (5+ aktiv befüllt), 32 Produkte (Textil/Lebensmittel/Kosmetik/Elektronik/Möbel/Schmuck/Digital/Service), Varianten inkl. Viele-Varianten-Produkt, Entwürfe, Archivierte, lange/kurze Namen, fehlende optionale Angaben, SEO, Steuerklassen, Return Policies.
- **Taxonomie:** 10+ Kategorien mit 3 Ebenen (Bekleidung→Herren→Hoodies), 5 Collections.
- **Medien:** ~10 generierte Produktbilder (imagegen, in `qa/demo-assets/`), Logo, Branding, Variantenbilder, Alt-Texte, 1 absichtlich fehlendes Bild.
- **Pricing/Promotions:** Basis-/Varianten-/Aktionspreise, Staffeln, Kundengruppenpreise, aktive/abgelaufene/zukünftige Angebote, Prozent/Festbetrag/BXGY/Gratisversand, Codes DEMO10/DEMO20/WELCOME-DEMO/FREESHIP-DEMO + ungültiger/abgelaufener Code, nicht kombinierbar.
- **Inventory:** 3 Lagerorte (Hauptlager Berlin, Store Hamburg, Externes Fulfillment), alle Bestandszustände inkl. Backorder/Tracking-aus, Bewegungen aller Arten.
- **Kunden:** 25+ (B2C, B2B, VIP, Gast, gesperrt, Mehrfachadressen, Gruppen, Notizen).
- **Carts/Checkouts:** alle 12 geforderten Zustände.
- **Orders:** 40+ über echten Payment-Fluss (bezahlt, pending, fehlgeschlagen, storniert, teil-/voll erstattet, alle Fulfillment-Stati, Gast/Kunde/B2B, gemischte Steuerklassen, Promotions, Versandkosten).
- **Steuern:** 19 %/7 %/0 % mit Reason Code, Mischkorb, Versandsteuer, B2B.
- **Shipping:** alle Stati inkl. Teilversand, Multi-Package, Test-Trackingnummern DEMO-DHL-*/DEMO-DPD-*.
- **Dokumente:** Rechnungen (Entwurf/ausgestellt), Teil-/Vollgutschrift, Lieferschein, PDFs mit Prüfsummen, Branding, Langtext-Positionen.
- **Retouren:** alle 14 geforderten Zustände.
- **Kommunikation:** alle Template-Arten + Zustände (queued/delivered/failed/hard_bounce/suppressed) über Mock-Provider, kein externer Versand.
- **Automation/Tasks:** aktiv/pausiert/fehlgeschlagen/Retry, Low-Stock-/Versand-/Retouren-Aufgaben, offen/überfällig/erledigt.
- **Monitoring:** absichtliche Demo-Befunde (offene Warnung, failed Job, Dead Letter, Rate-Limit-Spuren) — klar als Demo markiert, keine Produktionsalarme.

## QA-Fixtures

Szenario-Registry mit allen 22 Szenarien (`catalog_full` … `mobile_ui_full`). Jedes Szenario = Builder-Funktion, die nur benötigte Daten erzeugt und `{ fixture_id, organization_id, shop_id, entity_ids, expected_states, cleanup }` zurückgibt. Org-Name `QA Fixture <Datum> <Seq>`, Slug `qa-fixture-<kurzid>`.

`destroyQaFixture`: prüft Fixture-Registry (niemals normale Mandanten), löscht in FK-sicherer Reihenfolge was löschbar ist, respektiert immutable Journals (audit_log, inventory_movements, payment_events, tax_snapshots, Snapshots) — verbleibende Journal-Zeilen werden in `residual_notes` dokumentiert, Fixture → `destroyed`.

## UI

- **Demo-Banner** ("DEMO-UMGEBUNG — Alle Daten sind synthetisch…") dauerhaft in Backoffice, Kundenportal und Reference Storefront, wenn aktive Org in `demo_environments` (Flag über `getWorkspace`).
- **`/app/system/demo-data`**: Demo-Status, Seed-Version, Datenmengen je Gruppe, fehlende Gruppen, Seed/Reset mit Bestätigungsdialog, QA-Fixtures erzeugen/anzeigen/entfernen. Berechtigungsprüfung, Audit, Production Guard serverseitig.

## Audit/Events

`demo.seeded`, `demo.reset`, `qa.fixture.created`, `qa.fixture.destroyed`, `qa.fixture.failed` — ein Batch-Event pro Lauf, keine Event-Flut pro Datensatz.

## Verifikation (`qa/phase15-demo.ts` + Playwright)

1. Seed ausführen → alle Mindestmengen belegt (30+ Produkte, 25+ Kunden, 40+ Orders, …)
2. **Idempotenz:** zweiter Lauf → 0 Dubletten (Zählung vorher/nachher)
3. `verifyDemoEnvironment` → vollständig
4. Reset → Ausgangszustand wiederhergestellt
5. Production Guard: simuliertes Live-Signal → harter Abbruch, keine Änderung, Audit vorhanden
6. Fixture create/destroy für Stichproben-Szenarien (u. a. `catalog_full`, `payment_success`, `cross_tenant`), Residuen dokumentiert
7. Cross-Tenant: QA-Org sieht keine Demo-Daten und umgekehrt; Rollen: read_only ohne Seed-Recht bekommt 403
8. UI-Matrix mit vollen Daten: 375/390/430/768/1024/1440 px auf Kernoberflächen (Produkte, Bestellungen, Kunden, Lager, System)
9. Regression: alle bisherigen Suiten (A3 32, A4 52, A5 15, Jobs 21, Phase 12 52, E2E 46+35, Unit 72) + Build + Typecheck

## Deliverables

- Migration + `src/lib/commerce/demo/*` + `/app/system/demo-data` + Banner
- `docs/production/DEMO_DATA_SYSTEM.md` (inkl. dokumentierter Tabellenabkürzungen, Zugangsdaten-Hinweis, Reset-Strategie)
- `qa/phase15-demo.ts`, `qa/results-phase15-demo.json`, `qa/PHASE15-DEMO-REPORT.md`

## Umsetzungsreihenfolge

1. Migration (Tabellen, Permissions)
2. Guard + Engine-Skelett + Functions + UI-Grundgerüst
3. Seed-Builder Basis (Org/Team/Katalog/Medien/Pricing/Inventory/Kunden)
4. Seed-Builder transaktional (Orders/Dokumente/Retouren/Kommunikation/Automation/Monitoring)
5. Fixture-System + Szenarien
6. QA-Harness, UI-Matrix, Regression, Abschlussbericht

Keine neuen Commerce-Features; ausschließlich Datensystem. Gate B/C bleiben unangetastet.
