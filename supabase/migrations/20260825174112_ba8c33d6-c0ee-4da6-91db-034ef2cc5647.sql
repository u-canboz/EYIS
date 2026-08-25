-- ============ ENUMS ============
CREATE TYPE public.customer_status AS ENUM ('active','blocked','guest','archived');
CREATE TYPE public.customer_kind AS ENUM ('b2c','b2b');
CREATE TYPE public.customer_address_type AS ENUM ('shipping','billing','both');
CREATE TYPE public.return_status AS ENUM ('requested','authorized','rejected','in_transit','received','inspection','approved','partially_approved','refunded','completed','cancelled');
CREATE TYPE public.return_reason_code AS ENUM ('wrong_size','wrong_item','damaged','defective','not_as_expected','changed_mind','late_delivery','other');
CREATE TYPE public.return_item_condition AS ENUM ('new','opened','used','damaged','defective','missing_parts','unknown');
CREATE TYPE public.return_resolution AS ENUM ('refund','store_credit','replacement','none');
CREATE TYPE public.restock_decision AS ENUM ('pending','restock','do_not_restock','manual_review');
CREATE TYPE public.return_approval_strategy AS ENUM ('manual','automatic_rules');
CREATE TYPE public.shipping_refund_mode AS ENUM ('none','full','partial','manual');
CREATE TYPE public.return_policy_type AS ENUM ('standard','non_returnable','custom');
CREATE TYPE public.shipment_direction AS ENUM ('outbound','return');
CREATE TYPE public.return_window_start AS ENUM ('order_date','shipping_date','delivery_date');

-- ============ CUSTOMERS ============
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  auth_user_id uuid,
  email text NOT NULL,
  first_name text,
  last_name text,
  phone text,
  status public.customer_status NOT NULL DEFAULT 'active',
  customer_type public.customer_kind NOT NULL DEFAULT 'b2c',
  default_shipping_address_id uuid,
  default_billing_address_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX customers_shop_email_key ON public.customers (shop_id, lower(email));
CREATE UNIQUE INDEX customers_shop_auth_user_key ON public.customers (shop_id, auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX customers_org_idx ON public.customers (organization_id, status);
CREATE INDEX customers_auth_user_idx ON public.customers (auth_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_admin_read" ON public.customers FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'customers.read'));
CREATE POLICY "customers_admin_write" ON public.customers FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'customers.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'customers.manage'));
CREATE POLICY "customers_self_read" ON public.customers FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE TABLE public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  type public.customer_address_type NOT NULL DEFAULT 'both',
  first_name text NOT NULL,
  last_name text NOT NULL,
  company text,
  street text NOT NULL,
  street2 text,
  postal_code text NOT NULL,
  city text NOT NULL,
  state text,
  country_code text NOT NULL,
  phone text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_addresses_customer_idx ON public.customer_addresses (customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer_addresses_admin_read" ON public.customer_addresses FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'customers.read'));
CREATE POLICY "customer_addresses_admin_write" ON public.customer_addresses FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'customers.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'customers.manage'));
CREATE POLICY "customer_addresses_self" ON public.customer_addresses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.auth_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.auth_user_id = auth.uid()));

ALTER TABLE public.customers
  ADD CONSTRAINT customers_default_shipping_fk FOREIGN KEY (default_shipping_address_id)
    REFERENCES public.customer_addresses(id) ON DELETE SET NULL,
  ADD CONSTRAINT customers_default_billing_fk FOREIGN KEY (default_billing_address_id)
    REFERENCES public.customer_addresses(id) ON DELETE SET NULL;

CREATE TABLE public.customer_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_group_id uuid NOT NULL REFERENCES public.customer_groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, customer_group_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_group_members TO authenticated;
GRANT ALL ON public.customer_group_members TO service_role;
ALTER TABLE public.customer_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cgm_admin_read" ON public.customer_group_members FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'customers.read'));
CREATE POLICY "cgm_admin_write" ON public.customer_group_members FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'customer_groups.assign'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'customer_groups.assign'));

