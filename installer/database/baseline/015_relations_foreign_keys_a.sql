-- EYIS Database Install Pack — Fremdschlüssel (relations-foreign-keys-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

ALTER TABLE public."audit_log" ADD CONSTRAINT "audit_log_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."automation_action_executions" ADD CONSTRAINT "automation_action_executions_execution_id_fkey" FOREIGN KEY (execution_id) REFERENCES automation_executions(id) ON DELETE CASCADE;

ALTER TABLE public."automation_action_executions" ADD CONSTRAINT "automation_action_executions_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."automation_actions" ADD CONSTRAINT "automation_actions_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."automation_actions" ADD CONSTRAINT "automation_actions_rule_id_fkey" FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE;

ALTER TABLE public."automation_executions" ADD CONSTRAINT "automation_executions_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."automation_executions" ADD CONSTRAINT "automation_executions_retry_of_execution_id_fkey" FOREIGN KEY (retry_of_execution_id) REFERENCES automation_executions(id) ON DELETE SET NULL;

ALTER TABLE public."automation_executions" ADD CONSTRAINT "automation_executions_rule_id_fkey" FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE;

ALTER TABLE public."automation_executions" ADD CONSTRAINT "automation_executions_rule_version_id_fkey" FOREIGN KEY (rule_version_id) REFERENCES automation_rule_versions(id) ON DELETE SET NULL;

ALTER TABLE public."automation_executions" ADD CONSTRAINT "automation_executions_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."automation_jobs" ADD CONSTRAINT "automation_jobs_execution_id_fkey" FOREIGN KEY (execution_id) REFERENCES automation_executions(id) ON DELETE CASCADE;

ALTER TABLE public."automation_jobs" ADD CONSTRAINT "automation_jobs_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."automation_jobs" ADD CONSTRAINT "automation_jobs_rule_id_fkey" FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE;

ALTER TABLE public."automation_jobs" ADD CONSTRAINT "automation_jobs_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."automation_rule_counters" ADD CONSTRAINT "automation_rule_counters_rule_id_fkey" FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE;

ALTER TABLE public."automation_rule_versions" ADD CONSTRAINT "automation_rule_versions_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."automation_rule_versions" ADD CONSTRAINT "automation_rule_versions_rule_id_fkey" FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE;

ALTER TABLE public."automation_rules" ADD CONSTRAINT "automation_rules_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."automation_rules" ADD CONSTRAINT "automation_rules_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."cart_item_price_snapshots" ADD CONSTRAINT "cart_item_price_snapshots_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."cart_item_price_snapshots" ADD CONSTRAINT "cart_item_price_snapshots_snapshot_id_fkey" FOREIGN KEY (snapshot_id) REFERENCES cart_price_snapshots(id) ON DELETE CASCADE;

ALTER TABLE public."cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE;

ALTER TABLE public."cart_items" ADD CONSTRAINT "cart_items_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE public."cart_items" ADD CONSTRAINT "cart_items_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."cart_items" ADD CONSTRAINT "cart_items_variant_id_fkey" FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE;

ALTER TABLE public."cart_price_snapshots" ADD CONSTRAINT "cart_price_snapshots_cart_id_fkey" FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE;

ALTER TABLE public."cart_price_snapshots" ADD CONSTRAINT "cart_price_snapshots_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."cart_price_snapshots" ADD CONSTRAINT "cart_price_snapshots_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."cart_promotion_codes" ADD CONSTRAINT "cart_promotion_codes_cart_id_fkey" FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE;

ALTER TABLE public."cart_promotion_codes" ADD CONSTRAINT "cart_promotion_codes_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."cart_promotion_codes" ADD CONSTRAINT "cart_promotion_codes_promotion_id_fkey" FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE SET NULL;

ALTER TABLE public."cart_promotion_codes" ADD CONSTRAINT "cart_promotion_codes_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."carts" ADD CONSTRAINT "carts_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."carts" ADD CONSTRAINT "carts_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."categories" ADD CONSTRAINT "categories_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE;

ALTER TABLE public."categories" ADD CONSTRAINT "categories_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."checkout_addresses" ADD CONSTRAINT "checkout_addresses_checkout_session_id_fkey" FOREIGN KEY (checkout_session_id) REFERENCES checkout_sessions(id) ON DELETE CASCADE;

ALTER TABLE public."checkout_addresses" ADD CONSTRAINT "checkout_addresses_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."checkout_addresses" ADD CONSTRAINT "checkout_addresses_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."checkout_reservations" ADD CONSTRAINT "checkout_reservations_cart_id_fkey" FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE;

ALTER TABLE public."checkout_reservations" ADD CONSTRAINT "checkout_reservations_checkout_session_id_fkey" FOREIGN KEY (checkout_session_id) REFERENCES checkout_sessions(id) ON DELETE CASCADE;

ALTER TABLE public."checkout_reservations" ADD CONSTRAINT "checkout_reservations_inventory_reservation_id_fkey" FOREIGN KEY (inventory_reservation_id) REFERENCES inventory_reservations(id) ON DELETE CASCADE;

ALTER TABLE public."checkout_reservations" ADD CONSTRAINT "checkout_reservations_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."checkout_reservations" ADD CONSTRAINT "checkout_reservations_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."checkout_sessions" ADD CONSTRAINT "checkout_sessions_billing_address_fk" FOREIGN KEY (billing_address_id) REFERENCES checkout_addresses(id) ON DELETE SET NULL;

ALTER TABLE public."checkout_sessions" ADD CONSTRAINT "checkout_sessions_cart_id_fkey" FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE;

ALTER TABLE public."checkout_sessions" ADD CONSTRAINT "checkout_sessions_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."checkout_sessions" ADD CONSTRAINT "checkout_sessions_price_snapshot_id_fkey" FOREIGN KEY (price_snapshot_id) REFERENCES cart_price_snapshots(id) ON DELETE SET NULL;

ALTER TABLE public."checkout_sessions" ADD CONSTRAINT "checkout_sessions_shipping_address_fk" FOREIGN KEY (shipping_address_id) REFERENCES checkout_addresses(id) ON DELETE SET NULL;

ALTER TABLE public."checkout_sessions" ADD CONSTRAINT "checkout_sessions_shipping_option_id_fkey" FOREIGN KEY (shipping_option_id) REFERENCES shipping_methods(id) ON DELETE SET NULL;

ALTER TABLE public."checkout_sessions" ADD CONSTRAINT "checkout_sessions_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."checkout_sessions" ADD CONSTRAINT "checkout_sessions_vat_validation_id_fkey" FOREIGN KEY (vat_validation_id) REFERENCES vat_validations(id) ON DELETE SET NULL;

ALTER TABLE public."checkout_snapshots" ADD CONSTRAINT "checkout_snapshots_cart_snapshot_id_fkey" FOREIGN KEY (cart_snapshot_id) REFERENCES cart_price_snapshots(id) ON DELETE SET NULL;

ALTER TABLE public."checkout_snapshots" ADD CONSTRAINT "checkout_snapshots_checkout_session_id_fkey" FOREIGN KEY (checkout_session_id) REFERENCES checkout_sessions(id) ON DELETE CASCADE;

ALTER TABLE public."checkout_snapshots" ADD CONSTRAINT "checkout_snapshots_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."checkout_snapshots" ADD CONSTRAINT "checkout_snapshots_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."collections" ADD CONSTRAINT "collections_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."collections" ADD CONSTRAINT "collections_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."communication_attempts" ADD CONSTRAINT "communication_attempts_communication_id_fkey" FOREIGN KEY (communication_id) REFERENCES communications(id) ON DELETE CASCADE;

ALTER TABLE public."communication_attempts" ADD CONSTRAINT "communication_attempts_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."communication_branding" ADD CONSTRAINT "communication_branding_logo_media_id_fkey" FOREIGN KEY (logo_media_id) REFERENCES media_assets(id) ON DELETE SET NULL;

ALTER TABLE public."communication_branding" ADD CONSTRAINT "communication_branding_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."communication_branding" ADD CONSTRAINT "communication_branding_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."communication_provider_configs" ADD CONSTRAINT "communication_provider_configs_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."communication_provider_configs" ADD CONSTRAINT "communication_provider_configs_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."communication_provider_events" ADD CONSTRAINT "communication_provider_events_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."communication_provider_events" ADD CONSTRAINT "communication_provider_events_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."communication_rules" ADD CONSTRAINT "communication_rules_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."communication_rules" ADD CONSTRAINT "communication_rules_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."communication_rules" ADD CONSTRAINT "communication_rules_template_id_fkey" FOREIGN KEY (template_id) REFERENCES communication_templates(id) ON DELETE SET NULL;

ALTER TABLE public."communication_suppressions" ADD CONSTRAINT "communication_suppressions_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."communication_suppressions" ADD CONSTRAINT "communication_suppressions_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."communication_template_versions" ADD CONSTRAINT "communication_template_versions_template_id_fkey" FOREIGN KEY (template_id) REFERENCES communication_templates(id) ON DELETE CASCADE;

ALTER TABLE public."communication_templates" ADD CONSTRAINT "communication_templates_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."communication_templates" ADD CONSTRAINT "communication_templates_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."communications" ADD CONSTRAINT "communications_communication_rule_id_fkey" FOREIGN KEY (communication_rule_id) REFERENCES communication_rules(id) ON DELETE SET NULL;

ALTER TABLE public."communications" ADD CONSTRAINT "communications_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE public."communications" ADD CONSTRAINT "communications_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE public."communications" ADD CONSTRAINT "communications_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."communications" ADD CONSTRAINT "communications_resend_of_communication_id_fkey" FOREIGN KEY (resend_of_communication_id) REFERENCES communications(id) ON DELETE SET NULL;

ALTER TABLE public."communications" ADD CONSTRAINT "communications_sender_identity_id_fkey" FOREIGN KEY (sender_identity_id) REFERENCES sender_identities(id) ON DELETE SET NULL;

ALTER TABLE public."communications" ADD CONSTRAINT "communications_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."communications" ADD CONSTRAINT "communications_template_version_id_fkey" FOREIGN KEY (template_version_id) REFERENCES communication_template_versions(id) ON DELETE SET NULL;

ALTER TABLE public."credit_note_items" ADD CONSTRAINT "credit_note_items_credit_note_id_fkey" FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id) ON DELETE CASCADE;

