-- EYIS Database Install Pack — Fremdschlüssel (relations-foreign-keys-b)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

ALTER TABLE public."delivery_notes" ADD CONSTRAINT "delivery_notes_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."delivery_notes" ADD CONSTRAINT "delivery_notes_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."demo_environments" ADD CONSTRAINT "demo_environments_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."document_branding" ADD CONSTRAINT "document_branding_logo_media_id_fkey" FOREIGN KEY (logo_media_id) REFERENCES media_assets(id) ON DELETE SET NULL;

ALTER TABLE public."document_branding" ADD CONSTRAINT "document_branding_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."document_branding" ADD CONSTRAINT "document_branding_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."document_files" ADD CONSTRAINT "document_files_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."document_files" ADD CONSTRAINT "document_files_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."document_sequences" ADD CONSTRAINT "document_sequences_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."document_sequences" ADD CONSTRAINT "document_sequences_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."fulfillment_items" ADD CONSTRAINT "fulfillment_items_fulfillment_id_fkey" FOREIGN KEY (fulfillment_id) REFERENCES fulfillments(id) ON DELETE CASCADE;

ALTER TABLE public."fulfillment_items" ADD CONSTRAINT "fulfillment_items_order_item_id_fkey" FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE;

ALTER TABLE public."fulfillment_items" ADD CONSTRAINT "fulfillment_items_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."fulfillments" ADD CONSTRAINT "fulfillments_location_id_fkey" FOREIGN KEY (location_id) REFERENCES inventory_locations(id) ON DELETE SET NULL;

ALTER TABLE public."fulfillments" ADD CONSTRAINT "fulfillments_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE public."fulfillments" ADD CONSTRAINT "fulfillments_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."fulfillments" ADD CONSTRAINT "fulfillments_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."guest_order_access_tokens" ADD CONSTRAINT "guest_order_access_tokens_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE public."guest_order_access_tokens" ADD CONSTRAINT "guest_order_access_tokens_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."guest_order_access_tokens" ADD CONSTRAINT "guest_order_access_tokens_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."idempotency_keys" ADD CONSTRAINT "idempotency_keys_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."integration_connections" ADD CONSTRAINT "integration_connections_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."integration_connections" ADD CONSTRAINT "integration_connections_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."integration_health" ADD CONSTRAINT "integration_health_connection_id_fkey" FOREIGN KEY (connection_id) REFERENCES integration_connections(id) ON DELETE CASCADE;

ALTER TABLE public."integration_health" ADD CONSTRAINT "integration_health_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."integration_health" ADD CONSTRAINT "integration_health_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."inventory_items" ADD CONSTRAINT "inventory_items_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."inventory_items" ADD CONSTRAINT "inventory_items_variant_id_fkey" FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE;

ALTER TABLE public."inventory_levels" ADD CONSTRAINT "inventory_levels_inventory_item_id_fkey" FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE;

ALTER TABLE public."inventory_levels" ADD CONSTRAINT "inventory_levels_location_id_fkey" FOREIGN KEY (location_id) REFERENCES inventory_locations(id) ON DELETE RESTRICT;

ALTER TABLE public."inventory_levels" ADD CONSTRAINT "inventory_levels_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."inventory_levels" ADD CONSTRAINT "inventory_levels_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."inventory_locations" ADD CONSTRAINT "inventory_locations_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."inventory_locations" ADD CONSTRAINT "inventory_locations_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."inventory_movements" ADD CONSTRAINT "inventory_movements_inventory_item_id_fkey" FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE;

ALTER TABLE public."inventory_movements" ADD CONSTRAINT "inventory_movements_location_id_fkey" FOREIGN KEY (location_id) REFERENCES inventory_locations(id) ON DELETE SET NULL;

ALTER TABLE public."inventory_movements" ADD CONSTRAINT "inventory_movements_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."inventory_movements" ADD CONSTRAINT "inventory_movements_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."inventory_reservations" ADD CONSTRAINT "inventory_reservations_inventory_item_id_fkey" FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE;

ALTER TABLE public."inventory_reservations" ADD CONSTRAINT "inventory_reservations_location_id_fkey" FOREIGN KEY (location_id) REFERENCES inventory_locations(id) ON DELETE SET NULL;

ALTER TABLE public."inventory_reservations" ADD CONSTRAINT "inventory_reservations_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."inventory_reservations" ADD CONSTRAINT "inventory_reservations_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."inventory_transfer_items" ADD CONSTRAINT "inventory_transfer_items_inventory_item_id_fkey" FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT;

ALTER TABLE public."inventory_transfer_items" ADD CONSTRAINT "inventory_transfer_items_transfer_id_fkey" FOREIGN KEY (transfer_id) REFERENCES inventory_transfers(id) ON DELETE CASCADE;

ALTER TABLE public."inventory_transfers" ADD CONSTRAINT "inventory_transfers_from_location_id_fkey" FOREIGN KEY (from_location_id) REFERENCES inventory_locations(id) ON DELETE RESTRICT;

ALTER TABLE public."inventory_transfers" ADD CONSTRAINT "inventory_transfers_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."inventory_transfers" ADD CONSTRAINT "inventory_transfers_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."inventory_transfers" ADD CONSTRAINT "inventory_transfers_to_location_id_fkey" FOREIGN KEY (to_location_id) REFERENCES inventory_locations(id) ON DELETE RESTRICT;

ALTER TABLE public."invitations" ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;

ALTER TABLE public."invoice_items" ADD CONSTRAINT "invoice_items_order_item_id_fkey" FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE SET NULL;

