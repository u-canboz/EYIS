# Phase 4: Cart & Checkout Engine

Cart und Checkout werden als reine Konsumenten der bestehenden Engines gebaut: Preise kommen ausschließlich aus der Pricing Engine (Phase 2), Bestand ausschließlich aus den transaktionalen `inv_*`-Funktionen (Phase 3). Keine zweite Preis- oder Bestandslogik, keine Berechnung im Client. Phase 4 endet bei einer validierten Checkout-Session mit unveränderbarem Snapshot — keine Zahlung, keine Bestellung.

## Entscheidungen aus der Abstimmung

- Steuern: nur Architektur vorbereiten. `TaxProvider`-Interface mit Strategie `none`, `tax_minor` ist immer 0. Echte Steuerberechnung wird eigene Subphase.
- Buy X Get Y: wirkt als Rabattbetrag auf die günstigsten qualifizierenden Positionen. Keine automatisch eingefügte Gratisposition.
- Gastzugriff: ausschließlich über Cart-Server-Functions mit `cart_id` + Anonymous-Token. Keine öffentlichen API-Routen, keine anonymen DB-Policies.

## Datenmodell (eine Migration)

Neue Tabellen, alle mit `organization_id` + `shop_id`, RLS an, GRANTs nur für `authenticated` (Admin-Lesen über Membership) und `service_role`. Kein `anon`-GRANT auf irgendeiner Cart-Tabelle.

- `carts` — Status `active | checkout | completed | abandoned | expired`, `currency_code`, `customer_email`, `region_code`, `locale`, `anonymous_token_hash`, `expires_at`, `last_activity_at`, `abandoned_at`, `completed_at`, `metadata`.
- `cart_items` — `product_id`, `variant_id`, `quantity`, Snapshot-Felder für Titel/Variantentitel/SKU/Bild. Unique auf `(cart_id, variant_id)`, damit dieselbe Variante Menge addiert statt Doppelzeilen zu erzeugen.
- `cart_price_snapshots` — versioniert pro Cart, unveränderbar (Trigger blockt UPDATE/DELETE), enthält Totals in Minor Units plus `pricing_context` und `calculation_result`.
- `cart_item_price_snapshots` — pro Line eines Snapshots: Basis-, aufgelöster, Zeilen-, Rabatt- und Endbetrag, angewandte Preisregeln und Promotions.
- `cart_promotion_codes` — angewandte Codes je Cart mit `code_snapshot`.
- `checkout_sessions` — Status `open | validated | awaiting_payment | expired | cancelled`, `price_snapshot_id`, `expires_at` (Standard 20 Minuten), `validated_at`.
- `checkout_addresses` — Shipping/Billing-Snapshot je Session.
- `checkout_reservations` — Brücke zwischen Cart-Line und `inventory_reservations`.
- `checkout_snapshots` — versionierter, unveränderbarer Endstand vor Payment (Adressen, Versandart, Totals, Lines, Promotions).
- `shipping_methods` — `pricing_type` (`fixed` | `free`), `amount_minor`, `countries`, `min/max_subtotal_minor`, `free_above_minor`, Status.

Indizes auf `cart_id`, `shop_id`, `organization_id`, `status`, `customer_id`, `expires_at`, `variant_id`, `checkout_session_id`.

Neue Permissions in `role_permissions`: `carts.read`, `carts.manage`, `checkout.read`, `checkout.manage`, `shipping_methods.read`, `shipping_methods.manage`.

## Transaktionale DB-Funktionen

Wie in Phase 3 laufen kritische Operationen als `SECURITY DEFINER`-Postgres-Funktionen, damit sie atomar und idempotent sind:

- `cart_start_checkout(...)` — Session anlegen, alle lagergeführten Positionen über die bestehende Reservierungslogik reservieren, Snapshot verknüpfen, Audit + Outbox + Idempotency in einer Transaktion. Schlägt eine Position fehl, rollt alles zurück. Keine Teilreservierung.
- `cart_expire_checkout_sessions(...)` — abgelaufene Sessions auf `expired` setzen und zugehörige Reservierungen freigeben.
- `cart_expire_carts(...)` — alte Gast-Carts ablaufen lassen, nie mit offenen Reservierungen.

Reservieren, Freigeben und Committen selbst nutzen unverändert die Phase-3-Funktionen.

## Pricing- und Promotion-Integration

- `repriceCart(cartId)` lädt Cart und Lines, ruft pro Line die bestehende Pricing Engine auf und wertet danach cartweite Promotions aus.
- Die Pricing Engine wird um eine Cart-Ebene **erweitert**, nicht dupliziert: eine neue Funktion `resolveCartPricing(snapshot, cartContext)` in derselben Engine-Datei nutzt dieselbe Preisauflösung pro Line und ergänzt cartweite Auswertung für `minimum_subtotal`, mehrere Produkte/Kategorien, feste Cart-Rabatte, `free_shipping` und Buy X Get Y (Rabatt auf günstigste qualifizierende Positionen). Bisheriges Line-Verhalten und die 18 vorhandenen Tests bleiben unverändert.
- Rabatte werden anteilig deterministisch auf Lines verteilt, Rundungsreste gehen an die erste Zeile — Summe der Lines ergibt exakt den Cart-Rabatt.
- Jede Neuberechnung schreibt eine neue Snapshot-Version; alte Snapshots bleiben unangetastet.
- Änderungen zwischen zwei Berechnungen erzeugen Hinweise (`price_changed`, `promotion_removed`, `quantity_reduced`, `out_of_stock`), die die UI anzeigt.
- Usage-Limits werden nur validiert, nicht verbraucht.

