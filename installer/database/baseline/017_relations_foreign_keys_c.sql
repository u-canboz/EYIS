-- EYIS Database Install Pack — Fremdschlüssel (relations-foreign-keys-c)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

ALTER TABLE public."product_media" ADD CONSTRAINT "product_media_media_asset_id_fkey" FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE CASCADE;

ALTER TABLE public."product_media" ADD CONSTRAINT "product_media_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE public."product_media" ADD CONSTRAINT "product_media_variant_id_fkey" FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE;

ALTER TABLE public."product_option_values" ADD CONSTRAINT "product_option_values_option_id_fkey" FOREIGN KEY (option_id) REFERENCES product_options(id) ON DELETE CASCADE;

ALTER TABLE public."product_options" ADD CONSTRAINT "product_options_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE public."product_variants" ADD CONSTRAINT "product_variants_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE public."product_variants" ADD CONSTRAINT "product_variants_tax_class_id_fkey" FOREIGN KEY (tax_class_id) REFERENCES tax_classes(id) ON DELETE SET NULL;

ALTER TABLE public."products" ADD CONSTRAINT "products_blueprint_id_fkey" FOREIGN KEY (blueprint_id) REFERENCES product_blueprints(id);

ALTER TABLE public."products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."products" ADD CONSTRAINT "products_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."products" ADD CONSTRAINT "products_tax_class_id_fkey" FOREIGN KEY (tax_class_id) REFERENCES tax_classes(id) ON DELETE SET NULL;

ALTER TABLE public."promotions" ADD CONSTRAINT "promotions_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."promotions" ADD CONSTRAINT "promotions_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."provider_credentials" ADD CONSTRAINT "provider_credentials_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."provider_credentials" ADD CONSTRAINT "provider_credentials_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."qa_fixtures" ADD CONSTRAINT "qa_fixtures_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."qa_fixtures" ADD CONSTRAINT "qa_fixtures_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL;

ALTER TABLE public."refunds" ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE public."refunds" ADD CONSTRAINT "refunds_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."return_items" ADD CONSTRAINT "return_items_order_item_id_fkey" FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE RESTRICT;

ALTER TABLE public."return_items" ADD CONSTRAINT "return_items_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."return_items" ADD CONSTRAINT "return_items_restock_location_id_fkey" FOREIGN KEY (restock_location_id) REFERENCES inventory_locations(id) ON DELETE SET NULL;

ALTER TABLE public."return_items" ADD CONSTRAINT "return_items_return_id_fkey" FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE;

ALTER TABLE public."return_media" ADD CONSTRAINT "return_media_media_asset_id_fkey" FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE CASCADE;

ALTER TABLE public."return_media" ADD CONSTRAINT "return_media_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."return_media" ADD CONSTRAINT "return_media_return_id_fkey" FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE CASCADE;

ALTER TABLE public."return_media" ADD CONSTRAINT "return_media_return_item_id_fkey" FOREIGN KEY (return_item_id) REFERENCES return_items(id) ON DELETE CASCADE;

ALTER TABLE public."return_sequences" ADD CONSTRAINT "return_sequences_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."return_sequences" ADD CONSTRAINT "return_sequences_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."return_settings" ADD CONSTRAINT "return_settings_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."return_settings" ADD CONSTRAINT "return_settings_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."returns" ADD CONSTRAINT "returns_credit_note_id_fkey" FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id) ON DELETE SET NULL;

ALTER TABLE public."returns" ADD CONSTRAINT "returns_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public."returns" ADD CONSTRAINT "returns_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;

ALTER TABLE public."returns" ADD CONSTRAINT "returns_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."returns" ADD CONSTRAINT "returns_refund_id_fkey" FOREIGN KEY (refund_id) REFERENCES refunds(id) ON DELETE SET NULL;

ALTER TABLE public."returns" ADD CONSTRAINT "returns_return_shipment_id_fkey" FOREIGN KEY (return_shipment_id) REFERENCES shipments(id) ON DELETE SET NULL;

ALTER TABLE public."returns" ADD CONSTRAINT "returns_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."sender_domains" ADD CONSTRAINT "sender_domains_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."sender_domains" ADD CONSTRAINT "sender_domains_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."sender_identities" ADD CONSTRAINT "sender_identities_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."sender_identities" ADD CONSTRAINT "sender_identities_sender_domain_id_fkey" FOREIGN KEY (sender_domain_id) REFERENCES sender_domains(id) ON DELETE SET NULL;

ALTER TABLE public."sender_identities" ADD CONSTRAINT "sender_identities_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."shipments" ADD CONSTRAINT "shipments_fulfillment_id_fkey" FOREIGN KEY (fulfillment_id) REFERENCES fulfillments(id) ON DELETE CASCADE;

ALTER TABLE public."shipments" ADD CONSTRAINT "shipments_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."shipments" ADD CONSTRAINT "shipments_package_id_fkey" FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL;

ALTER TABLE public."shipments" ADD CONSTRAINT "shipments_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."shipping_labels" ADD CONSTRAINT "shipping_labels_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."shipping_labels" ADD CONSTRAINT "shipping_labels_shipment_id_fkey" FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE;

