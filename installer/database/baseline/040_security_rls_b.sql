-- EYIS Database Install Pack — Row Level Security (security-rls-b)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

CREATE POLICY "credit_notes_write" ON public."credit_notes"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.credit'::text))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'invoices.credit'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "customer_addresses_admin_read" ON public."customer_addresses"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'customers.read'::text));

CREATE POLICY "customer_addresses_admin_write" ON public."customer_addresses"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'customers.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'customers.manage'::text));

CREATE POLICY "customer_addresses_self_delete" ON public."customer_addresses"
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_addresses.customer_id) AND (c.auth_user_id = auth.uid()) AND (c.status = 'active'::customer_status)))));

CREATE POLICY "customer_addresses_self_insert" ON public."customer_addresses"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_addresses.customer_id) AND (c.auth_user_id = auth.uid()) AND (c.status = 'active'::customer_status) AND (c.organization_id = customer_addresses.organization_id) AND (NOT (c.shop_id IS DISTINCT FROM customer_addresses.shop_id))))));

CREATE POLICY "customer_addresses_self_select" ON public."customer_addresses"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_addresses.customer_id) AND (c.auth_user_id = auth.uid())))));

CREATE POLICY "customer_addresses_self_update" ON public."customer_addresses"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_addresses.customer_id) AND (c.auth_user_id = auth.uid()) AND (c.status = 'active'::customer_status)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM customers c
  WHERE ((c.id = customer_addresses.customer_id) AND (c.auth_user_id = auth.uid()) AND (c.status = 'active'::customer_status) AND (c.organization_id = customer_addresses.organization_id) AND (NOT (c.shop_id IS DISTINCT FROM customer_addresses.shop_id))))));

CREATE POLICY "cgm_admin_read" ON public."customer_group_members"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'customers.read'::text));

CREATE POLICY "cgm_admin_write" ON public."customer_group_members"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'customer_groups.assign'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'customer_groups.assign'::text));

CREATE POLICY "customer_groups_read" ON public."customer_groups"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((is_org_member(auth.uid(), organization_id) AND has_permission(auth.uid(), organization_id, 'customer_groups.read'::text)));

CREATE POLICY "customer_groups_write" ON public."customer_groups"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'customer_groups.manage'::text))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'customer_groups.manage'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "customer_notes_admin" ON public."customer_notes"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'customers.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'customers.manage'::text));

CREATE POLICY "customers_admin_read" ON public."customers"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'customers.read'::text));

CREATE POLICY "customers_admin_write" ON public."customers"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'customers.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'customers.manage'::text));

CREATE POLICY "customers_self_read" ON public."customers"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((auth_user_id = auth.uid()));

CREATE POLICY "delivery_notes_read" ON public."delivery_notes"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((has_permission(auth.uid(), organization_id, 'invoices.read'::text) OR has_permission(auth.uid(), organization_id, 'fulfillment.read'::text)));

CREATE POLICY "delivery_notes_write" ON public."delivery_notes"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.manage'::text))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'invoices.manage'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "demo_environments_read" ON public."demo_environments"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "document_branding_read" ON public."document_branding"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "document_branding_write" ON public."document_branding"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'documents.settings'::text))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'documents.settings'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "document_files_read" ON public."document_files"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.read'::text));

CREATE POLICY "document_files_write" ON public."document_files"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'invoices.manage'::text));

CREATE POLICY "document_sequences_read" ON public."document_sequences"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "document_sequences_write" ON public."document_sequences"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'documents.settings'::text))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'documents.settings'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "fulfillment_items_read" ON public."fulfillment_items"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'fulfillment.read'::text));

CREATE POLICY "fulfillment_items_write" ON public."fulfillment_items"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'fulfillment.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'fulfillment.manage'::text));

CREATE POLICY "fulfillments_read" ON public."fulfillments"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'fulfillment.read'::text));

CREATE POLICY "fulfillments_write" ON public."fulfillments"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'fulfillment.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'fulfillment.manage'::text));

CREATE POLICY "guest_tokens_admin_read" ON public."guest_order_access_tokens"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'orders.read'::text));

CREATE POLICY "ic_read" ON public."integration_connections"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
CASE category
    WHEN 'payment'::integration_category THEN has_permission(auth.uid(), organization_id, 'payment_settings.read'::text)
    WHEN 'email'::integration_category THEN has_permission(auth.uid(), organization_id, 'communications.read'::text)
    WHEN 'carrier'::integration_category THEN has_permission(auth.uid(), organization_id, 'shipping_settings.read'::text)
    ELSE NULL::boolean
END);

CREATE POLICY "ic_write" ON public."integration_connections"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
CASE category
    WHEN 'payment'::integration_category THEN has_permission(auth.uid(), organization_id, 'payment_settings.manage'::text)
    WHEN 'email'::integration_category THEN has_permission(auth.uid(), organization_id, 'communications.settings'::text)
    WHEN 'carrier'::integration_category THEN has_permission(auth.uid(), organization_id, 'shipping_settings.manage'::text)
    ELSE NULL::boolean
