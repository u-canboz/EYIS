# EYIS – lokale Neuinstallation

Stand: 15.09.2026. Arbeitsverzeichnis: `/Users/u-can/Documents/ChatGPT/Eyis`.
Betriebsart C, ausschließlich `APP_ENV=development`, eigene lokale Datenbank, Auth und Storage.
Quelle: https://eyis.de und https://github.com/u-canboz/EYIS, Branch `main`, Commit
`0d628e8362d32ddb564280716eafacf1be6eb46a`. Lokaler Arbeitsbranch: `codex/local-install`.

## Installationsprotokoll und Hürden

1. **Leerer Arbeitsordner mit initialisiertem Git:** Remote hinzugefügt, Originalquellstand abgerufen und lokalen Arbeitsbranch angelegt. Keine bestehende Installation gelöscht.
2. **Website über Recherchewerkzeug nicht abrufbar:** HTTPS-Abruf per curl erfolgreich, Start- und Entwicklerseite geprüft.
3. **Falscher Ordner in öffentlicher Anleitung:** `git clone .../EYIS.git` gefolgt von `cd commerce-os` funktioniert nicht. Installation direkt im vorhandenen Eyis-Arbeitsordner durchgeführt.
4. **Bun fehlt:** Bun 1.3.10 für macOS ARM64 unter `.local-runtime/` installiert. `bun install --frozen-lockfile` erfolgreich, 458 Pakete. Keine Paketversionen geändert.
5. **Container-Engine und Supabase CLI fehlen:** Projektlokale Lima 2.2.0, Docker-CLI 28.5.2, Supabase CLI 2.116.0 eingerichtet. Eigene VM `eyis-local`, 2 CPUs, 3 GiB RAM, 14 GiB virtuelles Disk-Limit; Docker Engine 29.8.0. Mac besitzt 8 GiB RAM und anfangs ungefähr 15 GiB freien Speicher. Nicht benötigte Supabase-Dienste ausgeschlossen.
6. **Supabase erkennt Docker nicht allein über DOCKER_HOST:** Erster Start bricht mit `docker: command not found` ab. Docker-CLI zusätzlich in PATH aufgenommen.
7. **PostgreSQL-Client fehlt:** Lokalen `psql`-Adapter geschrieben, der ausschließlich im Container `supabase_db_eyis-local` arbeitet. Damit funktionieren die vorhandenen Installer- und Fingerprint-Prüfungen ohne systemweite PostgreSQL-Installation.
8. **Repository enthält Cloud-Konfiguration in `.env`:** Lokale Overrides erforderlich, bevor die Anwendung gestartet wird. Lokale Secrets werden getrennt und nicht versioniert gespeichert; keine Cloud-Datenbank für Tests verwendet.
9. **Dokumentation nennt falsches Bootstrap-Secret:** `LOCAL_DEVELOPMENT.md` nennt `EYIS_BOOTSTRAP_SECRET`; Route und CLI erwarten tatsächlich `COMMERCE_BOOTSTRAP_SECRET`. Maßgeblich ist der Code.
10. **Manuelle Lücken im lokalen Runbook:** Es fehlen ausführbare Einrichtungsschritte für die Container-Engine, PostgreSQL-Adapter, lokale Umgebungsvariablen und Cron-Erreichbarkeit. Diese werden für diese Installation ergänzt und dokumentiert.

## Bisherige Nachweise

- Unverändertes `bun run verify`: erfolgreich, Exit-Code 0.
- Pack-Signatur, Checksummen, Kompatibilität: PASS.
- Installer-/Distributions-/Artefaktprüfungen: PASS.
- TypeScript: PASS; Vitest: 26 Testdateien, 295 Tests bestanden.
- Produktionsbuild: PASS (nur lokal gebaut).
- Rohprotokoll: `.local-state/logs/verify-initial.log`.

Weitere Nachweise und Bedienhinweise werden nach dem Praxistest ergänzt.

## Weitere Hürden und Lösungen