CREATE TABLE public.customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_notes_customer_idx ON public.customer_notes (customer_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_notes TO authenticated;
GRANT ALL ON public.customer_notes TO service_role;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer_notes_admin" ON public.customer_notes FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'customers.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'customers.manage'));

-- ============ GUEST ORDER ACCESS ============
CREATE TABLE public.guest_order_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guest_tokens_order_idx ON public.guest_order_access_tokens (order_id);
GRANT SELECT ON public.guest_order_access_tokens TO authenticated;
GRANT ALL ON public.guest_order_access_tokens TO service_role;
ALTER TABLE public.guest_order_access_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guest_tokens_admin_read" ON public.guest_order_access_tokens FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'orders.read'));

-- ============ RETURN SETTINGS ============
CREATE TABLE public.return_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL UNIQUE REFERENCES public.shops(id) ON DELETE CASCADE,
  returns_enabled boolean NOT NULL DEFAULT true,
  default_return_window_days integer NOT NULL DEFAULT 30,
  window_start public.return_window_start NOT NULL DEFAULT 'delivery_date',
  approval_strategy public.return_approval_strategy NOT NULL DEFAULT 'manual',
  customer_pays_return_shipping boolean NOT NULL DEFAULT true,
  auto_refund_on_approval boolean NOT NULL DEFAULT false,
  auto_restock boolean NOT NULL DEFAULT false,
  instructions text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_settings TO authenticated;
GRANT ALL ON public.return_settings TO service_role;
ALTER TABLE public.return_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "return_settings_read" ON public.return_settings FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'returns.read'));
CREATE POLICY "return_settings_write" ON public.return_settings FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'returns.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'returns.manage'));

CREATE TABLE public.return_sequences (
  shop_id uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  prefix text NOT NULL DEFAULT 'RMA',
  padding integer NOT NULL DEFAULT 6,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::int,
  next_value bigint NOT NULL DEFAULT 1
);
GRANT SELECT ON public.return_sequences TO authenticated;
GRANT ALL ON public.return_sequences TO service_role;
ALTER TABLE public.return_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "return_sequences_read" ON public.return_sequences FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'returns.read'));

-- ============ RETURNS ============
CREATE TABLE public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  return_number text NOT NULL,
  status public.return_status NOT NULL DEFAULT 'requested',
  reason_category public.return_reason_code NOT NULL DEFAULT 'other',
  customer_note text,
  internal_note text,
  rejection_reason text,
  shipping_refund_mode public.shipping_refund_mode NOT NULL DEFAULT 'none',
  shipping_refund_minor bigint NOT NULL DEFAULT 0,
  refund_total_minor bigint NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'EUR',
  requested_at timestamptz NOT NULL DEFAULT now(),
  authorized_at timestamptz,
  received_at timestamptz,
  inspected_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  refund_id uuid REFERENCES public.refunds(id) ON DELETE SET NULL,
  credit_note_id uuid REFERENCES public.credit_notes(id) ON DELETE SET NULL,
  return_shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, return_number),
  UNIQUE (organization_id, idempotency_key)
);
CREATE INDEX returns_order_idx ON public.returns (order_id);
CREATE INDEX returns_status_idx ON public.returns (organization_id, status, requested_at DESC);
CREATE INDEX returns_customer_idx ON public.returns (customer_id);
GRANT SELECT, INSERT, UPDATE ON public.returns TO authenticated;
GRANT ALL ON public.returns TO service_role;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "returns_admin_read" ON public.returns FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'returns.read'));
CREATE POLICY "returns_admin_write" ON public.returns FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'returns.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'returns.manage'));
CREATE POLICY "returns_customer_read" ON public.returns FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.auth_user_id = auth.uid()));

