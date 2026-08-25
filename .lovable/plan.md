# Commerce OS — Phase 2: Pricing & Promotions Engine

Aufbau auf Phase 0/1 ohne Ersatz der bestehenden Architektur: gleiche Muster (Server Functions mit `requireSupabaseAuth`, `assertPermission`, `writeAudit`, `emitEvent`, `*.server.ts` für Logik, RLS + GRANTs pro Tabelle).

Kein Cart, kein Checkout, keine Zahlungen, keine Bestellungen, keine Kundenverwaltung, kein Lager.

## Geldmodell

Alle Beträge als Integer in kleinster Währungseinheit (`amount_minor`) plus `currency_code`. Kein Float in DB, Server oder Client. Der Client bekommt `2990` und formatiert nur (`Intl.NumberFormat`) — er rechnet nie.

## Datenmodell (neue Tabellen)

- `customer_groups` — org/shop-scoped Gruppen (Privatkunden, B2B, VIP, …), nur Pricing-Grundlage.
- `price_sets` — Container je Produkt **oder** Variante (CHECK: genau eines gesetzt), org/shop-scoped, Unique je Produkt bzw. Variante.
- `prices` — `type` (base | sale | tier | customer_group | override), `currency_code`, `amount_minor`, Zeitraum, `min_quantity`/`max_quantity`, `customer_group_id`, `priority`, `status`, `metadata`.
- `promotions` — `code` (nullable, unique je Shop), `type` (percentage | fixed_amount | fixed_price | buy_x_get_y | free_shipping), `value`, Zeitraum, `usage_limit`, `usage_limit_per_customer`, `priority`, `stackable`, `conditions` jsonb, `actions` jsonb.

Alles mit `organization_id` + `shop_id`, `updated_at`-Trigger, Indizes auf Lookup-Pfaden (price_set, currency, Zeitraum, Code).

Validierung per DB-Constraints wo immutable (nicht-negative Beträge, `min_quantity > 0`, `max_quantity >= min_quantity`, `starts_at < ends_at`, Prozentgrenzen) und per Trigger/Server wo zeitabhängig oder org-übergreifend (Fremd-IDs müssen zur selben Organisation gehören, überlappende Tier-Bereiche im selben Price Set verboten).

## Preisauflösung (eine einzige Engine)

`src/lib/commerce/pricing.server.ts` ist die alleinige Rechenstelle. Eingabe:

```text
{ shopId, productId, variantId, quantity, currencyCode, customerGroupId?, promotionCodes?, now }
```

Ausgabe: `baseAmount`, `resolvedUnitAmount`, `subtotal`, `discounts[]`, `appliedPriceRules[]`, `appliedPromotions[]`, `compareAtAmount?`, `shippingDiscountEligible`, `currencyCode` — plus eine nachvollziehbare Erklärkette (jede Stufe mit Label, Betrag, Quelle) für die Preis-Transparenz im Admin.

Fachliche Priorität der Preisregeln:

```text
1. variant override
2. customer-group price
3. quantity tier
4. sale price
5. base price
danach: promotions
```

Kein zufälliger First-Match: Aus allen zum Zeitpunkt, zur Menge, zur Währung und zur Kundengruppe **gültigen** Preiszeilen wird nach fachlicher Priorität die höchste Stufe bestimmt; innerhalb derselben Stufe gewinnt deterministisch der günstigste gültige Preis (Tie-Break: höhere `priority`, dann jüngeres `updated_at`, dann `id`). Damit kann ein schlechterer Kundengruppenpreis keinen besseren Mengenpreis verdrängen — die Engine wählt bei gleichrangigen Kandidaten stets den für den Kunden besten Betrag. Die gewählte Stufe und alle verworfenen Kandidaten erscheinen in der Erklärkette.

Prices bleiben erweiterbar: neben den V1-Spalten trägt jede Preiszeile eine `conditions`-jsonb-Struktur (gleiches Muster wie bei Promotions). Künftige Kriterien wie Markt, Region, Channel oder B2B-Vertrag kommen dort hinein, ohne dass für jedes Kriterium eine neue Spalte nötig wird; die Engine wertet unbekannte Bedingungen konservativ als „nicht anwendbar“ aus.

Promotions werden nach `priority` sortiert ausgewertet; `stackable = false` beendet die Kombination (nur die höchstpriorisierte bzw. bei Gleichstand die für den Kunden günstigste greift, deterministisch per Tie-Break auf id). Rundung einmalig, kaufmännisch, auf Minor Units.

Promotion-Conditions datengetrieben ausgewertet: product, variant, category, collection, minimum_quantity, minimum_subtotal, customer_group, date_range. Actions: percentage_discount, fixed_discount, set_price, free_item, free_shipping. `free_shipping` setzt nur `shipping_discount_eligible = true`.

**Bewusst nur vorbereitet, nicht produktionsfähig in Phase 2:**