11. **Supabase CLI `--workdir` beim Start nicht wirksam:** Trotz des Parameters wurde zunächst die Kennung aus dem Hauptrepository benutzt. Start abgebrochen; anschließend im lokalen Supabase-Verzeichnis gestartet. Die erste lokale Hilfsinstanz wurde gestoppt, keine historische EYIS-Migrationskette für die eigentliche Installation verwendet.
12. **Verdeckter Portkonflikt mit älterer lokaler Installation:** Eine seit 10.09. laufende Lima-VM unter einem anderen LIMA_HOME belegte 54321/54322/54324. Sie erschien nicht in der Standard-Lima-Liste. Der HTTP-Zugriff zeigte dadurch zunächst deren bereits übernommene lokale Installation; der Bootstrap wurde mit `INSTALLATION_ALREADY_INITIALIZED` abgewiesen. Über Container-/VM-/Host-Abgleich nachgewiesen. Die neue Instanz verwendet jetzt **55321/55322/55324**. Die alte Installation wurde nicht geändert oder abgeschaltet. Vor dem eigentlichen Owner-Setup wurde der Zustand der neuen Instanz eindeutig geprüft.
13. **Veralteter signierter Schema-Fingerprint:** Das Pack ist korrekt signiert, meldet aber selbst `schema_fingerprint_state=REQUIRES_REINTROSPECTION`. Vier Forward-Port-Units enthalten u. a. acht zusätzliche Tabellen und neuere Rechtebeschränkungen. `eyis:database:verify` vergleicht weiter gegen den alten Stand und meldet FAIL. Das ist ein offener Fehler des ausgelieferten Packs, kein erfolgreicher offizieller Strukturcheck.
14. **Supabase vergibt implizite Tabellenrechte:** Die lokale Plattform erteilt standardmäßig weitreichende Tabellenrechte. Der Pack ergänzt Rechte, entfernt bestehende Standardrechte aber nicht durchgehend. Ergebnis: 1.664 zusätzliche Rechte gegenüber einer unabhängigen Installation ohne implizite Grants. Eine zweite leere Referenzdatenbank `eyis_install_reference` wurde aus genau demselben signierten 59-Schritte-Plan erstellt. Ausschließlich die Abweichungen der Tabellenrechte wurden gezielt korrigiert. Keine RLS deaktiviert, keine Tabellen/Daten gelöscht. Das vollständige normalisierte Schema stimmt jetzt exakt mit dieser unabhängig installierten Referenz überein.
15. **Mitgelieferte Reintrospektion nicht direkt macOS-tauglich:** Das Skript erwartet Linux-Werkzeuge wie `setpriv`, lokale PostgreSQL-Binaries und UID 1000. Außerdem aktualisiert sein Code nur Hash-Felder, nicht den normalisierten Soll-Objektbestand. Deshalb lokaler Referenzvergleich mit echtem PostgreSQL in der Container-VM; keine Neusignierung und kein Überschreiben des Original-Packs.
16. **Cron-Secret benötigt Plattformrechte:** `ALTER DATABASE ... SET app.settings.cron_secret` scheitert als `postgres`. Einmalige Konfiguration als lokaler `supabase_admin`; Jobs laufen als `postgres`. Secrets werden ausschließlich lokal gespeichert.
17. **Cron erreicht die App nicht über Container-localhost:** Cron benötigt den Lima-Host-Gateway. `host.lima.internal` erreicht Vite, wird aber durch dessen Host-Prüfung mit 403 abgewiesen. Die bekannte lokale Gateway-IP `192.168.5.2:8080` funktioniert bei unveränderter Host-Prüfung; der App-Listener bleibt auf Mac-Loopback. Vier Endpunkte mit Authentifizierung lieferten HTTP 200.
18. **Cron-Namen sind nur je DB-Benutzer eindeutig:** Beim Wechsel zwischen Plattform- und Anwendungsrolle entstanden doppelte Testregistrierungen. Bereinigt; final genau vier Jobs unter `postgres`, mit den Zeitplänen aus dem Resource-Manifest. Ein tatsächlicher Scheduler-Lauf aller vier Jobs wurde erfolgreich nachgewiesen.
19. **Smoke-Test hardcodiert alte Version:** Alle Kaufprüfungen bestanden, aber der letzte Test erwartete `0.0.0-dev`; installiert ist **1.0.3**. `qa/local-stack-smoke.ts` prüft nun gegen `commerce_installation.core_version`. Zusätzlich ist der Ergebnisdateipfad konfigurierbar, damit lokale Nachweise im Projekt bleiben. Danach vollständig PASS.
20. **Doctor übersieht fehlende Rechnungseinrichtung:** Der Doctor meldete PASS, obwohl die UI die Rechnungserstellung mit `company, address, tax, sequence` blockierte. Für die lokale Instanz synthetische Rechnungsangaben und Nummernkreise eingerichtet. Firmenname enthält ausdrücklich `KEINE ECHTE RECHNUNG`, Steuernummer `TEST-NICHT-GUELTIG`. Rechnungsentwurf, Ausstellung und PDF-Dateiversion funktionieren. Die fachliche Abschlussprüfung muss später verbessert werden.
21. **Auffällige Steueranzeige auf Rechnungsposition:** Die Testversandposition zeigt `18,93 %`, während die Zusammenfassung `19 %` zeigt. Als Folgepunkt für die Softwarefinalisierung festgehalten; keine pauschale steuerliche Korrektheit behauptet.
22. **Dokumentation ist hinter dem Quellstand:** Runbooks nennen 53/55/58 Schritte; der tatsächliche Plan enthält 59. README nennt Entwicklungsstand `0.0.0-dev`, der laufende Stand ist 1.0.3. Maßgeblich waren Paket, Code und Live-Prüfungen.

