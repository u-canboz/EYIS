# EYIS Dedicated — Blackbox-Installationstest (v1.0.0-rc.4)

Ziel: beweisen, dass ein frisches Kundenprojekt EYIS **ohne eine einzige manuelle
Code-Reparatur** installieren und betreiben kann. Erst wenn dieser Durchlauf sauber ist, wird
EYIS Dedicated V1 eingefroren und `v1.0.0` als Stable getaggt.

**Blackbox-Regel:** Für den Durchlauf existiert ausschließlich das veröffentlichte
Release-Paket und diese Anleitung. Kein Zugriff auf das EYIS-Hauptrepository, auf lokalen
Entwicklungsstand oder auf nicht veröffentlichte Dateien. Keine echten Zahlungen, keine echten
Versandlabels.

---

## 0. Getesteter Release

| Feld | Wert |
| --- | --- |
| Tag | `v1.0.0-rc.4` (Prerelease) |
| Commit | `4122565450c270703a8e332bc601472f7ee6510c` |
| Artefakt | `eyis-dedicated-1.0.0-rc.4.tar.gz` (685.435 Bytes, 402 Dateien) |
| Artefakt-SHA-256 | `8d57c9ed03d7699f5c834fa5309d5c7e90f53fbfd131ab54319f08040fd312a9` |
| Signaturschlüssel | `key_id 4e7f55e68fa9a1b934ce2d04719c9177` (aktiv im Trust Anchor) |
| Schema-Fingerprint | `401b9985a42722f233f9ebace860fdaece85640476b6a9eb0a50b158fe04f0e4` |
| System-Seed-Fingerprint | `3d56b91cabc04cd885b70998c432fe1b1b34642024ca4e5150a869f4dde1a163` |
| Baseline | 46 Units, 5 System-Seeds, Migration Head `057` |

Release-Assets (alle unter
`https://github.com/u-canboz/EYIS/releases/download/v1.0.0-rc.4/`):
`eyis-dedicated-1.0.0-rc.4.tar.gz`, `eyis-release.json`, `eyis-release.json.sig`,
`eyis-trust-anchor.json`, `eyis-database-installer.manifest.json`,
`eyis-database-installer.signature.json`, `eyis-code-distribution.manifest.json`,
`eyis-system-seeds.manifest.json`, `eyis-resources.manifest.json`.

## 1. Paketprüfung vor der Installation (Pflicht, Kundenseite)

```bash
curl -LO https://github.com/u-canboz/EYIS/releases/download/v1.0.0-rc.4/eyis-dedicated-1.0.0-rc.4.tar.gz
curl -LO https://github.com/u-canboz/EYIS/releases/download/v1.0.0-rc.4/eyis-release.json
curl -LO https://github.com/u-canboz/EYIS/releases/download/v1.0.0-rc.4/eyis-release.json.sig
curl -LO https://github.com/u-canboz/EYIS/releases/download/v1.0.0-rc.4/eyis-trust-anchor.json

sha256sum eyis-dedicated-1.0.0-rc.4.tar.gz   # muss dem Wert oben entsprechen
mkdir pack && tar xzf eyis-dedicated-1.0.0-rc.4.tar.gz -C pack
cd pack && bun scripts/eyis-pack-signature.ts verify   # Gesamt: PASS
```

Die Release-Signatur (`eyis-release.json.sig`) wird mit dem im Trust Anchor als `active`
markierten Ed25519-Public-Key gegen `eyis-release.json` geprüft. Schlägt eine der Prüfungen
fehl, wird **nicht** installiert.

## 2. Kundenprojekt vorbereiten

1. Neues Lovable-Projekt anlegen, Cloud/Datenbank aktivieren (frische, leere Datenbank).
2. Eine einfache eigene Storefront bauen (Startseite, Header, Footer, eigenes CSS).
   Diese Dateien sind `customer_owned` und müssen nach der Installation **unverändert** sein.
3. Secrets im Kundenprojekt setzen: `COMMERCE_DEPLOYMENT_MODE=dedicated`, `APP_ENV`,
   `COMMERCE_BOOTSTRAP_SECRET`, `PROVIDER_CREDENTIALS_KEY`, `CRON_SECRET`.

## 3. Installationsauftrag (wörtlich an den Agenten des Kundenprojekts)

