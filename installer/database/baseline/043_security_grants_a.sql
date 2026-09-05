-- EYIS Database Install Pack — Grants (security-grants-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

GRANT SELECT ON public."audit_log" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."audit_log" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."automation_action_executions" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."automation_action_executions" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."automation_actions" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."automation_actions" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."automation_executions" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."automation_executions" TO service_role;

GRANT SELECT ON public."automation_jobs" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."automation_jobs" TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."automation_rule_counters" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."automation_rule_versions" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."automation_rule_versions" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."automation_rules" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."automation_rules" TO service_role;

GRANT SELECT ON public."cart_item_price_snapshots" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."cart_item_price_snapshots" TO service_role;

GRANT SELECT ON public."cart_items" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."cart_items" TO service_role;

GRANT SELECT ON public."cart_price_snapshots" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."cart_price_snapshots" TO service_role;

GRANT SELECT ON public."cart_promotion_codes" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."cart_promotion_codes" TO service_role;

GRANT SELECT ON public."carts" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."carts" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."categories" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."categories" TO service_role;

GRANT SELECT ON public."checkout_addresses" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."checkout_addresses" TO service_role;

GRANT SELECT ON public."checkout_reservations" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."checkout_reservations" TO service_role;

GRANT SELECT ON public."checkout_sessions" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."checkout_sessions" TO service_role;

GRANT SELECT ON public."checkout_snapshots" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."checkout_snapshots" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."collections" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."collections" TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."commerce_installation" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."commerce_installation" TO service_role;

GRANT SELECT ON public."communication_attempts" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."communication_attempts" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."communication_branding" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."communication_branding" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."communication_provider_configs" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."communication_provider_configs" TO service_role;

GRANT SELECT ON public."communication_provider_events" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."communication_provider_events" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."communication_rules" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."communication_rules" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."communication_suppressions" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."communication_suppressions" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."communication_template_versions" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."communication_template_versions" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."communication_templates" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."communication_templates" TO service_role;

GRANT SELECT ON public."communications" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."communications" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."credit_note_items" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."credit_note_items" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."credit_notes" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."credit_notes" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."customer_addresses" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."customer_addresses" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."customer_group_members" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."customer_group_members" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."customer_groups" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."customer_groups" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."customer_notes" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."customer_notes" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."customers" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."customers" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."delivery_notes" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."delivery_notes" TO service_role;

GRANT SELECT ON public."demo_environments" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."demo_environments" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."document_branding" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."document_branding" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."document_files" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."document_files" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."document_sequences" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."document_sequences" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."fulfillment_items" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."fulfillment_items" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."fulfillments" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."fulfillments" TO service_role;

GRANT SELECT ON public."guest_order_access_tokens" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."guest_order_access_tokens" TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."idempotency_keys" TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."integration_connections" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."integration_connections" TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."integration_health" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."integration_health" TO service_role;

GRANT SELECT ON public."inventory_items" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."inventory_items" TO service_role;

GRANT SELECT ON public."inventory_levels" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."inventory_levels" TO service_role;

GRANT INSERT, SELECT, UPDATE ON public."inventory_locations" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."inventory_locations" TO service_role;

GRANT SELECT ON public."inventory_movements" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."inventory_movements" TO service_role;

GRANT SELECT ON public."inventory_reservations" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."inventory_reservations" TO service_role;

GRANT SELECT ON public."inventory_transfer_items" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."inventory_transfer_items" TO service_role;

GRANT SELECT ON public."inventory_transfers" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."inventory_transfers" TO service_role;

GRANT SELECT ON public."invitations" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."invitations" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."invoice_items" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."invoice_items" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."invoice_settings" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."invoice_settings" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."invoices" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."invoices" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."media_assets" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."media_assets" TO service_role;

GRANT DELETE, SELECT, UPDATE ON public."memberships" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."memberships" TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."oauth_states" TO service_role;

GRANT SELECT ON public."order_addresses" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."order_addresses" TO service_role;

GRANT SELECT ON public."order_items" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."order_items" TO service_role;

GRANT SELECT ON public."order_promotions" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."order_promotions" TO service_role;

GRANT SELECT ON public."orders" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."orders" TO service_role;

GRANT SELECT, UPDATE ON public."organizations" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."organizations" TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."outbox_events" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."outgoing_webhook_endpoints" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."outgoing_webhook_endpoints" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."package_items" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."package_items" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."package_presets" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."package_presets" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."packages" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."packages" TO service_role;

GRANT SELECT ON public."payment_attempts" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."payment_attempts" TO service_role;

GRANT SELECT ON public."payment_events" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."payment_events" TO service_role;

GRANT SELECT ON public."payment_provider_configs" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."payment_provider_configs" TO service_role;

GRANT SELECT ON public."payment_sessions" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."payment_sessions" TO service_role;

GRANT SELECT ON public."payment_transactions" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."payment_transactions" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."price_sets" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."price_sets" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."prices" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."prices" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."product_blueprints" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."product_blueprints" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."product_categories" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."product_categories" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."product_collections" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."product_collections" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."product_media" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."product_media" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."product_option_values" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."product_option_values" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."product_options" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."product_options" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."product_variants" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."product_variants" TO service_role;

GRANT INSERT, SELECT, UPDATE ON public."products" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."products" TO service_role;

GRANT SELECT, UPDATE ON public."profiles" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."profiles" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."promotions" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."promotions" TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."provider_credentials" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."provider_credentials" TO service_role;

GRANT SELECT ON public."qa_fixtures" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."qa_fixtures" TO service_role;

GRANT SELECT ON public."refunds" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."refunds" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."return_items" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."return_items" TO service_role;