## Lokaler Abschlussstand und Nachweise

- 59/59 Installationsschritte einschließlich 5 Seed-Units, Reconciliation und Journal abgeschlossen.
- Lokale aktuelle Schema-Prüfung: **PASS**, unabhängig erzeugter Soll-Fingerprint und Ist-Fingerprint beide `545d2f92291bbeac595efd3ff5bfe284f15e775fb01dcac17d9f31eb7fa41b01`.
- Wichtig: Der ursprüngliche Pack-Fingerprint bleibt veraltet. Die lokale Referenzprüfung ersetzt keine Herstellerfreigabe eines korrigierten Releases.
- System-Seeds: Manifest-Integrität und tatsächliche Datenbankprüfung **PASS**. 482 Rollenrechte, 9 Blueprints, 23 globale E-Mail-Vorlagen; Steuer-Systemdaten vorhanden.
- Owner-Konto angelegt, Passwort-Anmeldung über Auth API und Browser erfolgreich, eigene Organisation und eigener Shop übernommen.
- Drei Storage-Buckets vorhanden, Sichtbarkeit gemäß Manifest.
- Lokaler Commerce-Smoke-Test **PASS**: Katalog, Preis, Warenkorb, fehlendes Token abgelehnt, Checkout 54,80 EUR, Mock-Zahlung, Bestellung, Einmal-Token, Wiederholschutz, genau eine Lagerabbuchung, Wartungsmodus, Cron-Authentifizierung, Update-Mandantentrennung und gespeicherte Version.
- Zwei synthetische bezahlte Bestellungen im Backoffice sichtbar, keine echten Zahlungen. Eine Testrechnung wurde ausgestellt und als PDF-Dateiversion gespeichert. Ein erneuter Smoke-Test legt weitere Testdaten an.
- Alle zehn Setup-Schritte für diese **synthetische lokale Testinstanz** abgeschlossen; Doctor **PASS**. Echte Betreiber-, Steuer-, Versand- und Providerangaben sind weiterhin Gegenstand späterer Einrichtung.
- Vier Cron-Jobs tatsächlich durch den Scheduler ausgeführt: jeweils `succeeded`; nachfolgende HTTP-Antworten jeweils 200. Manifest-Zeitpläne wiederhergestellt.
- Gesamte `bun run verify`-Kette auch nach Testkorrektur erfolgreich: 26 Testdateien, 295 Tests, TypeScript, Signatur und Build.
- Keine Veröffentlichung, kein Push, kein Deployment, keine Live-Provider eingerichtet.

