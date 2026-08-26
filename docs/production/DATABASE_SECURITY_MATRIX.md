# Datenbank-Sicherheitsmatrix

Stand: Gate A4 (Phase 14, Production Hardening). Alle Angaben sind direkt aus dem
Datenbankkatalog der laufenden Umgebung erzeugt, nicht von Hand gepflegt.

## Kennzahlen

| Kennzahl | Wert |
| --- | --- |
| Tabellen im Schema `public` | 112 |
| Tabellen mit aktivem Row Level Security | 112 (100 %) |
| Zugriffsregeln (Policies) | 188 |
| SECURITY-DEFINER-Funktionen | 86 |
| davon für angemeldete Nutzer ausführbar | 7 |
| davon nur serverseitig ausführbar | 79 |
| Storage-Buckets | 3, alle privat |
| Storage-Policies | 8 |

## Zugriffsmodell in einem Satz

Anonyme Besucher haben **keinerlei** direkten Tabellenzugriff. Angemeldete
Nutzer sehen ausschließlich Daten ihrer eigenen Organisation, durchgesetzt über
Row Level Security. Sämtliche Schreibvorgänge des Shops und der öffentlichen
Store-API laufen über geprüfte Serverfunktionen mit erhöhten Rechten.

## Rollen und Rechte

| Rolle | Tabellenrechte | Funktionsrechte |
| --- | --- | --- |
| `anon` (nicht angemeldet) | keine | keine |
| `authenticated` (angemeldet) | pro Tabelle nur die Operationen, für die eine Policy existiert | nur die 7 RLS-Hilfsfunktionen |
| `service_role` (Serverfunktionen) | vollständig, RLS wird bewusst umgangen | alle |

Der `service_role`-Schlüssel wird ausschließlich serverseitig verwendet und ist
nicht Teil des Browser-Bundles.

## Tabellenübersicht

Spalte „Mandantenbezug“: `org` = Zeile gehört einer Organisation, `+shop`
zusätzlich einem Shop, `global` = organisationsunabhängige Systemtabelle.
Tabellen mit „0 (server-only)“ haben bewusst keine Policy und sind damit über
die Daten-API vollständig gesperrt.

