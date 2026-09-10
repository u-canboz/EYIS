# EYIS lokal prüfen

Dieser Ablauf verwendet ausschließlich eine eigene lokale Supabase-Instanz mit synthetischen Daten.
Benötigt: Bun 1.3.10, Docker-kompatible Engine, Supabase CLI 2.116.0.

1. `bun install --frozen-lockfile`.
2. Supabase in einem separaten lokalen Arbeitsverzeichnis initialisieren und starten.
3. `APP_ENV=development`, `COMMERCE_DEPLOYMENT_MODE=dedicated`, lokale Supabase-URL,
   Anon-/Service-Key sowie `COMMERCE_OS_URL=http://127.0.0.1:8080` setzen.
4. Den offiziellen frischen Installationsplan aus einem gültig signierten Paket ausführen:
   `bun installer/eyis.ts plan --json`. Die Schritte in Plan-Reihenfolge über den lokalen
   PostgreSQL-Adapter anwenden; historische Migrationen nicht als Fresh-Install wiederholen.
5. Bootstrap über `/api/public/install/bootstrap` mit lokalem `EYIS_BOOTSTRAP_SECRET`,
   anschließend lokalen Auth-Owner anlegen, anmelden und `/app/setup` abschließen.
6. Storage-Buckets `documents` (privat), `media` (öffentlich), `returns` (privat) anhand
   `installer/resources/eyis-resources.manifest.json` provisionieren.
7. `bun run dev --host 127.0.0.1 --port 8080` starten.
8. Mit derselben lokalen Umgebung `bun qa/local-stack-smoke.ts` ausführen.

Der Smoke-Test verweigert nicht-lokale App- oder Datenbank-URLs. Er erstellt synthetische Produkte,
Preise, Bestand und Versand; prüft über HTTP Warenkorb, Checkout, explizite Mock-Zahlung,
Bestellung, Einmal-Token, Idempotenz und Bestand. Außerdem werden Wartung und Cron-Authentifizierung
sowie die Organisation des Update-Administrators geprüft. Resultate: `../local-smoke-results.json`.

Die Standard- und Referenz-Storefront verwenden denselben SDK-Hook zur Zahlungsbestätigung.
`confirmTest` ist ausschließlich in Dev/Staging mit Test-Shop-Key und Mock-Testsession erlaubt.
Der Warenkorb-Cache wird erst nach erfolgreicher Bestellbestätigung geleert.

SDK 1.1.0 bleibt mit Store API v1 kompatibel. Neu sind `payments.confirmTest`, das optionale
`testConfirmationAvailable` und der Fehlercode `MAINTENANCE`.

Ein geänderter Quellstand besitzt zunächst keine gültige Produktionssignatur. `bun run verify`
behält dieses Gate bei. Lokal zusätzlich `bun run eyis:release:selftest:simulate` mit einem
Wegwerf-Schlüssel ausführen; dies ersetzt keine Freigabe des echten Releases.

Für die vollständige lokale Prüfung eines geänderten Quellstands: `bun run verify:development`.
Das führt die unveränderte `verify`-Kette in einer temporären Quellkopie mit einem nur dort
verwendeten Testschlüssel aus. Die Kopie wird danach gelöscht. Produktions-Trust-Anchor,
Signatur und private Release-Schlüssel bleiben unangetastet. Dies ist ein Entwicklungsnachweis,
kein freigegebenes Installationspaket.


Installationskorrektur vom 10.09.2026: Der Agent-Plan enthält jetzt 58 Schritte und alle fünf
kanonischen System-Seeds. Zuvor fehlten trotz vorhandener SQL-Dateien Blueprints, Mailvorlagen und
System-Steuerklassen im Ausführungsindex. `eyis:seeds:generate` synchronisiert beide Manifeste;
auch eine neue Baseline übernimmt den vollständigen Katalog. Bei einer bereits betroffenen
Dev-Installation können die unveränderten idempotenten Seed-Dateien 003–005 aus dem geprüften
Paket nachgeholt werden. Keine historischen Schema-Migrationen erneut ausführen.

Der Einrichtungsassistent nutzt die zehn vom Backend akzeptierten Schritte, speichert den
Fortschritt direkt im Query-Cache nach und prüft den Abschluss mit dem Doctor. Fehlende Cron-Jobs,
Buckets oder Systemdaten lassen sich nicht durch einen erfolgreichen Systemcheck übergehen.
Betreiberangaben, Steuern, Rechnungsangaben und echter Versandprovider bleiben Betreiberentscheidungen.
