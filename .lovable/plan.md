# Standardvorlage, pflegbare Inhalte, Katalogfilter und Google Shopping

Vier Arbeitsstränge in einem Durchgang. Der Feature-Freeze für V1 ist dafür ausdrücklich
aufgehoben; der Blackbox-Installationstest läuft danach gegen den neuen Stand.

Grundlage: die hochgeladenen Dokumente (`docs/theme/*`) und das Projekt „EYIS Storefront“,
aus dem die Vorlage übernommen wird.

---

## 1. Standard-Theme als mitgelieferte Vorlage

Der Shop aus dem externen Projekt wird zur neutralen Standardvorlage. Neutral heißt:
kein „Sunnah“, keine Dattel-Motive, keine Beispielbewertungen im Auslieferungsstand —
Marke, Farben, Schrift, Texte und Bilder kommen aus austauschbaren Inhaltsdateien.

Ablage: `templates/storefront-standard/` — eine eigene, versionierte Einheit neben
`templates/customer-repo/`. Nicht als `integration_patch`, damit Kundenanpassungen bei
Updates nie überschrieben werden.

Übernommen werden:

- Seiten: Start, Sortiment, Suche, Kategorie, Kollektion, Produkt, Warenkorb, Kasse,
  Bestätigung, Konto, Gastbestellung, Retouren, Kontakt, Über uns, Versand, FAQ,
  Newsletter-Bestätigung sowie die fünf Rechtsseiten als Platzhalter
- Bausteine: `components/store/**`, `components/home/**`, `StoreChrome`
- Hilfsmodule: `lib/storefront/**` (Verbindung, Filter, Suche, Beträge, zuletzt gesehen)
- Inhalte: aus `content/sunnah.ts` und `content/conversion.ts` wird ein neutrales
  `content/shop.ts` + `content/conversion.ts` mit generischen Beispieldaten
- Gestaltung: der `.storefront`-begrenzte Teil von `src/styles.css`, Farben und Schriften
  als Token an einer Stelle
- E-Mail-Design: `lib/email-templates/**` inkl. Vorschauseite

Neutralisierung im Detail:

- Markenname, Anschrift, Navigation, Fußzeile, Bühnentexte nur noch in der Inhaltsdatei
- Bilder: neutrale, generierte Motive in gleicher Bildsprache und mit gleichen Dateinamen,
  damit ein Austausch pro Kunde ein reines Ersetzen ist
- Der Bewertungsbereich ist im Auslieferungsstand **abgeschaltet** und wird erst durch die
  echte Bewertungsschnittstelle sichtbar — keine erfundenen Stimmen (Punkt B4 der Wunschliste)
- Grenze zum Backoffice bleibt unangetastet: `isEyisInternalRoute`, `.storefront` gegen
  `.eyis-admin`, `__root.tsx` und `src/styles.css` nur additiv

Verteilung und Nachweis:

- Aufnahme in `installer/distribution/eyis-code-distribution.manifest.json` als eigene Kategorie
- `docs/agent/NEW_STOREFRONT_RUNBOOK.md`: die Vorlage ist der Startpunkt, nicht das leere Projekt
- Neue Prüfung im Auslieferungstest: Vorlage baut, Kaufweg Produkt → Warenkorb → Kasse klickbar

---

## 2. Pflegbare Storefront-Inhalte (B5/B6)

Heute liegen Ankündigungsband, Vertrauenspunkte, Zahlungshinweise, Produkt-FAQ,
Newsletter-Einblendung, Startseitentexte und Rechtstexte fest im Theme. Sie ziehen in die Engine.

- Neue Tabellen für Inhaltsblöcke und Rechtsseiten je Shop, mandantengetrennt, mit Rechten,
  RLS und Regeln in einer Migration
- Backoffice: neuer Bereich „Storefront-Inhalte“ mit Blöcken und Rechtstexten, Entwurf/veröffentlicht
- Store API v1 additiv: `GET /content/blocks` und `GET /content/pages/{handle}` — öffentlich lesbar
- Die Vorlage liest diese Inhalte und nutzt die Datei nur noch als Rückfallebene

---

## 3. Katalog-Schnittstellen B1–B3

Serverseitig in `catalog-public.server.ts` und der Routentabelle, additiv:

