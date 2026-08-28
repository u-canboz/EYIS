# Commerce OS — UX/UI-Veredelung (Shell, Navigation, Kernseiten, Portal, Storefront)

Reine Präsentationsarbeit. Keine Änderung an Commerce-Logik, Server Functions, Store API, RLS,
Migrationen oder Provider-Code. Bestehende Datenabrufe und Mutationen bleiben unverändert —
geändert werden Layout, Struktur, Zustände und visuelle Sprache.

## Designrichtung (festgelegt)

- Farbwelt **Graphit & Kupfer**: neutrale Graphit-/Steinflächen als Basis, ein einziger warmer
  Kupfer-Signalakzent (#e85d3a-Familie) für Primäraktionen und aktive Zustände. Statusfarben
  (Erfolg, Warnung, Fehler, Info) getrennt vom Markenakzent, gedämpft und einheitlich.
- Typografie **Space Grotesk (Display) + DM Sans (Fließtext)** — bleibt, wird aber in eine echte
  Skala überführt (Seitentitel, Sektionstitel, Label, Wert, Meta) statt beliebiger Größen.
- Ruhige Flächen: weniger Rahmen und Karten, mehr Gruppierung durch Abstand, Trennlinien und
  Hintergrundstufen (background / surface / card). Keine Verläufe, kein Glas, keine Blobs.

## Navigation: Sidebar + Command-Palette

- Neue Navigationsstruktur nach der vorgegebenen Bereichsgliederung: Übersicht, Verkauf, Katalog,
  Lager & Versand, Kunden, Finanzen, Kommunikation, Integrationen, System, Entwickler,
  Einstellungen. Jede Gruppe kollabierbar, die Gruppe der aktiven Route ist offen, Zustand wird
  lokal gemerkt.
- Desktop: feste Sidebar mit Gruppen, deutlichem Aktiv-Zustand und dezenten Zählern, wo bereits
  Daten vorhanden sind.
- Tablet: Icon-Rail mit Tooltip; Antippen öffnet die Gruppe als Panel — kein schmaler Desktop.
- Mobil: Sheet-Navigation mit Gruppen-Akkordeon plus die bestehende Bottom-Bar für die vier
  Kernbereiche.
- Command-Palette (Strg/Cmd+K, Button in der Topbar): Sprung zu jeder Route über Suche,
  Gruppenlabels als Kontext. Rein clientseitig aus der Nav-Registry gespeist.

## App Shell

Topbar mit Breadcrumb/Kontext, Suche/Palette, Theme-Umschalter und Benutzer-Menü.
Standardisierter `PageHeader`: Titel, Kurzkontext, Status/Meta, eine Primäraktion, Sekundäres im
Overflow-Menü; mobil Primäraktion in der `StickyActionBar` mit Safe-Area.
Optionales Kontextpanel rechts auf Detailseiten (Desktop), das mobil ans Ende stapelt.

## Vereinheitlichte Muster

| Muster | Umsetzung |
| --- | --- |
| Listenansicht | `FilterBar` (Suche prominent, Filter mobil im Sheet), Tabelle in `TableScroll desktopOnly`, `RecordCardList` darunter, einheitliche Status-Badges, konsistente Zeilenaktionen |
| Detailseite | `DetailLayout` mit Kopfzone (Status, Kerndaten, Aktionen), `Panel`-Sektionen, `DataRow` für Feldwerte, `ScrollTabs` nur wo sinnvoll |
| Formular | gruppierte `Panel`-Abschnitte, Label + Hilfetext, Fehlertext am Feld, klare Primäraktion |
| Zustände | `EmptyState` mit nächster Aktion, `ListSkeleton`, `ErrorState`, `PermissionState` überall vollständig |
| Systemseiten | Health/Jobs/Status/Fehler/Demo & QA als lesbare Statusflächen mit Metrik-Kacheln und Verlaufslisten statt Rohausgaben |

## Umfang: alles in einem Durchgang

1. Design-Tokens in `src/styles.css` (Farben, Status, Elevation, Skala, Radien) neu aufsetzen.
2. Shell: `AppShell`, `AppNav`, `nav-registry`, neue Topbar, Command-Palette, `PageHeader`,
   `DetailLayout`, `Panel`, `DataRow`, `ScrollTabs`.
3. Datenbausteine: `FilterBar`, `RecordCard`, `TableScroll`, `States`, Status-Badge-Komponente.
4. Kernseiten auf die Muster umstellen: Übersicht, Bestellungen + Detail, Produkte + Editor,
   Lager, Retouren, Dokumente, Integrationen, Kommunikation, System (Health/Jobs/Status/Fehler/
   Demo & QA), Entwickler (API-Keys/Logs).
5. Restliche Backoffice-Seiten auf die gleichen Bausteine ziehen (Preise, Kategorien, Medien,
   Kunden, Versand, Steuern, Automationen, Team, Shops, Audit, Readiness).
6. Kundenportal separat veredeln: ruhiger, serviceorientiert, eigene Chrome ohne Backoffice-Optik;
   Bestellungen, Status, Tracking, Dokumente, Retouren, Adressen klar auffindbar.
7. Reference Storefront separat: verkaufsorientiert, produktdominant — Produktkarten,
   Produktdetail mit Varianten-UX, Warenkorb, Checkout, Konto.
8. Index-/Landingseite neu: eigenständiger Produktauftritt in der neuen Designsprache statt
   Phasen-Text, mit sauberer SEO-Head-Metadatenpflege.

## Mobile und Tablet

Kein Seitenüberlauf zwischen 320 und 1440 px, Touch-Ziele mindestens 44 px, Safe-Area bei allen
Sticky-Leisten, Kopfzeilen mit `grid-cols-[minmax(0,1fr)_auto]` mobil, `min-w-0` an Textcontainern,
`shrink-0` an Icons, Beträge mit `tabular-nums`, IDs/SKUs mit `break-words`.

## Nachweis

`bun run typecheck`, `bun run test`, `bun run build` (über `bun run verify`) müssen grün sein.
Zusätzlich die bestehende UI-Regressionsprüfung `qa/phase16-ui.py` erneut ausführen und die
Ergebnisse in `qa/results-phase16-ui.json` aktualisieren. Am Ende Zusammenfassung: überarbeitete
Bereiche, neue Muster, vereinheitlichte Komponenten, Geräteverhalten, verbleibender Feinschliff.

## Technische Details

- Nur `src/styles.css`, `src/components/**`, `src/routes/**` (Präsentationsteile) werden angefasst.
- `src/lib/commerce/**`, `*.server.ts`, `*.functions.ts`, `src/routes/api/**`,
  `src/integrations/supabase/**` und `supabase/migrations/**` bleiben unverändert.
- Ausschließlich semantische Tokens in Komponenten; keine Hex-Werte, kein `text-white`/`bg-black`.
- Command-Palette über `components/ui/command` (cmdk, bereits vorhanden), gespeist aus der
  Nav-Registry — keine neue Datenquelle.
- Kein `overflow-x-hidden` zur Kaschierung; Ursachen in den Komponenten beheben.
