# Phase 17 — Agent-Ready Repository & Handoff-System

Ziel: Das Repository erklärt sich selbst. Ein neuer Agent oder Entwickler versteht nach dem Klonen Architektur, Grenzen, Befehle, Module, Onboarding neuer Kunden und Anbindung neuer Storefronts — ohne Chat-Kontext.

Strikte Abgrenzung: Nur Dokumentation, Manifeste, Validierung, GitHub-Vorlagen und ein Onboarding-Report. Keine Änderung an Commerce-Fachlogik, Engines, Store API, RLS oder Datenmodell. Das laufende UX/UI-Redesign (Phase 16) bleibt unberührt.

## Ausgangslage (geprüft)

- `AGENTS.md` existiert, enthält aber ausschließlich den Lovable-Hinweisblock — keine Agentenregeln.
- `README.md` ist das generische Lovable-Template und beschreibt Commerce OS nicht.
- `docs/production/` enthält 13 belastbare Hardening-Dokumente (V1_SCOPE, ARCHITECTURE_CURRENT, ENVIRONMENT_MATRIX, DATABASE_SECURITY_MATRIX, Runbooks, KNOWN_LIMITATIONS). Diese werden referenziert, nicht dupliziert.
- `package.json` hat nur `dev`, `build`, `build:dev`, `preview`, `lint`, `format`. Es gibt **keine** `test`- oder `typecheck`-Skripte, obwohl vitest installiert ist und `qa/*.ts` Harnesses existieren. Befehle in der Dokumentation dürfen nicht erfunden werden.
- Module liegen unter `src/lib/commerce/*` (pricing, inventory, cart, checkout, payments, orders, tax, shipping, fulfillment, documents, returns, communications, automation, store, demo, health, system) sowie `src/lib/store-sdk/*`.

## Arbeitsschritte

### 17.1 Befehlsbasis (minimal, nicht erfunden)
`package.json` um reine Tooling-Skripte ergänzen, damit Dokumentation echte Befehle nennen kann:
`typecheck` (tsgo/tsc --noEmit), `test` (vitest run), `qa:*` Wrapper für die vorhandenen `qa/*.ts`-Harnesses, `docs:validate`.
Keine Änderung an Build- oder App-Konfiguration.

### 17.2 AGENTS.md (Root, verbindlicher Einstieg)
Lovable-Block bleibt erhalten, darunter: Projekt in einem Satz, Pflicht-Lesereihenfolge, Pflichtbefehle (nur real existierende), harte Architekturregeln (SDK-only Storefronts, serverseitige Berechnung, Inventory nur über Engine, Tenant-Isolation, Secret-Grenzen, Immutability, API-v1-Stabilität, Migrationen, kein Seed in Production), verbotene Abkürzungen, 8-Schritte-Arbeitsablauf.

### 17.3 README.md neu
Was Commerce OS ist, Zielgruppe, Kernmodule, Architekturüberblick, Public Store API, Storefront SDK, lokaler Start, Umgebungsvariablen (nur Namen), Tests, Agent-Einstieg, Providerstatus (produktiv/Test/BLOCKED), bekannte Einschränkungen. Quelle: Code und die aktuellsten QA-Berichte, keine alten Pläne.