ALTER TABLE public."invoice_items" ADD CONSTRAINT "invoice_items_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."invoice_settings" ADD CONSTRAINT "invoice_settings_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."invoice_settings" ADD CONSTRAINT "invoice_settings_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;

ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."invoices" ADD CONSTRAINT "invoices_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."media_assets" ADD CONSTRAINT "media_assets_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."media_assets" ADD CONSTRAINT "media_assets_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL;

ALTER TABLE public."memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."oauth_states" ADD CONSTRAINT "oauth_states_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."oauth_states" ADD CONSTRAINT "oauth_states_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."order_addresses" ADD CONSTRAINT "order_addresses_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE public."order_addresses" ADD CONSTRAINT "order_addresses_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."order_promotions" ADD CONSTRAINT "order_promotions_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE public."order_promotions" ADD CONSTRAINT "order_promotions_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."orders" ADD CONSTRAINT "orders_cart_id_fkey" FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE SET NULL;

ALTER TABLE public."orders" ADD CONSTRAINT "orders_checkout_session_id_fkey" FOREIGN KEY (checkout_session_id) REFERENCES checkout_sessions(id) ON DELETE RESTRICT;

ALTER TABLE public."orders" ADD CONSTRAINT "orders_checkout_snapshot_id_fkey" FOREIGN KEY (checkout_snapshot_id) REFERENCES checkout_snapshots(id) ON DELETE RESTRICT;

ALTER TABLE public."orders" ADD CONSTRAINT "orders_customer_fk" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public."orders" ADD CONSTRAINT "orders_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."orders" ADD CONSTRAINT "orders_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."orders" ADD CONSTRAINT "orders_tax_snapshot_id_fkey" FOREIGN KEY (tax_snapshot_id) REFERENCES tax_snapshots(id) ON DELETE SET NULL;

ALTER TABLE public."outbox_events" ADD CONSTRAINT "outbox_events_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."outbox_events" ADD CONSTRAINT "outbox_events_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."outgoing_webhook_endpoints" ADD CONSTRAINT "outgoing_webhook_endpoints_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."outgoing_webhook_endpoints" ADD CONSTRAINT "outgoing_webhook_endpoints_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."package_items" ADD CONSTRAINT "package_items_fulfillment_item_id_fkey" FOREIGN KEY (fulfillment_item_id) REFERENCES fulfillment_items(id) ON DELETE CASCADE;

ALTER TABLE public."package_items" ADD CONSTRAINT "package_items_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."package_items" ADD CONSTRAINT "package_items_package_id_fkey" FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE;

ALTER TABLE public."package_presets" ADD CONSTRAINT "package_presets_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."package_presets" ADD CONSTRAINT "package_presets_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."packages" ADD CONSTRAINT "packages_fulfillment_id_fkey" FOREIGN KEY (fulfillment_id) REFERENCES fulfillments(id) ON DELETE CASCADE;

ALTER TABLE public."packages" ADD CONSTRAINT "packages_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."packages" ADD CONSTRAINT "packages_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."payment_attempts" ADD CONSTRAINT "payment_attempts_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."payment_attempts" ADD CONSTRAINT "payment_attempts_payment_session_id_fkey" FOREIGN KEY (payment_session_id) REFERENCES payment_sessions(id) ON DELETE CASCADE;

ALTER TABLE public."payment_events" ADD CONSTRAINT "payment_events_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE public."payment_provider_configs" ADD CONSTRAINT "payment_provider_configs_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."payment_provider_configs" ADD CONSTRAINT "payment_provider_configs_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."payment_sessions" ADD CONSTRAINT "payment_sessions_checkout_session_id_fkey" FOREIGN KEY (checkout_session_id) REFERENCES checkout_sessions(id) ON DELETE CASCADE;

ALTER TABLE public."payment_sessions" ADD CONSTRAINT "payment_sessions_checkout_snapshot_id_fkey" FOREIGN KEY (checkout_snapshot_id) REFERENCES checkout_snapshots(id) ON DELETE CASCADE;

ALTER TABLE public."payment_sessions" ADD CONSTRAINT "payment_sessions_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."payment_sessions" ADD CONSTRAINT "payment_sessions_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."payment_transactions" ADD CONSTRAINT "payment_transactions_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE public."payment_transactions" ADD CONSTRAINT "payment_transactions_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."payment_transactions" ADD CONSTRAINT "payment_transactions_payment_session_id_fkey" FOREIGN KEY (payment_session_id) REFERENCES payment_sessions(id) ON DELETE SET NULL;

ALTER TABLE public."price_sets" ADD CONSTRAINT "price_sets_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."price_sets" ADD CONSTRAINT "price_sets_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE public."price_sets" ADD CONSTRAINT "price_sets_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."price_sets" ADD CONSTRAINT "price_sets_variant_id_fkey" FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE;

ALTER TABLE public."prices" ADD CONSTRAINT "prices_customer_group_id_fkey" FOREIGN KEY (customer_group_id) REFERENCES customer_groups(id) ON DELETE CASCADE;

ALTER TABLE public."prices" ADD CONSTRAINT "prices_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."prices" ADD CONSTRAINT "prices_price_set_id_fkey" FOREIGN KEY (price_set_id) REFERENCES price_sets(id) ON DELETE CASCADE;

ALTER TABLE public."prices" ADD CONSTRAINT "prices_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."product_blueprints" ADD CONSTRAINT "product_blueprints_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."product_categories" ADD CONSTRAINT "product_categories_category_id_fkey" FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;

ALTER TABLE public."product_categories" ADD CONSTRAINT "product_categories_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE public."product_collections" ADD CONSTRAINT "product_collections_collection_id_fkey" FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE;

ALTER TABLE public."product_collections" ADD CONSTRAINT "product_collections_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
