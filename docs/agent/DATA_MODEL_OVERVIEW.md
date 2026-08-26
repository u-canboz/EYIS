# Datenmodell — Überblick

112 Tabellen im Schema `public`, alle Fachtabellen mit RLS. Verbindlich sind die Migrationen unter
`supabase/migrations/` und die Datenbank selbst; diese Seite ordnet ein.
Detailmatrix: `docs/production/DATABASE_SECURITY_MATRIX.md`. Tabellen je Modul:
[modules.json](modules.json).

## Mandantenachse

```text
organizations ──< shops ──< (fast alle Fachdaten)
              └─< memberships >── profiles (auth.users)
```

- `organization_id` steht auf jeder Fachtabelle.
- `shop_id` zusätzlich auf allem Transaktionalen (Katalog, Warenkorb, Bestellung, Dokumente …).
- Rollen ausschließlich in `memberships`/`role_permissions`.
- Kein Fremdschlüssel zeigt direkt auf `auth.users`; die Brücke ist `profiles`.

## Bereiche

| Bereich | Kern-Tabellen |
| --- | --- |
| Katalog | `products`, `product_variants`, `product_options`, `variant_option_values`, `product_blueprints`, `categories`, `collections`, `product_media`, `media_assets` |
| Preise | `price_sets`, `prices`, `promotions` |
| Bestand | `inventory_items`, `inventory_levels`, `inventory_locations`, `inventory_movements`, `inventory_reservations`, `inventory_transfers` |
| Warenkorb | `carts`, `cart_items`, `cart_price_snapshots`, `cart_item_price_snapshots`, `cart_promotion_codes` |
| Checkout | `checkout_sessions`, `checkout_addresses`, `checkout_snapshots`, `checkout_reservations` |
| Zahlung | `payment_sessions`, `payment_attempts`, `payment_transactions`, `payment_events`, `refunds` |
| Bestellung | `orders`, `order_items`, `order_addresses`, `order_promotions` |
| Steuern | `tax_classes`, `tax_rates`, `tax_settings`, `tax_snapshots`, `vat_validations` |
| Versand | `shipping_methods`, `fulfillments`, `fulfillment_items`, `packages`, `shipments`, `shipping_labels`, `tracking_events`, `delivery_notes` |
| Dokumente | `invoices`, `invoice_items`, `credit_notes`, `credit_note_items`, `document_files`, `document_sequences` |
| Kunden | `customers`, `customer_addresses`, `customer_groups`, `customer_group_members`, `customer_notes` |
| Retouren | `returns`, `return_items`, `return_media`, `return_settings`, `return_sequences` |
| Kommunikation | `communications`, `communication_templates`, `communication_attempts`, `communication_suppressions`, `sender_identities` |
| Automation | `automation_rules`, `automation_actions`, `automation_executions`, `automation_jobs`, `outbox_events`, `outgoing_webhook_endpoints`, `tasks` |
| Store API | `store_api_keys`, `store_api_request_logs`, `store_api_rate_counters`, `store_privacy_salts`, `store_confirmation_tokens` |
| Demo/QA | `demo_environments`, `qa_fixtures` |
| Betrieb | `audit_log`, `idempotency_keys` |

## Unveränderliche Daten

- `tax_snapshots` — per Trigger gegen Änderung geschützt.
- Ausgestellte `invoices` und `credit_notes` samt Positionen.
- `order_items` nach Bestellabschluss.
- `payment_events` — append-only.
- Nummernkreise (`document_sequences`, `shop_order_sequences`, `return_sequences`) sind lückenlos
  und werden nie zurückgesetzt.

## Snapshot-Prinzip

Preis, Steuer und Adresse werden zum Zeitpunkt des Geschäftsvorfalls kopiert. Eine spätere Änderung
am Produkt, am Steuersatz oder am Kundenkonto verändert bestehende Bestellungen und Belege nicht.

## Storage

Drei private Buckets (Medien, Dokumente, Retouren-Nachweise). Kein öffentlicher Bucket. Zugriff nur
über signierte URLs nach Berechtigungsprüfung; Storage-Policies sind mandantengebunden.

## Datenbankfunktionen (Auswahl)

| Funktion | Zweck |
| --- | --- |
| `has_permission` | Rollen-/Rechteprüfung in Policies (SECURITY DEFINER, festes `search_path`) |
| `health_run_checks` | 45 Integritäts- und Konsistenzprüfungen |
| `ops_expire_due` | Abgelaufene Warenkörbe, Reservierungen und Tokens aufräumen |
| `demo_purge_organization` | Vollständiges Entfernen einer Demo-/QA-Organisation |
