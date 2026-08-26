# Phase 15 — Demo- und QA-Datensystem: End-to-End-Verifikation

Datum: 26.08.2026 · Harness: `qa/phase15-demo.ts` · Rohergebnis: `qa/results-phase15-demo.json`
Gesamtergebnis: **44/44 PASS**

Statuswerte ausschließlich: PASS · FAIL · OFFEN · BLOCKED.

---

## 1. Production Guard

| Prüfung | Status | Nachweis |
| --- | --- | --- |
| Seed bricht bei `APP_ENV=production` hart ab | PASS | `DEMO_SEED_FORBIDDEN`, Signal `environment_flag` |
| Reset bricht bei Produktionssignal hart ab | PASS | gleicher Fehlercode, keine Datenänderung |
| Fixture-Erzeugung blockiert | PASS | Abbruch vor jedem Insert |
| Live-Zahlungsanbieter in Ziel-Org blockiert Seed | PASS | Signal `live_payment_provider` |
| Live-Store-API-Key blockiert Seed | PASS | Signal `live_store_api_key` |
| Audit-Eintrag `security.demo_seed_blocked` | PASS | Eintrag in `audit_log` vorhanden |
| Keine Datenänderung während Blockade | PASS | Zähler vor/nach identisch |

## 2. Demo-Seed (SEED_VERSION 1.0.0)

| Datengruppe | Erwartet | Tatsächlich | Status |
| --- | --- | --- | --- |
| Organisation / Shop | 1 / 1 | 1 / 1 | PASS |
| Blueprints | 9 | 9 | PASS |
| Produkte | 32 | 32 | PASS |
| Varianten | > 32 | 44 | PASS |
| Kategorien / Kollektionen | 10+ / 5 | 12 / 5 | PASS |
| Produktbilder (`product_media`) | 12 | 12 | PASS |
| Preise / Promotions | vollständig | 44 Preise, 5 Promotions | PASS |
| Bestände über `inventory_movements` | alle Artikel | 44 Items, Bewegungen mit `DEMO-SEED` | PASS |
| Lagerorte | 3 | 3 | PASS |
| Kunden / Kundengruppen | 12 / 3 | 12 / 3 | PASS |
| Checkout-Flüsse (Cart→Checkout→Payment) | 40 | 40 | PASS |
| Bestellungen daraus | 36 (+4 offene Zahlungen) | 36 / 4 | PASS |
| Rechnungen inkl. PDF | vorhanden | ausgestellt, Datei je Rechnung | PASS |
| Versand / Fulfillment | mehrere Stati | versendet, teilversendet, Exception | PASS |
| Kommunikation | mehrere Stati | queued/sent/delivered/failed | PASS |
| Aufgaben / Automationen | vorhanden | aktiv, pausiert, fehlgeschlagen | PASS |
| Bestellzustände | mehrere | confirmed/cancelled · paid/partially_refunded/refunded | PASS |
| Health-Engine nach Seed | 0 kritische Befunde | 0 kritisch, 0 nachrangig | PASS |

Hinweis (kein Fehler): 4 der 40 Checkout-Sessions bleiben bewusst als offene Zahlung stehen, damit der Zustand „Zahlung ausstehend" abgedeckt ist. Daraus resultieren 36 Bestellungen.

## 3. Idempotenz

| Prüfung | Status | Nachweis |
| --- | --- | --- |
| Zweiter identischer Seed-Lauf | PASS | alle 28 geprüften Tabellenzähler identisch |
| Keine Dubletten bei Produkten/Varianten/Preisen | PASS | Zählung vorher = nachher |
| Kein doppelter Bestandsaufbau | PASS | Abgleich über `reference_id = DEMO-SEED` |
| Keine zusätzlichen Bestellungen | PASS | 36 vorher = 36 nachher |

## 4. QA-Fixtures

| Szenario | Erzeugung | Zerstörung (DB) | Storage-Reste |
| --- | --- | --- | --- |
| `mixed_tax_order` (7 % + 19 %) | PASS | PASS | PASS (0 Dateien) |
| `partial_fulfillment` | PASS | PASS | PASS (0 Dateien) |
| `shipping_exception` | PASS | PASS | PASS (0 Dateien) |
| `return_full` (Refund, Restock, Gutschrift) | PASS | PASS | PASS (0 Dateien) |

Zerstörung erfolgt über `demo_purge_organization` (nur für Demo-/QA-Organisationen freigegeben); die Organisation wird kaskadierend gelöscht, inklusive sonst unveränderlicher Journale.

## 5. Reset, Cleanup und Reseed

