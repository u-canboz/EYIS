# Phase 20 — UI-Redesign (Backoffice-Oberfläche)

Umfang: ausschließlich Präsentationsschicht. Keine Änderung an Commerce-Logik, Server Functions,
Store API, RLS, Datenbank oder Sicherheitsgrenzen.

## Ergebnis

| Prüfpunkt | Status | Nachweis |
| --- | --- | --- |
| `bun run verify` (docs:validate → typecheck → test → build) | PASS | Lauf ohne Fehler, Client- und Server-Build erzeugt |
| TypeScript (`tsgo --noEmit`) | PASS | keine Ausgabe |
| Keine Commerce-/API-/RLS-Änderung | PASS | Änderungen nur in `src/components/**` und `src/routes/_authenticated/app/**` (Presentation) |
| Nur echte Demo-Daten | PASS | alle Ansichten lesen weiterhin über die bestehenden Server Functions |

## Umgesetzte Regeln

| Regel | Umsetzung | Status |
| --- | --- | --- |
| 1 — 390 px als Referenz | Alle neuen Bausteine sind mobile-first, Raster `grid-cols-[minmax(0,1fr)_auto]`, `min-w-0`, `truncate` | PASS |
| 2 — Dashboard-Gewichtung | Umsatz (groß) → Bestellungen/Zahlungen → Aufmerksamkeit → Bestellstatus → Bestände → Aktivitäten | PASS |
| 3 — native App-Listen | Bestellungen, Produkte, Kunden, Lager nutzen `RecordRow`/`RecordList` | PASS |
| 4 — sparsame Borders/Schatten | Panels ohne Schatten, eine Haarlinie; Elevation nur für Overlays | PASS |
| 5 — Orange als Funktionsakzent | aktive Tabs, aktive Navigation, Primäraktionen, Sparkline | PASS |
| 6 — permanente Bottom Navigation | unverändert stabil, 4 Bereiche + Menü | PASS |
| 7 — Mobile-Menü als OS-Menü | Sheet mit Shop-Kontext, Suche und Gruppen | PASS |
| 8 — Detail/Editor als Arbeitsfläche | `Panel` verbindet Sections auf Mobil randlos, Lager-/Produktaktionen im `ActionMenu` | PASS |
| 9 — Wiederverwendung | `RecordRow`, `SectionPanel`, `TabsBar`, `FilterBar`, `ActionMenu`, `LeadMetric`/`SubMetric` | PASS |
| 10 — echte Demo-Daten | keine Platzhalterwerte im UI | PASS |
| 11 — sichtbar kompakter | Tabellen-Duplikate entfernt, Kartenstapel durch Divider-Listen ersetzt | PASS |
| 12 — Referenzbilder priorisiert | Komposition nach Redesign-Pack, keine Mockup-Texte übernommen | PASS |
| 13 — RecordRow nicht dogmatisch | Dashboard-Kacheln, Verteilungs-Balken und Aufmerksamkeitsliste bleiben eigenständig | PASS |
| 14 / 17 — Divider statt Karten | `RecordList` mit `divide-y`, Panels randlos auf Mobil | PASS |
| 15 — verbundene Sections | `Panel` und `SectionPanel` teilen dieselbe randlose Mobil-Darstellung | PASS |
| 16 — keine doppelten Überschriften | `PageHeader` blendet den Titel auf Mobil aus, wenn die Topbar denselben Label zeigt (h1 bleibt für Screenreader) | PASS |
| 18 — Primäraktionen einmalig | Sekundäres und Destruktives ausschließlich im `ActionMenu` | PASS |
| 19 — max. eine große Visualisierung | genau eine Sparkline im Umsatzblock; Bestellstatus als schmaler Balken | PASS |
| 20 — keine Konservierung | Produkt-, Bestell-, Kunden- und Lagertabellen wurden ersetzt statt erhalten | PASS |

## Neue Bausteine

- `src/eyis/data/RecordRow.tsx` — `RecordList`, `RecordRow`, `RecordThumb`
- `src/eyis/data/SectionPanel.tsx` — `SectionPanel`, `SectionLink`
- `src/eyis/data/TabsBar.tsx` — Segment-Leiste mit Zählern
- `src/eyis/data/ActionMenu.tsx` — Overflow-Menü für Sekundäraktionen
- `src/eyis/data/Metrics.tsx` — `LeadMetric`, `SubMetric`, `Sparkline`, `AttentionList`, `DistributionBar`

## Überarbeitete Seiten

- `/app` — Cockpit mit asymmetrischer Hierarchie
- `/app/bestellungen` — Inbox mit Segmenten (Alle, Offen, Unbezahlt, Zu versenden, Erledigt)
- `/app/produkte` — dichte Liste mit Thumbnail und Aktionsmenü
- `/app/kunden` — Segmentleiste plus dichte Liste
- `/app/lager` — Statussegmente, Kennzahlraster je Zeile, Buchungen im Aktionsmenü

## Offen

| Punkt | Status | Grund |
| --- | --- | --- |
| Screenreader-Abnahme der neuen Listen | OFFEN | manuelle Abnahme, nicht automatisierbar |
| Pixelgenauer Abgleich mit allen Referenzbildern | OFFEN | visuelle Abnahme durch Owner erforderlich |
| Redesign von Portal, Storefront und Landingpage | OFFEN | Phase 20 umfasst das Backoffice |
