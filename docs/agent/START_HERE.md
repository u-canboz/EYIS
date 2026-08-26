# START HERE — Commerce OS in 10 Minuten

Für einen Agenten ohne Vorwissen und ohne Chatverlauf.

## 1. Was ist das?

Commerce OS ist eine **mandantenfähige Commerce-Engine**: Backoffice für Händler, vollständige
Bestell-, Zahlungs-, Steuer-, Lager-, Dokumenten- und Retourenlogik sowie eine öffentliche
**Store API v1**, über die beliebig viele externe Storefronts angebunden werden.

Ein Repository, eine Datenbank, viele Organisationen und Shops. Die Trennung läuft über
`organization_id`/`shop_id` plus Row Level Security.

## 2. Zuerst entscheiden

Lies [OPERATING_MODES.md](OPERATING_MODES.md). Ohne diese Einordnung baust du mit hoher
Wahrscheinlichkeit das Falsche (typisch: eine überflüssige neue Datenbank).

## 3. Stack

| | |
| --- | --- |
| Framework | TanStack Start v1, React 19, Vite 7 |
| Laufzeit | Cloudflare Worker (Edge) — keine Subprozesse, kein `sharp`, kein dauerhaftes Dateisystem |
| Styling | Tailwind CSS v4 (`src/styles.css`, Tokens in oklch) |
| Backend | Lovable Cloud (Postgres, Auth, Storage) |
| Serverlogik | `createServerFn` (`*.functions.ts`) und Server-Routen unter `src/routes/api/` |
| Paketmanager | bun |

## 4. Start

```bash
bun install
bun run dev        # http://localhost:8080
bun run verify     # docs:validate + typecheck + test + build
```

**Braucht man eine Datenbank zum Starten?**
- `bun run dev`, `typecheck`, `test`, `build`, `docs:validate`: **nein**. Die Vitest-Suiten prüfen
  reine Engine-Logik und Importgrenzen und laufen ohne Datenbank.
- Sinnvoll bedienbar wird die App erst mit Lovable Cloud (Auth + Datenbank). Ohne Anmeldung
  erreichst du nur öffentliche Seiten; das Backoffice unter `/app` verlangt eine Session.
- `bun run qa:*` braucht **immer** eine erreichbare Dev-Datenbank mit Demo-Daten
  (`bun run qa:demo` erzeugt sie). Niemals gegen Production.

## 5. Wo liegt was?

```text
src/lib/commerce/        Commerce-Kern: Engines, Server-Funktionen, Domänenmodule
src/lib/commerce/store/  Öffentliche Store API v1: Router, Gateway, Keys, Rate-Limits, DTO-Allowlist
src/lib/store-sdk/       Store SDK (Core + React) — einzige Schnittstelle für Storefronts
src/routes/_authenticated/app/   Backoffice-Oberflächen
src/routes/api/public/   Öffentliche Endpunkte: Store API, Webhooks, Job-Endpunkte
src/routes/store/        Referenz-Storefront (nur über das SDK)
src/routes/portal/       Kundenportal
supabase/migrations/     Schema, RLS, Grants, Funktionen — einzige Quelle für DB-Änderungen
docs/agent/              Diese Agenten-Dokumentation + Manifeste
docs/production/         Betrieb: Umgebungen, Secrets, Restore, Sicherheit
qa/                      QA-Harnesses (.ts) und abgenommene Berichte (.md)
```

## 6. Die fünf wichtigsten Regeln

1. Mandantentrennung immer über `organization_id`/`shop_id` — kein Cross-Tenant-Zugriff.
2. Storefronts nur über SDK und Store API v1 — nie über Supabase.
3. Beträge, Steuern und Bestände rechnet ausschließlich der Server.
4. Rechnungen, Gutschriften und `tax_snapshots` sind unveränderlich.
5. In Production: keine Seeds, keine QA-Läufe, keine echten Zahlungen. Bei unklarer Umgebung stoppen.

Vollständig in [../../AGENTS.md](../../AGENTS.md).

## 7. Nächste Schritte je Aufgabe

| Aufgabe | Weiter mit |
| --- | --- |
| Kunde/Mandant anlegen | [CUSTOMER_ONBOARDING.md](CUSTOMER_ONBOARDING.md) |
| Storefront bauen | [NEW_STOREFRONT_RUNBOOK.md](NEW_STOREFRONT_RUNBOOK.md), [STORE_API_GUIDE.md](STORE_API_GUIDE.md) |
| Feature ändern | [MODULE_REGISTRY.md](MODULE_REGISTRY.md), [CHANGE_PLAYBOOK.md](CHANGE_PLAYBOOK.md) |
| Datenbank ändern | [MIGRATION_RULES.md](MIGRATION_RULES.md) |
| Sicherheit verstehen | [SECURITY_BOUNDARIES.md](SECURITY_BOUNDARIES.md) |
| Datenmodell verstehen | [DATA_MODEL_OVERVIEW.md](DATA_MODEL_OVERVIEW.md) |
| Testen/Nachweisen | [TESTING_AND_QA.md](TESTING_AND_QA.md) |
| Begriffe klären | [GLOSSARY.md](GLOSSARY.md) |
| Fertige Prompts | [PROMPTS.md](PROMPTS.md) |
