# Phase 16 — UX/UI- und Mobile-Redesign (Planung)

Grundlage: Befunde U1–U10 aus `qa/PHASE15-DEMO-REPORT.md`, geprüft an der befüllten Demo-Organisation.
Strikte Grenze: **nur Präsentationsschicht**. Keine Änderung an Backend, Server-Funktionen, Commerce-Logik, Store-API, RLS, Policies, Migrationen oder Sicherheits-Middleware. Kein Datenmodell, keine neuen Features.

## 16.0 Verbindliche Grundregeln

1. **Token-Namen bleiben, Werte werden neu abgestimmt.** Die semantischen Namen (`--background`, `--primary`, `--surface`, `--signal`, Sidebar-Tokens …) bleiben stabil, damit bestehende Komponenten weiter funktionieren. Farbwerte, Typo-Skala, Radien, Abstände, Elevation und Komponentenproportionen werden vollständig neu entworfen. Nichts bleibt bestehen, nur weil es bereits vorhanden ist.
2. **Kein kaschierender Overflow.** Globales `overflow-x-hidden` ist verboten. Jede Überlaufursache wird an der verursachenden Komponente behoben (`min-w-0`, `truncate`, Grid statt starrer Flex-Zeile, keine festen Breiten). Verstecktes bzw. gescrolltes Overflow ist nur in ausdrücklich dafür gebauten Komponenten zulässig (Scrollcontainer, Karussell, Tab-Leiste).
3. **Mobil = Karten, nicht Tabellen.** Datenansichten werden auf schmalen Breiten als Record Cards oder strukturierte Listen umgesetzt. Horizontal scrollbare Tabellen sind begründete Ausnahmen (z. B. Bestandsmatrix) und werden je Seite dokumentiert. Der Umschaltpunkt Karte↔Tabelle wird pro Seite nach Informationsdichte gewählt, nicht pauschal bei `md`.
4. **Drei getrennte Experience-Richtungen** (siehe 16.2).
5. **Alle Zustände sind Teil der Abnahme** (siehe 16.7).

## 16.1 Designsystem-Neuabstimmung

- Neu festgelegt in `src/styles.css`: Farbwerte (oklch, Light/Dark), Typo-Skala mit fluid clamp, Radien-Skala, Spacing-/Dichte-Tokens, Elevation-Set (Karten, Popover, Sticky-Bars), Fokus-Ring.
- Ergänzt: `--content-max`, Dichte-Tokens (`compact`/`comfortable`), Touch-Zielgröße min. 44 px, Safe-Area-Insets, dynamische Viewport-Höhen (`100dvh`, `svh`).
- Regeln: keine harten Farbklassen, jede Fläche über semantische Tokens, Kontrast AA in Light und Dark, sichtbarer Fokus überall.
- Breakpoint-Vertrag: base 320–639 (Mobil), `sm` 640, `md` 768 (eigener Tablet-Zweig statt Desktop-Fallback), `lg` 1024, `xl` 1280+.

## 16.2 Drei Experience-Richtungen

Gemeinsam: Tokens, Typo, Fokus-/Kontrast-/Touch-Regeln, Statuslogik.
Unterschiedlich: Seitenkomposition, Dichte, Navigation, Rhythmus.

- **Backoffice** (`/app/**`): operativ, kompakt, aufgabenorientiert. Dichte Listen, Filter, Massenaktionen, Tastaturpfade, Sidebar + Topbar.
- **Kundenportal** (`/portal/**`): ruhig, status- und serviceorientiert. Große Statusanzeigen, Timeline, wenige klare Aktionen, viel Weißraum, keine Sidebar.
- **Reference Storefront** (`/store/**`): produktdominant, conversion-orientiert. Bild zuerst, klare Preis-/CTA-Hierarchie, sticky Kaufaktion mobil, minimale Chrome.

## 16.3 App-Shell (U1, U3)

- Neue Komponenten unter `src/components/shell/`: `AppShell`, `AppSidebar`, `AppTopbar`, `PageHeader`, `DemoBanner`.
- `src/routes/_authenticated/route.tsx` wird auf die Shell umgestellt; Auth-Guard, Workspace-Query, Org-Auswahl und Sign-out bleiben funktional unverändert.
- Kein globales Overflow-Hidden: Shell arbeitet mit `min-w-0`-Ketten und einem definierten Content-Container.
- `PageHeader` als Standard (Titel, Kontext, Aktionen); mobil Primäraktion in sticky Bottom-Bar, Rest im Overflow-Menü.
- Demo-Banner (U3) mehrzeilig, umbruchfähig, eigene Zeile über dem Content.

## 16.4 Mobile-Navigation (U2, U8)

- Topbar mit Menü-Button, Navigation in einem `Sheet` mit vollständiger, gruppierter und scrollbarer Struktur aller 20+ Bereiche (Katalog, Verkauf, Kunden, Logistik, Finanzen, Kommunikation, System, Entwickler) aus einer zentralen Registry.
- Optional Bottom-Tabs mit 4–5 Kernbereichen (Übersicht, Bestellungen, Produkte, Lager, Menü).
- Sticky-Elemente (U7-Regel): `padding-bottom: env(safe-area-inset-bottom)`, Höhen über `dvh`, Content-Padding entsprechend der Bar-Höhe, damit nichts verdeckt wird; bei geöffneter mobiler Tastatur bleibt die Primäraktion erreichbar.