| Prüfung | Status | Nachweis |
| --- | --- | --- |
| Reset entfernt Demo-Organisation | PASS | Organisation gelöscht |
| Keine Datenreste in 28 Tabellen | PASS | 0 Zeilen |
| Storage bereinigt | PASS | 0 Dateien |
| Reseed stellt Ausgangszustand her | PASS | alle Zähler identisch zum ersten Lauf |

## 6. Gefundene Datenfehler

Keine offenen Datenfehler. Im Verlauf behoben und nachverifiziert:

- Bestandsbedarf wurde aus den Bestell-Templates berechnet, sonst reichte der Bestand für 40 Checkouts nicht.
- Idempotenz des Wareneingangs über `reference_id` statt reiner Mengenprüfung.
- Fehlende `invoice_settings` blockierten die Rechnungsstellung.
- `audit_log`-Unveränderlichkeit verhinderte Reset/Fixture-Löschung → `purge_mode()` + `demo_purge_organization`.
- Rechnungen entstehen jetzt über den Dokumenten-Service, damit auch das PDF erzeugt wird.

## 7. UI- und Mobile-Befunde (nur Dokumentation, kein Redesign)

Geprüft mit realen Demo-Daten bei 375 / 390 / 430 / 768 / 1440 px auf: Produkte, Bestellungen, Kunden, Lager, System (Demo-Daten), Test-Storefront.

| # | Befund | Breiten | Schwere | Status |
| --- | --- | --- | --- | --- |
| U1 | Ganze Seite scrollt horizontal (`scrollWidth` 2690 px bei 375–430 px Viewport). Ursache: Tabellen ohne eigenen Scrollcontainer + `max-w-5xl`-Container mit festem `px-6`. Betrifft Produkte, Bestellungen, Kunden, Lager. | 375/390/430 | hoch | OFFEN |
| U2 | Keine Sidebar-Navigation auf Mobil; stattdessen eine einzeilige Link-Leiste (`.md:hidden`), die selbst über den Rand hinausläuft und nur einen Bruchteil der 20+ Bereiche zeigt. | 375/390/430 | hoch | OFFEN |
| U3 | Demo-Banner wird abgeschnitten, Text bricht nicht um. | 375/390/430 | mittel | OFFEN |
| U4 | Datentabellen sind auf Mobil unbrauchbar: Spalten (SKU, Physisch, Beschädigt, Reserviert …) werden gestaucht, SKU bricht buchstabenweise um („DEMO-SCH-002" über drei Zeilen). | 375/390/430 | hoch | OFFEN |
| U5 | Bestellliste zeigt auf Mobil keine Kartendarstellung; Nummer, Datum, Kunde, Status, Zahlung, Versand, Summe konkurrieren um < 400 px. | 375/390/430 | hoch | OFFEN |
| U6 | Filterleisten (Suche + 3 Selects) stapeln full-width und schieben den Inhalt weit nach unten; kein Collapse/„Filter"-Sheet. | 375/390/430 | mittel | OFFEN |
| U7 | Auch bei 768 px läuft der Inhalt über (930–1094 px Breite) — Tablet-Layout fehlt vollständig, es greift der Desktop-Zweig. | 768 | hoch | OFFEN |
| U8 | Seite `Demo & QA Daten`: Statuskarte und Aktionsbuttons liegen außerhalb des Viewports; Seed-/Reset-Aktionen auf Mobil nicht erreichbar. | 375/390/430 | hoch | OFFEN |
| U9 | Test-Storefront verlangt einen Publishable Key als Eingabe, bevor irgendetwas sichtbar ist — die Demo-Organisation liefert keinen vorbelegten Key an die Referenz-Storefront. | alle | mittel | OFFEN |
| U10 | Desktop (1440 px) ist durchgehend sauber, keine Überläufe; nur die Bestelltabelle wirkt bei langen Gast-E-Mails eng. | 1440 | niedrig | OFFEN |

Screenshots: `/tmp/browser/ui/shots/<seite>_<breite>.png` (30 Aufnahmen).

## 8. Gesamtbewertung

| Bereich | Status |
| --- | --- |
| Production Guard | PASS |
| Demo-Seed und Zähler | PASS |
| Idempotenz | PASS |
| QA-Fixtures inkl. Zerstörung | PASS |
| Reset / Storage-Cleanup / Reseed | PASS |
| Datenintegrität (Health-Engine) | PASS |
| Mobile-/UI-Qualität | OFFEN (U1–U9) — Eingang in den Redesign-Plan |
| Stripe / E-Mail / Carrier real | BLOCKED (keine Zugangsdaten, unverändert) |

Gate B ist nicht gestartet. Nächster Schritt laut Vorgabe: vollständiger UX/UI- und Mobile-Redesign-Plan auf Basis der befüllten Demo-Organisation.
