# Installation härten — die sechs Beschwerden aus dem Blackbox-Bericht

Alle Punkte sind Fehlerbehebungen am Installationspaket und an den Installationsskripten. Keine neuen Produktfunktionen, keine Architekturänderung.

## Bestätigter Hauptbefund: die Tabellenrechte fehlen im Paket

Nachgeprüft: `installer/database/baseline/` enthält **keine einzige** Tabellen-`GRANT`-Anweisung — die 110 gefundenen `GRANT`-Zeilen stehen ausschließlich in den Funktionsrechte-Einheiten 043–045 und im Journal 000. Der Grund steht in `scripts/installer/introspect.ts`: die Rechte werden über `information_schema.role_table_grants` gelesen. Diese Sicht zeigt nur Rechte, die für die gerade angemeldete Datenbankrolle sichtbar sind. Beim Erzeugen des Pakets läuft eine eingeschränkte Rolle, also kommen null Zeilen zurück, `emitGrants()` erzeugt nichts, und die Einheit „Grants“ fällt still aus dem Paket. Genau deshalb musste das Testprojekt 233 Rechte von Hand nachziehen.

## Was gebaut wird

### 1. Rechte kommen zuverlässig ins Paket
- Rechte aus dem Katalog lesen (`pg_class.relacl` über `aclexplode`) statt aus der rollenabhängigen Sicht. Das ist unabhängig davon, welche Rolle das Paket erzeugt.
- Absicherung im Generator: null Tabellenrechte bei vorhandenen Tabellen ⇒ harter Abbruch statt stiller Auslieferung.
- Paket neu erzeugen (neue Einheit „Zugriffsrechte Tabellen“), Fingerprint, Manifest, Prüfsummen, Systemdaten und Abgleich neu ziehen.

### 2. Rechte-Prüfschritt vor dem Bootstrap
- Neuer Prüfschritt im Installationsablauf: für jede Kern-Tabelle wird geprüft, ob `service_role` und `authenticated` die im Paket vorgesehenen Rechte tatsächlich besitzen. Fehlt etwas, meldet der Installer die genaue Tabellenliste und die nachzuziehende Einheit — statt dass der Bootstrap später mit „permission denied“ abbricht.
- `runBootstrap()` prüft zuerst die Rechte, dann erst die Datenverbindung über `organizations`.

### 3. Laufzeit-Geheimnis und Erweiterungen sauber im Paket
- Ein Speicher für das Job-Geheimnis wird fester Bestandteil des Pakets (Tabelle mit Zugriffsschutz, ohne Rechte für Gäste und angemeldete Nutzer), inklusive Lese-/Schreibweg für die Jobs. Kein handgebauter Ersatz mehr im Zielprojekt.
- Erweiterungen werden idempotent behandelt: bereits vorhandene Erweiterungen führen nicht mehr zum Abbruch.

### 4. Nach der Übernahme ist der Shop im Mock-Betrieb lauffähig
- Direkt nach der Owner-Übernahme werden Pflicht-Vorgaben angelegt: ein Lieferland, eine Standard-Versandart und der Mock-Zahlweg, dazu die Storefront-Adresse aus der laufenden Umgebung.
- Der Einrichtungsassistent zeigt diese Werte vorausgefüllt; er bleibt manuell bestätigbar, blockiert aber keine erste Bestellung mehr.

### 5. Storefront-Anbindung als ein Befehl
- Neuer Befehl `eyis:storefront:init`: legt Anbieter-Komponente, Client, Wurzel-Einbindung und Verbindungsanzeige anhand der Laufzeitkonfiguration an, idempotent und mit Markern. Ersetzt das Zusammenkopieren aus dem Leitfaden.
- Der Typfehler bei `mode` im verbundenen Zustand wird im SDK-Typ behoben.

### 6. Doctor meldet Kassen-Blocker deutlich
- Neue Prüfungen: „0 Versandarten“, „0 Lieferländer“, „0 Zahlwege“, „Einrichtung nicht abgeschlossen“, „Storefront-Adresse leer“ — jeweils als Blocker mit Klartext „Kasse blockiert“.
- Dieselbe Auswertung erscheint als Hinweisfeld im Backoffice-Dashboard.

## Abschluss

`bun run eyis:database:baseline`, `eyis:seeds:generate`, `eyis:database:sync-check`, `eyis:database:forward-port`, `eyis:dist:verify`, `eyis:blackbox:simulate`, `bun run verify` — alle grün, plus ein Regressionstest, der ein Paket ohne Tabellenrechte als FAIL erkennt.

Danach folgt ein neuer Installationslauf im frischen Projekt; erst dieser zählt als Nachweis.