ALTER TABLE public."shipping_labels" ADD CONSTRAINT "shipping_labels_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."shipping_methods" ADD CONSTRAINT "shipping_methods_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."shipping_methods" ADD CONSTRAINT "shipping_methods_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."shipping_provider_configs" ADD CONSTRAINT "shipping_provider_configs_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."shipping_provider_configs" ADD CONSTRAINT "shipping_provider_configs_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."shop_domains" ADD CONSTRAINT "shop_domains_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."shop_domains" ADD CONSTRAINT "shop_domains_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."shop_order_sequences" ADD CONSTRAINT "shop_order_sequences_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."shop_order_sequences" ADD CONSTRAINT "shop_order_sequences_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."shops" ADD CONSTRAINT "shops_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."stock_alert_rules" ADD CONSTRAINT "stock_alert_rules_inventory_item_id_fkey" FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE;

ALTER TABLE public."stock_alert_rules" ADD CONSTRAINT "stock_alert_rules_location_id_fkey" FOREIGN KEY (location_id) REFERENCES inventory_locations(id) ON DELETE CASCADE;

ALTER TABLE public."stock_alert_rules" ADD CONSTRAINT "stock_alert_rules_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."stock_alert_rules" ADD CONSTRAINT "stock_alert_rules_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."store_api_keys" ADD CONSTRAINT "store_api_keys_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."store_api_keys" ADD CONSTRAINT "store_api_keys_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."store_api_request_logs" ADD CONSTRAINT "store_api_request_logs_key_id_fkey" FOREIGN KEY (key_id) REFERENCES store_api_keys(id) ON DELETE SET NULL;

ALTER TABLE public."store_api_request_logs" ADD CONSTRAINT "store_api_request_logs_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."store_api_request_logs" ADD CONSTRAINT "store_api_request_logs_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL;

ALTER TABLE public."store_confirmation_tokens" ADD CONSTRAINT "store_confirmation_tokens_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE public."store_confirmation_tokens" ADD CONSTRAINT "store_confirmation_tokens_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."store_confirmation_tokens" ADD CONSTRAINT "store_confirmation_tokens_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."tasks" ADD CONSTRAINT "tasks_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."tasks" ADD CONSTRAINT "tasks_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."tasks" ADD CONSTRAINT "tasks_source_automation_execution_id_fkey" FOREIGN KEY (source_automation_execution_id) REFERENCES automation_executions(id) ON DELETE SET NULL;

ALTER TABLE public."tax_classes" ADD CONSTRAINT "tax_classes_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."tax_classes" ADD CONSTRAINT "tax_classes_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."tax_rates" ADD CONSTRAINT "tax_rates_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."tax_rates" ADD CONSTRAINT "tax_rates_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."tax_rates" ADD CONSTRAINT "tax_rates_tax_class_id_fkey" FOREIGN KEY (tax_class_id) REFERENCES tax_classes(id) ON DELETE CASCADE;

ALTER TABLE public."tax_settings" ADD CONSTRAINT "tax_settings_default_tax_class_id_fkey" FOREIGN KEY (default_tax_class_id) REFERENCES tax_classes(id) ON DELETE SET NULL;

ALTER TABLE public."tax_settings" ADD CONSTRAINT "tax_settings_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."tax_settings" ADD CONSTRAINT "tax_settings_shipping_tax_class_id_fkey" FOREIGN KEY (shipping_tax_class_id) REFERENCES tax_classes(id) ON DELETE SET NULL;

ALTER TABLE public."tax_settings" ADD CONSTRAINT "tax_settings_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."tax_snapshots" ADD CONSTRAINT "tax_snapshots_cart_id_fkey" FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE SET NULL;

ALTER TABLE public."tax_snapshots" ADD CONSTRAINT "tax_snapshots_checkout_session_id_fkey" FOREIGN KEY (checkout_session_id) REFERENCES checkout_sessions(id) ON DELETE SET NULL;

ALTER TABLE public."tax_snapshots" ADD CONSTRAINT "tax_snapshots_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE public."tax_snapshots" ADD CONSTRAINT "tax_snapshots_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."tax_snapshots" ADD CONSTRAINT "tax_snapshots_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."tracking_events" ADD CONSTRAINT "tracking_events_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."tracking_events" ADD CONSTRAINT "tracking_events_shipment_id_fkey" FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE;

ALTER TABLE public."tracking_events" ADD CONSTRAINT "tracking_events_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."update_run_steps" ADD CONSTRAINT "update_run_steps_update_run_id_fkey" FOREIGN KEY (update_run_id) REFERENCES update_runs(id) ON DELETE CASCADE;

ALTER TABLE public."variant_option_values" ADD CONSTRAINT "variant_option_values_option_id_fkey" FOREIGN KEY (option_id) REFERENCES product_options(id) ON DELETE CASCADE;

ALTER TABLE public."variant_option_values" ADD CONSTRAINT "variant_option_values_option_value_id_fkey" FOREIGN KEY (option_value_id) REFERENCES product_option_values(id) ON DELETE CASCADE;

ALTER TABLE public."variant_option_values" ADD CONSTRAINT "variant_option_values_variant_id_fkey" FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE;

ALTER TABLE public."vat_validations" ADD CONSTRAINT "vat_validations_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