END)
  WITH CHECK (
CASE category
    WHEN 'payment'::integration_category THEN has_permission(auth.uid(), organization_id, 'payment_settings.manage'::text)
    WHEN 'email'::integration_category THEN has_permission(auth.uid(), organization_id, 'communications.settings'::text)
    WHEN 'carrier'::integration_category THEN has_permission(auth.uid(), organization_id, 'shipping_settings.manage'::text)
    ELSE NULL::boolean
END);

CREATE POLICY "ih_read" ON public."integration_health"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((has_permission(auth.uid(), organization_id, 'payment_settings.read'::text) OR has_permission(auth.uid(), organization_id, 'communications.read'::text) OR has_permission(auth.uid(), organization_id, 'shipping_settings.read'::text)));

CREATE POLICY "ih_write" ON public."integration_health"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ((has_permission(auth.uid(), organization_id, 'payment_settings.manage'::text) OR has_permission(auth.uid(), organization_id, 'communications.settings'::text) OR has_permission(auth.uid(), organization_id, 'shipping_settings.manage'::text)))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'payment_settings.manage'::text) OR has_permission(auth.uid(), organization_id, 'communications.settings'::text) OR has_permission(auth.uid(), organization_id, 'shipping_settings.manage'::text)));

CREATE POLICY "items read" ON public."inventory_items"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'inventory.read'::text));

CREATE POLICY "levels read" ON public."inventory_levels"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'inventory.read'::text));

CREATE POLICY "locations insert" ON public."inventory_locations"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'inventory.manage_locations'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "locations read" ON public."inventory_locations"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'inventory.read'::text));

CREATE POLICY "locations update" ON public."inventory_locations"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'inventory.manage_locations'::text))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'inventory.manage_locations'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "movements read" ON public."inventory_movements"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'inventory.read'::text));

CREATE POLICY "reservations read" ON public."inventory_reservations"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'inventory.read'::text));

CREATE POLICY "transfer items read" ON public."inventory_transfer_items"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM inventory_transfers t
  WHERE ((t.id = inventory_transfer_items.transfer_id) AND has_permission(auth.uid(), t.organization_id, 'inventory.read'::text)))));

CREATE POLICY "transfers read" ON public."inventory_transfers"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'inventory.read'::text));

CREATE POLICY "invitations_select" ON public."invitations"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'settings.manage'::text));

CREATE POLICY "invoice_items_read" ON public."invoice_items"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.read'::text));

CREATE POLICY "invoice_items_write" ON public."invoice_items"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'invoices.manage'::text));

CREATE POLICY "invoice_settings_read" ON public."invoice_settings"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "invoice_settings_write" ON public."invoice_settings"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'documents.settings'::text))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'documents.settings'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "invoices_read" ON public."invoices"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.read'::text));

CREATE POLICY "invoices_write" ON public."invoices"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'invoices.manage'::text))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'invoices.manage'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "media_assets_delete" ON public."media_assets"
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'media.manage'::text));

CREATE POLICY "media_assets_insert" ON public."media_assets"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (has_permission(auth.uid(), organization_id, 'media.upload'::text));

CREATE POLICY "media_assets_select" ON public."media_assets"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "media_assets_update" ON public."media_assets"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'media.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'media.manage'::text));

CREATE POLICY "memberships_delete" ON public."memberships"
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'settings.manage'::text));

CREATE POLICY "memberships_select" ON public."memberships"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "memberships_update" ON public."memberships"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'settings.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'settings.manage'::text));

CREATE POLICY "order_addresses_read" ON public."order_addresses"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'orders.read'::text));

CREATE POLICY "order_items_read" ON public."order_items"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'orders.read'::text));

CREATE POLICY "order_promotions_read" ON public."order_promotions"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'orders.read'::text));

CREATE POLICY "orders_read" ON public."orders"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'orders.read'::text));

CREATE POLICY "organizations_select" ON public."organizations"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), id));

CREATE POLICY "organizations_update" ON public."organizations"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (has_permission(auth.uid(), id, 'settings.manage'::text))
  WITH CHECK (has_permission(auth.uid(), id, 'settings.manage'::text));

CREATE POLICY "owe_read" ON public."outgoing_webhook_endpoints"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'webhooks.read'::text));

CREATE POLICY "owe_write" ON public."outgoing_webhook_endpoints"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'webhooks.manage'::text))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'webhooks.manage'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "package_items_read" ON public."package_items"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'fulfillment.read'::text));

CREATE POLICY "package_items_write" ON public."package_items"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'fulfillment.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'fulfillment.manage'::text));

CREATE POLICY "package_presets_read" ON public."package_presets"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'shipping_settings.read'::text));

CREATE POLICY "package_presets_write" ON public."package_presets"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'shipping_settings.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'shipping_settings.manage'::text));

CREATE POLICY "packages_read" ON public."packages"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'fulfillment.read'::text));

CREATE POLICY "packages_write" ON public."packages"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'fulfillment.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'fulfillment.manage'::text));
