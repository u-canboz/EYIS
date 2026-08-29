-- EYIS Database Install Pack — Row Level Security (security-rls-c)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

CREATE POLICY "payment_attempts_read" ON public."payment_attempts"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'payments.read'::text));

CREATE POLICY "payment_events_read" ON public."payment_events"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((organization_id IS NOT NULL) AND has_permission(auth.uid(), organization_id, 'payments.read'::text)));

CREATE POLICY "ppc_read" ON public."payment_provider_configs"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'payment_settings.read'::text));

CREATE POLICY "payment_sessions_read" ON public."payment_sessions"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'payments.read'::text));

CREATE POLICY "payment_transactions_read" ON public."payment_transactions"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'payments.read'::text));

CREATE POLICY "price_sets_read" ON public."price_sets"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((is_org_member(auth.uid(), organization_id) AND has_permission(auth.uid(), organization_id, 'pricing.read'::text)));

CREATE POLICY "price_sets_write" ON public."price_sets"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'pricing.manage'::text))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'pricing.manage'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "prices_read" ON public."prices"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((is_org_member(auth.uid(), organization_id) AND has_permission(auth.uid(), organization_id, 'pricing.read'::text)));

CREATE POLICY "prices_write" ON public."prices"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'pricing.manage'::text))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'pricing.manage'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "blueprints_delete" ON public."product_blueprints"
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (((NOT is_system) AND has_permission(auth.uid(), organization_id, 'blueprints.manage_custom'::text)));

CREATE POLICY "blueprints_insert" ON public."product_blueprints"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (((NOT is_system) AND (organization_id IS NOT NULL) AND has_permission(auth.uid(), organization_id, 'blueprints.manage_custom'::text)));

CREATE POLICY "blueprints_select" ON public."product_blueprints"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((is_system OR is_org_member(auth.uid(), organization_id)));

CREATE POLICY "blueprints_update" ON public."product_blueprints"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (((NOT is_system) AND has_permission(auth.uid(), organization_id, 'blueprints.manage_custom'::text)))
  WITH CHECK (((NOT is_system) AND has_permission(auth.uid(), organization_id, 'blueprints.manage_custom'::text)));

CREATE POLICY "product_categories_select" ON public."product_categories"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_categories.product_id) AND is_org_member(auth.uid(), p.organization_id)))));

CREATE POLICY "product_categories_write" ON public."product_categories"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_categories.product_id) AND has_permission(auth.uid(), p.organization_id, 'products.update'::text)))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_categories.product_id) AND has_permission(auth.uid(), p.organization_id, 'products.update'::text)))) AND (EXISTS ( SELECT 1
   FROM categories c
  WHERE ((c.id = product_categories.category_id) AND is_org_member(auth.uid(), c.organization_id))))));

CREATE POLICY "product_collections_select" ON public."product_collections"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_collections.product_id) AND is_org_member(auth.uid(), p.organization_id)))));

CREATE POLICY "product_collections_write" ON public."product_collections"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_collections.product_id) AND has_permission(auth.uid(), p.organization_id, 'products.update'::text)))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_collections.product_id) AND has_permission(auth.uid(), p.organization_id, 'products.update'::text)))) AND (EXISTS ( SELECT 1
   FROM collections c
  WHERE ((c.id = product_collections.collection_id) AND is_org_member(auth.uid(), c.organization_id))))));

CREATE POLICY "product_media_select" ON public."product_media"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_media.product_id) AND is_org_member(auth.uid(), p.organization_id)))));

CREATE POLICY "product_media_write" ON public."product_media"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_media.product_id) AND has_permission(auth.uid(), p.organization_id, 'products.update'::text)))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_media.product_id) AND has_permission(auth.uid(), p.organization_id, 'products.update'::text)))) AND (EXISTS ( SELECT 1
   FROM media_assets m
  WHERE ((m.id = product_media.media_asset_id) AND is_org_member(auth.uid(), m.organization_id))))));

CREATE POLICY "product_option_values_select" ON public."product_option_values"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (product_options o
     JOIN products p ON ((p.id = o.product_id)))
  WHERE ((o.id = product_option_values.option_id) AND is_org_member(auth.uid(), p.organization_id)))));

CREATE POLICY "product_option_values_write" ON public."product_option_values"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (product_options o
     JOIN products p ON ((p.id = o.product_id)))
  WHERE ((o.id = product_option_values.option_id) AND has_permission(auth.uid(), p.organization_id, 'products.update'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (product_options o
     JOIN products p ON ((p.id = o.product_id)))
  WHERE ((o.id = product_option_values.option_id) AND has_permission(auth.uid(), p.organization_id, 'products.update'::text)))));

CREATE POLICY "product_options_select" ON public."product_options"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_options.product_id) AND is_org_member(auth.uid(), p.organization_id)))));

CREATE POLICY "product_options_write" ON public."product_options"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_options.product_id) AND has_permission(auth.uid(), p.organization_id, 'products.update'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_options.product_id) AND has_permission(auth.uid(), p.organization_id, 'products.update'::text)))));

