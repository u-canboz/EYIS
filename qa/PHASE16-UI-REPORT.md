# Phase 16 — UX/UI- und Mobile-Redesign: Abschlussbericht

Datum: automatisch erzeugt beim letzten Harness-Lauf
Harness: `qa/phase16-ui.py` (Playwright), Runner `bun qa/phase16-ui.ts`
Rohdaten: `qa/results-phase16-ui.json`
Datenbasis: Demo-Organisation "Commerce OS Demo" (`5eebb5ba-0a22-4a34-9c28-5dfab7d48924`), realistisch befüllt (32 Produkte, 12 Kunden, 40 Checkouts)

## Gesamtergebnis

**11/11 PASS**

| ID | Prüfung | Status | Nachweis |
| --- | --- | --- | --- |
| — | Auth-Session für Backoffice-Prüfung verfügbar | PASS | Session injiziert, Demo-Org aktiv |
| U1 | Kein horizontaler Seitenüberlauf (320–1440 px + 375 px Querformat) | PASS | `overflow = 0` auf allen geprüften Routen/Breiten |
| U2 | Mobile Navigation erreichbar und vollständig | PASS | Trigger vorhanden, 94 Navigationslinks im Sheet |
| U3 | Demo-Banner bricht um, wird nicht abgeschnitten | PASS | `overflow 0`, Höhe 76,5 px bei 320 px |
| U4 | Keine buchstabenweisen Umbrüche (`break-all`) in Fachdaten | PASS | 0 Treffer außerhalb von `<code>`-Token-Blöcken |
| U5 | Bestellliste zeigt auf Mobil Karten statt Tabelle | PASS | sichtbare Tabellen = 0, RecordCards = 72 |
| U6 | Filter mobil im Sheet gebündelt | PASS | Filter-Trigger vorhanden, keine gequetschte Filterleiste |
| U7 | Tablet-Zweig bei 768 px ohne Überlauf | PASS | Icon-Rail aktiv, `overflow = 0` |
| U8 | Demo & QA: Aktionen liegen im Viewport | PASS | `overflow = 0` bei 320–430 px |
| U9 | Storefront: verständlicher Zustand ohne Key, kein Überlauf | PASS | Leerzustand mit Erklärtext, `overflow = 0` |
| U10 | Touch-Ziele ≥ 40 px auf Mobil (Ziel 44 px) | PASS | keine Fundstellen mehr bei 320/375/390/430 px |

## Viewport-Matrix

Geprüft: 320, 375, 390, 430, 768, 834, 1024, 1280, 1440 px sowie 375 px im Querformat.
Screenshots werden bei 390 px und 1440 px je Route abgelegt.

## Umgesetzte Korrekturen dieses Durchlaufs

- `src/components/ui/button.tsx`: alle Größen auf Touch-Maß (`default`/`lg` = `min-h-11`, `sm` = `min-h-10`, `icon` = `size-10`), keine festen `h-8`/`h-9`-Höhen mehr.
- `src/components/ui/tabs.tsx`: `TabsList` `min-h-11`, `TabsTrigger` `min-h-10` — Tabs sind mobil bedienbar.
- `src/components/ui/checkbox.tsx` / `switch.tsx`: sichtbare Größe erhöht (20 px bzw. 24 px) und unsichtbare `::after`-Trefferfläche auf 44 px erweitert.
- Routen-Bereinigung: alle verbliebenen `h-9`/`h-10`-Buttonklassen in `src/routes` auf `min-h-11` gehoben (u. a. Versand, Retouren, Dokumente, Preise, Promotions, Kategorien, Team, Warenkörbe, Zahlungen).
- `src/routes/_authenticated/app/lager/index.tsx`: SKU-Spalte von `break-all` auf `break-words`.
- `src/routes/_authenticated/app/produkte/index.tsx`: Pagination-Buttons auf `min-h-11`.
- Harness präzisiert: `break-all` in `<code>`-Blöcken (API-Keys, URLs) ist zulässig; Checkbox/Switch werden inklusive erweiterter Trefferfläche gemessen.

## Nicht verändert

Backend, Commerce-Engines, Store-API, RLS, Security-Header, Migrationen und Phase-17-Dokumentation blieben unangetastet. Die Änderungen liegen ausschließlich in `src/components/**` und `src/routes/**` (Präsentationsschicht).