### Nachweisdateien

Unter `.local-state/logs/`: `install-steps.json`, `install.log`, `reference-install.log`,
`reference-schema.json`, `schema-verification.json`, `grant-repair.sql`,
`database-final.log`, `commerce-smoke-results.json`, `commerce-smoke.log`,
`doctor.log`, `verify-initial.log`, `verify-final.log`, `dashboard.png`.
Private lokale Konfiguration und Laufzeitdateien werden nicht versioniert.

## Öffnen und bedienen

- **Backoffice:** http://127.0.0.1:8080/app
- **Shop:** http://127.0.0.1:8080/store
- **Lokales Mail-Testpostfach:** http://127.0.0.1:55324
- **Neue Supabase API:** http://127.0.0.1:55321
- **Neue Datenbank:** Loopback-Port 55322; Daten bleiben im Docker-Volume `supabase_db_eyis-local`.
- **Benutzer:** `owner@eyis.local`. Passwort in `.local-state/local-owner.json` (Dateirechte 0600), bereits im Testbrowser angemeldet.
- **Lokale Secrets:** `.env.local` (Dateirechte 0600). Nicht mit der mitgelieferten Cloud-Konfiguration verwechseln.

```bash
cd /Users/u-can/Documents/ChatGPT/Eyis
./scripts/local/eyis.sh start     # VM, Backend und App starten
./scripts/local/eyis.sh status    # Laufende Dienste und Installationszustand
./scripts/local/eyis.sh doctor    # Anwendungsbereitschaft
./scripts/local/eyis.sh database  # Aktuelle lokale Referenz + Seeds
./scripts/local/eyis.sh test      # Neuer synthetischer Kauf
./scripts/local/eyis.sh verify   # Offizielle Code-/Pack-Prüfkette
./scripts/local/eyis.sh stop      # Nur neue App/VM stoppen, Daten behalten
```

Die Werkzeuge sind projektlokal unter `.local-runtime/` installiert. Das Startskript setzt PATH
und Docker-Socket selbst. Ein systemweit verfügbares `bun` oder Docker Desktop ist nicht nötig.
Nach einem Mac-Neustart einmal `start` ausführen. Ohne laufende App/VM laufen lokale Jobs nicht.

## Für die folgenden Finalisierungs-Prompts

Priorität: aktuellen Fingerprint und Soll-Objekte sauber generieren und signieren; Fresh-Installer
gegen Plattform-Default-Grants härten; lokales Runbook automatisieren; Rechnungsbereitschaft im
Doctor prüfen; Versions-/Installationsangaben synchronisieren; Steueranzeige der Versandposition
prüfen. Der Original-Pack wurde absichtlich nicht mit einem lokalen Schlüssel neu signiert.

## Erweiterung am 17.09.2026

Aktueller Entwicklungsstand und zusätzliche Hürden: [COMMUNICATION-STUDIO-LOCAL.md](COMMUNICATION-STUDIO-LOCAL.md). Sechs Vorwärtsmigrationen ergänzen das bestehende Schema, insgesamt 68 Migrationen. Die lokale Referenz wurde über das Migrationswerkzeug aktualisiert. Das historische Installationsprotokoll oben bleibt als Nachweis des damaligen Ausgangsstands erhalten.

Storage-Policies fehlten im Fresh Pack; Browser-Upload daher erst nach Vorwärtsmigration funktionsfähig. Ressourcenquelle ist jetzt `scripts/manifest/resources.def.ts`; private Buckets, Dateitypen und Limits werden erzeugt und geprüft. Hersteller-Fingerprint und Signatur bleiben getrennte offene Release-Gates.
