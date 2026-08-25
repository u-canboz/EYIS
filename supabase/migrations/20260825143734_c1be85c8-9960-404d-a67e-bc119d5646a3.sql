-- ========= ENUMS =========
CREATE TYPE public.tax_calculation_mode AS ENUM ('gross','net');
CREATE TYPE public.tax_customer_type AS ENUM ('consumer','business','any');
CREATE TYPE public.shipping_tax_strategy AS ENUM ('fixed_class','proportional','highest_rate');
CREATE TYPE public.vat_validation_status AS ENUM ('pending','valid','invalid','unavailable','manual_review');

-- ========= TAX CLASSES =========
CREATE TABLE public.tax_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  description text,
  status public.entity_status NOT NULL DEFAULT 'active',
  is_system boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX tax_classes_system_code_key ON public.tax_classes (code) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX tax_classes_org_code_key ON public.tax_classes (organization_id, code) WHERE organization_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_classes TO authenticated;
GRANT ALL ON public.tax_classes TO service_role;
ALTER TABLE public.tax_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tax_classes_read" ON public.tax_classes FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "tax_classes_write" ON public.tax_classes FOR ALL TO authenticated
  USING (organization_id IS NOT NULL AND is_system = false AND public.has_permission(auth.uid(), organization_id, 'tax.manage'))
  WITH CHECK (organization_id IS NOT NULL AND is_system = false AND public.has_permission(auth.uid(), organization_id, 'tax.manage'));