CREATE TABLE public.return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE RESTRICT,
  quantity_requested integer NOT NULL CHECK (quantity_requested > 0),
  quantity_received integer NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  quantity_approved integer NOT NULL DEFAULT 0 CHECK (quantity_approved >= 0),
  reason_code public.return_reason_code NOT NULL DEFAULT 'other',
  condition public.return_item_condition NOT NULL DEFAULT 'unknown',
  resolution public.return_resolution NOT NULL DEFAULT 'refund',
  restock_decision public.restock_decision NOT NULL DEFAULT 'pending',
  restocked_at timestamptz,
  restock_location_id uuid REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
  refund_amount_minor bigint,
  inspection_note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (return_id, order_item_id)
);
CREATE INDEX return_items_return_idx ON public.return_items (return_id);
CREATE INDEX return_items_order_item_idx ON public.return_items (order_item_id);
GRANT SELECT, INSERT, UPDATE ON public.return_items TO authenticated;
GRANT ALL ON public.return_items TO service_role;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "return_items_admin_read" ON public.return_items FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'returns.read'));
CREATE POLICY "return_items_admin_write" ON public.return_items FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'returns.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'returns.manage'));
CREATE POLICY "return_items_customer_read" ON public.return_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.returns r JOIN public.customers c ON c.id = r.customer_id
                 WHERE r.id = return_id AND c.auth_user_id = auth.uid()));

CREATE TABLE public.return_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  return_item_id uuid REFERENCES public.return_items(id) ON DELETE CASCADE,
  media_asset_id uuid NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  uploaded_by_type text NOT NULL DEFAULT 'customer',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.return_media TO authenticated;
GRANT ALL ON public.return_media TO service_role;
ALTER TABLE public.return_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "return_media_admin_read" ON public.return_media FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'returns.read'));
CREATE POLICY "return_media_admin_write" ON public.return_media FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'returns.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'returns.manage'));

-- ============ EXISTING TABLE EXTENSIONS ============
ALTER TABLE public.orders
  ADD CONSTRAINT orders_customer_fk FOREIGN KEY (customer_id)
    REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.products
  ADD COLUMN return_policy_type public.return_policy_type NOT NULL DEFAULT 'standard',
  ADD COLUMN return_policy_note text;
ALTER TABLE public.shipments
  ADD COLUMN direction public.shipment_direction NOT NULL DEFAULT 'outbound';

CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER customer_addresses_updated_at BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER returns_updated_at BEFORE UPDATE ON public.returns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER return_items_updated_at BEFORE UPDATE ON public.return_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER return_settings_updated_at BEFORE UPDATE ON public.return_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PERMISSIONS ============
INSERT INTO public.role_permissions (role, permission) VALUES
  ('owner','customers.manage'),('owner','customers.block'),('owner','returns.read'),('owner','returns.manage'),
  ('owner','returns.approve'),('owner','returns.inspect'),('owner','returns.restock'),('owner','customer_groups.assign'),
  ('administrator','customers.manage'),('administrator','customers.block'),('administrator','returns.read'),
  ('administrator','returns.manage'),('administrator','returns.approve'),('administrator','returns.inspect'),
  ('administrator','returns.restock'),('administrator','customer_groups.assign'),
  ('operations','customers.manage'),('operations','returns.read'),('operations','returns.manage'),
  ('operations','returns.approve'),('operations','returns.inspect'),('operations','returns.restock'),
  ('operations','customer_groups.assign'),
  ('customer_support','customers.manage'),('customer_support','returns.read'),('customer_support','returns.manage'),
  ('customer_support','returns.approve'),
  ('fulfillment','returns.read'),('fulfillment','returns.inspect'),('fulfillment','returns.restock'),
  ('fulfillment','returns.manage'),
  ('finance','returns.read'),
  ('marketing','customer_groups.assign'),
  ('read_only','returns.read')
