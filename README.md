# EYIS

Mandantenfähige Commerce-Engine: Backoffice für Händler, vollständige Bestell-, Zahlungs-, Steuer-,
Lager-, Dokumenten- und Retourenlogik sowie eine öffentliche **Store API v1**, über die beliebig
viele externe Storefronts angebunden werden.

Ein Repository, eine Datenbank, viele Organisationen und Shops. Die Trennung läuft über
`organization_id`/`shop_id` plus Row Level Security.

> **Für KI-Agenten:** zuerst [AGENTS.md](AGENTS.md) und [docs/agent/START_HERE.md](docs/agent/START_HERE.md)
> lesen. Vor jeder Arbeit die Betriebsart klären: [docs/agent/OPERATING_MODES.md](docs/agent/OPERATING_MODES.md).

## Aktueller Entwicklungsstand

Update Center mit signierter Release-Prüfung, Kanalwahl, Preflight, nachvollziehbarem Fortschritt
und sicherer Workflow-Korrelation. Kunden-Updates prüfen echte Artefakte vor der Übernahme;
Checkout und explizite Mock-Zahlung sind über Store API und SDK verbunden. Der Entwicklungsstand
ist `0.0.0-dev`, SDK `1.1.0`, API `v1`. Das ist noch kein signierter neuer Stable-Release.

Release-Setup und verbleibende Betreiberaufgaben: [Update Center](docs/production/UPDATE_CENTER.md).

## Betriebsarten in einem Satz

| | Fall | Eigene Datenbank? |
| --- | --- | --- |
| **A** | Neuer Kunde im bestehenden EYIS (Organisation + Shop) | nein |
| **B** | Neue React-/Lovable-Storefront (API-URL + Publishable Key) | nein |
| **C** | Dedicated Deployment (vollständig isolierte Installation) | ja |

## Stack

| | |
| --- | --- |
| Framework | TanStack Start v1, React 19, Vite 8 |
| Laufzeit | Cloudflare Worker (Edge) |
| Styling | Tailwind CSS v4 |
| Backend | Lovable Cloud (Postgres, Auth, Storage) |
| Serverlogik | `createServerFn` und Server-Routen unter `src/routes/api/` |
| Paketmanager | bun |

## Lokal starten

```bash
bun install --frozen-lockfile
bun run dev        # http://localhost:8080
```

`dev`, `typecheck`, `test`, `build` und `docs:validate` laufen ohne Datenbank. Für ein bedienbares
Backoffice und die `qa:*`-Läufe werden Supabase Auth, Postgres und Storage benötigt.
Eine isolierte lokale Installation ist möglich: [Lokale Entwicklung](docs/agent/LOCAL_DEVELOPMENT.md).
Synthetische Käufe über die echte HTTP-API prüft `bun run qa:local` mit lokalen Umgebungsvariablen.

## Befehle

| Befehl | Zweck |
| --- | --- |
| `bun run dev` | Entwicklungsserver |
| `bun run typecheck` | TypeScript ohne Emit |
| `bun run test` | Vitest (Engines, SDK-Grenzen) |
| `bun run lint` | ESLint inkl. Architekturgrenzen |
| `bun run generate:manifests` | Manifeste aus dem Code erzeugen |
| `bun run docs:validate` | Dokumentation und Manifest-Aktualität prüfen |
| `bun run build` | Produktionsbuild |
| **`bun run verify`** | **Dokumentation, Installer, Distribution, Signatur, TypeScript, Tests und Build** |
| `bun run verify:development` | Vollständige Prüfkette in isolierter Kopie mit Testschlüssel, ohne Release-Freigabe |
| `bun run qa:*` | QA-Harnesses gegen Dev (`qa:e2e`, `qa:store-api`, `qa:security`, `qa:rls`, `qa:health`, `qa:jobs`, `qa:migrations`, `qa:demo`) |

## Struktur

```text
src/lib/commerce/        Commerce-Kern (Engines, Server-Funktionen, Domänenmodule)
src/lib/commerce/store/  Store API v1: Router, Gateway, Keys, Rate-Limits, DTO-Allowlist
src/lib/store-sdk/       Store SDK (Core + React)
src/routes/_authenticated/app/   Backoffice
src/routes/api/public/   Store API, Webhooks, Job-Endpunkte
src/routes/store/        Referenz-Storefront (nur über das SDK)
src/routes/portal/       Kundenportal
supabase/migrations/     Schema, RLS, Grants, Funktionen
docs/agent/              Agenten-Dokumentation und Manifeste
docs/production/         Betrieb: Umgebungen, Secrets, Restore, Sicherheit
qa/                      QA-Harnesses und abgenommene Berichte
scripts/                 Manifest-Generator und Doku-Validierung
```

## Storefront anbinden

Eine Storefront spricht ausschließlich über das **Store SDK** und die **Store API v1**. Sie hat
keine eigene Datenbank und keinen Supabase-Zugriff. Das SDK liegt unter `src/lib/store-sdk/` und
wird derzeit als **Repository-Quellstand** übernommen — es gibt noch kein npm-Paket. Ablauf:
[docs/agent/NEW_STOREFRONT_RUNBOOK.md](docs/agent/NEW_STOREFRONT_RUNBOOK.md).

## Dokumentation

- [AGENTS.md](AGENTS.md) — verbindliche Regeln
- [docs/agent/START_HERE.md](docs/agent/START_HERE.md) — Einstieg
- [docs/agent/ARCHITECTURE_MAP.md](docs/agent/ARCHITECTURE_MAP.md) — Vertrauenszonen und Datenflüsse
- [docs/agent/SECURITY_BOUNDARIES.md](docs/agent/SECURITY_BOUNDARIES.md) — Sicherheit
- [docs/agent/MODULE_REGISTRY.md](docs/agent/MODULE_REGISTRY.md) — Module
- [docs/agent/STORE_API_GUIDE.md](docs/agent/STORE_API_GUIDE.md) — öffentliche API
- [docs/agent/CHANGE_PLAYBOOK.md](docs/agent/CHANGE_PLAYBOOK.md) — Änderungsabläufe
- Maschinenlesbar: `commerce-os.manifest.json`, `docs/agent/modules.json`, `docs/agent/routes.json`,
  `docs/agent/store-api-v1.json`, `docs/agent/openapi-store-v1.json`

## Status und Grenzen

V1 ist eingefroren (RC1); es laufen Härtung und Go-live-Vorbereitung. BLOCKED ohne Zugangsdaten:
Stripe Live, echter E-Mail-Versand, Carrier-Labels. Vollständig in
[docs/production/KNOWN_LIMITATIONS.md](docs/production/KNOWN_LIMITATIONS.md).

**Production-Regeln:** keine Demo-Seeds, keine QA-Läufe, keine echten Zahlungen, keine Migration
ohne Runbook und Backup. Bei unklarer Umgebung: stoppen und prüfen.