### 17.4 docs/agent/ — Handbuch
Neue Dateien:
- `START_HERE.md` — Reifegrad, Ordner, Befehle, Versionen, Providerstatus, Einstieg je Aufgabentyp
- `ARCHITECTURE_MAP.md` — tatsächliche Schichten, Vertrauensgrenzen, Datenflüsse, Jobs, Outbox, Demo/QA
- `MODULE_REGISTRY.md` — alle geforderten Module mit Pfaden, Tabellen, RPCs, Events, Permissions, Tests, Limits
- `SECURITY_BOUNDARIES.md` — Tenant-Modell, RLS, Auth-Arten, Token-Typen, Service Role, Cron-Auth, Webhooks, Storage, Immutability, ERLAUBT/VERBOTEN-Beispiele
- `CHANGE_PLAYBOOK.md` — sichere Abläufe für Storefront-Feature, Backoffice-Ansicht, Schemaänderung, neuer Provider, neue Automation Action
- `NEW_CUSTOMER_ONBOARDING.md` — mandantenfähiges Standardmodell (neue Organisation + Shop, keine neue Datenbank), 13-Schritte-Ablauf, Dedicated Deployment nur als begründete Ausnahme
- `NEW_STOREFRONT_RUNBOOK.md` — 10 Schritte, benötigte Env-Variablen, Anti-Patterns
- `DEPLOYMENT_AND_ENVIRONMENTS.md` — Dev/Demo/QA/Staging/Production, Trennung, Verweise auf Production-Docs, offene Blocker benannt
- `TESTING_AND_QA.md` — welche Tests je Änderungsart Pflicht sind
- `DEBUGGING_RUNBOOK.md` — Diagnosewege plus konkrete Fehlerbilder (Zahlung ohne Order, Bestandsabweichung, fehlende Rechnung, Mail, Tracking, 401/403)
- `AGENT_HANDOFF_CHECKLIST.md` — Abschlusscheckliste
- `NEW_PROJECT_AGENT_PROMPT.md` und `CORE_CHANGE_AGENT_PROMPT.md` — kopierbare Prompts mit Platzhaltern

### 17.5 Maschinenlesbare Manifeste
Aus dem tatsächlichen Code erzeugt, ohne Secrets und ohne erfundene URLs:
- `commerce-os.manifest.json` (Root)
- `docs/agent/modules.json` (deckungsgleich mit MODULE_REGISTRY.md)
- `docs/agent/routes.json` — App-, Portal-, Store- und API-Routen mit Auth-Stufe und Modul
- `docs/agent/store-api-v1.json` und `docs/store-api/openapi-v1.json` — abgeglichen mit dem realen Router unter `src/routes/api/public/store/v1/`; die dokumentierte Endpunktzahl wird gegen den Code geprüft, nicht angenommen

### 17.6 GitHub-Vorlagen
`.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/change_request.md` mit Scope, Modulen, DB/RLS, API-Kompatibilität, Tests, Mobile, Security, Rollback.

### 17.7 Dokumentationsvalidierung
`scripts/docs-validate.ts`, ausführbar über `bun run docs:validate`. Prüft: referenzierte Dateien existieren, Manifest-Pfade existieren, JSON valide, Modul-IDs eindeutig, keine Secret-Muster in Dokumentation, keine toten internen Links, Routeninventur gegen die Dateien unter `src/routes/`. Read-only, verändert keinen Anwendungscode.

### 17.8 Agent-Onboarding-Test
Simulation eines Agenten ohne Kontext: die sieben Pflichtfragen (Start, Inventory Engine, neue Storefront, Supabase-Direktzugriff, neuer Kunde, blockierende Provider, Tests vor Merge) werden ausschließlich aus dem Repository beantwortet. Ergebnis in `qa/AGENT_READINESS_REPORT.md` mit Status je Frage: PASS, FAIL, OFFEN, BLOCKED.

### 17.9 Abschluss
`docs:validate`, Typecheck, Build und die bestehenden Vitest-Suiten laufen. Abschlussbericht mit erstellten und geänderten Dateien, validierten Befehlen, Onboarding-Ergebnis, Dokumentationslücken, offenen Blockern und dem Ein-Satz-Prompt für zukünftige Agenten.

## Technische Hinweise

- Fakten werden vor dem Schreiben aus Code und Datenbank erhoben (Routen-Scan, Tabellen-/RPC-Liste, Migrationsstand, Providerstatus aus den Phase-14/15-Berichten). Nichts wird geschätzt.
- Alle Env-Variablen nur als Namen, nie als Werte; `.env.example` bleibt maßgeblich.
- Keine Datei unter `src/lib/commerce/**`, `src/routes/api/**`, `supabase/migrations/**` wird inhaltlich verändert.
- Einzige Ausnahme außerhalb der Dokumentation: neue Skript-Einträge in `package.json` und die neue Datei `scripts/docs-validate.ts`.
