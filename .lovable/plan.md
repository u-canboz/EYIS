# Phase 16 — UX/UI- und Mobile-Redesign (Planung)

Grundlage: Befunde U1–U9 aus `qa/PHASE15-DEMO-REPORT.md`, geprüft an der befüllten Demo-Organisation.
Strikte Grenze: **nur Präsentationsschicht**. Keine Änderung an Backend, Server-Funktionen, Commerce-Logik, Store-API, RLS, Policies, Migrationen oder Sicherheits-Middleware. Kein Datenmodell, keine neuen Features.

## 16.1 Designsystem-Härtung

- Tokens in `src/styles.css` bleiben Quelle der Wahrheit (oklch, `--surface`, `--signal`, Sidebar-Tokens, DM Sans / Space Grotesk). Ergänzt werden nur: Content-Breiten (`--content-max`), Touch-Zielgröße (min. 44 px), Tabellen-/Karten-Dichte-Tokens, Safe-Area-Insets für iOS.
- Verbindliche Regeln: keine harten Farbklassen, jede neue Fläche über semantische Tokens, Light/Dark-Kontrast geprüft.
- Breakpoint-Vertrag: `base` 320–639 (Mobil), `sm` 640, `md` 768 (Tablet, eigener Zweig statt Desktop-Fallback), `lg` 1024, `xl` 1280+.

## 16.2 App-Shell

- Neue Shell-Komponenten unter `src/components/shell/`: `AppShell`, `AppSidebar` (auf Basis der vorhandenen `ui/sidebar`), `AppTopbar`, `PageHeader`, `DemoBanner`.
- `src/routes/_authenticated/route.tsx` wird auf diese Shell umgestellt; Auth-Guard, Workspace-Query, Org-Auswahl und Sign-out bleiben funktional unverändert.
- Layout-Container mit `min-w-0` + `overflow-x-hidden` auf Shell-Ebene, damit U1 (horizontaler Seiten-Scroll, 2690 px bei 375 px) strukturell nicht mehr auftreten kann.
- `PageHeader` als Standard: Titel, Kontext, Aktionen; Aktionsleiste auf Mobil als sticky Bottom-Bar oder Overflow-Menü statt Nebeneinander.

## 16.3 Mobile-Navigation (U2, U8)

- Ersetzt die einzeilige Linkleiste: Topbar mit Menü-Button, Navigation in einem `Sheet` (Drawer) mit vollständiger, gruppierter Struktur aller 20+ Bereiche.
- Navigation wird zu einer strukturierten Registry (Gruppen: Katalog, Verkauf, Kunden, Logistik, Finanzen, Kommunikation, System, Entwickler) — dieselben Ziele wie heute, nur gruppiert und scrollbar.
- Optional zusätzlich: Bottom-Tab-Leiste mit 4–5 Kernbereichen (Übersicht, Bestellungen, Produkte, Lager, Menü).
- Demo-Banner (U3) wird umbruchfähig, mehrzeilig, mit eigener Zeile über dem Content statt beschnitten.

## 16.4 Responsive Datenkomponenten (U4, U5, U6, U10)

- `DataTable`-Wrapper: horizontaler Scrollcontainer mit `min-w-0`, sticky erste Spalte, `truncate` + `tabular-nums`, `break-normal` für SKUs.
- `RecordList`: ab `md` Tabelle, darunter automatisch Kartenansicht (Primärzeile, 2–4 Sekundärfelder, Status-Badges, Chevron in die Detailansicht).
- `FilterBar`: ab `md` inline, darunter Suchfeld + Button „Filter" mit Sheet und Zähler aktiver Filter.
- Detailseiten: Zwei-Spalten-Layout ab `lg`, darunter gestapelt; Tabs scrollbar.

## 16.5 Seitenprioritäten

- **P0**: Shell + Navigation, Bestellungen (Liste/Detail), Produkte (Liste/Detail), Kunden, Lager (inkl. Unterseiten), Übersicht.
- **P1**: Zahlungen, Retouren, Dokumente, Versand, Preise/Promotions, Kategorien, Warenkörbe.
- **P2**: Kommunikation, Automationen/Aufgaben, System (Health, Jobs, Status, Fehler, Demo & QA — U8), Entwickler, Team, Shops, Audit, Medien, Steuern.
- **P3**: Referenz-Storefront (`/store`) und Kundenportal (`/portal`) — mobile Politur; zu U9 nur ein Präsentations-Fix: vorbelegter Publishable Key über bestehende Env/Query-Auflösung plus verständlicher Leerzustand, ohne API-Änderung.

## 16.6 Viewport-Testmatrix

Breiten: 320, 375, 390, 430, 768, 834, 1024, 1280, 1440 px; zusätzlich 375 px im Querformat.
Je Seite geprüft: kein horizontaler Überlauf (`scrollWidth <= clientWidth`), Touch-Ziele ≥ 44 px, Text lesbar (kein buchstabenweiser Umbruch), Navigation erreichbar, Primäraktion im Viewport, Fokus-/Tastaturpfad, Light- und Dark-Mode.
Umsetzung als Playwright-Skript `qa/phase16-ui.ts` mit Screenshots je Seite/Breite, Ergebnis in `qa/PHASE16-UI-REPORT.md`; Status ausschließlich PASS · FAIL · OFFEN · BLOCKED. Abnahmekriterium: U1–U9 auf PASS, Phase-15-Harness (44/44) und Gate-A-Regression unverändert grün.

## Technische Hinweise

- Nur betroffen: `src/routes/_authenticated/**` (Präsentation), `src/routes/store/**`, `src/routes/portal/**`, `src/components/**`, `src/styles.css`.
- Nicht angefasst: `src/lib/commerce/**` Serverlogik, `*.server.ts`, `*.functions.ts`, `src/routes/api/**`, Migrationen, `src/integrations/supabase/**`.
- Die Boundary-Regel in `eslint.config.js` (Storefront darf nur `store-sdk` + `ui` importieren) bleibt bestehen; neue Shell-Komponenten liegen außerhalb des Storefront-Subtrees.
- Umsetzung in Etappen: 16.1/16.2/16.3 → Abnahme, dann P0, dann P1, dann P2/P3, jeweils mit Testmatrix-Lauf.
