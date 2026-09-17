# EYIS – Rechnungen, Branding und Newsletter

Stand: 17.09.2026. Lokale Instanz auf `127.0.0.1:8080`, `APP_ENV=development`, synthetische Testdaten. Dieser Bericht erweitert [INSTALLATION-LOCAL.md](INSTALLATION-LOCAL.md) und [UI-UX-LOCAL.md](UI-UX-LOCAL.md).

## Lieferumfang

- Rechnung, Gutschrift und Lieferschein: gemessener Textumbruch, eigene Zahlenspalten, wiederholte Tabellenköpfe, über Seiten fortgesetzte Positionen, getrennte Summen-/Fußbereiche und Seitenzahlen. Originalbelegdaten bleiben unverändert. Die lokale Rechnung `TEST--000001` besitzt eine neue PDF-Dateiversion 2.
- Storefront-Inhalte und Storefront-Branding: Verwaltungsseiten, Navigation und schreibende Admin-Funktionen entfernt. Die öffentliche Store API v1 behält bestehende Leseverträge; vorhandene Daten wurden nicht gelöscht.
- E-Mail-Branding: automatische Vererbung von Logo, Farben, Schrift, Unternehmensfußzeile und Rechtstext. Logo als eingebetteter CID-Anhang; PDFs werden zusammen mit dem Mailinhalt unveränderlich gespeichert. SMTP, Resend und Testanbieter unterstützen Anhänge; ungeeignete Anbieter werden ausdrücklich abgewiesen.
- Blockeditor in Vorlagen und Newsletter: Überschriften, Text, Buttons, Trennlinien, Bilder, serverseitig geladene Produktkarten, Rechtsblöcke und PDF-Anhänge. Bestehende Systemvorlagen nutzen denselben Renderer.
- Newsletter Studio: Empfängerliste mit Suche/Filter/Seitennavigation, Double-Opt-in, ablaufende Einmalbestätigung, protokollierte Einwilligung und Abmeldung. Geplante Kampagnen, einmalige Willkommensmail mit Verzögerung, Pausieren/Fortsetzen, Entwurfskopien, Testsendung und Versandprotokoll.
- Versand: Bestätigung und Kampagnen werden über den Kommunikations-Job verarbeitet. Eindeutige Datenbankindizes verhindern doppelte Kampagnenmails; atomare Übernahme verhindert doppelte parallele Versandversuche. Vor Versand werden Einwilligung und Sperrliste erneut geprüft. Statistiken werden in der Datenbank aggregiert.
- Store-API/SDK: additive Newsletter-Endpunkte; Standardvorlage und Referenzshop verwenden diese Funktionen. GET auf Bestätigungslinks meldet niemanden an; eine ausdrückliche POST-Bestätigung ist erforderlich.
- Storage: fehlende Medien-Policies als Vorwärtsmigration ergänzt. Ressourcen werden aus `scripts/manifest/resources.def.ts` erzeugt; private Buckets mit Dateityp-/Größenbegrenzung. `eyis:resources:provision --storage-only` richtet nur Storage ein, ohne Cron-Ziele umzuschreiben.

## Prüfungen

- 40 lokale Integrationsprüfungen: Bestätigung, Wiederholschutz, Pause/Fortsetzung, geplante Zeit, Versandübernahme, Einwilligungshistorie, Abmeldung, Rechte, SMTP-PDF, CID-Logo und Browser-Storage-Verträge.
- 22 Commerce-Smoke-Prüfungen: Warenkorb, Checkout-Abbruch, Mock-Zahlung, Bestellung `ORD-000006`, Einmaltoken, exakt eine Bestandsbuchung, Wartung und Cron-Authentifizierung.
- Migrationsprüfung: 9 Prüfungen, 136 Tabellen, 112 Funktionen. Aktueller Migrationsstand: 68 Dateien.
- Normalisiertes Entwicklungsschema stimmt mit unabhängiger Install-Pack-Referenz plus Vorwärtsmigrationen überein: `1332ce821d0dfe643ea22ffae3561ff36991078167cf8518c9d82423223b3e47`.
- System-Seeds: Manifest und tatsächliche Datenbank PASS; Fingerprint `3d56b91cabc04cd885b70998c432fe1b1b34642024ca4e5150a869f4dde1a163`.
- PDF: Rechnung, Gutschrift und neunseitiger Extremfall gerendert und visuell geprüft; zusätzliche Geometrieprüfungen für Spalten, lange SKUs und Seitenfuß.
- Browser: Produkt-Newsletter gespeichert und erneut geöffnet; Desktop-/Mobil-Mailvorschau, Produktpreis und Shoplinks geprüft. Logo und PDF über den Dateidialog hochgeladen und im Branding Studio gespeichert.
- Vollständige Codeprüfung und Veröffentlichungsstand: siehe Abschlussabschnitt unten; keine Produktions- oder echte Zustellungsprüfung behauptet.

