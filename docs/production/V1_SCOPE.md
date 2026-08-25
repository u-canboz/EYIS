# Commerce OS — V1 Scope (eingefroren)

Stand: 2026-08-25 · Version `1.0.0-rc.1` · Feature Freeze aktiv

Grundregel: Jede Zeile mit Status `PASS` ist durch eine Codestelle, einen Testlauf oder eine SQL-Abfrage belegt. Nicht Geprüftes steht auf `OFFEN`, extern Blockiertes auf `BLOCKED`.

## Nachweisbasis dieses Dokuments

| Nachweis | Ergebnis | Quelle |
| --- | --- | --- |
| Typecheck | grün, keine Fehler | `tsgo --noEmit -p tsconfig.json`, 2026-08-25 |
| Unit-/Boundary-Tests | 4 Dateien, 72 Tests, alle grün | `bunx vitest run`, 2026-08-25 |
| Migrationen | 31 Dateien im Repo, 31 in der Datenbank angewandt, letzte `20260825221017` | `supabase_migrations.schema_migrations` |
| Datenbankumfang | 112 Tabellen, davon 112 mit aktivem RLS, 185 Policies, 99 Funktionen, 91 Trigger, 69 Enums | `information_schema` / `pg_catalog` |
| Storage | 3 Buckets: `media`, `shipping-labels`, `documents` — alle privat | `storage.buckets` |
| Backoffice-Routen | 52 Dateien unter `src/routes/_authenticated/app/` | Dateisystem |
| Public Store API | 35 Endpunkte unter `/api/public/store/v1` | `src/lib/commerce/store/routes.server.ts` |
| Server Functions | 27 `*.functions.ts`-Module mit 262 `createServerFn`-Deklarationen | `rg -c createServerFn` |
| SDK-Version | `STORE_SDK_VERSION = "1.0.0"` | `src/lib/store-sdk/config.ts` |

## Funktionsumfang Phase 0–12

### Phase 0 — Fundament
Organisationen, Shops, Memberships, Rollen (`app_role`, 10 Stufen), Rollen-Rechte-Matrix (`role_permissions`, `has_permission`), Einladungen per Token mit Ablauf und Status, unveränderliches `audit_log`, `outbox_events`, `idempotency_keys`, Owner-Schutz (`protect_last_owner`).
Status: PASS (Tabellen und Funktionen in der Datenbank vorhanden).

### Phase 1 — Katalog & Product Blueprints
Produkte, Varianten, Optionen, Blueprints (JSONB-Schema), Kategorien, Collections, Medien (`media_assets`, privater Bucket).
Status: PASS.

### Phase 2 — Pricing & Promotions
`price_sets`, `prices` (Integer-Minor-Beträge), Kundengruppenpreise, Staffelpreise, Promotions (5 Typen), deterministische Engine `pricing-engine.ts`.
Status: PASS — 18 Unit-Tests grün.

### Phase 3 — Inventory
Lagerorte, `inventory_levels`, unveränderliche `inventory_movements`, Reservierungen mit Ablauf, Transfers, Wareneingang, transaktionssichere RPCs (`inv_*`).
Status: PASS.

### Phase 4 — Cart & Checkout
Warenkörbe mit gehashten Gast-Tokens, Preis-Snapshots (`cart_price_snapshots`, `cart_item_price_snapshots`), Checkout-Sessions, Reservierungen beim Checkout-Start, `cart-engine.ts`.
Status: PASS — 20 Unit-Tests grün.

### Phase 5 — Payments & Orders
Payment-Sessions, -Attempts, -Transactions, -Events (append-only), Orders mit Nummernkreis, `order_finalize_from_payment`, Refunds, Stripe- und Mock-Adapter, Stripe-Webhook-Route.
Status: PASS für Logik und Mock-Provider. Stripe live: BLOCKED (kein `STRIPE_SECRET_KEY` hinterlegt, siehe Secret-Inventur in A2).