## 16.5 Responsive Datenkomponenten (U4, U5, U6, U10)

- `RecordList`: mobil Karten (Primärzeile, 2–4 Sekundärfelder, Status-Badges, Chevron), darüber Tabelle. Umschaltpunkt pro Seite konfigurierbar.
- `DataTable`: nur wo Tabellen nötig sind — eigener Scrollcontainer, sticky erste Spalte, `truncate`, `tabular-nums`, SKU-sicheres Umbruchverhalten (kein buchstabenweiser Umbruch).
- `FilterBar`: ab Tablet inline, mobil Suchfeld + „Filter“-Sheet mit Zähler aktiver Filter.
- Detailseiten: zwei Spalten ab `lg`, darunter gestapelt; Tabs horizontal scrollbar mit Scroll-Indikator.
- U10 (enge Bestelltabelle bei langen Gast-E-Mails auf 1440 px) wird im Zuge der Bestellliste mit behoben; der Befund existiert im QA-Bericht als Schwere „niedrig“.

## 16.6 Referenzansichten (Qualitätsstandard)

Zuerst gebaut und abgenommen, danach Rollout aller weiteren Seiten nach diesem Standard:

1. App-Shell + Mobile-Navigation
2. Dashboard / Übersicht
3. Bestellliste + Bestelldetail
4. Produktliste + Produkteditor
5. Kundenportal-Bestelldetail
6. Storefront-Produktseite

## 16.7 Zustandsmatrix

Jede Referenzansicht und jede P0/P1-Seite wird in diesen Zuständen geprüft:
realistisch befüllt · sehr lange Namen und SKUs · große Geldbeträge · viele Status-Badges · leer · Loading (Skeleton) · Error · eingeschränkte Berechtigung (`can()` false) · Demo-Modus mit Banner · Sticky Actions bei geöffneter mobiler Tastatur.

## 16.8 Seitenprioritäten

- **P0**: Shell + Navigation, Übersicht, Bestellungen (Liste/Detail), Produkte (Liste/Editor), Kunden, Lager.
- **P1**: Kundenportal (Übersicht, Bestelldetail, Gastzugang), Storefront (Katalog, Produktseite, Warenkorb, Checkout, Bestätigung), Zahlungen, Retouren, Dokumente, Versand.
- **P2**: Preise/Promotions, Kategorien, Warenkörbe, Kommunikation, Automationen/Aufgaben, System (Health, Jobs, Status, Fehler, Demo & QA — U8), Entwickler, Team, Shops, Audit, Medien, Steuern.
- U9 (Storefront verlangt Publishable Key) wird als Präsentations-Fix gelöst: vorbelegter Key über bestehende Env-/Query-Auflösung plus verständlicher Leerzustand, ohne API-Änderung.

## 16.9 Viewport-Testmatrix und visuelle Baselines

Breiten: 320, 375, 390, 430, 768, 834, 1024, 1280, 1440 px; zusätzlich 375 px Querformat.
Je Seite geprüft: `scrollWidth <= clientWidth`, Touch-Ziele ≥ 44 px, keine buchstabenweisen Umbrüche, Navigation erreichbar, Primäraktion sichtbar und nicht verdeckt, Fokus-/Tastaturpfad, Light und Dark.
Umsetzung als Playwright-Harness `qa/phase16-ui.ts`; Screenshots werden als **visuelle Baselines** unter `qa/baselines/<seite>_<breite>_<theme>.png` abgelegt und bei jedem Lauf gegen die Baseline verglichen. Regressionen bei U1–U10 lassen den Lauf fehlschlagen.
Ergebnis in `qa/PHASE16-UI-REPORT.md`; Status ausschließlich PASS · FAIL · OFFEN · BLOCKED. Abnahme: U1–U10 auf PASS, Phase-15-Harness (44/44) und Gate-A-Regression unverändert grün, Kundenportal und Storefront Teil der finalen mobilen Abnahme.

## Technische Hinweise

- Nur betroffen: `src/routes/_authenticated/**` (Präsentation), `src/routes/store/**`, `src/routes/portal/**`, `src/components/**`, `src/styles.css`.
- Nicht angefasst: `src/lib/commerce/**` Serverlogik, `*.server.ts`, `*.functions.ts`, `src/routes/api/**`, Migrationen, `src/integrations/supabase/**`.
- Die Boundary-Regel in `eslint.config.js` (Storefront darf nur `store-sdk` + `ui` importieren) bleibt bestehen; Storefront bekommt eigene Präsentationskomponenten innerhalb der erlaubten Grenzen.
- Etappen: 16.1 Designsystem → 16.3/16.4 Shell + Navigation → 16.6 Referenzansichten → Abnahme → P0 → P1 → P2, jeweils mit Testmatrix-Lauf und Baseline-Aktualisierung.