| Tabelle | RLS | Policies | GRANTs | Mandantenbezug | Schutz-Trigger |
| --- | --- | --- | --- | --- | --- |
| `audit_log` | ja | 1 | authenticated, service_role | org | audit_log_immutable, audit_log_immutable |
| `automation_action_executions` | ja | 2 | authenticated, service_role | org | — |
| `automation_actions` | ja | 2 | authenticated, service_role | org | — |
| `automation_executions` | ja | 2 | authenticated, service_role | org+shop | — |
| `automation_jobs` | ja | 1 | authenticated, service_role | org+shop | — |
| `automation_rule_counters` | ja | **0 (server-only)** | service_role | global | — |
| `automation_rule_versions` | ja | 2 | authenticated, service_role | org | automation_version_guard |
| `automation_rules` | ja | 2 | authenticated, service_role | org+shop | — |
| `cart_item_price_snapshots` | ja | 1 | authenticated, service_role | org | snapshot_immutable |
| `cart_items` | ja | 1 | authenticated, service_role | org+shop | — |
| `cart_price_snapshots` | ja | 1 | authenticated, service_role | org+shop | snapshot_immutable |
| `cart_promotion_codes` | ja | 1 | authenticated, service_role | org+shop | — |
| `carts` | ja | 1 | authenticated, service_role | org+shop | — |
| `categories` | ja | 2 | authenticated, service_role | org+shop | — |
| `checkout_addresses` | ja | 1 | authenticated, service_role | org+shop | — |
| `checkout_reservations` | ja | 1 | authenticated, service_role | org+shop | — |
| `checkout_sessions` | ja | 1 | authenticated, service_role | org+shop | — |
| `checkout_snapshots` | ja | 1 | authenticated, service_role | org+shop | snapshot_immutable |
| `collections` | ja | 2 | authenticated, service_role | org+shop | — |
| `communication_attempts` | ja | 1 | authenticated, service_role | org | — |
| `communication_branding` | ja | 2 | authenticated, service_role | org+shop | — |
| `communication_provider_configs` | ja | 2 | authenticated, service_role | org+shop | — |
| `communication_provider_events` | ja | 1 | authenticated, service_role | org+shop | communication_provider_event_guard |
| `communication_rules` | ja | 2 | authenticated, service_role | org+shop | — |
| `communication_suppressions` | ja | 2 | authenticated, service_role | org+shop | — |
| `communication_template_versions` | ja | 2 | authenticated, service_role | global | comm_template_version_guard |
| `communication_templates` | ja | 2 | authenticated, service_role | org+shop | — |
| `communications` | ja | 1 | authenticated, service_role | org+shop | communication_snapshot_guard |
| `credit_note_items` | ja | 2 | authenticated, service_role | org | — |
| `credit_notes` | ja | 2 | authenticated, service_role | org+shop | credit_note_guard |
| `customer_addresses` | ja | 6 | authenticated, service_role | org+shop | — |
| `customer_group_members` | ja | 2 | authenticated, service_role | org | — |
| `customer_groups` | ja | 2 | authenticated, service_role | org+shop | — |
| `customer_notes` | ja | 1 | authenticated, service_role | org | — |
| `customers` | ja | 3 | authenticated, service_role | org+shop | — |
| `delivery_notes` | ja | 2 | authenticated, service_role | org+shop | — |
| `document_branding` | ja | 2 | authenticated, service_role | org+shop | — |
| `document_files` | ja | 2 | authenticated, service_role | org+shop | document_files_guard |
| `document_sequences` | ja | 2 | authenticated, service_role | org+shop | — |
| `fulfillment_items` | ja | 2 | authenticated, service_role | org | fulfillment_items_guard |
| `fulfillments` | ja | 2 | authenticated, service_role | org+shop | — |
| `guest_order_access_tokens` | ja | 1 | authenticated, service_role | org+shop | — |
| `idempotency_keys` | ja | **0 (server-only)** | service_role | org | — |
| `inventory_items` | ja | 1 | authenticated, service_role | org | — |
| `inventory_levels` | ja | 1 | authenticated, service_role | org+shop | — |
| `inventory_locations` | ja | 3 | authenticated, service_role | org+shop | — |
| `inventory_movements` | ja | 1 | authenticated, service_role | org+shop | inventory_movements_immutable, inventory_movements_immutable |
| `inventory_reservations` | ja | 1 | authenticated, service_role | org+shop | — |
| `inventory_transfer_items` | ja | 1 | authenticated, service_role | global | — |
| `inventory_transfers` | ja | 1 | authenticated, service_role | org+shop | — |
| `invitations` | ja | 1 | authenticated, service_role | org | — |
| `invoice_items` | ja | 2 | authenticated, service_role | org | invoice_items_guard |
| `invoice_settings` | ja | 2 | authenticated, service_role | org+shop | — |
| `invoices` | ja | 2 | authenticated, service_role | org+shop | invoice_guard |
| `media_assets` | ja | 4 | authenticated, service_role | org+shop | — |
| `memberships` | ja | 3 | authenticated, service_role | org | — |
| `order_addresses` | ja | 1 | authenticated, service_role | org | snapshot_immutable |
| `order_items` | ja | 1 | authenticated, service_role | org | snapshot_immutable |
| `order_promotions` | ja | 1 | authenticated, service_role | org | snapshot_immutable |
| `orders` | ja | 1 | authenticated, service_role | org+shop | — |
| `organizations` | ja | 2 | authenticated, service_role | global | — |
| `outbox_events` | ja | **0 (server-only)** | service_role | org+shop | — |
| `outgoing_webhook_endpoints` | ja | 2 | authenticated, service_role | org+shop | — |
| `package_items` | ja | 2 | authenticated, service_role | org | — |
| `package_presets` | ja | 2 | authenticated, service_role | org+shop | — |
| `packages` | ja | 2 | authenticated, service_role | org+shop | — |
| `payment_attempts` | ja | 1 | authenticated, service_role | org | — |
| `payment_events` | ja | 1 | authenticated, service_role | org | payment_events_immutable, payment_events_immutable |
| `payment_provider_configs` | ja | 1 | authenticated, service_role | org+shop | — |
| `payment_sessions` | ja | 1 | authenticated, service_role | org+shop | — |
| `payment_transactions` | ja | 1 | authenticated, service_role | org | — |
| `price_sets` | ja | 2 | authenticated, service_role | org+shop | — |
| `prices` | ja | 2 | authenticated, service_role | org+shop | — |
| `product_blueprints` | ja | 4 | authenticated, service_role | org | — |
| `product_categories` | ja | 2 | authenticated, service_role | global | — |
| `product_collections` | ja | 2 | authenticated, service_role | global | — |
| `product_media` | ja | 2 | authenticated, service_role | global | — |
| `product_option_values` | ja | 2 | authenticated, service_role | global | — |
| `product_options` | ja | 2 | authenticated, service_role | global | — |
| `product_variants` | ja | 2 | authenticated, service_role | org | — |
| `products` | ja | 3 | authenticated, service_role | org+shop | — |
| `profiles` | ja | 2 | authenticated, service_role | global | — |
| `promotions` | ja | 2 | authenticated, service_role | org+shop | — |
| `refunds` | ja | 1 | authenticated, service_role | org | — |
| `return_items` | ja | 3 | authenticated, service_role | org | — |
| `return_media` | ja | 2 | authenticated, service_role | org | — |
| `return_sequences` | ja | 1 | authenticated, service_role | org+shop | — |
| `return_settings` | ja | 2 | authenticated, service_role | org+shop | — |
| `returns` | ja | 3 | authenticated, service_role | org+shop | — |
| `role_permissions` | ja | 1 | authenticated, service_role | global | — |
| `sender_identities` | ja | 2 | authenticated, service_role | org+shop | — |
| `shipments` | ja | 2 | authenticated, service_role | org+shop | — |
| `shipping_labels` | ja | 2 | authenticated, service_role | org+shop | — |
| `shipping_methods` | ja | 1 | authenticated, service_role | org+shop | — |
| `shipping_provider_configs` | ja | 2 | authenticated, service_role | org+shop | — |
| `shop_domains` | ja | 2 | authenticated, service_role | org+shop | — |
| `shop_order_sequences` | ja | 1 | authenticated, service_role | org+shop | — |
| `shops` | ja | 4 | authenticated, service_role | org | — |
| `stock_alert_rules` | ja | 2 | authenticated, service_role | org+shop | — |
| `store_api_keys` | ja | 2 | authenticated, service_role | org+shop | — |
| `store_api_rate_counters` | ja | **0 (server-only)** | service_role | global | — |
| `store_api_request_logs` | ja | 1 | authenticated, service_role | org+shop | — |
| `store_confirmation_tokens` | ja | **0 (server-only)** | service_role | org+shop | — |
| `store_privacy_salts` | ja | **0 (server-only)** | service_role | global | — |
| `tasks` | ja | 2 | authenticated, service_role | org+shop | — |
| `tax_classes` | ja | 2 | authenticated, service_role | org+shop | — |
| `tax_rates` | ja | 2 | authenticated, service_role | org+shop | — |
| `tax_settings` | ja | 2 | authenticated, service_role | org+shop | — |
| `tax_snapshots` | ja | 1 | authenticated, service_role | org+shop | tax_snapshot_immutable |
| `tracking_events` | ja | 1 | authenticated, service_role | org+shop | tracking_events_immutable |
| `variant_option_values` | ja | 2 | authenticated, service_role | global | — |
| `vat_validations` | ja | 2 | authenticated, service_role | org | — |

