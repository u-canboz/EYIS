# Integration Center — Payments, E-Mail, Carrier

Gate B ist abgenommen; Gate C wird nicht begonnen. Ziel ist ein zentrales Integration Center,
das den Status aller externen Anbieter bündelt und die vorhandenen Detail-Seiten konsistent
verlinkt. Keine neue Commerce-Fachlogik, kein Umbau der Provider-Contracts: Die bestehenden
Engines (`payments/`, `communications/`, `shipping/`) bleiben führend.

## Ausgangslage

- Zahlungen: `/app/zahlungen` (249 Zeilen) — Provider-Konfigurationen, Test/Live-Status.
- Carrier: `/app/versand/dienstleister` (605 Zeilen) — Carrier-Katalog, Konfigurationen.
- E-Mail: verteilt über `/app/kommunikation/*` (Vorlagen, Regeln, Verlauf, Branding) —
  keine eigene Provider-Statusseite.
- Readiness-Wahrheit liegt bereits in `payment_provider_configs`,
  `communication_provider_configs`, `shipping_provider_configs` plus
  `qa/phase14-providers.ts` und `PROVIDER_READINESS_MATRIX.md`.

## Umsetzung

### 1. Zentrale Übersicht `/app/integrationen`

Neue Route mit drei Bereichskarten (Zahlungen, E-Mail, Versand), jeweils:

- Adapter-Katalog: welche Provider der Code kennt (`getProvider`, `CARRIER_CATALOG`,
  E-Mail-Registry) und ob sie implementiert oder nur Stub sind.
- Konfigurationsstatus je Shop: Anzahl Konfigurationen, Typ (mock/test/live), Priorität,
  Webhook-Schutz aktiv.
- Go-live-Ampel: PASS / BLOCKED (z. B. „Stripe Live: Zugangsdaten fehlen") — aus den
  Konfigurationstabellen abgeleitet, nicht hartcodiert.
- Direktlinks in die bestehenden Detail-Seiten (`/app/zahlungen`,
  `/app/versand/dienstleister`, neue E-Mail-Provider-Seite).

### 2. E-Mail-Provider-Statusseite

Neue Unterseite (z. B. `/app/kommunikation/provider` oder Abschnitt im Integration Center),
die die vorhandenen `communication_provider_configs` analog zu Zahlungen/Carrier sichtbar
macht: Provider, Test/Live, Absenderidentität-Status, Sperrliste vorhanden, Webhook-Endpunkt.

### 3. Gemeinsamer Status-Servercode

Dünne Lese-Funktionen (`integration.functions.ts` + `*.server.ts`) pro Bereich:
Konfigurationen + abgeleiteter Readiness-Status, mandantengefiltert
(`organization_id`/`shop_id`), Admin-Client nur im Handler. Kein Schreiben über das
Integration Center — Konfiguration bleibt auf den bestehenden Seiten.

### 4. Navigation

„Integrationen" in der Hauptnavigation (nav-registry), Icon z. B. `Plug`/`Blocks`.
Bestehende Einträge bleiben.

### 5. Grenzen (nicht verhandelbar, aus Gate B)

- Keine Live-Schaltung durch den Agenten; UI zeigt Status und Handlungsanleitung für den
  Betreiber, bietet aber keinen Live-Aktivieren-Schalter.
- Secrets werden nie angezeigt oder erneut abgefragt — nur „hinterlegt/ nicht hinterlegt".
- Mock/Test-Kennzeichnung bleibt deutlich sichtbar.

## Nachweis und Re-Checks

1. `bun run verify` (docs:validate, typecheck, test, build) — inkl. Manifest-Neuerzeugung
   wegen neuer Route.
2. `bun run qa:providers` — Provider-Readiness erneut (erwartet: 12 PASS, 2 BLOCKED, unverändert).
3. `bun run qa:security` und `bun run qa:rls` — Regression nach neuen Lese-Funktionen
   (neue Tabellen werden nicht angelegt; Zugriff über bestehende Policies).
4. Voll-Regression: Store API, Jobs, Health, Demo — per bestehenden `qa:*`-Harnesses.
5. Shop-Readiness: visuelle Prüfung des Integration Center in 390/1440px + Dark Mode
   über den Visual-Harness bzw. Screenshots; B1-Kriterien (Overflow, Touch-Targets,
   Fokus) gelten auch für die neue Seite.
6. Kurzbericht `qa/PHASE18-INTEGRATION-CENTER.md` mit Status PASS/FAIL/OFFEN/BLOCKED je Punkt.

## Umsetzungsreihenfolge

1. Status-Servercode (lesen) + Tests.
2. Route `/app/integrationen` mit den drei Bereichskarten.
3. E-Mail-Provider-Status.
4. Navigation, Manifeste, verify.
5. Re-Checks (providers, security, rls, Regression) und Bericht.
