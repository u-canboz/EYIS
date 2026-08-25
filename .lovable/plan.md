# Phase 6 — Tax Engine Deutschland & EU

Ausgangslage (geprüft): `src/lib/commerce/tax.ts` enthält nur den Platzhalter
`zeroTaxProvider` (liefert überall 0). `repriceCart()` ruft ihn bereits an genau einer
Stelle auf und schreibt `tax_minor` in `cart_price_snapshots`; `checkout_snapshots` und
die Order-Finalisierung übernehmen diesen Wert. Phase 6 ersetzt ausschließlich diesen
Provider durch eine echte Engine — es entsteht keine zweite Rechenlogik.

## 1. Grundsätze

- Genau ein Rechenweg: Pricing → Promotions → Versand → Tax Engine → Snapshot → Payment → Order.
- Keine Steuerlogik im Client, im Checkout-UI oder in Order-Komponenten.
- Nur Minor Units, Sätze als Basispunkte (19 % = 1900). Keine Floats.
- Unsichere steuerliche Sachverhalte werden nie stillschweigend automatisiert:
  entweder explizite Konfiguration oder `manual_review` + Warnung.

## 2. Datenmodell (Migration)

Neue Tabellen, alle org-scoped mit RLS + GRANTs, `updated_at`-Trigger:

- `tax_classes` — `organization_id`/`shop_id` nullable (Systemklassen), `name`, `code`,
  `description`, `status`, `is_system`, `metadata`. Systemklassen: Standard, Ermäßigt,
  Steuerfrei, Digitale Leistung, Lebensmittel, Bücher, Versand.
- `tax_rates` — `tax_class_id`, `country_code`, `region_code`, `rate_basis_points`,
  `valid_from`, `valid_until`, `customer_type`, `transaction_type`, `status`, `priority`,
  `source`, `metadata`. Seed nur Deutschland: 19 % / 7 % / 0 %. Keine erfundene EU-Tabelle —
  weitere Länder sind im Admin anlegbar/importierbar.
- `tax_settings` (pro Shop) — `calculation_mode` (gross|net), `home_country_code`,
  `default_tax_class_id`, `prices_include_tax`, `shipping_tax_strategy`
  (fixed_class|proportional|highest_rate) inkl. `shipping_tax_class_id`, `b2b_enabled`,
  `eu_oss_enabled`, `small_business_exemption_enabled`, `tax_number`, `vat_id`, `metadata`.
- `vat_validations` — `vat_id`, `country_code`, `normalized_vat_id`, `status`
  (pending|valid|invalid|unavailable|manual_review), `provider`, `provider_reference`,
  `checked_at`, `expires_at`, `response_snapshot`.
- `tax_snapshots` — unveränderlich (Trigger blockiert UPDATE/DELETE), verweist auf
  cart / checkout_session / order, speichert `calculation_mode`, `jurisdiction`,
  `customer_type`, `result` (JSONB), `engine_version`.

Erweiterungen bestehender Tabellen:

- `products.tax_class_id`, `product_variants.tax_class_id` (beide nullable → Vererbung).
- `checkout_sessions`: `customer_type`, `company_name`, `customer_vat_id`,
  `vat_validation_id`.
- `orders`: `net_total_minor`, `tax_total_minor`, `gross_total_minor`, `tax_breakdown`,
  `tax_engine_version`, `tax_snapshot_id`.
- `order_items`: `net_minor`, `tax_minor`, `gross_minor`, `tax_rate_basis_points`,
  `tax_class_snapshot`, `tax_reason_code`, `tax_country_code`.
- `cart_price_snapshots` / `checkout_snapshots`: `tax_breakdown`, `tax_engine_version`.
- Neue Permissions `tax.read`, `tax.manage`, `tax.override`, `vat.read`, `vat.manage`
  in `role_permissions` gemäß Rollenmatrix (owner/administrator alles, finance
  tax+vat manage, catalog_manager tax.read + Steuerklasse am Produkt,
  customer_support/read_only nur tax.read).

## 3. Engine (`src/lib/commerce/tax/`)

```text
tax.types.ts       Context, Result, Reason Codes, Rules
tax.engine.ts      resolveTax(context, rules) — reine Funktion, engine_version "de-eu-v1"
tax.rules.ts       Jurisdiktion, Klassen-Vererbung, Reason-Code-Ableitung
tax.server.ts      lädt Settings/Klassen/Rates, baut Rules, implementiert TaxProvider
tax.validation.ts  Zod-Schemas, VAT-ID-Format/Normalisierung, VatValidationProvider
tax.functions.ts   Server Functions für Admin-UI (Settings, Klassen, Rates, VAT-Prüfung)
__tests__/tax.test.ts
```

Der bisherige `tax.ts` wird auf das neue Modul umgestellt (`getTaxProvider()` liefert die
echte Engine); die alte Datei bleibt nur als Re-Export-Shim oder entfällt vollständig.

Rechenregeln:
- Gross-Modus: Steuer aus dem Bruttobetrag herausgerechnet, Netto = Brutto − Steuer.
  Net-Modus: Steuer aufgeschlagen.