> Installiere EYIS Dedicated aus dem veröffentlichten Release `v1.0.0-rc.4`
> (https://github.com/u-canboz/EYIS/releases/tag/v1.0.0-rc.4) in dieses Projekt.
> Lade ausschließlich die Release-Assets; nutze keinen anderen Repository-Stand.
> Prüfe zuerst SHA-256, Pack-Signatur und Trust Anchor — ohne PASS keine Installation.
> Bestehendes Design behalten. Meine Administrator-E-Mail ist `<E-Mail>`.
> Halte dich an `eyis-code-distribution.manifest.json` (Version 6.0.0):
> Nur `install`-Pfade übernehmen, `customer_owned` und `customer_routes` niemals ersetzen,
> an `src/routes/__root.tsx` und `src/styles.css` ausschließlich den beschriebenen additiven
> `integration_patch` vornehmen. Danach `installer/database/` als Fresh Install einspielen
> (Units in Manifest-Reihenfolge → Seeds → `reconcile/001_migration_history.sql`),
> `bun run eyis:install:verify` ausführen, dann
> `EYIS_OWNER_EMAIL=<E-Mail> bun run commerce:bootstrap` und
> `bun run eyis:resources:provision`.

## 4. Prüfpunkte des Durchlaufs

Jeder Punkt ist PASS, FAIL, OFFEN oder BLOCKED. Kein PASS ohne Nachweis.

| # | Schritt | Erwartung |
| --- | --- | --- |
| 0 | Paketprüfung | SHA-256, 402 Dateiprüfsummen, Pack- und Release-Signatur gegen den aktiven Trust-Anchor-Key PASS |
| 1 | Installation Pack | Alle 46 Units + 5 Seeds eingespielt, Journal vollständig, Reconciliation angewendet |
| 2 | Fingerprints | `schema_fingerprint` **und** `system_seed_fingerprint` PASS |
| 3 | Kundenoberfläche | Startseite, Header, Footer, Farben, Schriften unverändert; `/` bleibt Kundenroute |
| 4 | Registrierung | Konto mit der Administrator-E-Mail anlegen |
| 5 | Owner Claim | Nach der Anmeldung automatisch Owner (`pending_owner_email`), ohne Claim-Code |
| 6 | Backoffice | `/app` lädt im `.eyis-admin`-Scope, ohne Kunden-Chrome |
| 7 | Produkt | Produktart **Textil**, Variante, Preis, Bestand |
| 8 | Veröffentlichen | Produkt `active` |
| 9 | Store API | `GET /api/public/store/v1/...` liefert Produkt inkl. serverseitigem Preis |
| 10 | Storefront | Produkt erscheint in der **bestehenden** Kundenoberfläche über das SDK |
| 11 | Warenkorb | Summen kommen vom Server, kein Client rechnet nach |
| 12 | Checkout | Bestellung mit Testzahlung, Bestand wird gebucht |
| 13 | Jobs | `bun run eyis:resources:provision` → drei Zeitpläne aktiv |
| 14 | Doctor | `bun run commerce:doctor` bzw. `/app/system` — alle Prüfungen PASS, insbesondere „Katalog (Preisauflösung)", „Kommunikation (Kernvorlagen)" und „Job-Zeitpläne (Cron)" |
| 15 | Verify | `bun run verify` im Kundenprojekt grün |

**Abbruchregel:** Sobald ein Schritt nur durch Handanpassung am gelieferten Code funktioniert,
gilt der Test als FAIL. Der Defekt wird im Hauptprojekt behoben, ein neuer Release signiert und
der Durchlauf von vorn begonnen. `v1.0.0-rc.4` selbst wird nicht verändert.

## 5. Bekannte Umgebungsfallen

- Der Installer erkennt den Zustand über die Datenbankverbindung der Umgebung. Läuft die CLI
  gegen eine bereits bestückte Datenbank (z. B. eine Entwicklungsumgebung mit gesetzten
  `PG*`-Variablen), meldet `eyis:install:status` „INSTALLED". Der Blackbox-Lauf braucht deshalb
  zwingend eine **frische, leere** Datenbank.
- Ohne `APP_ENV` stoppt jede schreibende Aktion. Das ist Absicht.

## 6. Nach bestandenem Durchlauf

1. Ergebnisse in einem Bericht unter `qa/` (Namensschema `PHASE28-BLACKBOX-INSTALL-REPORT`) festhalten.
2. Stable Release taggen (`v1.0.0`) — der Workflow signiert das Pack.
3. Installationsbasis einfrieren. Weitere Änderungen laufen ausschließlich über Versionen und
   das Update Center (`docs/production/UPDATE_CENTER.md`).

## 7. Dauerhaft extern blockiert

Stripe Live, echter E-Mail-Versand mit verifizierter Absenderdomain und echte Carrier-Labels
bleiben BLOCKED und sind **nicht** Teil dieses Tests
(siehe `docs/production/KNOWN_LIMITATIONS.md`).
