# EYIS – lokaler UI/UX-Stand und Prüfbericht

Stand: 16. September 2026. Arbeitskopie `codex/local-install`, ausschließlich lokale Testdaten.

## Ergebnis und Grenze

Die bestehende Anwendung wurde direkt überarbeitet: gemeinsame Oberfläche, Navigation, Formulare, Tabellen/Karten, mobile Ansichten und zentrale Kauf-/Produktabläufe. Dies ist ein lauffähiger lokaler Entwicklungsstand. Eine vollständige Produktionsfreigabe für sämtliche Rollen, Provider und Sonderfälle ist **nicht** nachgewiesen. Die folgende Matrix trennt Sichtprüfung von funktionalen Tests.

- Backoffice: http://127.0.0.1:8080/app
- Referenzshop: http://127.0.0.1:8080/store
- Start/Stop und Installationshürden: [INSTALLATION-LOCAL.md](INSTALLATION-LOCAL.md)
- Keine Veröffentlichung, keine echten Zahlungen, keine externen Kunden- oder Produktionsdaten.

## Mobbin-Recherche und Designentscheidungen

- [Shopify Dashboard](https://mobbin.com/screens/a14400bb-6617-4890-af09-01c012c69998): tägliche Aufgaben, klare Informationshierarchie.
- [Shopify Analytics](https://mobbin.com/screens/b05d31da-98af-42f1-9d27-a833f94778f7): nachvollziehbare Kennzahlen und Zeiträume.
- [Shopify Produktanlage](https://mobbin.com/flows/9e256ffd-d5a3-4fd2-88bd-a239d491a91b) und [Produktbearbeitung](https://mobbin.com/flows/dae1edfb-b1b9-413d-a1db-1775d1ffcebb): gegliederte Formulare, Hauptbereich/Seitenleiste, Speichern/Verwerfen.
- [Spotify Navigation](https://mobbin.com/screens/4429f42c-8e9a-4084-9a2e-3887e8c92e48): stabile Orientierung und direkt erreichbare Suche.
- [Stripe Transaktionen](https://mobbin.com/screens/5aba8f78-028a-4ad6-81f1-6ca698a41451): Status, Filter und gut lesbare Geschäftsdaten.

Übernommen wurden Bedienmuster, keine fremden Markenoberflächen: helle Arbeitsfläche, zurückhaltende EYIS-Farbe, lesbare Hierarchie, 44-px-Bedienelemente, sichtbarer Tastaturfokus und mobile Karten. EYIS-Tokens bleiben im bestehenden Admin-Scope; auch Dialoge und Menüs außerhalb des DOM-Unterbaums erhalten diesen Scope. Kundeneigene Root-Datei und globale Kundentokens wurden nicht ersetzt.

## Umgesetzte Verbesserungen

- Tagesnavigation dauerhaft sichtbar; nur der präziseste Menüpunkt wird aktiviert. Mobile Überschriften, eindeutige Kontrollen, eine zentrale Navigationssuche.
- Gemeinsame PageHeader, Panel, DetailLayout, Statusanzeigen, Lade-/Leer-/Fehlerzustände; Dashboard mit priorisierten Aufgaben und Bestellungen.
- Produkt- und Bestelllisten mit Desktoptabellen, mobilen Karten, Filtern und korrekten Such-Leerzuständen.
- Produktdetail mit klarer Gruppierung; Varianten und Preise auf 320 px bedienbar. Speichern schützt bei Navigation vor Datenverlust; Tastaturbedienung für Tabs.
- Zugängliche Formularbezeichnungen, Dialogtitel, Schließen-Kontrollen und korrektes Inline-Markup für Badges.
- Lagerreservierungen auch mit geladenen Datensätzen ohne Seitenüberlauf; gemeinsame Überschriften in Lageransichten.
- Referenzshop mit echtem Shopnamen aus SDK, ehrlichen Verfügbarkeits-/Preistexten, Fehlerbehandlung und mobilem Checkout.

## Gefundene Hürden und technische Korrekturen

| Problem                                                                                                    | Lösung / Nachweis                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Einfaches Produkt bekam null Varianten und war nicht verkaufbar                                            | Server erzeugt genau eine Standardvariante; Produktwizard ruft Generator auch ohne Optionsachsen auf. Mandant vor Kinderabfragen geprüft; Regressionstests und echte Browseranlage.                                                                                                                                       |
| Neuer Automationseditor zeigte leeren Auslöser; zwei Vorlagen verwendeten nicht existierendes `order.paid` | Auf tatsächlich ausgesendetes `payment.succeeded` korrigiert. Fünf Regressionstests prüfen alle ereignisbasierten Vorlagen gegen das Register; Editor/Entwurf/Dry-Run im Browser geprüft.                                                                                                                                 |
| Leere Branding-Vorschau                                                                                    | Falschen Vorlagenschlüssel `order.confirmation` auf installierten Schlüssel `order.confirmed` korrigiert; iframe anschließend sichtbar.                                                                                                                                                                                   |
| Checkout sperrte Warenkorb ohne Bearbeitungsrückweg                                                        | Additiver API-Endpunkt `POST /checkout/:sessionId/cancel` nutzt vorhandene authentifizierte Abbruchlogik. SDK 1.2.0 ergänzt `checkout.cancel`; optionaler Cart-Status bleibt kompatibel mit älteren Antworten. UI erklärt Sperre und entsperrt über „Warenkorb bearbeiten“. Reservierungen werden vom Server freigegeben. |
| Fehler beim Ändern/Entfernen von Warenkorbpositionen unsichtbar                                            | Fehlerrückmeldung ergänzt, gesperrte Aktionen deaktiviert, Datenladefehler nicht mehr als leerer Warenkorb dargestellt.                                                                                                                                                                                                   |
| Mobile Reservierungsliste erst mit echten Daten zu breit                                                   | Toolbar umbrochen und mobile Datensatzkarten eingeführt; 375-px-Nachprüfung ohne Überlauf.                                                                                                                                                                                                                                |
| Eltern- und Unterpunkt gleichzeitig aktiv                                                                  | Längste passende Route entscheidet, Regressionstests.                                                                                                                                                                                                                                                                     |
| Mobilmenü wurde zweimal als Portal geöffnet; Schließen lag hinter der Kopfzeile                            | Eine gemeinsame Sheet-Instanz und sichtbare Schließen-Kontrolle; bei 320 px geprüft.                                                                                                                                                                                                                                      |
| Portale verloren Admin-Farben und Dialogsemantik                                                           | UI-Scope-Kontext plus zugängliche Titel und größere Schließen-Kontrollen.                                                                                                                                                                                                                                                 |
| Badge-Div innerhalb eines Absatzes verursachte Hydration-Warnung                                           | Badge rendert Inline-Span.                                                                                                                                                                                                                                                                                                |
| Frühe QA las Skeletons statt fertiger Daten                                                                | Auf Organisation und Ende des Query-Ladens warten; alle 56 Verwaltungsseiten erneut geprüft.                                                                                                                                                                                                                              |
| Shop-Link im Backoffice verletzte optionale Storefront-Grenze                                              | Bestehende interne Storefront-Testseite verlinkt. Routenprüfung erneut ausgeführt.                                                                                                                                                                                                                                        |
| Entwicklungsprüfung kopierte lokale Laufzeit und private Testzustände                                      | `.local-runtime` und `.local-state` vom temporären Prüfsnapshot ausgeschlossen.                                                                                                                                                                                                                                           |
| Hersteller-Signatur passt nach Quellcodeänderung nicht mehr                                                | Offiziellen Trust Anchor und Signatur nicht ersetzt. Entwicklungsprüfung in Wegwerfkopie mit flüchtigem Testschlüssel; keine neue Herstellerfreigabe behauptet.                                                                                                                                                           |

## Nachweise

- 56 reguläre Verwaltungsseiten: Desktop und 375 px nach Datenladen geprüft. Jeweils DOM-Messung des Seitenüberlaufs, Überschriften und Screenshots; nicht gleichbedeutend mit vollständiger Funktionsabnahme jedes Buttons.
- Acht Detailtypen: Bestellung, Produkt, Rechnung, Kommunikationsnachricht, Vorlage, Kunde, Versand und Automation mit lokalen Datensätzen geöffnet.
- Alle sieben Produkt-Tabs bei 320 px: kein horizontaler Seitenüberlauf, keine sichtbaren Fehleralarme.
- Browser: Produktanlage, Standardvariante, Preis speichern, Such-/Filterleerzustand, ungespeicherte Änderung abbremsen, weiter bearbeiten, speichern und neu laden. Auch Verwerfen/Verlassen geprüft: Der verworfene Text ist nach erneutem Öffnen nicht gespeichert.
- Browser: Testkunde angelegt, interne Notiz gespeichert und nach Neuladen bestätigt. Testbestellung als Versandauftrag angelegt, kommissioniert und verpackt; kein Carrier-Auftrag ausgelöst.
- Browser: Automationsentwurf gespeichert und Dry-Run erfolgreich; Entwurf bleibt inaktiv.
- Browser: gestartete Kasse → Warenkorb bearbeiten → Positionen wieder editierbar und erhalten.
- `qa/local-stack-smoke.ts`: 22 Prüfungen inklusive Checkout-Abbruch, fehlendem Token, Mockzahlung, Einmaltoken, Bestandsbuchung, Wartung und Mandantentrennung. Log: `.local-state/logs/design-commerce-test.log`.
- `bun run verify:development`: PASS – 307 Tests in 29 Dateien, Typecheck, Dokumentations-/Verteilungsprüfungen und Produktionsbuild in isolierter Kopie. Log: `.local-state/logs/design-verify-development.log`.
- `bun run verify`: FAIL ausschließlich am Pack-Signatur-Gate nach erfolgreichen vorgelagerten Prüfungen. Log: `.local-state/logs/design-verify.log`.
- Browser: kompletter mobiler Checkout mit Testadresse, Testversand und Mock-Zahlung bis Bestätigung `ORD-000005`, 54,80 EUR; Warenkorb anschließend leer.
- Browser: Navigationssuche → Produkte mit Enter funktioniert; Mobilmenü enthält genau einen Dialog, Schließen ist sichtbar und funktioniert.

Screenshots/JSON lokal unter `.local-state/design/`; keine Tokens oder Kundendaten in diesem Bericht. Einzelne Screenshots wurden visuell geprüft, die übrigen Seiten zusätzlich automatisiert auf DOM-/Layoutzustände. Diese Prüfung ist keine vollständige WCAG-Zertifizierung.

## Noch nicht als vollständig abgenommen

- Reale Provider, Livezahlung, echte E-Mail-Zustellung, Carrier-Labels und produktive Webhooks.
- Jede Rollen-/Rechtekombination, umfangreiche Massendaten, Lasttests, komplette Tastatur-/Screenreader-Abnahme.
- Alle Retouren-/Versand-/Automations-Sonderfälle und sämtliche dynamischen Detailzustände mit repräsentativen Daten. Insbesondere Kundenportal und Retourendetail noch nicht vollständig im Browser durchgespielt.
- Die Automationsvorlage für Warenkorberinnerungen verweist auf `cart_abandoned`; ein entsprechender System-Template-Key ist im Quellkatalog nicht nachgewiesen. Dieser Ablauf braucht eine gesonderte fachliche Abnahme vor Aktivierung.
- Herstellerseitige Neusignierung und Releasefreigabe des veränderten Codes. Vorhandene Install-Pack-Fingerprint-Grenze siehe Installationsbericht.

## Seitenmatrix

„Layout“ bedeutet geladen und auf Seitenüberlauf geprüft. „Offen“ bedeutet keine vollständige Funktionsabnahme in diesem Lauf. Die gemeinsamen Komponenten wirken auch auf diese Seiten; sie werden hier nicht pauschal als fertig getestet bezeichnet.

| Route                                         | Nachweis dieses Laufs                                     |
| --------------------------------------------- | --------------------------------------------------------- |
| `/`                                           | Gemeinsames Design; Einzelabnahme offen                   |
| `/auth`                                       | Gemeinsames Design; Einzelabnahme offen                   |
| `/entwickler`                                 | Gemeinsames Design; Einzelabnahme offen                   |
| `/invite`                                     | Gemeinsames Design; Einzelabnahme offen                   |
| `/app/login`                                  | Gemeinsames Design; Einzelabnahme offen                   |
| `/portal`                                     | Gemeinsames Design; Einzelabnahme offen                   |
| `/portal/gast`                                | Gemeinsames Design; Einzelabnahme offen                   |
| `/portal/bestellungen/$orderId`               | Einzelabnahme offen                                       |
| `/app`                                        | Desktop + mobil: Layout                                   |
| `/app/team`                                   | Desktop + mobil: Layout                                   |
| `/app/zahlungen`                              | Desktop + mobil: Layout                                   |
| `/app/audit`                                  | Desktop + mobil: Layout                                   |
| `/app/warenkoerbe`                            | Desktop + mobil: Layout                                   |
| `/app/kategorien`                             | Desktop + mobil: Layout                                   |
| `/app/shops`                                  | Desktop + mobil: Layout                                   |
| `/app/steuern`                                | Desktop + mobil: Layout                                   |
| `/app/medien`                                 | Desktop + mobil: Layout                                   |
| `/app/einstellungen/integrationen`            | Desktop + mobil: Layout                                   |
| `/app/lager/wareneingang`                     | Desktop + mobil: Layout                                   |
| `/app/lager`                                  | Desktop + mobil: Layout                                   |
| `/app/lager/bewegungen`                       | Desktop + mobil: Layout                                   |
| `/app/lager/transfers`                        | Desktop + mobil: Layout                                   |
| `/app/lager/lagerorte`                        | Desktop + mobil: Layout                                   |
| `/app/lager/reservierungen`                   | Desktop + mobil: Layout                                   |
| `/app/produkte`                               | Desktop + mobil: Layout                                   |
| `/app/produkte/$productId`                    | Geladene Detailstichprobe; siehe Nachweise                |
| `/app/produkte/neu`                           | Desktop + mobil: Layout                                   |
| `/app/bestellungen`                           | Desktop + mobil: Layout                                   |
| `/app/bestellungen/$orderId`                  | Geladene Detailstichprobe; siehe Nachweise                |
| `/app/preise`                                 | Desktop + mobil: Layout                                   |
| `/app/preise/testen`                          | Desktop + mobil: Layout                                   |
| `/app/kunden`                                 | Desktop + mobil: Layout                                   |
| `/app/kunden/$customerId`                     | Geladene Detailstichprobe und Teilablauf; siehe Nachweise |
| `/app/setup`                                  | Gemeinsames Design; Einzelabnahme offen                   |
| `/app/setup/recovery`                         | Gemeinsames Design; Einzelabnahme offen                   |
| `/app/versand`                                | Desktop + mobil: Layout                                   |
| `/app/versand/$fulfillmentId`                 | Geladene Detailstichprobe und Teilablauf; siehe Nachweise |
| `/app/versand/versandarten`                   | Desktop + mobil: Layout                                   |
| `/app/versand/dienstleister`                  | Desktop + mobil: Layout                                   |
| `/app/entwickler`                             | Desktop + mobil: Layout                                   |
| `/app/entwickler/protokoll`                   | Desktop + mobil: Layout                                   |
| `/app/entwickler/feeds`                       | Desktop + mobil: Layout                                   |
| `/app/entwickler/api`                         | Desktop + mobil: Layout                                   |
| `/app/dokumente/$invoiceId`                   | Geladene Detailstichprobe; siehe Nachweise                |
| `/app/dokumente`                              | Desktop + mobil: Layout                                   |
| `/app/dokumente/einstellungen`                | Desktop + mobil: Layout                                   |
| `/app/system/demo-daten`                      | Desktop + mobil: Layout                                   |
| `/app/system/health`                          | Desktop + mobil: Layout                                   |
| `/app/system/errors`                          | Desktop + mobil: Layout                                   |
| `/app/system/release-readiness`               | Desktop + mobil: Layout                                   |
| `/app/system/updates-einrichtung`             | Desktop + mobil: Layout                                   |
| `/app/system/jobs`                            | Desktop + mobil: Layout                                   |
| `/app/system/status`                          | Desktop + mobil: Layout                                   |
| `/app/system/updates`                         | Desktop + mobil: Layout                                   |
| `/app/system/storefront-test`                 | Desktop + mobil: Layout                                   |
| `/app/system/einrichtung`                     | Desktop + mobil: Layout                                   |
| `/app/automationen/webhooks`                  | Desktop + mobil: Layout                                   |
| `/app/automationen`                           | Desktop + mobil: Layout                                   |
| `/app/automationen/aufgaben`                  | Desktop + mobil: Layout                                   |
| `/app/automationen/verlauf`                   | Desktop + mobil: Layout                                   |
| `/app/automationen/regel/$ruleId`             | Geladene Detailstichprobe und Teilablauf; siehe Nachweise |
| `/app/retouren`                               | Desktop + mobil: Layout                                   |
| `/app/retouren/einstellungen`                 | Desktop + mobil: Layout                                   |
| `/app/retouren/$returnId`                     | Einzelabnahme offen                                       |
| `/app/marketing/branding`                     | Desktop + mobil: Layout                                   |
| `/app/marketing/inhalte`                      | Desktop + mobil: Layout                                   |
| `/app/marketing/promotions`                   | Desktop + mobil: Layout                                   |
| `/app/marketing/google-shopping`              | Desktop + mobil: Layout                                   |
| `/app/kommunikation`                          | Desktop + mobil: Layout                                   |
| `/app/kommunikation/branding`                 | Desktop + mobil: Layout                                   |
| `/app/kommunikation/regeln`                   | Desktop + mobil: Layout                                   |
| `/app/kommunikation/verlauf`                  | Desktop + mobil: Layout                                   |
| `/app/kommunikation/verlauf/$communicationId` | Geladene Detailstichprobe; siehe Nachweise                |
| `/app/kommunikation/vorlagen`                 | Desktop + mobil: Layout                                   |
| `/app/kommunikation/vorlagen/$templateId`     | Geladene Detailstichprobe; siehe Nachweise                |
| `/store`                                      | Mobile Browserprüfung und Kaufablauf; siehe Nachweise     |
| `/store/checkout`                             | Mobile Browserprüfung und Kaufablauf; siehe Nachweise     |
| `/store/warenkorb`                            | Mobile Browserprüfung und Kaufablauf; siehe Nachweise     |
| `/store/produkt/$handle`                      | Mobile Browserprüfung und Kaufablauf; siehe Nachweise     |
| `/store/konto`                                | Gemeinsames Design; Einzelabnahme offen                   |
| `/store/bestaetigung`                         | Mobile Browserprüfung und Kaufablauf; siehe Nachweise     |

## Nachfolgender Ausbau am 17.09.2026

Storefront-Inhalte/-Branding wurden auf ausdrücklichen Wunsch aus dem Backoffice entfernt. Rechnungen, Branding Studio, gemeinsame Mailgestaltung und Newsletter Studio sind im [aktuellen Prüfbericht](COMMUNICATION-STUDIO-LOCAL.md) dokumentiert. Die ursprüngliche Seitenmatrix oben beschreibt den früheren Prüfstand.