## Cart/Inventory-Grenze

- Cart macht ausschließlich Availability-Checks (`available = on_hand − damaged − reserved`, Backorder wie in Phase 3 definiert).
- Echte Reservierungen entstehen erst bei `startCheckout()` und werden bei Ablauf oder Abbruch freigegeben.

## SDK

Neue Dateien nach bestehender Konvention (`*.functions.ts` dünn, Logik in `*.server.ts`, Typen client-safe):

```text
src/lib/commerce/
├ cart.types.ts / cart.server.ts / cart.functions.ts
├ checkout.types.ts / checkout.server.ts / checkout.functions.ts
├ shipping.types.ts / shipping.server.ts / shipping.functions.ts
└ tax.ts   (TaxProvider-Interface, Strategie "none")
```

Server-Funktionen: `createCart`, `getCart`, `addItem`, `updateItemQuantity`, `removeItem`, `clearCart`, `applyPromotionCode`, `removePromotionCode`, `setCustomerEmail`, `setShippingAddress`, `setBillingAddress`, `listShippingOptions`, `setShippingOption`, `startCheckout`, `validateCheckout`, `mergeCart`, `expireCart`, `expireCheckoutSessions`.

Jede Mutation: Kontext prüfen (Membership oder gültiger Cart-Token), Shop- und ID-Zugehörigkeit prüfen, Idempotency-Key über die bestehende `idempotency_keys`-Tabelle, Repricing, Snapshot, Audit/Outbox nur bei fachlich relevanten Ereignissen (kein Repricing-Spam).

`getCart` liefert alles in einem aggregierten Read: Lines mit Produkt-/Variantendaten, aktueller Preis-Snapshot, Promotionstatus, Verfügbarkeitsindikatoren, Checkout-Zustand — ohne N+1.

## Sicherheit

- Anonymer Token wird serverseitig erzeugt, nur der SHA-256-Hash gespeichert; der Roh-Token wird genau einmal zurückgegeben.
- Token autorisiert exakt einen Cart, konstantzeitiger Vergleich, kein Cross-Cart-Zugriff.
- Keine anonymen SELECT-Policies auf Cart-, Checkout- oder Adresstabellen.
- Der Client sendet nur IDs, Mengen, Adresseingaben, Promotion-Code und Auswahlentscheidungen. Preis, Rabatt, Versandkosten, Steuer, Total, Titel und SKU erzeugt ausschließlich der Server.
- Audit-Einträge enthalten keine vollständigen Adressen, nur Land/PLZ-Kürzel und Referenzen.

## UI

- Interne Testoberfläche unter `/app/system/storefront-test`: Produkt und Variante wählen, Menge, in den Warenkorb, Cart öffnen, Menge ändern, Code anwenden, Checkout starten, Kontakt, Liefer-/Rechnungsadresse, Versandart, Validierung, Zusammenfassung. Bewusst schlicht, nicht als finale Storefront gestaltet.
- Komponenten: `CartLine`, `CartSummary`, `PromotionCodeInput`, `CheckoutContact`, `CheckoutAddress`, `ShippingMethodSelector`, `CheckoutSummary`. Keine Payment-Komponenten.
- `/app/versandarten`: Verwaltung der Shipping Methods.
- `/app/system/cart-debug`: nur für Owner/Developer, zeigt Cart, Lines, Snapshots, Promotions, Reservierungen, Session, finalen Snapshot und Events — strikt auf die eigene Organisation begrenzt.
- Navigation um „Versand" und „System" erweitert.
- React formatiert nur; alle Beträge kommen fertig aus dem Server.

## Tests und Verifikation

Vitest-Tests für Cart-Engine und Cart-Promotions (inkl. Buy X Get Y, `minimum_subtotal`, `free_shipping`, Rabattverteilung, Minor-Unit-Rundung) plus Datenbanktests in isolierten QA-Organisationen, die danach vollständig entfernt werden:

- Cart: erstellen, hinzufügen, gleiche Variante erneut, Menge ändern, entfernen, leeren.
- Pricing: aktueller Preis, Staffelpreis, Cart-Promotion, Promotion entfernen, Preisänderung vor Checkout.
- Inventory: Availability im Cart, Reservierung beim Checkout, Release bei Ablauf, Bestandsrückgang zwischen Cart und Checkout.
- Concurrency: zwei Carts starten gleichzeitig Checkout bei `available = 1` → genau einer erfolgreich.
- Security: fremder Cart, falscher Token, fremder Shop, direkter anonymer DB-Zugriff blockiert.
- Idempotency: doppeltes Add, doppelter Checkout-Start, doppeltes Merge.
- Checkout-Validierung: fehlende Mail, unvollständige Adresse, inaktive Versandart, abgelaufene Promotion, abgelaufene Reservierung, archiviertes Produkt oder Variante, manipulierte IDs.

Phase 0–3 bleiben unverändert; bestehende Tests, Build und Typecheck müssen grün bleiben.

## Ausdrücklich nicht Teil von Phase 4

Kein Payment-Provider, keine Zahlung, kein Payment Intent, keine Order, keine Rechnung, kein Versandlabel, kein Fulfillment, keine Retouren, kein Kundenportal, keine Marketing-Mails, keine finale Storefront, keine Fake-Payment-Funktion.
