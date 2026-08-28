# Phase 20 — UI-Redesign nach dem hochgeladenen Redesign-Pack

Grundlage: `COMMERCE_OS_UI_REDESIGN_PACK` (Master-Prompt, Design System, Navigation, Responsive Patterns, 9 Seitenspezifikationen, 8 Referenzbilder, Visual-QA-Checkliste).

Strikte Grenze wie im Pack gefordert: **nur Präsentationsschicht**. Keine Änderung an Datenmodell, Commerce-Engines, Server Functions, Store API, SDK-Contracts, RLS, Auth, Payment/Tax/Inventory-Logik. Keine neuen Features, keine Mock-Daten in der UI.

## Ausgangslage

Die Shell existiert bereits mit Sidebar (xl), Icon-Rail (md), Sheet-Drawer, Bottom-Tabs (4 + Menü) und Command Palette. Die Farbwelt ist Light-Mode „Graphit & Kupfer", Dark Mode wurde entfernt. Das Redesign verschiebt vor allem **Dichte, Komposition und mobile Eigenständigkeit**, nicht die Grundarchitektur der Shell.

## 0. Verbindliche Designregeln (Vorrang vor allen bisherigen UI-Mustern)

1. **390 px ist die primäre Designreferenz.** Desktop wird daraus intelligent erweitert, nie umgekehrt.
2. **Dashboard mit klarer Gewichtung**, keine Card-Wüste: zuerst die wichtigsten Geschäftskennzahlen, dann operative Probleme, dann Status, Bestand und Aktivitäten. Keine sechs gleichwertigen Boxen.
3. **Bestellungen, Produkte, Kunden und Lager fühlen sich wie native App-Listen an** — kompakt, scanbar, schnell antippbar, keine großen Web-Card-Blöcke.
4. **Borders und Schatten extrem sparsam.** Struktur über Typografie, Abstände, leichte Flächenunterschiede und Divider. Nicht jedes Element in einen eigenen Kasten.
5. **Orange ist Funktionsakzent**, keine Dekoration: aktive Navigation, Hauptaktionen, wichtige Highlights, ausgewählte Zustände.
6. **Bottom Navigation als permanenter nativer Bestandteil**: kompakt, stabile Höhe, Safe-Area-sicher, keine übergroßen aktiven Flächen.
7. **Mobile-Menü als OS-Menü**, kein Sidebar-Dump: Shop-Kontext, Suche, klare Gruppen, nur relevante Gruppen geöffnet, schneller Rückweg.
8. **Produkteditor und Bestelldetail sind Arbeitsoberflächen**, keine Formular-Card-Sammlungen. Informationen verdichten, Sekundäres progressiv offenlegen.
9. **Konsequente Wiederverwendung** von `RecordRow`, `MetricTile`, `SectionPanel`, `TabsBar`, `FilterBar`, `ActionMenu` und den gemeinsamen Sheet-Patterns. Keine Sonderdesigns pro Seite.
10. **Nur echte Demo-Daten** — lange Namen, Varianten, reale Statuskombinationen und große Beträge sind schon während des Designs sichtbar.
11. **Jede Seite wird sichtbar kompakter** als bisher: mehr relevante Information pro Bildschirm, ohne eng oder unruhig zu wirken.
12. **Bei Unsicherheit entscheiden die Referenzbilder** in `references/` über Proportion, Dichte und Hierarchie. Keine Mockup-Texte oder -Zahlen übernehmen.
13. **RecordRow ist Standard, nicht Dogma.** Wo eine zweizeilige native Liste besser funktioniert, wird keine unnötige Card drumherum gebaut.
14. **Mobil Divider statt einzelner weißer Rahmenkarten** — dadurch wirkt es wesentlich mehr wie eine echte App.
15. **Produkteditor und Bestelldetail: Sections dürfen visuell zusammenhängen.** Nicht jedes Formularfeld oder jede Gruppe erneut in eine eigene Box sperren.
16. **Keine doppelten Überschriften auf Mobil.** Zeigt die Topbar bereits „Produkte", folgt darunter keine große H1 „Produkte".
17. **Mobile Listen bevorzugen Divider statt Karten.** Bestellungen, Produkte, Kunden und Lager wirken wie native iOS-/Shopify-Listen, nicht wie einzelne Boxen mit Schatten.
18. **Primäraktionen nur einmal.** Kein „Neues Produkt" gleichzeitig oben, als Floating Button und unten.
19. **Dashboard maximal eine große Visualisierung** (z. B. Umsatztrend). Keine fünf Diagramme; der Rest bleibt scanbar und operativ.
20. **Bestehende Layouts werden nicht konserviert.** Widerspricht eine vorhandene Präsentationsstruktur dem Zielbild, wird sie konsequent ersetzt — Logik und Datenflüsse bleiben unverändert.