CREATE TRIGGER tax_classes_updated_at BEFORE UPDATE ON public.tax_classes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========= TAX RATES =========
CREATE TABLE public.tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  tax_class_id uuid NOT NULL REFERENCES public.tax_classes(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  region_code text,
  rate_basis_points integer NOT NULL CHECK (rate_basis_points >= 0 AND rate_basis_points <= 10000),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  customer_type public.tax_customer_type NOT NULL DEFAULT 'any',
  transaction_type text NOT NULL DEFAULT 'goods',
  status public.entity_status NOT NULL DEFAULT 'active',
  priority integer NOT NULL DEFAULT 100,
  source text NOT NULL DEFAULT 'manual',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tax_rates_lookup_idx ON public.tax_rates (country_code, tax_class_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_rates TO authenticated;
GRANT ALL ON public.tax_rates TO service_role;
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tax_rates_read" ON public.tax_rates FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "tax_rates_write" ON public.tax_rates FOR ALL TO authenticated
  USING (organization_id IS NOT NULL AND public.has_permission(auth.uid(), organization_id, 'tax.manage'))
  WITH CHECK (organization_id IS NOT NULL AND public.has_permission(auth.uid(), organization_id, 'tax.manage'));
CREATE TRIGGER tax_rates_updated_at BEFORE UPDATE ON public.tax_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========= TAX SETTINGS (per shop) =========
CREATE TABLE public.tax_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL UNIQUE REFERENCES public.shops(id) ON DELETE CASCADE,
  calculation_mode public.tax_calculation_mode NOT NULL DEFAULT 'gross',
  home_country_code text NOT NULL DEFAULT 'DE',
  default_tax_class_id uuid REFERENCES public.tax_classes(id) ON DELETE SET NULL,
  prices_include_tax boolean NOT NULL DEFAULT true,
  display_prices_including_tax boolean NOT NULL DEFAULT true,
  shipping_tax_strategy public.shipping_tax_strategy NOT NULL DEFAULT 'fixed_class',
  shipping_tax_class_id uuid REFERENCES public.tax_classes(id) ON DELETE SET NULL,
  b2b_enabled boolean NOT NULL DEFAULT false,
  eu_oss_enabled boolean NOT NULL DEFAULT false,
  small_business_exemption_enabled boolean NOT NULL DEFAULT false,
  tax_number text,
  vat_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_settings TO authenticated;
GRANT ALL ON public.tax_settings TO service_role;
ALTER TABLE public.tax_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tax_settings_read" ON public.tax_settings FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "tax_settings_write" ON public.tax_settings FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'tax.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'tax.manage') AND public.shop_in_org(shop_id, organization_id));
CREATE TRIGGER tax_settings_updated_at BEFORE UPDATE ON public.tax_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========= VAT VALIDATIONS =========
CREATE TABLE public.vat_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid,
  vat_id text NOT NULL,
  country_code text NOT NULL,
  normalized_vat_id text NOT NULL,
  status public.vat_validation_status NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'none',
  provider_reference text,
  checked_at timestamptz,
  expires_at timestamptz,
  response_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vat_validations_lookup_idx ON public.vat_validations (organization_id, normalized_vat_id);
GRANT SELECT, INSERT, UPDATE ON public.vat_validations TO authenticated;
GRANT ALL ON public.vat_validations TO service_role;
ALTER TABLE public.vat_validations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vat_validations_read" ON public.vat_validations FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'vat.read'));
CREATE POLICY "vat_validations_write" ON public.vat_validations FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'vat.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'vat.manage'));

-- ========= TAX SNAPSHOTS (immutable) =========
CREATE TABLE public.tax_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  cart_id uuid REFERENCES public.carts(id) ON DELETE SET NULL,
  checkout_session_id uuid REFERENCES public.checkout_sessions(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  calculation_mode public.tax_calculation_mode NOT NULL,
  jurisdiction text NOT NULL,
  customer_type public.tax_customer_type NOT NULL DEFAULT 'consumer',
  result jsonb NOT NULL,
  engine_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tax_snapshots_session_idx ON public.tax_snapshots (checkout_session_id);
GRANT SELECT ON public.tax_snapshots TO authenticated;
GRANT ALL ON public.tax_snapshots TO service_role;
ALTER TABLE public.tax_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tax_snapshots_read" ON public.tax_snapshots FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE TRIGGER tax_snapshots_immutable BEFORE UPDATE OR DELETE ON public.tax_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_immutable();

-- ========= EXTENSIONS ON EXISTING TABLES =========
ALTER TABLE public.products ADD COLUMN tax_class_id uuid REFERENCES public.tax_classes(id) ON DELETE SET NULL;
ALTER TABLE public.product_variants ADD COLUMN tax_class_id uuid REFERENCES public.tax_classes(id) ON DELETE SET NULL;

ALTER TABLE public.checkout_sessions
  ADD COLUMN customer_type public.tax_customer_type NOT NULL DEFAULT 'consumer',
  ADD COLUMN company_name text,
  ADD COLUMN customer_vat_id text,
  ADD COLUMN vat_validation_id uuid REFERENCES public.vat_validations(id) ON DELETE SET NULL;

ALTER TABLE public.cart_price_snapshots
  ADD COLUMN tax_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN tax_engine_version text NOT NULL DEFAULT 'none';

ALTER TABLE public.checkout_snapshots
  ADD COLUMN tax_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN tax_engine_version text NOT NULL DEFAULT 'none';

ALTER TABLE public.orders
  ADD COLUMN net_total_minor bigint NOT NULL DEFAULT 0,
  ADD COLUMN tax_total_minor bigint NOT NULL DEFAULT 0,
  ADD COLUMN gross_total_minor bigint NOT NULL DEFAULT 0,
  ADD COLUMN tax_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN tax_engine_version text NOT NULL DEFAULT 'none',
  ADD COLUMN tax_snapshot_id uuid REFERENCES public.tax_snapshots(id) ON DELETE SET NULL;

ALTER TABLE public.order_items
  ADD COLUMN net_minor bigint NOT NULL DEFAULT 0,
  ADD COLUMN tax_minor bigint NOT NULL DEFAULT 0,
  ADD COLUMN gross_minor bigint NOT NULL DEFAULT 0,
  ADD COLUMN tax_rate_basis_points integer NOT NULL DEFAULT 0,
  ADD COLUMN tax_class_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN tax_reason_code text NOT NULL DEFAULT 'unknown',
  ADD COLUMN tax_country_code text;

-- ========= PERMISSIONS =========
INSERT INTO public.role_permissions (role, permission) VALUES
  ('owner','tax.read'),('owner','tax.manage'),('owner','tax.override'),('owner','vat.read'),('owner','vat.manage'),
  ('administrator','tax.read'),('administrator','tax.manage'),('administrator','tax.override'),('administrator','vat.read'),('administrator','vat.manage'),
  ('finance','tax.read'),('finance','tax.manage'),('finance','vat.read'),('finance','vat.manage'),
  ('catalog_manager','tax.read'),
  ('customer_support','tax.read'),
  ('operations','tax.read'),
  ('read_only','tax.read')
ON CONFLICT DO NOTHING;

-- ========= SYSTEM TAX CLASSES =========
INSERT INTO public.tax_classes (organization_id, name, code, description, is_system) VALUES
  (NULL,'Standard','standard','Regelsteuersatz',true),
  (NULL,'Ermäßigt','reduced','Ermäßigter Steuersatz',true),
  (NULL,'Steuerfrei','zero','Steuerfrei / 0 %',true),
  (NULL,'Digitale Leistung','digital','Digitale Dienstleistungen',true),
  (NULL,'Lebensmittel','food','Lebensmittel — steuerliche Einordnung bitte prüfen',true),
  (NULL,'Bücher','books','Bücher und Presseerzeugnisse',true),
  (NULL,'Versand','shipping','Versandkosten',true);

-- ========= GERMANY PRESET =========
INSERT INTO public.tax_rates (organization_id, tax_class_id, country_code, rate_basis_points, customer_type, source, metadata)
SELECT NULL, tc.id, 'DE',
  CASE tc.code WHEN 'standard' THEN 1900 WHEN 'reduced' THEN 700 WHEN 'zero' THEN 0
    WHEN 'digital' THEN 1900 WHEN 'food' THEN 700 WHEN 'books' THEN 700 WHEN 'shipping' THEN 1900 END,
  'any', 'system', jsonb_build_object('label','Deutschland')
FROM public.tax_classes tc WHERE tc.organization_id IS NULL AND tc.is_system;

-- ========= ORDER FINALIZATION CARRIES TAX =========
CREATE OR REPLACE FUNCTION public.order_finalize_from_payment(
  _org uuid, _payment_session uuid, _provider_payment_id text,
  _amount_minor bigint, _currency text, _actor uuid DEFAULT NULL, _idem text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ps public.payment_sessions; sess public.checkout_sessions; snap public.checkout_snapshots;
  existing public.orders; oid uuid; onum text; ln jsonb; pr jsonb; totals jsonb;
  ci public.cart_items; res jsonb; r record; committed integer := 0; tsnap uuid;
BEGIN
  res := public.inv_idem_get(_org, 'order_finalize_from_payment', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;

  SELECT * INTO ps FROM public.payment_sessions
  WHERE id = _payment_session AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Zahlungssitzung nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;

  SELECT * INTO existing FROM public.orders
  WHERE checkout_session_id = ps.checkout_session_id AND organization_id = _org;
  IF FOUND THEN
    res := jsonb_build_object('order_id', existing.id, 'order_number', existing.order_number, 'created', false);
    PERFORM public.inv_idem_put(_org, 'order_finalize_from_payment', _idem, res);
    RETURN res;
  END IF;

  IF ps.status IN ('cancelled','expired','failed') THEN
    RAISE EXCEPTION 'Zahlungssitzung ist %.', ps.status USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO sess FROM public.checkout_sessions WHERE id = ps.checkout_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Checkout-Sitzung nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
  IF sess.status NOT IN ('validated','awaiting_payment') THEN
    RAISE EXCEPTION 'Checkout-Sitzung ist nicht zahlungsbereit (Status: %).', sess.status USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO snap FROM public.checkout_snapshots
  WHERE id = ps.checkout_snapshot_id AND organization_id = _org;
  IF NOT FOUND THEN RAISE EXCEPTION 'Checkout-Snapshot fehlt.' USING ERRCODE = 'check_violation'; END IF;

  totals := snap.totals;
  IF upper(_currency) <> upper(ps.currency_code) OR upper(_currency) <> upper(snap.currency_code) THEN
    RAISE EXCEPTION 'Währung der Zahlung weicht vom Checkout ab.' USING ERRCODE = 'check_violation';
  END IF;
  IF _amount_minor <> ps.amount_minor OR _amount_minor <> (totals ->> 'totalMinor')::bigint THEN
    RAISE EXCEPTION 'Zahlbetrag weicht vom Checkout-Snapshot ab.' USING ERRCODE = 'check_violation';
  END IF;

  onum := public.order_next_number(_org, sess.shop_id);

  SELECT id INTO tsnap FROM public.tax_snapshots
  WHERE checkout_session_id = sess.id AND organization_id = _org
  ORDER BY created_at DESC LIMIT 1;

  INSERT INTO public.orders (
    organization_id, shop_id, order_number, checkout_session_id, checkout_snapshot_id, cart_id,
    customer_id, email, environment, order_status, payment_status, fulfillment_status,
    currency_code, subtotal_minor, discount_minor, shipping_minor, tax_minor, total_minor,
    net_total_minor, tax_total_minor, gross_total_minor, tax_breakdown, tax_engine_version, tax_snapshot_id,
    shipping_method)
  VALUES (_org, sess.shop_id, onum, sess.id, snap.id, sess.cart_id,
    sess.customer_id, COALESCE(snap.email, sess.email), ps.environment, 'confirmed', 'paid', 'unfulfilled',
    snap.currency_code,
    COALESCE((totals ->> 'subtotalMinor')::bigint, 0),
    COALESCE((totals ->> 'discountMinor')::bigint, 0),
    COALESCE((totals ->> 'shippingMinor')::bigint, 0),
    COALESCE((totals ->> 'taxMinor')::bigint, 0),
    COALESCE((totals ->> 'totalMinor')::bigint, 0),
    COALESCE((totals ->> 'netTotalMinor')::bigint, COALESCE((totals ->> 'totalMinor')::bigint,0) - COALESCE((totals ->> 'taxMinor')::bigint,0)),
    COALESCE((totals ->> 'taxMinor')::bigint, 0),
    COALESCE((totals ->> 'totalMinor')::bigint, 0),
    COALESCE(snap.tax_breakdown, '[]'::jsonb),
    COALESCE(snap.tax_engine_version, 'none'),
    tsnap,
    COALESCE(snap.shipping_method, '{}'::jsonb))
  RETURNING id INTO oid;

  IF tsnap IS NOT NULL THEN
    UPDATE public.tax_snapshots SET order_id = oid WHERE id = tsnap AND order_id IS NULL;
  END IF;

  FOR ln IN SELECT * FROM jsonb_array_elements(COALESCE(snap.lines, '[]'::jsonb)) LOOP
    SELECT * INTO ci FROM public.cart_items WHERE id = (ln ->> 'lineId')::uuid;
    INSERT INTO public.order_items (
      organization_id, order_id, product_id, variant_id, title_snapshot, variant_title_snapshot,
      sku_snapshot, quantity, unit_base_minor, unit_resolved_minor,
      line_subtotal_minor, line_discount_minor, line_total_minor, applied_rules, applied_promotions,
      net_minor, tax_minor, gross_minor, tax_rate_basis_points, tax_class_snapshot, tax_reason_code, tax_country_code)
    VALUES (_org, oid, ci.product_id, COALESCE(ci.variant_id, (ln ->> 'variantId')::uuid),
      COALESCE(ci.title_snapshot, 'Position'), COALESCE(ci.variant_title_snapshot, ''), ci.sku_snapshot,
      (ln ->> 'quantity')::integer,
      COALESCE((ln ->> 'unitBaseMinor')::bigint, 0),
      COALESCE((ln ->> 'unitResolvedMinor')::bigint, 0),
      COALESCE((ln ->> 'lineSubtotalMinor')::bigint, 0),
      COALESCE((ln ->> 'lineDiscountMinor')::bigint, 0),
      COALESCE((ln ->> 'lineTotalMinor')::bigint, 0),
      COALESCE(ln -> 'appliedPriceRules', '[]'::jsonb),
      COALESCE(ln -> 'appliedPromotions', '[]'::jsonb),
      COALESCE((ln ->> 'netMinor')::bigint, 0),
      COALESCE((ln ->> 'taxMinor')::bigint, 0),
      COALESCE((ln ->> 'grossMinor')::bigint, COALESCE((ln ->> 'lineTotalMinor')::bigint, 0)),
      COALESCE((ln ->> 'taxRateBasisPoints')::integer, 0),
      COALESCE(ln -> 'taxClass', '{}'::jsonb),
      COALESCE(ln ->> 'taxReasonCode', 'unknown'),
      ln ->> 'taxCountryCode');
  END LOOP;

  INSERT INTO public.order_addresses (organization_id, order_id, type, address)
  VALUES (_org, oid, 'shipping', COALESCE(snap.shipping_address, '{}'::jsonb)),
         (_org, oid, 'billing', COALESCE(snap.billing_address, snap.shipping_address, '{}'::jsonb));

  FOR pr IN SELECT * FROM jsonb_array_elements(COALESCE(snap.promotions, '[]'::jsonb)) LOOP
    INSERT INTO public.order_promotions (organization_id, order_id, promotion_id, code_snapshot, name_snapshot, discount_minor, detail)
    VALUES (_org, oid,
      CASE WHEN (pr ->> 'promotionId') ~ '^[0-9a-f-]{36}$' THEN (pr ->> 'promotionId')::uuid ELSE NULL END,
      pr ->> 'code', COALESCE(pr ->> 'name', 'Aktion'),
      COALESCE((pr ->> 'discountMinor')::bigint, 0), pr);
  END LOOP;

  INSERT INTO public.payment_transactions (organization_id, order_id, payment_session_id, provider, type,
    amount_minor, currency_code, provider_transaction_id)
  VALUES (_org, oid, ps.id, ps.provider, 'charge', _amount_minor, snap.currency_code, _provider_payment_id);

  PERFORM set_config('commerce.system_op', 'on', true);
  FOR r IN
    SELECT cr.inventory_reservation_id AS rid FROM public.checkout_reservations cr
    JOIN public.inventory_reservations ir ON ir.id = cr.inventory_reservation_id
    WHERE cr.checkout_session_id = sess.id AND cr.organization_id = _org AND ir.status = 'active'
  LOOP
    PERFORM public.inv_commit_reservation(_org, NULL, r.rid, 'order-commit:' || oid::text || ':' || r.rid::text);
    committed := committed + 1;
  END LOOP;
  PERFORM set_config('commerce.system_op', 'off', true);

  UPDATE public.payment_sessions
  SET status = 'paid', provider_payment_id = COALESCE(_provider_payment_id, provider_payment_id)
  WHERE id = ps.id;
  UPDATE public.checkout_sessions SET status = 'completed', completed_at = now() WHERE id = sess.id;
  UPDATE public.carts SET status = 'completed', completed_at = now() WHERE id = sess.cart_id;

  PERFORM public.inv_audit(_org, _actor, 'order.created', 'order', oid::text,
    jsonb_build_object('order_number', onum, 'total_minor', _amount_minor, 'reservations_committed', committed));
  PERFORM public.inv_event(_org, 'order.created',
    jsonb_build_object('order_id', oid, 'order_number', onum, 'total_minor', _amount_minor));
  PERFORM public.inv_event(_org, 'payment.succeeded',
    jsonb_build_object('payment_session_id', ps.id, 'order_id', oid, 'amount_minor', _amount_minor));

  res := jsonb_build_object('order_id', oid, 'order_number', onum, 'created', true,
    'reservations_committed', committed);
  PERFORM public.inv_idem_put(_org, 'order_finalize_from_payment', _idem, res);
  RETURN res;
END; $$;

REVOKE EXECUTE ON FUNCTION public.order_finalize_from_payment(uuid,uuid,text,bigint,text,uuid,text) FROM anon, authenticated;