# EYIS Dedicated — Installation in diesem Projekt abschließen

## Vorabbestätigung (verbindlich)

1. Dieses Projekt wird als EYIS **Dedicated** betrieben.
2. Es wird **keine externe EYIS-API** benötigt.
3. Es wird **kein vorhandener Publishable Key** benötigt oder abgefragt.
4. Es wird **kein zweites EYIS-Projekt** benötigt.
5. EYIS läuft vollständig auf der **eigenen Infrastruktur dieses Projekts** (eigene Datenbank, Auth, Storage, Secrets, Jobs).
6. Die bestehende Storefront/Website bleibt in Design, Layout und Branding **unverändert**.
7. Das SDK wird **erst nach** Bootstrap → Owner → Organisation → Shop → Key verbunden.

## Befund der Analyse

Dieses Projekt **ist** bereits die EYIS-Codebasis, kein Kundenprojekt mit externem Backend:

- Commerce Core vollständig unter `src/lib/commerce/**` (Katalog, Pricing, Inventory, Cart, Checkout, Orders, Tax, Shipping, Documents, Returns, Communications, Automation, Integrations, System).
- Backoffice unter `/app`, Portal unter `/portal`, Store API unter `/api/public/store/v1` (echter Gateway, keine Mock-API), SDK unter `src/lib/store-sdk/**`.
- Dedicated-Modus existiert bereits: `commerce_installation`, Bootstrap (`/api/public/install/bootstrap`), Claim-Session, Doctor, Setup-Wizard, CLI `commerce:bootstrap` / `commerce:doctor`.
- Eigene Cloud-Infrastruktur ist aktiv. Es wird **nichts importiert, kopiert oder neu aufgebaut**, keine zweite Datenbank, keine Migration erneut ausgeführt, keine Daten gelöscht.

Damit sind die Phasen A–K aus dem Auftrag bereits erfüllt. Offen sind genau die Punkte, die den Kreisschluss „SDK fragt nach Key" verursachen.

## Was tatsächlich gebaut wird

### 1. Dedicated Runtime Config (Same-Origin, ohne manuelle Eingabe)

- Neuer öffentlicher Store-API-Endpunkt `GET /api/public/store/v1/runtime-config` als zusätzliche Route in der bestehenden Route-Registry (additiv, kein Breaking Change an v1).
- Liefert ausschließlich öffentliche Daten: `deploymentMode`, `apiVersion`, `publishableKey` (der Dedicated-Hauptshop-Key), `shopHandle`, `locale`, `currency`.
- Antwort nur im Dedicated-Modus mit geclaimter Installation; sonst `mode: "shared"` ohne Key. Keine Secrets, keine Provider-Credentials, keine internen IDs über die bestehende DTO-Allowlist hinaus.
- Der Endpunkt läuft bewusst vor der Publishable-Key-Prüfung des Gateways (er liefert den Key ja erst aus) und bleibt read-only + ratelimitiert.

### 2. Automatische Key-Erzeugung beim Shop-Anlegen

- Beim Owner-Claim bzw. beim Anlegen des Hauptshops wird — falls noch kein aktiver Publishable Key für diesen Shop existiert — automatisch einer erzeugt und dem Shop zugeordnet. Idempotent: vorhandener aktiver Key wird wiederverwendet, kein zweiter Key.

### 3. SDK-Bootstrapping ohne ENV und ohne Formular

- `src/routes/store/route.tsx`: Reihenfolge wird `runtime-config` zuerst, ENV/URL/localStorage nur noch als Remote-Fallback. Das manuelle Key-Eingabeformular entfällt im Dedicated-Modus; statt dessen ein neutraler Ladezustand bzw. ein Hinweis auf `/app/setup`, wenn die Installation noch nicht geclaimt ist.
- `baseUrl` bleibt Same-Origin `/api/public/store/v1` — funktioniert in Preview, Staging, Production und auf Custom Domain ohne Codeänderung.
- Remote-Modus bleibt vollständig erhalten und strikt getrennt (`deploymentMode === "remote"` verlangt weiterhin API-URL + Key). Keine Vermischung.
- Design, Layout, Branding und Komponenten der Storefront bleiben unangetastet — nur die Konfigurationsquelle ändert sich.

### 4. Doctor: Dedicated Independence

- Der bestehende Doctor bekommt zusätzliche Prüfungen: `runtime_config_reachable`, `publishable_key_present`, `sdk_same_origin`, `no_external_commerce_runtime`.
- Ergebnis dokumentiert ausdrücklich: `Deployment Mode: DEDICATED`, `External EYIS Runtime Dependency: NONE`.

### 5. Frisch-Installations-E2E + Network Assertion

- Neuer Harness `qa/phase23-dedicated-install.ts` (`bun run qa:dedicated-install`), der gegen Dev/Preview prüft: Runtime Config liefert Key → SDK-Client ohne ENV initialisierbar → Produkt aus dem Backoffice erscheint über Store API in der Storefront → Cart-Add funktioniert → keine Commerce-Anfrage an eine fremde EYIS-Runtime-Domain.
- Unit-Tests für Runtime-Config-Redaktion (keine Secrets), Idempotenz der Key-Erzeugung und die Dedicated/Remote-Auflösung im SDK.

### 6. Dokumentation und Agentenregel

- `docs/production/INSTALLATION.md`: Same-Origin-Runtime-Config, automatische Key-Erzeugung, keine manuellen API-/Key-Eingaben.
- `docs/agent/NEW_STOREFRONT_RUNBOOK.md`: klare Trennung Dedicated (Same-Origin, keine ENV) vs. Remote (ENV nötig).
- `AGENTS.md`: verbindliche Regel — „EYIS installieren" bedeutet ohne Rückfrage **dedicated**; Remote nur bei ausdrücklicher Nennung. Verbotene Fragen (API-URL, Publishable Key, externes Projekt) werden explizit gelistet.
- `qa/PHASE23-DEDICATED-INSTALL-REPORT.md` mit Statusmatrix (PASS/FAIL/OFFEN/BLOCKED) und Abschlussbericht im geforderten Format.

## Nicht Teil dieser Arbeit

- Keine neuen Commerce-Features, keine Änderung an Pricing/Tax/Inventory/Order-Logik.
- Keine Änderung an bestehenden Migrationen; sofern die automatische Key-Erzeugung eine Spalte braucht, wird nur additiv migriert (CREATE → GRANT → RLS → POLICY).
- Keine Provider-Aktivierung: Stripe Live, echter E-Mail-Versand, SMTP-Produktivbetrieb und Carrier bleiben BLOCKED und blockieren die Installation nicht (`NOT CONFIGURED`).
- Keine destruktiven Operationen, kein Schema-Reset.

## Abschluss

`bun run generate:manifests`, `bun run verify` (docs, typecheck, tests, build), `commerce:doctor` gegen Dev sowie der neue Install-E2E müssen grün sein. Kein PASS ohne Nachweis.