ON CONFLICT DO NOTHING;

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.ret_assert(_actor uuid, _org uuid, _perm text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF _actor IS NULL OR NOT public.has_permission(_actor, _org, _perm) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diese Retourenaktion.' USING ERRCODE = 'insufficient_privilege';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.ret_next_number(_org uuid, _shop uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE seq public.return_sequences; v bigint; y integer := EXTRACT(YEAR FROM now())::int;
BEGIN
  INSERT INTO public.return_sequences (shop_id, organization_id)
  VALUES (_shop, _org) ON CONFLICT (shop_id) DO NOTHING;
  SELECT * INTO seq FROM public.return_sequences WHERE shop_id = _shop FOR UPDATE;
  IF seq.year <> y THEN
    UPDATE public.return_sequences SET year = y, next_value = 1 WHERE shop_id = _shop RETURNING * INTO seq;
  END IF;
  v := seq.next_value;
  UPDATE public.return_sequences SET next_value = next_value + 1 WHERE shop_id = _shop;
  RETURN seq.prefix || '-' || y::text || '-' || lpad(v::text, seq.padding, '0');
END; $$;

-- effective returned quantity for one order item (excludes rejected/cancelled)
CREATE OR REPLACE FUNCTION public.ret_returned_qty(_order_item uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(SUM(
    CASE WHEN r.status IN ('rejected','cancelled') THEN 0
         WHEN r.status IN ('approved','partially_approved','refunded','completed') THEN ri.quantity_approved
         ELSE ri.quantity_requested END), 0)::int
  FROM public.return_items ri
  JOIN public.returns r ON r.id = ri.return_id
  WHERE ri.order_item_id = _order_item;
$$;

-- ============ STATE MACHINE ============
CREATE OR REPLACE FUNCTION public.ret_request(
  _org uuid, _shop uuid, _order uuid, _customer uuid, _actor uuid,
  _items jsonb, _reason public.return_reason_code, _note text, _idem text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE ord public.orders; rid uuid; rnum text; it jsonb; oi public.order_items;
  qty integer; already integer; res jsonb;
BEGIN
  IF _idem IS NULL OR length(_idem) < 8 THEN
    RAISE EXCEPTION 'Idempotenzschlüssel fehlt.' USING ERRCODE = 'check_violation';
  END IF;
  SELECT id INTO rid FROM public.returns WHERE organization_id = _org AND idempotency_key = _idem;
  IF rid IS NOT NULL THEN
    SELECT jsonb_build_object('return_id', r.id, 'return_number', r.return_number, 'status', r.status, 'duplicate', true)
    INTO res FROM public.returns r WHERE r.id = rid;
    RETURN res;
  END IF;

  SELECT * INTO ord FROM public.orders WHERE id = _order AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bestellung nicht gefunden.' USING ERRCODE = 'no_data_found'; END IF;
  IF ord.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'Nur bezahlte Bestellungen können retourniert werden.' USING ERRCODE = 'check_violation';
  END IF;
  IF _customer IS NOT NULL AND ord.customer_id IS NOT NULL AND ord.customer_id <> _customer THEN
    RAISE EXCEPTION 'Bestellung gehört nicht zu diesem Kunden.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF jsonb_array_length(COALESCE(_items, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Keine Positionen ausgewählt.' USING ERRCODE = 'check_violation';
  END IF;

  rnum := public.ret_next_number(_org, _shop);
  INSERT INTO public.returns (organization_id, shop_id, order_id, customer_id, return_number,
    status, reason_category, customer_note, currency_code, idempotency_key)
  VALUES (_org, _shop, _order, _customer, rnum, 'requested', COALESCE(_reason,'other'), _note,
    ord.currency_code, _idem)
  RETURNING id INTO rid;

  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO oi FROM public.order_items
      WHERE id = (it ->> 'order_item_id')::uuid AND order_id = _order FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Position gehört nicht zur Bestellung.' USING ERRCODE = 'check_violation'; END IF;
    qty := GREATEST((it ->> 'quantity')::int, 0);
    IF qty = 0 THEN CONTINUE; END IF;
    already := public.ret_returned_qty(oi.id);
    IF already + qty > oi.quantity THEN
      RAISE EXCEPTION 'Rückgabemenge überschreitet die bestellte Menge.' USING ERRCODE = 'check_violation';
    END IF;
    INSERT INTO public.return_items (organization_id, return_id, order_item_id, quantity_requested, reason_code)
    VALUES (_org, rid, oi.id, qty, COALESCE((it ->> 'reason_code')::public.return_reason_code, COALESCE(_reason,'other')));
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.return_items WHERE return_id = rid) THEN
    RAISE EXCEPTION 'Keine gültigen Positionen.' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM public.inv_event(_org, 'return.requested',
    jsonb_build_object('return_id', rid, 'return_number', rnum, 'order_id', _order));
  RETURN jsonb_build_object('return_id', rid, 'return_number', rnum, 'status', 'requested', 'duplicate', false);
END; $$;

CREATE OR REPLACE FUNCTION public.ret_authorize(_org uuid, _return uuid, _actor uuid, _instructions text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.returns;
BEGIN
  PERFORM public.ret_assert(_actor, _org, 'returns.approve');
  SELECT * INTO r FROM public.returns WHERE id = _return AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retoure nicht gefunden.' USING ERRCODE = 'no_data_found'; END IF;
  IF r.status <> 'requested' THEN RAISE EXCEPTION 'Nur angefragte Retouren können genehmigt werden.' USING ERRCODE = 'check_violation'; END IF;
  UPDATE public.returns SET status = 'authorized', authorized_at = now(),
    metadata = metadata || jsonb_build_object('return_instructions', _instructions)
  WHERE id = _return;
  PERFORM public.inv_audit(_org, _actor, 'return.authorized', 'return', _return::text, '{}'::jsonb);
  PERFORM public.inv_event(_org, 'return.authorized', jsonb_build_object('return_id', _return));
  RETURN jsonb_build_object('status', 'authorized');
END; $$;

CREATE OR REPLACE FUNCTION public.ret_reject(_org uuid, _return uuid, _actor uuid, _reason text, _internal text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.returns;
BEGIN
  PERFORM public.ret_assert(_actor, _org, 'returns.approve');
  IF _reason IS NULL OR length(btrim(_reason)) = 0 THEN
    RAISE EXCEPTION 'Ablehnung benötigt einen Grund.' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO r FROM public.returns WHERE id = _return AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retoure nicht gefunden.' USING ERRCODE = 'no_data_found'; END IF;
  IF r.status NOT IN ('requested','inspection','received') THEN
    RAISE EXCEPTION 'Diese Retoure kann nicht mehr abgelehnt werden.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.returns SET status = 'rejected', rejection_reason = _reason,
    internal_note = COALESCE(_internal, internal_note), completed_at = now()
  WHERE id = _return;
  PERFORM public.inv_audit(_org, _actor, 'return.rejected', 'return', _return::text, '{}'::jsonb);
  PERFORM public.inv_event(_org, 'return.rejected', jsonb_build_object('return_id', _return));
  RETURN jsonb_build_object('status', 'rejected');
END; $$;

CREATE OR REPLACE FUNCTION public.ret_mark_in_transit(_org uuid, _return uuid, _actor uuid, _shipment uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.returns;
BEGIN
  PERFORM public.ret_assert(_actor, _org, 'returns.manage');
  SELECT * INTO r FROM public.returns WHERE id = _return AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retoure nicht gefunden.' USING ERRCODE = 'no_data_found'; END IF;
  IF r.status <> 'authorized' THEN RAISE EXCEPTION 'Retoure ist nicht genehmigt.' USING ERRCODE = 'check_violation'; END IF;
  UPDATE public.returns SET status = 'in_transit', return_shipment_id = COALESCE(_shipment, return_shipment_id)
  WHERE id = _return;
  PERFORM public.inv_event(_org, 'return.in_transit', jsonb_build_object('return_id', _return));
  RETURN jsonb_build_object('status', 'in_transit');
END; $$;

CREATE OR REPLACE FUNCTION public.ret_receive(_org uuid, _return uuid, _actor uuid, _items jsonb, _idem text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.returns; it jsonb; ri public.return_items; res jsonb;
BEGIN
  res := public.inv_idem_get(_org, 'ret_receive', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.ret_assert(_actor, _org, 'returns.inspect');
  SELECT * INTO r FROM public.returns WHERE id = _return AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retoure nicht gefunden.' USING ERRCODE = 'no_data_found'; END IF;
  IF r.status NOT IN ('authorized','in_transit','received') THEN
    RAISE EXCEPTION 'Wareneingang ist in diesem Status nicht möglich.' USING ERRCODE = 'check_violation';
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb)) LOOP
    SELECT * INTO ri FROM public.return_items
      WHERE id = (it ->> 'return_item_id')::uuid AND return_id = _return FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Retourenposition nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
    IF (it ->> 'quantity_received')::int > ri.quantity_requested THEN
      RAISE EXCEPTION 'Eingegangene Menge überschreitet die angefragte Menge.' USING ERRCODE = 'check_violation';
    END IF;
    UPDATE public.return_items
    SET quantity_received = (it ->> 'quantity_received')::int,
        condition = COALESCE((it ->> 'condition')::public.return_item_condition, condition)
    WHERE id = ri.id;
  END LOOP;

  UPDATE public.returns SET status = 'received', received_at = COALESCE(received_at, now()) WHERE id = _return;
  PERFORM public.inv_audit(_org, _actor, 'return.received', 'return', _return::text, '{}'::jsonb);
  PERFORM public.inv_event(_org, 'return.received', jsonb_build_object('return_id', _return));
  res := jsonb_build_object('status', 'received');
  PERFORM public.inv_idem_put(_org, 'ret_receive', _idem, res);
  RETURN res;
END; $$;

CREATE OR REPLACE FUNCTION public.ret_start_inspection(_org uuid, _return uuid, _actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.returns;
BEGIN
  PERFORM public.ret_assert(_actor, _org, 'returns.inspect');
  SELECT * INTO r FROM public.returns WHERE id = _return AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retoure nicht gefunden.' USING ERRCODE = 'no_data_found'; END IF;
  IF r.status <> 'received' THEN RAISE EXCEPTION 'Ware ist noch nicht eingegangen.' USING ERRCODE = 'check_violation'; END IF;
  UPDATE public.returns SET status = 'inspection' WHERE id = _return;
  PERFORM public.inv_event(_org, 'return.inspection_started', jsonb_build_object('return_id', _return));
  RETURN jsonb_build_object('status', 'inspection');
END; $$;

-- inspection result per item; sets approved quantities, condition, restock decision and refund amounts
CREATE OR REPLACE FUNCTION public.ret_inspect(
  _org uuid, _return uuid, _actor uuid, _items jsonb, _shipping_mode public.shipping_refund_mode,
  _shipping_minor bigint, _idem text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.returns; it jsonb; ri public.return_items; oi public.order_items;
  amt bigint; total bigint := 0; approved_sum integer := 0; requested_sum integer := 0;
  new_status public.return_status; res jsonb;
BEGIN
  res := public.inv_idem_get(_org, 'ret_inspect', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.ret_assert(_actor, _org, 'returns.inspect');
  SELECT * INTO r FROM public.returns WHERE id = _return AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retoure nicht gefunden.' USING ERRCODE = 'no_data_found'; END IF;
  IF r.status NOT IN ('received','inspection') THEN
    RAISE EXCEPTION 'Prüfung ist in diesem Status nicht möglich.' USING ERRCODE = 'check_violation';
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb)) LOOP
    SELECT * INTO ri FROM public.return_items
      WHERE id = (it ->> 'return_item_id')::uuid AND return_id = _return FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Retourenposition nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
    SELECT * INTO oi FROM public.order_items WHERE id = ri.order_item_id;
    IF (it ->> 'quantity_approved')::int > GREATEST(ri.quantity_received, 0) THEN
      RAISE EXCEPTION 'Genehmigte Menge überschreitet die eingegangene Menge.' USING ERRCODE = 'check_violation';
    END IF;
    -- historical, proportional amount: paid line total after discount, never current prices
    amt := CASE WHEN oi.quantity > 0
      THEN round(COALESCE(oi.gross_minor, oi.line_total_minor)::numeric
                 * (it ->> 'quantity_approved')::int / oi.quantity)::bigint
      ELSE 0 END;
    UPDATE public.return_items
    SET quantity_approved = (it ->> 'quantity_approved')::int,
        condition = COALESCE((it ->> 'condition')::public.return_item_condition, condition),
        restock_decision = COALESCE((it ->> 'restock_decision')::public.restock_decision, restock_decision),
        inspection_note = COALESCE(it ->> 'note', inspection_note),
        refund_amount_minor = amt
    WHERE id = ri.id;
    total := total + amt;
  END LOOP;

  SELECT COALESCE(SUM(quantity_approved),0), COALESCE(SUM(quantity_requested),0)
  INTO approved_sum, requested_sum FROM public.return_items WHERE return_id = _return;

  total := total + GREATEST(COALESCE(_shipping_minor, 0), 0);
  IF approved_sum = 0 THEN new_status := 'rejected';
  ELSIF approved_sum < requested_sum THEN new_status := 'partially_approved';
  ELSE new_status := 'approved';
  END IF;

  UPDATE public.returns
  SET status = new_status, inspected_at = now(), refund_total_minor = total,
      shipping_refund_mode = COALESCE(_shipping_mode, shipping_refund_mode),
      shipping_refund_minor = GREATEST(COALESCE(_shipping_minor, 0), 0),
      rejection_reason = CASE WHEN new_status = 'rejected'
        THEN COALESCE(rejection_reason, 'Keine Position genehmigt.') ELSE rejection_reason END
  WHERE id = _return;

  PERFORM public.inv_audit(_org, _actor, 'return.inspected', 'return', _return::text,
    jsonb_build_object('approved', approved_sum, 'requested', requested_sum));
  PERFORM public.inv_event(_org, 'return.' || CASE WHEN new_status = 'partially_approved'
    THEN 'partially_approved' WHEN new_status = 'approved' THEN 'approved' ELSE 'rejected' END,
    jsonb_build_object('return_id', _return, 'refund_total_minor', total));

  res := jsonb_build_object('status', new_status, 'refund_total_minor', total);
  PERFORM public.inv_idem_put(_org, 'ret_inspect', _idem, res);
  RETURN res;
END; $$;

-- restock one approved return item exactly once, through the phase 3 inventory engine
CREATE OR REPLACE FUNCTION public.ret_restock(_org uuid, _return_item uuid, _actor uuid, _location uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE ri public.return_items; r public.returns; oi public.order_items; item uuid; res jsonb;
BEGIN
  PERFORM public.ret_assert(_actor, _org, 'returns.restock');
  SELECT * INTO ri FROM public.return_items WHERE id = _return_item AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retourenposition nicht gefunden.' USING ERRCODE = 'no_data_found'; END IF;
  IF ri.restocked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_restocked', 'quantity', ri.quantity_approved);
  END IF;
  IF ri.restock_decision <> 'restock' THEN
    RAISE EXCEPTION 'Für diese Position ist keine Einlagerung vorgesehen.' USING ERRCODE = 'check_violation';
  END IF;
  IF ri.quantity_approved <= 0 THEN
    RAISE EXCEPTION 'Keine genehmigte Menge zum Einlagern.' USING ERRCODE = 'check_violation';
  END IF;
  IF _location IS NULL THEN
    RAISE EXCEPTION 'Lagerort muss angegeben werden.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO r FROM public.returns WHERE id = ri.return_id;
  SELECT * INTO oi FROM public.order_items WHERE id = ri.order_item_id;
  SELECT id INTO item FROM public.inventory_items
    WHERE organization_id = _org AND variant_id = oi.variant_id;
  IF item IS NULL THEN RAISE EXCEPTION 'Kein Inventarartikel für diese Variante.' USING ERRCODE = 'no_data_found'; END IF;

  PERFORM public.inv_lock_level(_org, r.shop_id, item, _location);
  UPDATE public.inventory_levels SET on_hand = on_hand + ri.quantity_approved
  WHERE inventory_item_id = item AND location_id = _location;
  PERFORM public.inv_movement(_org, r.shop_id, item, _location, 'return', ri.quantity_approved,
    'return', ri.return_id::text, 'return_restock', NULL, _actor, 'return_item:' || ri.id::text);

  UPDATE public.return_items SET restocked_at = now(), restock_location_id = _location WHERE id = ri.id;
  PERFORM public.inv_audit(_org, _actor, 'return.restocked', 'return_item', ri.id::text,
    jsonb_build_object('quantity', ri.quantity_approved, 'location_id', _location));
  res := jsonb_build_object('status', 'restocked', 'quantity', ri.quantity_approved);
  RETURN res;
END; $$;

CREATE OR REPLACE FUNCTION public.ret_link_settlement(
  _org uuid, _return uuid, _actor uuid, _refund uuid, _credit_note uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.returns
  SET refund_id = COALESCE(_refund, refund_id),
      credit_note_id = COALESCE(_credit_note, credit_note_id),
      status = CASE WHEN _refund IS NOT NULL THEN 'refunded'::public.return_status ELSE status END
  WHERE id = _return AND organization_id = _org;
  PERFORM public.inv_event(_org, 'return.refunded',
    jsonb_build_object('return_id', _return, 'refund_id', _refund, 'credit_note_id', _credit_note));
  RETURN jsonb_build_object('status', 'linked');
END; $$;

CREATE OR REPLACE FUNCTION public.ret_complete(_org uuid, _return uuid, _actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.returns;
BEGIN
  PERFORM public.ret_assert(_actor, _org, 'returns.manage');
  SELECT * INTO r FROM public.returns WHERE id = _return AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retoure nicht gefunden.' USING ERRCODE = 'no_data_found'; END IF;
  IF r.status NOT IN ('approved','partially_approved','refunded') THEN
    RAISE EXCEPTION 'Retoure kann noch nicht abgeschlossen werden.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.returns SET status = 'completed', completed_at = now() WHERE id = _return;
  PERFORM public.inv_event(_org, 'return.completed', jsonb_build_object('return_id', _return));
  RETURN jsonb_build_object('status', 'completed');
END; $$;

CREATE OR REPLACE FUNCTION public.ret_cancel(_org uuid, _return uuid, _actor uuid, _by_customer boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.returns;
BEGIN
  IF NOT _by_customer THEN PERFORM public.ret_assert(_actor, _org, 'returns.manage'); END IF;
  SELECT * INTO r FROM public.returns WHERE id = _return AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retoure nicht gefunden.' USING ERRCODE = 'no_data_found'; END IF;
  IF r.status NOT IN ('requested','authorized','in_transit') THEN
    RAISE EXCEPTION 'Retoure kann nicht mehr storniert werden.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.returns SET status = 'cancelled', cancelled_at = now() WHERE id = _return;
  PERFORM public.inv_event(_org, 'return.cancelled', jsonb_build_object('return_id', _return));
  RETURN jsonb_build_object('status', 'cancelled');
END; $$;

REVOKE EXECUTE ON FUNCTION public.ret_assert(uuid, uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ret_next_number(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ret_request(uuid, uuid, uuid, uuid, uuid, jsonb, public.return_reason_code, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ret_link_settlement(uuid, uuid, uuid, uuid, uuid) FROM anon, authenticated;