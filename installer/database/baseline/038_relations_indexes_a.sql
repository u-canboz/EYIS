-- EYIS Database Install Pack — Indexe (relations-indexes-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

CREATE INDEX audit_log_org_created_idx ON public.audit_log USING btree (organization_id, created_at DESC);

CREATE UNIQUE INDEX automation_executions_event_uniq ON public.automation_executions USING btree (rule_id, source_event_id) WHERE ((source_event_id IS NOT NULL) AND (retry_of_execution_id IS NULL));

CREATE INDEX automation_executions_rule_idx ON public.automation_executions USING btree (rule_id, created_at DESC);

CREATE INDEX automation_executions_status_idx ON public.automation_executions USING btree (organization_id, status, created_at DESC);

CREATE UNIQUE INDEX automation_jobs_dedupe_uniq ON public.automation_jobs USING btree (dedupe_key) WHERE (dedupe_key IS NOT NULL);

CREATE INDEX automation_jobs_queue_idx ON public.automation_jobs USING btree (status, available_at);

CREATE INDEX automation_rules_lookup_idx ON public.automation_rules USING btree (organization_id, shop_id, status, trigger_type);

CREATE INDEX cart_item_price_snapshots_snapshot_idx ON public.cart_item_price_snapshots USING btree (snapshot_id);

CREATE INDEX cart_items_cart_idx ON public.cart_items USING btree (cart_id);

CREATE INDEX cart_items_org_shop_idx ON public.cart_items USING btree (organization_id, shop_id);

CREATE INDEX cart_items_variant_idx ON public.cart_items USING btree (variant_id);

CREATE INDEX cart_price_snapshots_cart_idx ON public.cart_price_snapshots USING btree (cart_id, version DESC);

CREATE INDEX cart_promotion_codes_cart_idx ON public.cart_promotion_codes USING btree (cart_id);

CREATE INDEX carts_customer_idx ON public.carts USING btree (customer_id);

CREATE INDEX carts_expires_idx ON public.carts USING btree (expires_at);

CREATE INDEX carts_org_shop_idx ON public.carts USING btree (organization_id, shop_id);

CREATE INDEX carts_status_idx ON public.carts USING btree (status);

CREATE UNIQUE INDEX carts_token_hash_idx ON public.carts USING btree (anonymous_token_hash) WHERE (anonymous_token_hash IS NOT NULL);

CREATE INDEX categories_org_idx ON public.categories USING btree (organization_id);

CREATE INDEX categories_parent_idx ON public.categories USING btree (parent_id);

CREATE UNIQUE INDEX categories_shop_handle_unique ON public.categories USING btree (shop_id, handle);

CREATE INDEX checkout_addresses_session_idx ON public.checkout_addresses USING btree (checkout_session_id);

CREATE INDEX checkout_reservations_cart_idx ON public.checkout_reservations USING btree (cart_id);

CREATE INDEX checkout_reservations_session_idx ON public.checkout_reservations USING btree (checkout_session_id);

CREATE INDEX checkout_sessions_cart_idx ON public.checkout_sessions USING btree (cart_id);

CREATE INDEX checkout_sessions_expires_idx ON public.checkout_sessions USING btree (expires_at);

CREATE UNIQUE INDEX checkout_sessions_one_open_per_cart ON public.checkout_sessions USING btree (cart_id) WHERE (status = ANY (ARRAY['open'::checkout_session_status, 'validated'::checkout_session_status, 'awaiting_payment'::checkout_session_status]));

CREATE INDEX checkout_sessions_org_shop_idx ON public.checkout_sessions USING btree (organization_id, shop_id);

CREATE INDEX checkout_sessions_status_idx ON public.checkout_sessions USING btree (status);

CREATE INDEX checkout_snapshots_session_idx ON public.checkout_snapshots USING btree (checkout_session_id, version DESC);

CREATE INDEX collections_org_idx ON public.collections USING btree (organization_id);

CREATE UNIQUE INDEX collections_shop_handle_unique ON public.collections USING btree (shop_id, handle);

CREATE INDEX comm_attempts_msg_idx ON public.communication_attempts USING btree (provider, provider_message_id);

CREATE INDEX cpe_pending_idx ON public.communication_provider_events USING btree (processing_status, received_at);

CREATE INDEX comm_rules_event_idx ON public.communication_rules USING btree (event_type, enabled);

CREATE INDEX csup_address_idx ON public.communication_suppressions USING btree (channel, lower(address));

CREATE INDEX ctv_template_idx ON public.communication_template_versions USING btree (template_id, locale, version DESC);

CREATE UNIQUE INDEX comm_templates_org_key_idx ON public.communication_templates USING btree (organization_id, COALESCE(shop_id, '00000000-0000-0000-0000-000000000000'::uuid), key, channel) WHERE (organization_id IS NOT NULL);

CREATE UNIQUE INDEX comm_templates_system_key_idx ON public.communication_templates USING btree (key, channel) WHERE (organization_id IS NULL);

CREATE INDEX communications_customer_idx ON public.communications USING btree (customer_id);

CREATE UNIQUE INDEX communications_event_idem_idx ON public.communications USING btree (shop_id, source_event_id, communication_rule_id, recipient_address) WHERE ((source_event_id IS NOT NULL) AND (communication_rule_id IS NOT NULL));

CREATE INDEX communications_order_idx ON public.communications USING btree (order_id);

CREATE INDEX communications_queue_idx ON public.communications USING btree (status, scheduled_at) WHERE (status = 'queued'::communication_status);

CREATE INDEX communications_recipient_idx ON public.communications USING btree (shop_id, recipient_address);

CREATE INDEX communications_status_idx ON public.communications USING btree (organization_id, status, created_at DESC);

CREATE INDEX credit_notes_invoice_idx ON public.credit_notes USING btree (invoice_id);

CREATE INDEX customer_addresses_customer_idx ON public.customer_addresses USING btree (customer_id);

CREATE UNIQUE INDEX customer_groups_shop_handle_idx ON public.customer_groups USING btree (shop_id, handle);

CREATE INDEX customer_notes_customer_idx ON public.customer_notes USING btree (customer_id, created_at DESC);

CREATE INDEX customers_auth_user_idx ON public.customers USING btree (auth_user_id);

CREATE INDEX customers_org_idx ON public.customers USING btree (organization_id, status);

CREATE UNIQUE INDEX customers_shop_auth_user_key ON public.customers USING btree (shop_id, auth_user_id) WHERE (auth_user_id IS NOT NULL);

CREATE UNIQUE INDEX customers_shop_email_key ON public.customers USING btree (shop_id, lower(email));

CREATE INDEX document_files_doc_idx ON public.document_files USING btree (document_id, format, version DESC);

CREATE INDEX fulfillment_items_ful_idx ON public.fulfillment_items USING btree (fulfillment_id);

CREATE INDEX fulfillment_items_order_item_idx ON public.fulfillment_items USING btree (order_item_id);

CREATE INDEX fulfillments_location_idx ON public.fulfillments USING btree (location_id, status);

CREATE INDEX fulfillments_order_idx ON public.fulfillments USING btree (order_id);

CREATE INDEX fulfillments_org_idx ON public.fulfillments USING btree (organization_id, status, created_at DESC);

CREATE INDEX fulfillments_shop_idx ON public.fulfillments USING btree (shop_id, status);

CREATE INDEX guest_tokens_order_idx ON public.guest_order_access_tokens USING btree (order_id);

CREATE UNIQUE INDEX idx_idem_keys_unique ON public.idempotency_keys USING btree (organization_id, endpoint, key);

CREATE INDEX integration_health_org_idx ON public.integration_health USING btree (organization_id);

CREATE INDEX idx_inv_items_barcode ON public.inventory_items USING btree (organization_id, barcode);

CREATE INDEX idx_inv_items_org ON public.inventory_items USING btree (organization_id);

CREATE INDEX idx_inv_items_sku ON public.inventory_items USING btree (organization_id, sku);

CREATE INDEX idx_inv_levels_loc ON public.inventory_levels USING btree (location_id);

CREATE INDEX idx_inv_levels_org ON public.inventory_levels USING btree (organization_id);

CREATE INDEX idx_inv_levels_shop ON public.inventory_levels USING btree (shop_id);

CREATE INDEX idx_inv_locations_org ON public.inventory_locations USING btree (organization_id);

CREATE INDEX idx_inv_locations_shop ON public.inventory_locations USING btree (shop_id, priority);

CREATE INDEX idx_inv_mov_item ON public.inventory_movements USING btree (inventory_item_id, created_at DESC);

CREATE INDEX idx_inv_mov_loc ON public.inventory_movements USING btree (location_id);

CREATE INDEX idx_inv_mov_org_created ON public.inventory_movements USING btree (organization_id, created_at DESC);

CREATE INDEX idx_inv_mov_ref ON public.inventory_movements USING btree (reference_type, reference_id);

CREATE INDEX idx_inv_mov_type ON public.inventory_movements USING btree (movement_type);

CREATE INDEX idx_inv_res_created ON public.inventory_reservations USING btree (created_at DESC);

CREATE INDEX idx_inv_res_expires ON public.inventory_reservations USING btree (expires_at) WHERE (status = 'active'::reservation_status);

CREATE UNIQUE INDEX idx_inv_res_idem ON public.inventory_reservations USING btree (organization_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);

CREATE INDEX idx_inv_res_item ON public.inventory_reservations USING btree (inventory_item_id, status);

CREATE INDEX idx_inv_res_org ON public.inventory_reservations USING btree (organization_id, status);

CREATE INDEX idx_inv_transfer_items_transfer ON public.inventory_transfer_items USING btree (transfer_id);

CREATE INDEX idx_inv_transfers_org ON public.inventory_transfers USING btree (organization_id, status, created_at DESC);

CREATE UNIQUE INDEX invitations_one_pending_per_email ON public.invitations USING btree (organization_id, lower(email)) WHERE (status = 'pending'::invitation_status);

CREATE UNIQUE INDEX invoices_one_active_per_order ON public.invoices USING btree (order_id) WHERE (status <> 'voided'::invoice_status);

CREATE INDEX invoices_org_status_idx ON public.invoices USING btree (organization_id, status, created_at DESC);

CREATE INDEX media_assets_org_idx ON public.media_assets USING btree (organization_id, created_at DESC);

CREATE UNIQUE INDEX media_assets_path_unique ON public.media_assets USING btree (storage_path);

CREATE INDEX memberships_user_idx ON public.memberships USING btree (user_id);

CREATE INDEX order_items_order_idx ON public.order_items USING btree (order_id);

CREATE INDEX order_items_org_idx ON public.order_items USING btree (organization_id);

CREATE INDEX order_promotions_order_idx ON public.order_promotions USING btree (order_id);

CREATE INDEX orders_org_placed_idx ON public.orders USING btree (organization_id, placed_at DESC);

CREATE INDEX outbox_events_pending_idx ON public.outbox_events USING btree (status, available_at);

CREATE INDEX outbox_events_shop_idx ON public.outbox_events USING btree (shop_id, event_type, created_at DESC);

CREATE INDEX outgoing_webhook_endpoints_org_idx ON public.outgoing_webhook_endpoints USING btree (organization_id);

CREATE INDEX package_items_package_idx ON public.package_items USING btree (package_id);

CREATE INDEX package_presets_org_idx ON public.package_presets USING btree (organization_id, shop_id);

CREATE INDEX packages_ful_idx ON public.packages USING btree (fulfillment_id);

CREATE INDEX packages_org_idx ON public.packages USING btree (organization_id, status);

CREATE INDEX payment_sessions_checkout_idx ON public.payment_sessions USING btree (checkout_session_id);

CREATE INDEX payment_transactions_order_idx ON public.payment_transactions USING btree (order_id);

CREATE UNIQUE INDEX price_sets_product_idx ON public.price_sets USING btree (product_id) WHERE (product_id IS NOT NULL);

CREATE INDEX price_sets_shop_idx ON public.price_sets USING btree (shop_id);

CREATE UNIQUE INDEX price_sets_variant_idx ON public.price_sets USING btree (variant_id) WHERE (variant_id IS NOT NULL);

CREATE INDEX prices_group_idx ON public.prices USING btree (customer_group_id);

CREATE INDEX prices_set_idx ON public.prices USING btree (price_set_id, currency_code, status);

CREATE INDEX product_blueprints_org_idx ON public.product_blueprints USING btree (organization_id);

CREATE UNIQUE INDEX product_blueprints_org_key_version ON public.product_blueprints USING btree (organization_id, key, version) WHERE (NOT is_system);

CREATE UNIQUE INDEX product_blueprints_system_key_version ON public.product_blueprints USING btree (key, version) WHERE is_system;

CREATE INDEX product_categories_category_idx ON public.product_categories USING btree (category_id);

CREATE INDEX product_collections_collection_idx ON public.product_collections USING btree (collection_id);

CREATE INDEX product_media_asset_idx ON public.product_media USING btree (media_asset_id);

CREATE INDEX product_media_product_idx ON public.product_media USING btree (product_id, "position");

CREATE INDEX product_media_variant_idx ON public.product_media USING btree (variant_id);

CREATE INDEX product_option_values_option_idx ON public.product_option_values USING btree (option_id);

CREATE UNIQUE INDEX product_option_values_unique ON public.product_option_values USING btree (option_id, value);

CREATE UNIQUE INDEX product_options_key_unique ON public.product_options USING btree (product_id, key);

CREATE INDEX product_options_product_idx ON public.product_options USING btree (product_id);

CREATE UNIQUE INDEX product_variants_combination_unique ON public.product_variants USING btree (product_id, option_signature);

CREATE INDEX product_variants_org_idx ON public.product_variants USING btree (organization_id);

CREATE INDEX product_variants_product_idx ON public.product_variants USING btree (product_id);

CREATE UNIQUE INDEX product_variants_sku_unique ON public.product_variants USING btree (organization_id, sku) WHERE ((sku IS NOT NULL) AND (sku <> ''::text));

CREATE INDEX products_blueprint_idx ON public.products USING btree (blueprint_key);

CREATE INDEX products_org_idx ON public.products USING btree (organization_id);

CREATE UNIQUE INDEX products_shop_handle_unique ON public.products USING btree (shop_id, handle);

CREATE INDEX products_shop_idx ON public.products USING btree (shop_id);

CREATE INDEX products_status_idx ON public.products USING btree (organization_id, status);

CREATE INDEX products_updated_idx ON public.products USING btree (organization_id, updated_at DESC);

CREATE UNIQUE INDEX promotions_shop_code_idx ON public.promotions USING btree (shop_id, upper(code)) WHERE (code IS NOT NULL);

CREATE INDEX promotions_shop_status_idx ON public.promotions USING btree (shop_id, status);

CREATE INDEX refunds_order_idx ON public.refunds USING btree (order_id);

CREATE INDEX return_items_order_item_idx ON public.return_items USING btree (order_item_id);

CREATE INDEX return_items_return_idx ON public.return_items USING btree (return_id);

CREATE INDEX return_media_return_idx ON public.return_media USING btree (return_id);

CREATE INDEX return_sequences_org_idx ON public.return_sequences USING btree (organization_id);

CREATE INDEX returns_customer_idx ON public.returns USING btree (customer_id);

CREATE INDEX returns_order_idx ON public.returns USING btree (order_id);

CREATE INDEX returns_status_idx ON public.returns USING btree (organization_id, status, requested_at DESC);

CREATE UNIQUE INDEX sender_identities_default_idx ON public.sender_identities USING btree (shop_id, channel) WHERE is_default;

CREATE INDEX shipments_ful_idx ON public.shipments USING btree (fulfillment_id);

CREATE UNIQUE INDEX shipments_idem_idx ON public.shipments USING btree (organization_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);

CREATE INDEX shipments_org_idx ON public.shipments USING btree (organization_id, status, created_at DESC);

CREATE UNIQUE INDEX shipments_package_active_idx ON public.shipments USING btree (package_id) WHERE ((package_id IS NOT NULL) AND (status <> 'cancelled'::shipment_status));

CREATE INDEX shipments_provider_shipment_idx ON public.shipments USING btree (carrier_provider, provider_shipment_id);

CREATE INDEX shipments_tracking_idx ON public.shipments USING btree (tracking_number);

CREATE UNIQUE INDEX shipping_labels_active_idx ON public.shipping_labels USING btree (shipment_id) WHERE (voided_at IS NULL);

CREATE INDEX shipping_labels_org_idx ON public.shipping_labels USING btree (organization_id, created_at DESC);

CREATE INDEX shipping_provider_configs_org_idx ON public.shipping_provider_configs USING btree (organization_id, status);

CREATE INDEX shop_order_sequences_org_idx ON public.shop_order_sequences USING btree (organization_id);

CREATE INDEX idx_stock_alert_org ON public.stock_alert_rules USING btree (organization_id, shop_id);

CREATE INDEX store_api_keys_org_idx ON public.store_api_keys USING btree (organization_id, shop_id);

CREATE INDEX store_api_logs_org_time_idx ON public.store_api_request_logs USING btree (organization_id, created_at DESC);

CREATE INDEX store_api_logs_request_idx ON public.store_api_request_logs USING btree (request_id);

CREATE INDEX store_confirmation_tokens_order_idx ON public.store_confirmation_tokens USING btree (order_id);

CREATE UNIQUE INDEX tasks_dedupe_uniq ON public.tasks USING btree (shop_id, dedupe_key) WHERE ((dedupe_key IS NOT NULL) AND (status = ANY (ARRAY['open'::task_status, 'in_progress'::task_status])));

CREATE INDEX tasks_inbox_idx ON public.tasks USING btree (organization_id, shop_id, status, due_at);

CREATE UNIQUE INDEX tax_classes_org_code_key ON public.tax_classes USING btree (organization_id, code) WHERE (organization_id IS NOT NULL);

CREATE UNIQUE INDEX tax_classes_system_code_key ON public.tax_classes USING btree (code) WHERE (organization_id IS NULL);

CREATE INDEX tax_rates_lookup_idx ON public.tax_rates USING btree (country_code, tax_class_id, status);

CREATE INDEX tax_snapshots_session_idx ON public.tax_snapshots USING btree (checkout_session_id);

CREATE UNIQUE INDEX tracking_events_dedupe_idx ON public.tracking_events USING btree (shipment_id, dedupe_hash);

CREATE INDEX tracking_events_org_idx ON public.tracking_events USING btree (organization_id, occurred_at DESC);

CREATE INDEX tracking_events_shipment_idx ON public.tracking_events USING btree (shipment_id, occurred_at DESC);

CREATE UNIQUE INDEX update_runs_single_active ON public.update_runs USING btree ((true)) WHERE (status = ANY (ARRAY['preflight'::text, 'ready'::text, 'backup_check'::text, 'maintenance'::text, 'deploying'::text, 'migrating'::text, 'seeding'::text, 'verifying'::text, 'rolling_back'::text]));

CREATE INDEX update_runs_started_at_idx ON public.update_runs USING btree (started_at DESC);

CREATE INDEX variant_option_values_value_idx ON public.variant_option_values USING btree (option_value_id);

CREATE INDEX vat_validations_lookup_idx ON public.vat_validations USING btree (organization_id, normalized_vat_id);
