-- EYIS Database Install Pack — Row Level Security (security-rls-d)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

CREATE POLICY "tax_classes_write" ON public."tax_classes"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (((organization_id IS NOT NULL) AND (is_system = false) AND has_permission(auth.uid(), organization_id, 'tax.manage'::text)))
  WITH CHECK (((organization_id IS NOT NULL) AND (is_system = false) AND has_permission(auth.uid(), organization_id, 'tax.manage'::text)));

CREATE POLICY "tax_rates_read" ON public."tax_rates"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((organization_id IS NULL) OR is_org_member(auth.uid(), organization_id)));

CREATE POLICY "tax_rates_write" ON public."tax_rates"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (((organization_id IS NOT NULL) AND has_permission(auth.uid(), organization_id, 'tax.manage'::text)))
  WITH CHECK (((organization_id IS NOT NULL) AND has_permission(auth.uid(), organization_id, 'tax.manage'::text)));

CREATE POLICY "tax_settings_read" ON public."tax_settings"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "tax_settings_write" ON public."tax_settings"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'tax.manage'::text))
  WITH CHECK ((has_permission(auth.uid(), organization_id, 'tax.manage'::text) AND shop_in_org(shop_id, organization_id)));

CREATE POLICY "tax_snapshots_read" ON public."tax_snapshots"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "tracking_events_read" ON public."tracking_events"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'tracking.read'::text));

CREATE POLICY "variant_option_values_select" ON public."variant_option_values"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM product_variants v
  WHERE ((v.id = variant_option_values.variant_id) AND is_org_member(auth.uid(), v.organization_id)))));

CREATE POLICY "variant_option_values_write" ON public."variant_option_values"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM product_variants v
  WHERE ((v.id = variant_option_values.variant_id) AND has_permission(auth.uid(), v.organization_id, 'products.update'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM product_variants v
  WHERE ((v.id = variant_option_values.variant_id) AND has_permission(auth.uid(), v.organization_id, 'products.update'::text)))));

CREATE POLICY "vat_validations_read" ON public."vat_validations"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'vat.read'::text));

CREATE POLICY "vat_validations_write" ON public."vat_validations"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'vat.manage'::text))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'vat.manage'::text));