- `sort=price_asc` / `price_desc` auf Basis des effektiven Verkaufspreises inklusive Varianten-Minimum
- `price_min` / `price_max` und `availability=in_stock` als echte Serverfilter
- Suche über Titel, Untertitel, Marke, Produktart und Kategoriename, dazu eine je Shop
  pflegbare Synonymtabelle mit Backoffice-Pflege
- Danach entfallen in der Vorlage die Behelfe: das lokale Nachsortieren, das Laden von
  200 Artikeln und die mitgelieferte Synonymliste

---

## 4. Google Shopping

Zwei Wege, beide gebaut — Feed zuerst, direkte Anbindung darauf aufgesetzt.

**Weg A — Produktdatenquelle zum Abholen.** Öffentliche Adresse je Shop, die den Katalog als
XML im RSS-2.0-Format von Google ausliefert [2](https://support.google.com/merchants/answer/14987622?hl=en):
Artikelnummer, Titel, Beschreibung, Link, Bild, Verfügbarkeit, Preis inklusive Steuer, Marke,
GTIN/MPN, Zustand, Versand, Produktkategorie, Varianten über Elterngruppe. Alle Werte kommen
vom Server; nichts wird im Feed nachgerechnet. Zugriff über einen eigenen, widerrufbaren
Feed-Schlüssel, nicht über den Publishable Key.

**Weg B — direkte Anbindung.** Anbindung an die Merchant API mit Google-Konto: Produkte werden
nach Änderung gezielt eingespielt statt auf den nächsten Abholtermin zu warten
[1](https://developers.google.com/merchant/api/guides/products/add-manage)
[4](https://developers.google.com/merchant/api/reference/rest/products_v1/accounts.productInputs/insert).
Anmeldung über den bestehenden OAuth-Weg (`oauth_states`), Zugangsdaten nur als Referenz,
niemals als Klartext in einer Tabelle. Ein Hintergrundlauf schiebt Änderungen und Löschungen nach
und schreibt je Produkt Ergebnis und Google-Meldung mit.

**Backoffice.** Neue Kachel im Integration Center: Feed-Adresse mit Kopierknopf, Pflichtfelder-Prüfung
(„17 Produkte ohne Bild, 4 ohne Marke“), Google-Konto verbinden/trennen, letzter Abgleich,
Fehler im Klartext. Ohne Verbindung bleibt der Weg ehrlich als „nicht verbunden“ stehen.

**Produktpflege.** Die für Google nötigen Felder (Marke, GTIN, MPN, Zustand, Google-Produktkategorie,
Altersgruppe, Geschlecht, Größe, Farbe, „bei Google ausschließen“) werden an Produkt und Variante
ergänzt und im Backoffice pflegbar.

---

## Technische Hinweise

- Datenbank: je eine Migration für Inhaltsblöcke/Rechtsseiten, Suchsynonyme, Google-Felder und
  Feed-/Google-Verbindung. Reihenfolge immer `CREATE TABLE` → `GRANT` → `ENABLE RLS` → `CREATE POLICY`.
- Neue Enum-Kategorie für Integrationen (heute nur Zahlung, E-Mail, Carrier).
- Feed und Google-Lauf als TanStack-Serverroute unter `src/routes/api/public/` bzw. als Job mit
  `authenticateCronRequest`; keine neuen Edge Functions.
- Store API v1 bleibt stabil: alle Ergänzungen sind additiv, keine geänderten Antworten.
- Nach jedem Baustein: Baseline neu erzeugen (`eyis:database:forward-port`, `sync-check`),
  Systemdaten neu erzeugen, Pack neu signieren, `bun run verify` grün.

## Reihenfolge der Umsetzung

1. Vorlage übernehmen, neutralisieren, verpacken und in die Auslieferung aufnehmen
2. Katalog-Schnittstellen B1–B3, danach Behelfe in der Vorlage abräumen
3. Pflegbare Inhalte und Rechtstexte inklusive Backoffice
4. Google: Produktfelder, Feed, dann direkte Anbindung
5. Abschluss: alle Gates, danach der Blackbox-Installationstest gegen den neuen Stand

## Bewusst nicht in diesem Durchgang

Bewertungsschnittstelle (B4), Lieferzeitprognose (B7), Produktbilder im Backoffice (A1),
Systemübersicht (A2), Einrichtungsfortschritt (A3), Portalpunkte C1–C6. Sie bleiben in der
Wunschliste geführt.