- Steuer je Zeile auf dem bereits rabattierten Betrag, kaufmännische Rundung zentral in
  einer Funktion; Rundungsdifferenzen deterministisch (größter Restbetrag, dann Zeilen-ID)
  verteilt, sodass Summe(Zeilen) exakt dem Total entspricht.
- Steuerklassen-Vererbung: Variante → Produkt → Shop-Default.
- Versand nach konfigurierter Strategie (fixed_class / proportional / highest_rate).
- Reason Codes: standard_rate, reduced_rate, zero_rate, small_business_exemption,
  reverse_charge, intra_eu_b2b, export, tax_exempt, manual_override, unknown.
- Reverse Charge nur bei Business + EU-Sachverhalt + `status = valid` der VAT-Prüfung;
  ohne belastbaren Provider bleibt es `manual_review` und es wird regulär besteuert.
- OSS: bei `eu_oss_enabled` bestimmt das Lieferland die Jurisdiktion, sonst das Heimatland.
- Drittland/Export nur, wenn eine konfigurierte Regel dies vorsieht — keine Pauschalannahme.

## 4. Integration

- `repriceCart()`: Tax Engine erhält den finalen, rabattierten Zeilenbetrag und den
  Versandbetrag; das Ergebnis (Breakdown, Reason Codes) geht in den Cart-Snapshot.
- `validateCheckout()` / `writeCheckoutSnapshot()`: baut den Tax Context aus Shop-Settings,
  Kundentyp, VAT-Status und Liefer-/Rechnungsland, schreibt einen unveränderlichen
  `tax_snapshots`-Eintrag und die vollständige Breakdown in den Checkout-Snapshot.
- Payment: Betrag bleibt strikt der Bruttowert des validierten Checkout-Snapshots.
  Ändert sich der Snapshot durch Tax-Repricing, wird eine offene Payment Session
  invalidiert und neu erzeugt.
- Order-Finalisierung: übernimmt Steuerwerte ausschließlich aus dem Checkout-/Tax-Snapshot.
  Keine Neuberechnung nach Zahlung; historische Orders bleiben bei späteren Satzänderungen
  unverändert.
- Audit-Events: tax.settings.updated, tax.class.*, tax.rate.*, tax.override.applied,
  vat.validation.requested/updated. Outbox: tax.calculated (nur bei persistierten
  Commerce-Flows, nicht im Preview), tax.settings.changed, vat.validation.completed.

## 5. UI

- `/app/einstellungen/steuern` — geführter Einstieg (Sitzland → Preisführung →
  B2B ja/nein → EU-Privatkunden ja/nein), danach die passenden Detaileinstellungen.
- Unterbereiche „Steuerklassen" (Systemklassen geschützt, eigene Klassen anlegbar) und
  „Steuersätze" (Klasse, Land, Satz, gültig ab/bis, Status — Formular, kein JSON).
- Produkteditor: Auswahlfeld Steuerklasse; Blueprint-Vorschlag wird angezeigt und muss
  mit „Übernehmen" bestätigt werden. Bei unsicheren Typen (z. B. Lebensmittel) erscheint
  ein „Bitte prüfen"-Hinweis statt einer stillen Vorbelegung.
- Pricing Preview: zusätzlich Steuerbasis, Satz, Steuerbetrag und Brutto (Gross-Modus
  rückwärts aufgelöst) — über die echten Engines.
- Test-Storefront: Zwischensumme, Rabatt, Versand, MwSt. je Satz, Gesamt — alles serverseitig.
- Bestelldetail: Steuerausweis je Land und Satz, Gesamtsteuer, bei 0 % der Reason Code
  im Klartext (z. B. „Reverse Charge", „Kleinunternehmerregelung").

## 6. Tests

Unit-Tests der reinen Engine: Gross/Net × Standard/Ermäßigt (119/100/107-Fälle), Mixed Cart
(200 netto / 26 Steuer / 226 brutto), Promotion vor Steuer, Tier-Preis vor Steuer,
Shipping-Strategien, Zero Rate mit Reason Code, Kleinunternehmer-Modus, B2B DE ohne
Reverse Charge, EU-B2B ohne belastbare VAT-Prüfung → manual_review, Rundungsserien mit
Cent-Problemen (Summengarantie), Satzwechsel über `valid_from` (historische Order stabil).

QA-Lauf gegen die Datenbank (analog Phase 5): Cross-Tenant-Zugriff auf Settings/Klassen/
Rates, manipuliertes Lieferland, vom Client geschickte `tax_minor`/eigener Satz, Override
ohne Permission — alle blockiert. Anschließend Regressionslauf Phase 0–5 inklusive
Payment-Betrag = Checkout-Snapshot-Total inkl. Steuer.

## 7. Nicht in Phase 6

Rechnungs-PDF, XRechnung/ZUGFeRD, Steuerberater- und OSS-Exporte, automatische
Umsatzsteuererklärung, US Sales Tax, Marketplace-Tax, IOSS-Sonderfälle. Manual Override
wird nur als Datenfeld + Reason Code vorbereitet, ohne UI-Massenwerkzeug.
Offen aus Phase 5 bleibt der echte Stripe-Testkauf, sobald die Test-Keys vorliegen.
