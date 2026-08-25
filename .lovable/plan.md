# Phase 6 — Tax Engine Deutschland / EU

Ziel: Aus dem Platzhalter-Provider (`tax.ts`, liefert überall 0) wird eine echte,
serverseitige Steuer-Engine für DE/EU. Cart, Checkout, Payment und Orders bleiben
unverändert in ihrer Architektur — die Engine wird nur an der bestehenden
`TaxProvider`-Schnittstelle eingehängt.

## Fachliche Regeln

- Alle Beträge bleiben Integer in Minor Units. Steuer wird pro Position berechnet
  und danach summiert (keine Steuer auf Gesamtsumme), Rundung kaufmännisch je Position.
- Preise können pro Shop **brutto** (B2C, Standard DE) oder **netto** (B2B) geführt werden.
  Bei Bruttoführung wird die Steuer herausgerechnet, bei Nettoführung aufgeschlagen.
- Steuerklassen pro Produkt/Variante: Standard (19 %), ermäßigt (7 %), steuerfrei (0 %).
- Länder-/Regelwerk: Steuersätze je Land + Steuerklasse mit Gültigkeitszeitraum
  (`valid_from` / `valid_to`), damit Satzänderungen historisch korrekt bleiben.
- Bestimmungslandprinzip (OSS): Lieferland der Versandadresse bestimmt den Satz.
  Fällt kein Satz an (Drittland), gilt 0 % mit Grund `export`.
- Reverse Charge: B2B-Kunde mit gültiger USt-IdNr. aus anderem EU-Land → 0 %,
  Grund `reverse_charge`. Kleinunternehmerregelung (§19 UStG) pro Shop abschaltbar → 0 %.
- USt-IdNr.-Prüfung: Format-/Prüfzifferncheck offline, optional VIES-Abgleich
  serverseitig mit Ergebnis-Caching; ungültige ID ⇒ kein Reverse Charge.
- Versandkosten werden besteuert: Standard-Satz des Lieferlandes, bei gemischtem
  Warenkorb anteilig nach Netto-Warenwert der Positionen verteilt.
- Rabatte/Promotions mindern die Bemessungsgrundlage — die Engine rechnet auf den
  bereits rabattierten Nettozeilen der Cart-Engine.
- Steuerergebnisse sind Bestandteil der unveränderlichen Cart-/Checkout-Snapshots
  und wandern beim Kauf in `orders` / `order_items` (Satz, Betrag, Klasse, Grund).
- Erstattungen erstatten die Steuer anteilig zum erstatteten Betrag.

## Datenmodell (neue Tabellen, org-scoped, RLS + GRANTs)

- `tax_classes` — Standard/Ermäßigt/Steuerfrei je Organisation, systemseitig geseedet.
- `tax_rates` — Land, optional Region, Steuerklasse, Satz in Basispunkten,
  `valid_from` / `valid_to`, Name für Belege. Geseedet: DE 19/7/0 plus EU-Standardsätze.
- `tax_settings` (pro Shop) — Preisführung brutto/netto, Herkunftsland, Kleinunternehmer-Flag,
  Reverse-Charge aktiv, Versandsteuer-Verhalten.
- `customer_tax_profiles` / Felder an Checkout-Session — USt-IdNr., Prüfstatus,
  Prüfzeitpunkt, B2B-Kennzeichen.
- Erweiterungen: `products`/`product_variants` erhalten `tax_class_id`;
  `cart_items`, `cart_price_snapshots`, `checkout_snapshots`, `order_items`, `orders`
  erhalten Steuerfelder (Satz, Steuerbetrag, Klasse, Grund, netto/brutto-Kennzeichen).

## Engine

- `src/lib/commerce/tax/tax-engine.ts` — reine Funktion: Zeilen + Kontext (Lieferland,
  Preisführung, B2B-Status, Datum) → Steuer je Zeile, Versandsteuer, Summen je Satz
  (Steuerausweis für Beleg), Grund/Exemption.
- `src/lib/commerce/tax/tax.server.ts` — lädt Sätze/Settings, cached pro Request,
  implementiert `TaxProvider` und ersetzt `getTaxProvider()` — die Cart-Engine bleibt unberührt.
- `src/lib/commerce/tax/vat-id.ts` — Formatprüfung je EU-Land; VIES-Abfrage serverseitig.
- Unit-Tests: Brutto-/Nettoführung, Rundung pro Zeile, gemischte Sätze, Versandverteilung,
  Reverse Charge, Drittland, Kleinunternehmer, Rabattbasis, Satzwechsel per Datum.

## UI

- `/app/steuern` — Steuersätze pro Land/Klasse mit Gültigkeit, Steuerklassen-Verwaltung.
- Shop-Einstellungen: Preisführung, Herkunftsland, Kleinunternehmer, Reverse Charge.
- Produkt-Editor: Steuerklasse pro Produkt (Override je Variante).
- Checkout/Testshop: USt-IdNr.-Feld mit Prüfstatus, Steuerausweis je Satz in der Übersicht.
- Bestelldetail: Steuerausweis je Satz und Position, Grund bei 0 %.

## Berechtigungen

Neue Permissions `tax.read` / `tax.write`, vergeben an Owner, Administrator und Finance.
Steuersätze sind für alle Org-Mitglieder lesbar, schreibbar nur mit `tax.write`.

## Abgrenzung

Keine Rechnungs-PDFs, keine DATEV-/Buchhaltungsexporte, keine US-Sales-Tax und keine
automatische OSS-Meldung — das gehört in eine spätere Phase. Der echte Stripe-Testkauf
aus Phase 5 (Punkt 15) bleibt offen und wird nachgeholt, sobald die Test-Keys vorliegen.