- `buy_x_get_y` — braucht einen positionsübergreifenden Warenkorb-Kontext mit mehreren Zeilen. Phase 2 liefert Datenmodell, Regeldefinition und Validierung sowie einen Wizard-Pfad; die echte positionsübergreifende Auswertung kommt mit dem Cart. Die Engine gibt für solche Promotions ein klar gekennzeichnetes „noch nicht anwendbar“ zurück statt einer Behelfsrechnung, und die UI weist darauf hin.
- `usage_limit` / `usage_limit_per_customer` — ohne Kunden- und Bestellsystem nicht zuverlässig durchsetzbar. Felder und Validierung jetzt, echte Verbrauchszählung mit Orders.


Cross-Tenant: Promotion, Preis und Kundengruppe müssen zu Shop und Organisation des Kontexts gehören, sonst werden sie verworfen — zusätzlich zu RLS.

## SDK-Erweiterung

- `pricing.functions.ts` — Price Sets/Preise lesen und mutieren, Bulk-Aktionen, `resolvePrice` / `resolvePrices`.
- `promotions.functions.ts` — CRUD, Aktivieren/Deaktivieren, Code-Prüfung.
- `customer-groups.functions.ts` — CRUD.
- `pricing.server.ts` (Engine), `money.ts` (nur Formatierung/Parsing für die UI, keine Preislogik).

Bulk-Operationen (alle Varianten auf Betrag setzen, +10 %, −5 €) laufen serverseitig atomar über eine SECURITY-DEFINER-DB-Funktion, mit `idempotency_keys` gegen doppelte Ausführung bei Retry. Default atomar; Fehler in einer Zeile rollt alles zurück.

Bulk-Basis ist eindeutig definiert: mutiert werden ausschließlich explizit ausgewählte, gespeicherte Preiszeilen eines bestimmten Typs (z. B. „alle `base`-Preise dieser Varianten in EUR“). Relative Änderungen rechnen immer vom gespeicherten `amount_minor` dieser Zeilen — niemals vom aufgelösten Endpreis. Damit verändert `+10 %` nie versehentlich Sale- oder Staffelergebnisse. Vor dem Ausführen zeigt die UI eine Vorschau alt → neu je betroffener Zeile.

## Permissions & RLS

Neu in `role_permissions`: `pricing.read`, `pricing.manage`, `promotions.read`, `promotions.manage`, `customer_groups.read`, `customer_groups.manage`.

- owner/administrator: alles
- finance: pricing read+manage, promotions read
- catalog_manager: pricing read+manage, customer_groups read
- marketing: promotions read+manage, pricing read
- operations/developer: read
- read_only: nur read

RLS auf allen neuen Tabellen über bestehende Helper (`is_org_member`, `has_permission`, `shop_in_org`), GRANTs für `authenticated` und `service_role` in derselben Migration.

## UI (Deutsch)

- `/app/preise` — Preislisten-Übersicht in Geschäftssprache: Tabs Produkte, Aktionspreise, Mengenpreise, Kundengruppen, Promotions; Filter nach Produkt, Kategorie, Collection, Status, Zeitraum, Kundengruppe.
- `/app/preise/testen` — Pricing Preview: Produkt, Variante, Menge, Kundengruppe, Gutscheincode, Datum wählen; Ergebnis mit vollständiger Berechnungskette. Nutzt exakt dieselbe Engine, keine zweite Logik.
- `/app/marketing/promotions` — Promotion Builder als Wizard: Ziel wählen (Prozent, Fester Rabatt, Mengenaktion, Buy X Get Y, Gratisversand), dann geführt Geltungsbereich, Zeitraum, Code, Kombinierbarkeit.
- Produkteditor (`/app/produkte/$productId`) bekommt den Tab **Preise**: Preise je Produkt bzw. je Variante, plus Bulk-Aktionen. Keine neue Produktstruktur.
- Kundengruppen-Verwaltung als Bereich innerhalb der Preisseite.
- Navigation in der Sidebar wird um Preise und Marketing ergänzt.

## Audit & Outbox

Audit: `price.created/updated/deleted`, `price_set.created/updated`, `customer_group.created/updated`, `promotion.created/updated/activated/deactivated/deleted`.

Outbox: `pricing.changed`, `pricing.price.created`, `pricing.price.updated`, `promotion.created/updated/activated/expired`. Keine Worker-Verarbeitung in dieser Phase.

## Tests

Vitest wird eingerichtet; die Engine wird als reine Funktion über einem geladenen Regel-Snapshot getestet, damit sie ohne DB prüfbar ist:

- Basispreis, Sale, zeitlicher Sale (vor/während/nach)
- Mengenstaffeln (1 / 5 / 10 Stück)
- Kundengruppenpreis
- Prozent- und Festbetrag-Promotion
- zwei nicht kombinierbare Promotions → deterministisches Ergebnis
- Cross-Tenant: fremde Promotion/Kundengruppe wird ignoriert

Zusätzlich manuelle End-to-End-Prüfung im Browser: Preise setzen, Bulk-Aktion, Promotion anlegen, Preview-Ergebnis, Rechte mit einer Read-Only-Rolle.

## Technische Hinweise

- Preislogik ausschließlich in `pricing.server.ts`; Route-Komponenten rufen nur Server Functions auf.
- `*.functions.ts` bleiben dünne Wrapper, Server-Only-Module werden im Handler dynamisch importiert.
- Bestehende Phase-0/1-Funktionalität bleibt unverändert; nur der Produkteditor bekommt einen zusätzlichen Tab.
