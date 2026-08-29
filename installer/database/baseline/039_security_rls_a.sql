-- EYIS Database Install Pack — Row Level Security (security-rls-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

ALTER TABLE public."audit_log" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."automation_action_executions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."automation_actions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."automation_executions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."automation_jobs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."automation_rule_counters" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."automation_rule_versions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."automation_rules" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."cart_item_price_snapshots" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."cart_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."cart_price_snapshots" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."cart_promotion_codes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."carts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."categories" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."checkout_addresses" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."checkout_reservations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."checkout_sessions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."checkout_snapshots" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."collections" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."commerce_installation" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."communication_attempts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."communication_branding" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."communication_provider_configs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."communication_provider_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."communication_rules" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."communication_suppressions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."communication_template_versions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."communication_templates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."communications" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."credit_note_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."credit_notes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."customer_addresses" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."customer_group_members" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."customer_groups" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."customer_notes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."customers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."delivery_notes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."demo_environments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."document_branding" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."document_files" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."document_sequences" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."fulfillment_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."fulfillments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."guest_order_access_tokens" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."idempotency_keys" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."integration_connections" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."integration_health" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."inventory_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."inventory_levels" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."inventory_locations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."inventory_movements" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."inventory_reservations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."inventory_transfer_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."inventory_transfers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."invitations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."invoice_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."invoice_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."invoices" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."media_assets" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."memberships" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."oauth_states" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."order_addresses" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."order_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."order_promotions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."orders" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."organizations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."outbox_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."outgoing_webhook_endpoints" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."package_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."package_presets" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."packages" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."payment_attempts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."payment_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."payment_provider_configs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."payment_sessions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."payment_transactions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."price_sets" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."prices" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."product_blueprints" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."product_categories" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."product_collections" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."product_media" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."product_option_values" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."product_options" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."product_variants" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."products" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."promotions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."provider_credentials" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."qa_fixtures" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."refunds" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."return_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."return_media" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."return_sequences" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."return_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."returns" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."role_permissions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."sender_domains" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."sender_identities" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."shipments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."shipping_labels" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."shipping_methods" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."shipping_provider_configs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."shop_domains" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."shop_order_sequences" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."shops" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."stock_alert_rules" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."store_api_keys" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."store_api_rate_counters" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."store_api_request_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."store_confirmation_tokens" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."store_privacy_salts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."tasks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."tax_classes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."tax_rates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."tax_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."tax_snapshots" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."tracking_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."update_run_steps" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."update_runs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."variant_option_values" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."vat_validations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select" ON public."audit_log"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'audit.read'::text));

CREATE POLICY "aae_read" ON public."automation_action_executions"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'automations.read'::text));

CREATE POLICY "aae_write" ON public."automation_action_executions"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'automations.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'automations.manage'::text));

CREATE POLICY "aa_read" ON public."automation_actions"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'automations.read'::text));

CREATE POLICY "aa_write" ON public."automation_actions"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'automations.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'automations.manage'::text));

CREATE POLICY "ae_read" ON public."automation_executions"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'automations.read'::text));

CREATE POLICY "ae_write" ON public."automation_executions"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'automations.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'automations.manage'::text));

CREATE POLICY "aj_read" ON public."automation_jobs"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'automations.read'::text));

CREATE POLICY "arv_read" ON public."automation_rule_versions"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'automations.read'::text));

CREATE POLICY "arv_write" ON public."automation_rule_versions"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'automations.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'automations.manage'::text));

CREATE POLICY "ar_read" ON public."automation_rules"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'automations.read'::text));

CREATE POLICY "ar_write" ON public."automation_rules"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'automations.manage'::text))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'automations.manage'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "cart_item_price_snapshots_read" ON public."cart_item_price_snapshots"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'carts.read'::text));

CREATE POLICY "cart_items_read" ON public."cart_items"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'carts.read'::text));

CREATE POLICY "cart_price_snapshots_read" ON public."cart_price_snapshots"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'carts.read'::text));

CREATE POLICY "cart_promotion_codes_read" ON public."cart_promotion_codes"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'carts.read'::text));

CREATE POLICY "carts_read" ON public."carts"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'carts.read'::text));

CREATE POLICY "categories_select" ON public."categories"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "categories_write" ON public."categories"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'categories.manage'::text))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'categories.manage'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "checkout_addresses_read" ON public."checkout_addresses"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'checkout.read'::text));

CREATE POLICY "checkout_reservations_read" ON public."checkout_reservations"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'checkout.read'::text));

CREATE POLICY "checkout_sessions_read" ON public."checkout_sessions"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'checkout.read'::text));

CREATE POLICY "checkout_snapshots_read" ON public."checkout_snapshots"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'checkout.read'::text));

CREATE POLICY "collections_select" ON public."collections"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "collections_write" ON public."collections"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'collections.manage'::text))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'collections.manage'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "cat_read" ON public."communication_attempts"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'communications.read'::text));

CREATE POLICY "cbr_read" ON public."communication_branding"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'communications.read'::text));

CREATE POLICY "cbr_write" ON public."communication_branding"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'communications.settings'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'communications.settings'::text));

CREATE POLICY "cpc_read" ON public."communication_provider_configs"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'communications.read'::text));

CREATE POLICY "cpc_write" ON public."communication_provider_configs"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'communications.settings'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'communications.settings'::text));

CREATE POLICY "cpe_read" ON public."communication_provider_events"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((organization_id IS NOT NULL) AND has_permission(auth.uid(), organization_id, 'communications.read'::text)));

CREATE POLICY "crl_read" ON public."communication_rules"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'communications.read'::text));

CREATE POLICY "crl_write" ON public."communication_rules"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'communications.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'communications.manage'::text));

CREATE POLICY "csup_read" ON public."communication_suppressions"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'communications.read'::text));

CREATE POLICY "csup_write" ON public."communication_suppressions"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'communications.settings'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'communications.settings'::text));

CREATE POLICY "ctv_read" ON public."communication_template_versions"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM communication_templates t
  WHERE ((t.id = communication_template_versions.template_id) AND ((t.organization_id IS NULL) OR has_permission(auth.uid(), t.organization_id, 'communications.read'::text))))));

CREATE POLICY "ctv_write" ON public."communication_template_versions"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM communication_templates t
  WHERE ((t.id = communication_template_versions.template_id) AND (t.organization_id IS NOT NULL) AND has_permission(auth.uid(), t.organization_id, 'communications.manage'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM communication_templates t
  WHERE ((t.id = communication_template_versions.template_id) AND (t.organization_id IS NOT NULL) AND has_permission(auth.uid(), t.organization_id, 'communications.manage'::text)))));

CREATE POLICY "ctpl_read" ON public."communication_templates"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((organization_id IS NULL) OR has_permission(auth.uid(), organization_id, 'communications.read'::text)));

CREATE POLICY "ctpl_write" ON public."communication_templates"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (((organization_id IS NOT NULL) AND has_permission(auth.uid(), organization_id, 'communications.manage'::text)))
  WITH CHECK (((organization_id IS NOT NULL) AND has_permission(auth.uid(), organization_id, 'communications.manage'::text)));

CREATE POLICY "comm_read" ON public."communications"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'communications.read'::text));

CREATE POLICY "credit_note_items_read" ON public."credit_note_items"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.read'::text));

CREATE POLICY "credit_note_items_write" ON public."credit_note_items"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.credit'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'invoices.credit'::text));

CREATE POLICY "credit_notes_read" ON public."credit_notes"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.read'::text));