## SECURITY-DEFINER-Funktionen

Jede Funktion hat einen fest gesetzten `search_path` und kann damit nicht über
untergeschobene Objekte umgeleitet werden.

| Funktion | Ausführbar durch | Konfiguration |
| --- | --- | --- |
| `automation_check_limits` | nur service_role | search_path=public |
| `automation_claim_jobs` | nur service_role | search_path=public |
| `automation_record_error` | nur service_role | search_path=public |
| `bulk_update_prices` | nur service_role | search_path=public |
| `can_view_profile` | authenticated | search_path=public |
| `cart_cancel_checkout` | nur service_role | search_path=public |
| `cart_expire_checkout_sessions` | nur service_role | search_path=public |
| `cart_pick_location` | nur service_role | search_path=public |
| `cart_release_session_reservations` | nur service_role | search_path=public |
| `cart_start_checkout` | nur service_role | search_path=public |
| `comm_ensure_shop_defaults` | nur service_role | search_path=public |
| `comm_template_version_guard` | nur service_role | search_path=public |
| `communication_provider_event_guard` | nur service_role | search_path=public |
| `communication_snapshot_guard` | nur service_role | search_path=public |
| `credit_note_create` | nur service_role | search_path=public |
| `credit_note_issue` | nur service_role | search_path=public |
| `current_org_ids` | authenticated | search_path=public |
| `delivery_note_create` | nur service_role | search_path=public |
| `doc_assert` | nur service_role | search_path=public |
| `doc_branding_snapshot` | nur service_role | search_path=public |
| `doc_next_number` | nur service_role | search_path=public |
| `doc_seller_snapshot` | nur service_role | search_path=public |
| `doc_setup_missing` | nur service_role | search_path=public |
| `ful_cancel` | nur service_role | search_path=public |
| `ful_complete_picking` | nur service_role | search_path=public |
| `ful_create` | nur service_role | search_path=public |
| `ful_pack` | nur service_role | search_path=public |
| `ful_recompute_order_status` | nur service_role | search_path=public |
| `ful_start_picking` | nur service_role | search_path=public |
| `handle_new_user` | nur service_role | search_path=public |
| `has_org_role` | authenticated | search_path=public |
| `has_permission` | authenticated | search_path=public |
| `inv_adjust_stock` | nur service_role | search_path=public |
| `inv_assert` | nur service_role | search_path=public |
| `inv_audit` | nur service_role | search_path=public |
| `inv_commit_reservation` | nur service_role | search_path=public |
| `inv_event` | nur service_role | search_path=public |
| `inv_expire_reservations` | nur service_role | search_path=public |
| `inv_health_check` | nur service_role | search_path=public |
| `inv_idem_get` | nur service_role | search_path=public |
| `inv_idem_put` | nur service_role | search_path=public |
| `inv_lock_level` | nur service_role | search_path=public |
| `inv_mark_damaged` | nur service_role | search_path=public |
| `inv_movement` | nur service_role | search_path=public |
| `inv_receive_stock` | nur service_role | search_path=public |
| `inv_release_reservation` | nur service_role | search_path=public |
| `inv_reserve_stock` | nur service_role | search_path=public |
| `inv_status_events` | nur service_role | search_path=public |
| `inv_transfer_cancel` | nur service_role | search_path=public |
| `inv_transfer_complete` | nur service_role | search_path=public |
| `inv_transfer_start` | nur service_role | search_path=public |
| `invoice_create_from_order` | nur service_role | search_path=public |
| `invoice_issue` | nur service_role | search_path=public |
| `invoice_void` | nur service_role | search_path=public |
| `is_org_member` | authenticated | search_path=public |
| `ops_expire_due` | nur service_role | search_path=public |
| `order_cancel` | nur service_role | search_path=public |
| `order_finalize_from_payment` | nur service_role | search_path=public |
| `order_next_number` | nur service_role | search_path=public |
| `prices_validate` | nur service_role | search_path=public |
| `protect_last_owner` | nur service_role | search_path=public |
| `refund_create` | nur service_role | search_path=public |
| `refund_settle` | nur service_role | search_path=public |
| `ret_assert` | nur service_role | search_path=public |
| `ret_authorize` | nur service_role | search_path=public |
| `ret_cancel` | nur service_role | search_path=public |
| `ret_complete` | nur service_role | search_path=public |
| `ret_inspect` | nur service_role | search_path=public |
| `ret_link_settlement` | nur service_role | search_path=public |
| `ret_mark_in_transit` | nur service_role | search_path=public |
| `ret_next_number` | nur service_role | search_path=public |
| `ret_receive` | nur service_role | search_path=public |
| `ret_reject` | nur service_role | search_path=public |
| `ret_request` | nur service_role | search_path=public |
| `ret_restock` | nur service_role | search_path=public |
| `ret_returned_qty` | nur service_role | search_path=public |
| `ret_start_inspection` | nur service_role | search_path=public |
| `shares_org_with` | authenticated | search_path=public |
| `ship_cancel` | nur service_role | search_path=public |
| `ship_create` | nur service_role | search_path=public |
| `ship_mark_shipped` | nur service_role | search_path=public |
| `ship_record_label` | nur service_role | search_path=public |
| `shop_in_org` | authenticated | search_path=public |
| `store_current_ip_salt` | nur service_role | search_path=public |
| `store_rate_hit` | nur service_role | search_path=public |
| `track_record_event` | nur service_role | search_path=public |