Rohdaten liegen ignoriert unter `.local-state/expansion/`. Test-PDFs sind synthetische Layoutbelege, keine rechtsgültigen Rechnungen.

## Hürden und Korrekturen

| Hürde                                                                                            | Korrektur / Grenze                                                                                                                                             |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Positionsnamen, lange SKUs und Beträge drängten in Nachbarspalten                                | Breiten aus Schriftmetriken gemessen; Zeilen auf Folgeseiten fortgesetzt; numerische Spalten getrennt.                                                         |
| Eigene Mailvorlagen umgingen einheitliches Branding                                              | Gemeinsamer Renderer fügt genau ein Logo und eine Fußzeile ein.                                                                                                |
| Signierte Logo-URLs liefen ab                                                                    | Versand kopiert Logo als CID-Anhang in den unveränderlichen Mail-Snapshot.                                                                                     |
| PDFs wurden bislang nicht bis zum Anbieter transportiert                                         | Anhangvertrag, MIME-Aufbau und Resend-Zuordnung ergänzt; ungeeignete Anbieter scheitern sichtbar.                                                              |
| Anmeldung ohne belastbare Bestätigung bzw. SDK-Anschluss                                         | Atomare Anmelde-RPC, Tokenablauf, ausdrückliches POST, Einwilligungshistorie, API-/SDK-Anbindung.                                                              |
| Mailscanner könnten Bestätigungslinks auslösen                                                   | GET zeigt nur das Bestätigungsformular; erst POST ändert die Einwilligung.                                                                                     |
| Parallele Jobs konnten dieselbe Nachricht übernehmen                                             | Bedingtes Status-Update beansprucht eine Nachricht einmal; wiederholte Kampagnenverarbeitung ist dedupliziert.                                                 |
| Pausierte Nachrichten blockierten vordere Queue-Plätze                                           | Beim Pausieren aus der fälligen Queue genommen, beim Fortsetzen wieder eingeplant.                                                                             |
| Versandzahlen waren durch 1.000 geladene Zeilen begrenzt                                         | Serverseitige, mandantengebundene Aggregation.                                                                                                                 |
| Neue Tabellen erbten zu weitgehende Supabase-Standardrechte                                      | Explizite Grants/Revokes; Änderungen ausschließlich über Berechtigungsprüfung. Auch Installer-Journale korrigiert.                                             |
| Migrationsdokumentation nannte nicht vorhandene Triggerfunktion                                  | Tatsächliche Funktion `set_updated_at` verwendet; Beispiel korrigiert.                                                                                         |
| Bestehende Migrations-QA meldete nicht ausgeführten Fresh-Replay als PASS                        | Falschen PASS entfernt; tatsächlichen separaten Fresh-Install-Test benannt.                                                                                    |
| Unabhängiges Referenz-Upgrade scheiterte an SSL auf Loopback                                     | Nur für die bekannte lokale PostgreSQL-Instanz `sslmode=disable`; kein Remote-TLS verändert.                                                                   |
| Vorschau verwendete trotz Branding alte Shopadresse                                              | Vorschau übernimmt dieselben Branding-Links wie Versand; lokale Shopbasis `/store`.                                                                            |
| Server-Uploadtests bestanden, Browser-Upload scheiterte an RLS                                   | Fresh Pack enthielt keine `storage.objects`-Policies. Idempotente Policy-Migration ergänzt; echter Inhaber-Upload und Fremdzugriffs-Negativtests.              |
| Resource-Manifest erlaubte öffentliche Medien und ließ Limits offen                              | Kanonische Ressourcendefinition, private Buckets, MIME-/Größenlimits und tatsächliche Prüfung ergänzt.                                                         |
| QA-Logout beendete weitere Sitzungen desselben lokalen Owners                                    | QA meldet nur die eigene Sitzung ab (`scope: local`).                                                                                                          |
| Mobile Browsergrößen-Vorgabe blieb im neuen Browserlauf unwirksam                                | Mobile E-Mail-Vorschau visuell geprüft; vollständige mobile Admin-Abnahme dieses neuen Moduls noch offen.                                                      |
| Offizielle Pack-Signatur passt nach Codeänderungen nicht mehr                                    | Trust Anchor bleibt unverändert. Vollständige Entwicklungsprüfung erfolgt in isolierter Wegwerfkopie mit Testschlüssel; kein offizielles Release vorgetäuscht. |
| Lovable im In-App-Browser nicht angemeldet; Chrome-Steuerung durch Erweiterungsfenster blockiert | Nutzer um Schließen des Fensters/Entsperren gebeten. Veröffentlichung bislang nicht nachgewiesen.                                                              |