### Phase 6 — Tax Engine DE/EU
`tax.engine.ts` mit OSS, Reverse Charge, § 19 UStG, Steuerklassen, Steuersätze, USt-IdNr.-Prüfung, unveränderliche `tax_snapshots`.
Status: PASS — 17 Unit-Tests grün.

### Phase 7 — Shipping, Fulfillment, Tracking
Versandarten, Fulfillments mit Zustandsautomat, Packstücke, Sendungen, Labels im privaten Bucket, Tracking-Events (append-only), Carrier-Adapter DHL/DPD/GLS/UPS/Sendcloud/Mock.
Status: PASS für Zustandsautomat und Mock-Carrier. Echte Carrier: BLOCKED (keine Provider-Zugangsdaten hinterlegt).

### Phase 8 — Invoicing & Documents
Rechnungen, Gutschriften, Lieferscheine, Nummernkreise mit Reset-Politik, Dokument-Branding, serverseitiger PDF-Renderer (`pdf-lib`), privater `documents`-Bucket, E-Invoicing-Vorbereitung (`document_format`).
Status: PASS für PDF. ZUGFeRD/XRechnung/UBL: OFFEN (Formate im Enum vorbereitet, Erzeugung nicht implementiert).

### Phase 9 — Kundenportal & Retouren
Kundenkonten, Gastzugang über gehashte Access-Tokens, Retouren-Zustandsautomat (`ret_*`), Rückerstattungsanbindung, Retouren-Einstellungen und -Nummernkreise, mobiles Portal.
Status: PASS.

### Phase 10 — Communication Studio
Vorlagen mit Versionen, Regeln, Branding, Absenderidentitäten, Zustellstatus, Unterdrückungsliste, Provider-Events, Warteschlange über `/api/public/jobs/communications`.
Status: PASS für Test-Provider. Echter E-Mail-Versand: BLOCKED (kein Versand-Provider konfiguriert, `COMMUNICATION_WEBHOOK_SECRET` nicht gesetzt). Job-Auslösung seit A2 über `LOVABLE_CRON_SECRET`.

### Phase 11 — Automation Engine
Regeln mit Versionen, Bedingungen, Aktionen, Ausführungen, Job-Queue mit `SKIP LOCKED` (`automation_claim_jobs`), ausgehende Webhooks mit SSRF-Schutz, Aufgaben-Inbox.
Status: PASS.

### Phase 12 — Storefront SDK & Public Store API
35 Endpunkte unter `/api/public/store/v1`, Gateway mit Publishable Keys, Origin-Allowlist, Rate-Limits, Zod-Validierung, DTO-Allowlist, privacy-sichere Request-Logs, SDK `1.0.0`, Referenz-Storefront, Entwickler-Dashboard.
Status: PASS — QA-Bericht `qa/PHASE12-QA-REPORT.md` mit 52/52, Boundary-Tests (17) grün.

## Eingefrorene Verträge

- Public Store API bleibt `/api/public/store/v1`. Änderungen an Pfaden, DTO-Feldern oder Fehlercodes nur über eine neue Version.
- Fehlercodes und Antworthülle (`{ data, requestId }` bzw. `{ error: { code, message, fieldErrors? }, requestId }`) sind Bestandteil des Vertrags — Quelle: `src/lib/commerce/store/gateway.server.ts`.
- Header-Vertrag: `x-commerce-key`, `x-cart-token`, `x-guest-token`, `authorization`, `idempotency-key`, Antwort `X-Request-ID`.
- SDK `src/lib/store-sdk` ist die einzige zulässige Storefront-Schnittstelle; die Importgrenzen sind per ESLint und `src/lib/store-sdk/__tests__/boundaries.test.ts` abgesichert.
- Datenbankstand `20260825221017` ist der Referenzstand für RC1.

## Nicht Bestandteil von V1

Phase-13-Funktionen, ZUGFeRD/XRechnung-Erzeugung, Live-Zahlungen, echter E-Mail-Versand, echte Carrier-Labels, mehrsprachige Storefront, Marktplatz-/Multi-Currency-Erweiterungen.