## 1. Design-Tokens (`src/styles.css`)

Werte auf die Pack-Palette abstimmen, Token-Namen bleiben stabil:
App-Hintergrund warmweiß `#F8F7F5`, Surface `#FFFFFF`, Elevated `#FCFBFA`, Text `#171717` / `#6E6B68` / `#96918D`, Border `#E8E4E0` / `#D9D4CF`, Primary warmes Orange `#F4511E`, Accent Soft `#FFF0E9`, gedämpfte Semantikfarben. Zusätzlich: Radien-Skala (Control 8–10, Record 12–14, Panel 16, Sheet 20–24), Schatten nur für Floating/Drawer/Sheet/Sticky-Nav, Dichte-Tokens für Record-Höhen 64–100 px, Typo-Skala nach Pack (Page 22–26, Section 16–18, Record 14–16, Meta 12–13, Metric 24–30).

## 2. Gemeinsame Komponenten

- `RecordRow` (neu, ersetzt großflächige `RecordCard`-Nutzung): Thumbnail/Leading, Titel + Meta, rechte Kennzahl, max. 2 Statuschips, Chevron/Overflow, Zielhöhe 78–96 px.
- `MetricTile`: kompakt, 2 Spalten mobil, optionale Sparkline und Trendwert.
- `SectionPanel`: Titel + „Alle anzeigen"-Link, dünne Border statt Schattenkarte.
- `FilterBar`: mobil Suche + Filter-Button → Bottom Sheet mit Zähler; ab Tablet inline.
- `TabsBar`: horizontal scrollbar, kompakt, Zähler-Badges, aktiver Tab orange.
- `ActionMenu`: Overflow `…` für Sekundär-/Destruktivaktionen.
- Bottom-Sheet-Variante der Dialoge auf schmalen Breiten.

## 3. Shell und Navigation

