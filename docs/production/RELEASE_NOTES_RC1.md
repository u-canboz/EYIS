# Release Notes — 1.0.0-rc.1

Datum: 2026-08-25 · Status: Release Candidate, **nicht go-live-freigegeben**

## Inhalt

EYIS V1 mit den Phasen 0 bis 12: Mandanten und Rollen, Katalog und Blueprints, Pricing und Promotions, Bestand, Cart und Checkout, Payments und Orders, Steuer-Engine DE/EU, Versand und Fulfillment, Rechnungen und Dokumente, Kundenportal und Retouren, Communication Studio, Automation Engine, öffentliche Store API und Storefront SDK. Vollständige Auflistung: `docs/production/V1_SCOPE.md`.

## Bau- und Teststand (gemessen am 2026-08-25)

| Prüfung | Ergebnis |
| --- | --- |
| `tsgo --noEmit` | grün, keine Fehler |
| `bunx vitest run` | 4 Dateien, 72 Tests, alle grün (Pricing 18, Tax 17, Cart 20, SDK-Grenzen 17) |
| Phase-5-QA | 93 Prüfpunkte bestanden, `qa/PHASE5-QA-REPORT.md` |
| Phase-12-QA | 52/52 bestanden, `qa/PHASE12-QA-REPORT.md` |
| Build | nach den Dokumentationsänderungen dieses Schritts unverändert; kein Anwendungscode berührt |

## Schemastand

- 31 Migrationen im Repository, 31 in der Datenbank angewandt.
- Letzte Migration: `20260825221017_701c58fa-d163-479f-98ee-72902e35e0a9.sql`.
- 112 Tabellen im Schema `public`, alle mit aktivem RLS, 185 Policies, 99 Funktionen, 91 Trigger, 69 Enum-Typen.
- Storage: `media`, `shipping-labels`, `documents` — alle privat.

## Öffentliche Verträge

- Store API `v1` unter `/api/public/store/v1` mit 35 Endpunkten.
- Storefront SDK `1.0.0`.
- Antwort- und Fehlerhülle sowie Header-Vertrag wie in `V1_SCOPE.md` beschrieben.

## Nicht enthalten / blockiert

Siehe `docs/production/KNOWN_LIMITATIONS.md`. Wesentlich: keine Live-Zahlungen, kein echter E-Mail-Versand, keine echten Carrier-Labels, keine laufende Job-Warteschlange, keine getrennte Staging-Umgebung, kein Backup-Nachweis.

## Freigabestatus

RC1 ist ein eingefrorener Funktionsstand für die Produktionshärtung. Eine Go-live-Freigabe setzt den Abschluss der Gates A, B und C voraus; offene Punkte aus A2 bis A8 sind noch nicht bearbeitet.