CREATE POLICY "product_variants_select" ON public."product_variants"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "product_variants_write" ON public."product_variants"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'products.update'::text))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'products.update'::text) AND (EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_variants.product_id) AND (p.organization_id = p.organization_id))))));

CREATE POLICY "products_insert" ON public."products"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'products.create'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "products_select" ON public."products"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "products_update" ON public."products"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'products.update'::text))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'products.update'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "profiles_select_self" ON public."profiles"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (can_view_profile(id));

CREATE POLICY "profiles_update_self" ON public."profiles"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((id = auth.uid()))
  WITH CHECK ((id = auth.uid()));

CREATE POLICY "promotions_read" ON public."promotions"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((is_org_member(auth.uid(), organization_id) AND has_permission(auth.uid(), organization_id, 'promotions.read'::text)));

CREATE POLICY "promotions_write" ON public."promotions"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'promotions.manage'::text))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'promotions.manage'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "qa_fixtures_read" ON public."qa_fixtures"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "refunds_read" ON public."refunds"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'payments.read'::text));

CREATE POLICY "return_items_admin_read" ON public."return_items"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'returns.read'::text));

CREATE POLICY "return_items_admin_write" ON public."return_items"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'returns.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'returns.manage'::text));

CREATE POLICY "return_items_customer_read" ON public."return_items"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (returns r
     JOIN customers c ON ((c.id = r.customer_id)))
  WHERE ((r.id = return_items.return_id) AND (c.auth_user_id = auth.uid())))));

CREATE POLICY "return_media_admin_read" ON public."return_media"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'returns.read'::text));

CREATE POLICY "return_media_admin_write" ON public."return_media"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'returns.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'returns.manage'::text));

CREATE POLICY "return_sequences_read" ON public."return_sequences"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'returns.read'::text));

CREATE POLICY "return_settings_read" ON public."return_settings"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'returns.read'::text));

CREATE POLICY "return_settings_write" ON public."return_settings"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'returns.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'returns.manage'::text));

CREATE POLICY "returns_admin_read" ON public."returns"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'returns.read'::text));

CREATE POLICY "returns_admin_write" ON public."returns"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'returns.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'returns.manage'::text));

CREATE POLICY "returns_customer_read" ON public."returns"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = returns.customer_id) AND (c.auth_user_id = auth.uid())))));

CREATE POLICY "role_permissions_read" ON public."role_permissions"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "sd_read" ON public."sender_domains"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'communications.read'::text));

CREATE POLICY "sd_write" ON public."sender_domains"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'communications.settings'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'communications.settings'::text));

CREATE POLICY "sid_read" ON public."sender_identities"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'communications.read'::text));

CREATE POLICY "sid_write" ON public."sender_identities"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'communications.settings'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'communications.settings'::text));

CREATE POLICY "shipments_read" ON public."shipments"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'shipping.read'::text));

CREATE POLICY "shipments_write" ON public."shipments"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'shipping.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'shipping.manage'::text));

CREATE POLICY "shipping_labels_read" ON public."shipping_labels"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'shipping.read'::text));

CREATE POLICY "shipping_labels_write" ON public."shipping_labels"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'shipping.create_label'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'shipping.create_label'::text));

CREATE POLICY "shipping_methods_read" ON public."shipping_methods"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'shipping_methods.read'::text));

CREATE POLICY "shipping_provider_configs_read" ON public."shipping_provider_configs"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'shipping_settings.read'::text));

CREATE POLICY "shipping_provider_configs_write" ON public."shipping_provider_configs"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'shipping_settings.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'shipping_settings.manage'::text));

CREATE POLICY "shop_domains_select" ON public."shop_domains"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "shop_domains_write" ON public."shop_domains"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'settings.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'settings.manage'::text));

CREATE POLICY "sos_read" ON public."shop_order_sequences"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'orders.read'::text));

CREATE POLICY "shops_delete" ON public."shops"
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'settings.manage'::text));

CREATE POLICY "shops_insert" ON public."shops"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_permission(auth.uid(), organization_id, 'settings.manage'::text));

CREATE POLICY "shops_select" ON public."shops"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "shops_update" ON public."shops"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'settings.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'settings.manage'::text));

CREATE POLICY "alert rules read" ON public."stock_alert_rules"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'inventory.read'::text));

CREATE POLICY "alert rules write" ON public."stock_alert_rules"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'inventory.manage_settings'::text))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'inventory.manage_settings'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "sak_read" ON public."store_api_keys"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'developer.read'::text));

CREATE POLICY "sak_write" ON public."store_api_keys"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'developer.manage'::text))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'developer.manage'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "sarl_read" ON public."store_api_request_logs"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'developer.read'::text));

CREATE POLICY "tasks_read" ON public."tasks"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'tasks.read'::text));

CREATE POLICY "tasks_write" ON public."tasks"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'tasks.manage'::text))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'tasks.manage'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "tax_classes_read" ON public."tax_classes"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((organization_id IS NULL) OR is_org_member(auth.uid(), organization_id)));