ALTER TABLE public."credit_note_items" ADD CONSTRAINT "credit_note_items_invoice_item_id_fkey" FOREIGN KEY (invoice_item_id) REFERENCES invoice_items(id) ON DELETE SET NULL;

ALTER TABLE public."credit_note_items" ADD CONSTRAINT "credit_note_items_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT;

ALTER TABLE public."credit_notes" ADD CONSTRAINT "credit_notes_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;

ALTER TABLE public."credit_notes" ADD CONSTRAINT "credit_notes_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."credit_notes" ADD CONSTRAINT "credit_notes_refund_id_fkey" FOREIGN KEY (refund_id) REFERENCES refunds(id) ON DELETE SET NULL;

ALTER TABLE public."credit_notes" ADD CONSTRAINT "credit_notes_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE public."customer_addresses" ADD CONSTRAINT "customer_addresses_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."customer_addresses" ADD CONSTRAINT "customer_addresses_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."customer_group_members" ADD CONSTRAINT "customer_group_members_customer_group_id_fkey" FOREIGN KEY (customer_group_id) REFERENCES customer_groups(id) ON DELETE CASCADE;

ALTER TABLE public."customer_group_members" ADD CONSTRAINT "customer_group_members_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE public."customer_group_members" ADD CONSTRAINT "customer_group_members_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."customer_groups" ADD CONSTRAINT "customer_groups_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."customer_groups" ADD CONSTRAINT "customer_groups_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."customer_notes" ADD CONSTRAINT "customer_notes_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE public."customer_notes" ADD CONSTRAINT "customer_notes_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."customers" ADD CONSTRAINT "customers_default_billing_fk" FOREIGN KEY (default_billing_address_id) REFERENCES customer_addresses(id) ON DELETE SET NULL;

ALTER TABLE public."customers" ADD CONSTRAINT "customers_default_shipping_fk" FOREIGN KEY (default_shipping_address_id) REFERENCES customer_addresses(id) ON DELETE SET NULL;

ALTER TABLE public."customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE public."customers" ADD CONSTRAINT "customers_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

ALTER TABLE public."delivery_notes" ADD CONSTRAINT "delivery_notes_fulfillment_id_fkey" FOREIGN KEY (fulfillment_id) REFERENCES fulfillments(id) ON DELETE SET NULL;

ALTER TABLE public."delivery_notes" ADD CONSTRAINT "delivery_notes_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;