## Storage

| Bucket | Sichtbarkeit | Größenlimit | MIME-Prüfung |
| --- | --- | --- | --- |
| `documents` | privat | 20 MB | in der Anwendungsschicht |
| `media` | privat | 25 MB | in der Anwendungsschicht |
| `shipping-labels` | privat | 20 MB | in der Anwendungsschicht |

| Storage-Policy | Operation |
| --- | --- |
| `documents_read` | SELECT |
| `documents_write` | INSERT |
| `media_delete_own_org` | DELETE |
| `media_insert_own_org` | INSERT |
| `media_read_own_org` | SELECT |
| `media_update_own_org` | UPDATE |
| `shipping_labels_storage_read` | SELECT |
| `shipping_labels_storage_write` | INSERT |

Jede Storage-Policy prüft den ersten Pfadabschnitt gegen die Organisation des
Nutzers. Dateien liegen deshalb immer unter `<organisation>/…`.

Die Begrenzung erlaubter Dateitypen auf Bucket-Ebene ist plattformseitig nicht
setzbar. Sie wird stattdessen beim Hochladen in der Anwendungsschicht
durchgesetzt (Allowlist ohne SVG, Größenprüfung, Pfadvalidierung).

## Bewusst akzeptierte Punkte

- Sechs Systemtabellen (`outbox_events`, `idempotency_keys`,
  `automation_rule_counters`, `store_api_rate_counters`,
  `store_confirmation_tokens`, `store_privacy_salts`) haben RLS aktiv, aber
  keine Policy und keine GRANTs. Das sperrt sie über die Daten-API vollständig;
  Zugriff besteht nur serverseitig.
- Sieben Hilfsfunktionen bleiben für angemeldete Nutzer ausführbar, weil die
  Zugriffsregeln sie benötigen. Sie geben ausschließlich Ja/Nein-Antworten zur
  eigenen Mitgliedschaft zurück und legen keine fremden Daten offen.