## Grenzen

Die [Masterliste](docs/agent/COMMERCE_MASTERLIST_SOURCE.md) mit 2.129 Punkten ist **nicht vollständig gebaut**. Die [Bereichsmatrix](docs/agent/COMMERCE_DELIVERY_STATUS.md) hält alle 86 Bereiche fest. Insbesondere POS, Abonnements, Marketplace, Loyalty, Enterprise-SSO und vollständige mehrstufige Marketing-Journeys sind mit diesem Stand nicht geliefert.

Weitere offene Abnahmen:

- Echte Gmail-/Outlook-/Apple-Mail-Zustellung, SPF/DKIM/DMARC, verifizierte Absender und echte Bounce-/Complaint-Ereignisse; lokal ausschließlich Testanbieter.
- Hohe Versandmengen und Wiederanlauf bei Prozessabbruch während eines externen Provider-Aufrufs. Nachrichten im Zustand `sending` benötigen bei einem solchen Absturz Prüfung; keine Exactly-once-Garantie für externe Provider behauptet.
- Newsletter aktuell eine Willkommensmail pro Kampagne/Abonnent; keine mehrstufigen Journeys, Segmente oder A/B-Tests. Versandhistorie großer Kampagnen nicht lastgetestet.
- Anhänge einschließlich Logo höchstens 5 MB und als Snapshot in der Datenbank; für hohe Volumen ist deduplizierter Blob-Speicher sinnvoll.
- PDF-Standardschriften decken lateinische Zeichen ab. Vollständige Unicode-Schriften, E-Rechnungsformate und steuerliche/rechtliche Vollabnahme sind separate Aufgaben.
- Bestehende versendete Mail-Snapshots werden nicht nachträglich verändert. Neue Gestaltung gilt für neu gerenderte Nachrichten.
- Offizieller Install-Pack-Fingerprint benötigt weiterhin Hersteller-Reintrospektion/Neusignierung. Der unabhängige lokale Vergleich ist kein Ersatz für die Releasefreigabe.

## Veröffentlichung

Verfahren und Voraussetzungen: [Release-Runbook](docs/production/COMMUNICATION_STUDIO_RELEASE.md). GitHub-Push und Lovable-Veröffentlichung sind vom Nutzer angefordert. Cloud-Umgebung, Backup und Migrationsausführung wurden bisher nicht verifiziert; daher ist keine produktive Datenbank verändert worden.

## Abschlussprüfung des Entwicklungsstands

- `bun run verify:development`: **PASS**, 317 Tests in 31 Dateien, TypeScript, Dokumentations-/Distributionsprüfungen und vollständiger Build. Isolierte Wegwerfkopie; keine Hersteller-Signatur erzeugt.
- `bun run verify`: bleibt am offiziellen Pack-Signatur-Gate blockiert; geänderte Quellen sind erwartungsgemäß nicht durch die alte Signatur gedeckt.
- Storage-Ressourcen: vier private Buckets, MIME-Allowlists und Größenlimits **PASS**.
- Lokaler E-Mail-Worker gestartet; authentifizierter Kommunikations-Job antwortet HTTP 200 ohne Fehler.
- Test-PDF-Zuordnung im Branding Studio nach Nachweis wieder entfernt; hochgeladenes Logo bleibt für die lokale Vorschau gespeichert.
- Lokaler Git-Push scheiterte an fehlender HTTPS-Anmeldung. Übertragung über die bereits verbundene GitHub-App wird verwendet; es werden keine GitHub-Zugangsdaten ausgelesen oder gespeichert.

GitHub-Ziel ist der Entwicklungsbranch `codex/local-install`. Lovable kann erst nach wieder freigegebener Browsersitzung sowie nachgewiesener Zielumgebung, Backup und Migrationsfreigabe veröffentlicht werden. Kein Go-live des gesamten Masterkatalogs behauptet.
