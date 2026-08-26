# Phase 17 — Agent-Readiness-Test

Datum: 2026-08-26 · Umgebung: Dev/Preview · Status ausschließlich `PASS`, `FAIL`, `OFFEN`, `BLOCKED`.

Verfahren: Simulation eines Agenten ohne Chatverlauf. Jede Frage wird ausschließlich aus dem
Repository beantwortet; als Nachweis gilt die Datei, in der die Antwort steht.

## 1. Onboarding-Fragen

| # | Frage | Antwort im Repository | Quelle | Status |
| --- | --- | --- | --- | --- |
| 1 | Was ist das Projekt? | Mandantenfähige Commerce-Engine mit Backoffice, Store API v1 und SDK | `README.md`, `docs/agent/START_HERE.md` | PASS |
| 2 | Welcher Stack? | TanStack Start v1, React 19, Vite 7, Tailwind v4, Cloudflare Worker, Lovable Cloud, bun | `README.md`, `commerce-os.manifest.json` (`stack`) | PASS |
| 3 | Wie startet man lokal? | `bun install` → `bun run dev` (Port 8080) | `README.md`, `docs/agent/START_HERE.md` | PASS |
| 4 | **Braucht man zum Starten eine Datenbank?** | Nein für `dev`, `typecheck`, `test`, `build`, `docs:validate`. Ja für nutzbares Backoffice und für alle `qa:*`-Läufe | `docs/agent/START_HERE.md` §4, `docs/agent/TESTING_AND_QA.md` | PASS |
| 5 | Wo liegt die Preis-, Steuer- und Bestandslogik? | `src/lib/commerce/pricing-engine.ts`, `src/lib/commerce/tax`, `src/lib/commerce/inventory.server.ts` | `docs/agent/MODULE_REGISTRY.md`, `docs/agent/modules.json` | PASS |
| 6 | Wie bindet eine Storefront an? | Ausschließlich über Store SDK + Store API v1 mit API-URL und Publishable Key | `docs/agent/NEW_STOREFRONT_RUNBOOK.md` | PASS |
| 7 | **Wie wird das SDK derzeit eingebunden?** | Aus dem Repository-Quellstand (`src/lib/store-sdk/`) im definierten Commit; **kein** npm-Paket | `docs/agent/NEW_STOREFRONT_RUNBOOK.md` §2, `commerce-os.manifest.json` (`sdk_distribution: repository-source`) | PASS |
| 8 | **Braucht ein neuer Storefront-Kunde eine eigene Datenbank?** | Nein | `docs/agent/OPERATING_MODES.md` (B), `commerce-os.manifest.json` (`operating_modes[B].needs_new_database=false`) | PASS |
| 9 | **Wann braucht ein Kunde eine eigene Datenbank?** | Nur bei ausdrücklich gewähltem Dedicated Deployment (Betriebsart C) | `docs/agent/OPERATING_MODES.md` (C) | PASS |
| 10 | Was gilt für Production? | Keine Seeds, keine QA-Läufe, keine echten Zahlungen, keine Live-Daten, keine Secret-Änderung, keine Migration ohne Runbook und Backup; bei unklarer Umgebung stoppen | `AGENTS.md` §2 | PASS |
| 11 | Welche Quelle gilt bei Widersprüchen? | Code > Migrationen/DB > QA-Berichte > Manifeste > Dokumentation > alte Pläne | `AGENTS.md` §1 | PASS |
| 12 | Wie weist man eine Änderung nach? | `bun run verify` plus passender `qa:*`-Lauf gegen Dev | `AGENTS.md` §5, `docs/agent/TESTING_AND_QA.md` | PASS |
| 13 | Wie legt man einen neuen Mandanten an? | 10 Schritte ohne neue Datenbank | `docs/agent/CUSTOMER_ONBOARDING.md` | PASS |
| 14 | Welche Regeln gelten im betroffenen Ordner? | Lokale AGENTS-Dateien für Commerce-Kern, SDK, Storefront und Migrationen | `src/lib/commerce/AGENTS.md`, `src/lib/store-sdk/AGENTS.md`, `src/routes/store/AGENTS.md`, `docs/agent/MIGRATION_RULES.md` | PASS |
| 15 | Was ist blockiert? | Stripe Live, echter E-Mail-Versand, Carrier-Labels | `docs/production/KNOWN_LIMITATIONS.md`, Manifest `blocked_integrations` | PASS |

