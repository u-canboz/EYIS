# Modulregister

Maschinenlesbar und verbindlich: [modules.json](modules.json) (aus `scripts/manifest/modules.def.ts`
erzeugt, alle Pfade werden beim Generieren gegen das Dateisystem geprüft). Diese Seite ist die
lesbare Übersicht.

| ID | Modul | Zweck | Kernpfad |
| --- | --- | --- | --- |
| `organizations-shops` | Organizations & Shops | Mandantenwurzel: Organisation, Shops, Domains, Nummernkreise | `src/lib/commerce/workspace.functions.ts` |
| `auth-memberships` | Auth, Rollen & Memberships | Anmeldung, Einladungen, Rollen, Berechtigungen | `src/lib/commerce/team.functions.ts` |
| `catalog` | Catalog & Blueprints | Produkte, Varianten, Optionen, Kategorien, Kollektionen, Medien | `src/lib/commerce/catalog.server.ts` |
| `pricing` | Pricing & Promotions | Preislisten, Gruppenpreise, Staffeln, Rabatte | `src/lib/commerce/pricing-engine.ts` |
| `inventory` | Inventory | Bestände, Lagerorte, Reservierungen, Bewegungen, Umlagerungen | `src/lib/commerce/inventory.server.ts` |
| `cart-checkout` | Cart & Checkout | Warenkorb, Snapshots, Adressen, Versandwahl, Sessions | `src/lib/commerce/cart-engine.ts` |
| `payments-orders` | Payments & Orders | Zahlungssessions, Provider-Events, Bestellungen, Refunds | `src/lib/commerce/orders` |
| `tax` | Tax Engine | Steuersätze, Netto/Brutto, unveränderliche Steuer-Snapshots | `src/lib/commerce/tax` |
| `shipping-fulfillment` | Shipping, Fulfillment & Tracking | Versandarten, Pakete, Labels, Sendungen, Tracking | `src/lib/commerce/fulfillment` |
| `documents` | Document Engine | Rechnungen, Gutschriften, Lieferscheine, Nummernkreise, PDF | `src/lib/commerce/documents` |
| `customers-returns` | Customers, Portal & Returns | Kunden, Gruppen, Kundenportal, Gastzugang, Retouren | `src/lib/commerce/customers` |
| `communications` | Communications | Vorlagen, Warteschlange, Provider-Events, Suppressions | `src/lib/commerce/communications` |
| `automation` | Automations, Tasks & Outbox | Regeln, Aufgaben, ausgehende Webhooks, Ereignisquelle | `src/lib/commerce/automation` |
| `store-api` | Public Store API v1 | Öffentliche Schnittstelle: Keys, Rate-Limits, DTO-Allowlist, Logs | `src/lib/commerce/store` |
| `store-sdk` | Store SDK | Client für die Store API (Core + React) | `src/lib/store-sdk` |
| `storefront-reference` | Reference Storefront | Beispiel-Storefront ausschließlich über das SDK | `src/routes/store` |
| `demo-qa` | Demo & QA Data | Demo-Organisation, QA-Fixtures, Purge, Production Guard | `src/lib/commerce/demo` |
| `health-jobs` | Health, Jobs & Monitoring | Integritätsprüfungen, Job-Queue, Cron-Auth, Audit | `src/lib/commerce/health` |
| `security` | Security & Headers | Security-Header, CSP, zentrale Sicherheitshelfer | `src/lib/security/headers.ts` |

## Abhängigkeitsrichtung

```text
organizations-shops ─ auth-memberships
        │
        ├─ catalog ─ pricing ─┐
        ├─ inventory ─────────┼─ cart-checkout ─ payments-orders ─┬─ documents
        ├─ tax ───────────────┘                                   ├─ shipping-fulfillment
        └─ customers-returns ─────────────────────────────────────┴─ communications ─ automation

store-api → nutzt catalog, cart-checkout, payments-orders, customers-returns
store-sdk → nutzt ausschließlich store-api
storefront-reference → nutzt ausschließlich store-sdk
```

Rückwärtsgerichtete Importe sind verboten: Der Commerce-Kern importiert nie aus dem SDK, aus
Routen oder aus UI-Komponenten.

## Je Modul dokumentiert `modules.json`

`id`, `name`, `purpose`, `paths`, `tables`, `rpcs`, `events`, `permissions`, `public_interfaces`,
`tests`, `depends_on`, `limitations`.

## Wenn ein Modul geändert wird

1. Betroffene Tabellen und Ereignisse in `modules.json` nachziehen (über `modules.def.ts`).
2. `bun run generate:manifests`
3. `bun run verify`
4. Passenden QA-Harness laufen lassen (siehe [TESTING_AND_QA.md](TESTING_AND_QA.md)).