- Mobile Topbar: Menü/Back, Titel, Suche, max. eine Kontextaktion; doppelte Seitenüberschrift entfällt, wo sie nichts hinzufügt.
- Bottom Navigation bleibt Übersicht · Bestellungen · Produkte · Lager · Mehr, wird kompakter, aktiver Zustand orange, Safe Area und 44 px Touch-Ziel.
- Drawer („Mehr") als OS-artiges Menü: Identität, Shop-Switcher, globale Suche, Gruppen nach der IA des Packs (Verkauf, Katalog, Lager & Versand, Kunden, Finanzen, Kommunikation, Integrationen, System, Entwickler, Einstellungen), unten Benutzer/Rolle/Abmelden. Nur aktive Gruppe aufgeklappt.
- Desktop-Sidebar auf 232–260 px, gruppiert, einklappbar. Tablet behält Icon-Rail mit kontextueller Ausklappung.
- Die Gruppenstruktur wird in `nav-registry.ts` an die IA des Packs angeglichen; vorhandene Routen bleiben unverändert, es werden keine neuen Ziele erfunden.

## 4. Kernseiten (in dieser Reihenfolge)

1. **Dashboard** — asymmetrische Informationshierarchie statt Kacheloptik. **Dashboard-Komposition (verbindlich):** Keine sechs visuell gleichgewichteten KPI-Karten. Das Dashboard wird als operatives Cockpit aufgebaut: oben „Umsatz heute/Zeitraum" groß mit Trend/Sparkline, daneben bzw. darunter Bestellungen und Zahlungen; danach eine kompakte „Operative Aufmerksamkeit"-Liste (offene Bestellungen, Retouren, niedrige Bestände, Versandprobleme); danach Bestellstatus als kompakte Visualisierung; danach kritische Bestände; danach letzte Bestellungen/Aktivitäten. Eine oder zwei zentrale Geschäftskennzahlen erhalten klare visuelle Priorität, operative Probleme werden in einer Attention-Liste gebündelt, unterschiedliche Informationsarten sehen unterschiedlich aus — nicht alles als Card. Jedes Element führt in die gefilterte Arbeitsansicht.
2. **Bestellungen** — Inbox-Optik: Tabs mit Zählern, kompakte Records (Nummer + Kunde, Zeit + Artikelzahl, Betrag rechts, max. 2 Chips), Desktop als dichte Tabelle.
3. **Produkte** — Zeilen mit 52–64 px Bild, Name (max. 2 Zeilen), SKU, Status, Variantenzahl, Preis/Bestand rechts, Aktionen im Overflow.
4. **Lager** — Tabs Übersicht/Wareneingang/Reservierungen/Bewegungen, kleine Kennzahlen, Record mit „verfügbar" prominent und 2×2-Meta.
5. **Produktdetail** — Kopf mit Bild/Thumbnails/Status/Preis, Quick Stats, Tabs, klare Aktion „Bearbeiten".
6. **Produkteditor** — Topbar Abbrechen/Titel/Speichern, Tabs, kompakter Media-Strip, gruppierte Felder, Sticky Save nur bei Dirty State.
7. **Bestelldetail** — Operations-Workspace: Kopf mit Status/Betrag, Kunde mit Kontaktaktionen, Totals, kompakte Positionen, Timeline, eine prominente Next Action, Rest im Overflow. Bestehende Querverweise (Versand, Zahlungen, Dokumente) bleiben erhalten.

## 5. Rollout auf die übrigen Seiten

Kunden, Retouren, Dokumente, Zahlungen, Versand, Warenkörbe, Preise/Promotions, Kategorien, Kommunikation, Automationen/Aufgaben, Integrationen, System (Health/Jobs/Status/Fehler/Demo & QA), Entwickler, Team, Shops, Audit, Medien, Steuern — jeweils nach den Mustern aus `pages/09_GLOBAL_PATTERNS.md`. Portal und Storefront erhalten dieselbe Tokenbasis und Dichte, behalten aber ihre eigene ruhige bzw. produktdominante Komposition.

## 6. Abnahme

Playwright-Lauf über die vorhandene Demo-Organisation bei 320, 375, 390, 430, 768, 834, 1024, 1280, 1440 px. Geprüft: kein horizontaler Overflow, Bottom-Nav verdeckt nichts, Safe Area, Touch-Ziele ≥ 44 px, lange Namen und große Beträge, Filter-Sheet bedienbar, Tastatur verdeckt Primäraktion nicht, sinnvoll steigende Dichte auf Desktop. Ergebnis als `qa/PHASE20-UI-REPORT.md` mit Status PASS · FAIL · OFFEN · BLOCKED, Screenshots als Baselines.

Abschluss erst nach `bun run verify` (docs:validate → typecheck → test → build) grün.

## Technische Hinweise

- Betroffen: `src/styles.css`, `src/components/shell/**`, `src/components/data/**`, `src/components/ui/**` (nur Varianten), `src/routes/_authenticated/**`, `src/routes/portal/**`, `src/routes/store/**`.
- Nicht angefasst: `src/lib/commerce/**` Serverlogik, `*.server.ts`, `*.functions.ts`, `src/routes/api/**`, Migrationen, `src/integrations/supabase/**`.
- Die ESLint-Boundary für Storefront (nur `store-sdk` + `ui`) bleibt bestehen.
- Dark Mode ist entfernt und wird nicht wieder eingeführt; die Dark-Mode-Zeile der Pack-Checkliste entfällt bewusst.
- Die Referenzbilder liefern Dichte und Hierarchie; Mockup-Texte und -Zahlen werden nicht übernommen.