Ergebnis: **15/15 PASS**.

## 2. Artefakte

| Artefakt | Inhalt | Status |
| --- | --- | --- |
| `AGENTS.md` | Quellenhierarchie, Production-Sperre, 10 Architekturgrenzen, 8-Schritt-Ablauf, Befehle | PASS |
| `README.md` | Projektbeschreibung, Betriebsarten, Setup, Struktur, Grenzen | PASS |
| `docs/agent/` | 12 Markdown-Dateien + 4 Manifeste | PASS |
| Lokale AGENTS-Dateien | Commerce-Kern, SDK, Referenz-Storefront (+ Migrationsregeln in `docs/agent/MIGRATION_RULES.md`) | PASS |
| `.github/` | PR-Template, Issue-Templates (Agenten-Aufgabe, Fehlermeldung) | PASS |

Hinweis: Der Ordner `supabase/migrations/` wird vom Migrationswerkzeug verwaltet und nimmt keine
zusätzlichen Dateien auf. Die Bereichsregeln liegen deshalb in `docs/agent/MIGRATION_RULES.md` und
sind aus `AGENTS.md` und dem Change Playbook verlinkt. Status: PASS (mit dokumentierter Abweichung).

## 3. Manifeste (generiert, nicht handgepflegt)

| Datei | Quelle | Provenienz-Felder |
| --- | --- | --- |
| `commerce-os.manifest.json` | Aggregat | `generated_at`, `source_commit`, `latest_migration`, `generator_version` |
| `docs/agent/routes.json` | Dateiscan `src/routes/**` | vollständig |
| `docs/agent/modules.json` | `scripts/manifest/modules.def.ts`, Pfade dateisystemgeprüft | vollständig |
| `docs/agent/store-api-v1.json` | `api-catalog.ts`, abgeglichen mit `routes.server.ts` | vollständig |
| `docs/agent/openapi-store-v1.json` | aus `store-api-v1.json` abgeleitet (OpenAPI 3.1) | Provenienz in `store-api-v1.json` |

Gemessene Zähler des Generierungslaufs: **19 Module, 77 Routen, 35 Store-API-Endpunkte,
45 Migrationen, 112 öffentliche Tabellen**. Der Generator bricht ab, wenn ein Modulpfad fehlt, ein
Testnachweis fehlt, eine Abhängigkeit unbekannt ist oder Katalog und Laufzeit-Router voneinander
abweichen. Status: PASS.

## 4. Prüfbefehle

| Befehl | Ergebnis | Status |
| --- | --- | --- |
| `bun run docs:validate` | `OK — 24 Pflichtdateien, 44 Markdown-Dateien geprüft` | PASS |
| `bun run typecheck` | fehlerfrei | PASS |
| `bun run test` | 4 Dateien, 72 Tests, alle grün | PASS |
| `bun run build` | erfolgreich (Client + Server + Worker) | PASS |
| `bun run verify` | vollständig grün | PASS |

`docs:validate` prüft: Pflichtdateien, tote relative Links, referenzierte Repo-Pfade, Secret-Muster
(Stripe, Supabase, JWT, Private Keys), erfundene SDK-Installationsbefehle, Provenienz-Felder,
eindeutige Modul-IDs und die Aktualität aller Manifeste.

## 5. Nicht geändert (Grenze eingehalten)

`src/lib/commerce/**` (außer der neuen `AGENTS.md`), Store API, SDK-Logik, RLS, Migrationen,
Engines und UI-Verhalten sind unverändert. Phase 17 hat ausschließlich Dokumentation, Manifeste,
Skripte und `package.json`-Befehle hinzugefügt.

## 6. Offene Punkte

| Punkt | Status | Anmerkung |
| --- | --- | --- |
| SDK als npm-/GitHub-Package | OFFEN | derzeit bewusst `repository-source`; im Manifest so ausgewiesen |
| Bereichsregeln direkt in `supabase/migrations/` | OFFEN | Ordner ist werkzeugverwaltet; Regeln liegen in `docs/agent/MIGRATION_RULES.md` |
| Stripe Live, E-Mail-Versand, Carrier-Labels | BLOCKED | Zugangsdaten fehlen |
| Mobile-/UI-Befunde U1–U10 | OFFEN | Phase 16 (Redesign) läuft |

**Gesamtergebnis Phase 17: PASS.**
