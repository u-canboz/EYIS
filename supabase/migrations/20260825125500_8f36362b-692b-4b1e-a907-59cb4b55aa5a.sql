-- ============================================================
-- Phase 5: Payments & Orders Engine
-- ============================================================

CREATE TYPE public.commerce_environment AS ENUM ('test','live');
CREATE TYPE public.payment_session_status AS ENUM ('created','pending','paid','failed','cancelled','expired');
CREATE TYPE public.payment_attempt_status AS ENUM ('started','pending','succeeded','failed','cancelled');
CREATE TYPE public.payment_transaction_type AS ENUM ('authorization','capture','charge','refund','partial_refund','void');
CREATE TYPE public.order_state AS ENUM ('pending','confirmed','processing','completed','cancelled');
CREATE TYPE public.order_payment_status AS ENUM ('unpaid','authorized','paid','partially_refunded','refunded','failed');
CREATE TYPE public.order_fulfillment_status AS ENUM ('unfulfilled','partially_fulfilled','fulfilled','returned');
CREATE TYPE public.refund_status AS ENUM ('requested','processing','completed','failed','cancelled');

-- ============ PROVIDER CONFIG ============
CREATE TABLE public.payment_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  provider text NOT NULL,
  display_name text NOT NULL,
  environment public.commerce_environment NOT NULL DEFAULT 'test',
  status public.entity_status NOT NULL DEFAULT 'inactive',
  priority integer NOT NULL DEFAULT 100,
  secret_ref text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, provider, environment)
);
GRANT SELECT ON public.payment_provider_configs TO authenticated;
GRANT ALL ON public.payment_provider_configs TO service_role;
ALTER TABLE public.payment_provider_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ppc_read" ON public.payment_provider_configs FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'payment_settings.read'));
CREATE TRIGGER ppc_updated_at BEFORE UPDATE ON public.payment_provider_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ORDER NUMBER SEQUENCES ============
CREATE TABLE public.shop_order_sequences (
  shop_id uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  prefix text NOT NULL DEFAULT 'ORD',
  padding integer NOT NULL DEFAULT 6,
  next_value bigint NOT NULL DEFAULT 1
);
GRANT SELECT ON public.shop_order_sequences TO authenticated;
GRANT ALL ON public.shop_order_sequences TO service_role;
ALTER TABLE public.shop_order_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sos_read" ON public.shop_order_sequences FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'orders.read'));

-- ============ PAYMENT SESSIONS ============
CREATE TABLE public.payment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  checkout_session_id uuid NOT NULL REFERENCES public.checkout_sessions(id) ON DELETE CASCADE,
  checkout_snapshot_id uuid NOT NULL REFERENCES public.checkout_snapshots(id) ON DELETE CASCADE,
  provider text NOT NULL,
  environment public.commerce_environment NOT NULL DEFAULT 'test',
  status public.payment_session_status NOT NULL DEFAULT 'created',
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency_code text NOT NULL,
  provider_session_id text,
  provider_payment_id text,
  redirect_url text,
  idempotency_key text,
  last_error text,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider, provider_session_id)
);
CREATE INDEX payment_sessions_checkout_idx ON public.payment_sessions (checkout_session_id);
GRANT SELECT ON public.payment_sessions TO authenticated;
GRANT ALL ON public.payment_sessions TO service_role;
ALTER TABLE public.payment_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_sessions_read" ON public.payment_sessions FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'payments.read'));
CREATE TRIGGER payment_sessions_updated_at BEFORE UPDATE ON public.payment_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PAYMENT ATTEMPTS ============
CREATE TABLE public.payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payment_session_id uuid NOT NULL REFERENCES public.payment_sessions(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  status public.payment_attempt_status NOT NULL DEFAULT 'started',
  provider_payment_id text,
  error_code text,
  error_message text,
  provider_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_session_id, attempt_number)
);
GRANT SELECT ON public.payment_attempts TO authenticated;
GRANT ALL ON public.payment_attempts TO service_role;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_attempts_read" ON public.payment_attempts FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'payments.read'));
CREATE TRIGGER payment_attempts_updated_at BEFORE UPDATE ON public.payment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PAYMENT EVENTS (webhook journal) ============
CREATE TABLE public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  signature_verified boolean NOT NULL DEFAULT false,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  process_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);
GRANT SELECT ON public.payment_events TO authenticated;
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_events_read" ON public.payment_events FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.has_permission(auth.uid(), organization_id, 'payments.read'));

CREATE OR REPLACE FUNCTION public.payment_events_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Zahlungs-Events dürfen nicht gelöscht werden.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.payload IS DISTINCT FROM OLD.payload
     OR NEW.provider_event_id IS DISTINCT FROM OLD.provider_event_id
     OR NEW.provider IS DISTINCT FROM OLD.provider
     OR NEW.event_type IS DISTINCT FROM OLD.event_type THEN
    RAISE EXCEPTION 'Zahlungs-Events sind unveränderbar; nur der Verarbeitungsstatus darf sich ändern.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER payment_events_no_delete BEFORE DELETE ON public.payment_events
  FOR EACH ROW EXECUTE FUNCTION public.payment_events_immutable();
CREATE TRIGGER payment_events_guard BEFORE UPDATE ON public.payment_events
  FOR EACH ROW EXECUTE FUNCTION public.payment_events_immutable();

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  checkout_session_id uuid NOT NULL REFERENCES public.checkout_sessions(id) ON DELETE RESTRICT,
  checkout_snapshot_id uuid NOT NULL REFERENCES public.checkout_snapshots(id) ON DELETE RESTRICT,
  cart_id uuid REFERENCES public.carts(id) ON DELETE SET NULL,
  customer_id uuid,
  email text,
  environment public.commerce_environment NOT NULL DEFAULT 'test',
  order_status public.order_state NOT NULL DEFAULT 'confirmed',
  payment_status public.order_payment_status NOT NULL DEFAULT 'paid',
  fulfillment_status public.order_fulfillment_status NOT NULL DEFAULT 'unfulfilled',
  currency_code text NOT NULL,
  subtotal_minor bigint NOT NULL DEFAULT 0,
  discount_minor bigint NOT NULL DEFAULT 0,
  shipping_minor bigint NOT NULL DEFAULT 0,
  tax_minor bigint NOT NULL DEFAULT 0,
  total_minor bigint NOT NULL DEFAULT 0,
  refunded_minor bigint NOT NULL DEFAULT 0,
  shipping_method jsonb NOT NULL DEFAULT '{}'::jsonb,
  internal_note text,
  cancelled_at timestamptz,
  cancel_reason text,
  placed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, order_number),
  UNIQUE (checkout_session_id)
);
CREATE INDEX orders_org_placed_idx ON public.orders (organization_id, placed_at DESC);
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_read" ON public.orders FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'orders.read'));
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid,
  variant_id uuid,
  title_snapshot text NOT NULL,
  variant_title_snapshot text NOT NULL,
  sku_snapshot text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_base_minor bigint NOT NULL,
  unit_resolved_minor bigint NOT NULL,
  line_subtotal_minor bigint NOT NULL,
  line_discount_minor bigint NOT NULL,
  line_total_minor bigint NOT NULL,
  applied_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  applied_promotions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_read" ON public.order_items FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'orders.read'));
CREATE TRIGGER order_items_immutable BEFORE UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_immutable();

CREATE TABLE public.order_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  type public.checkout_address_type NOT NULL,
  address jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, type)
);
GRANT SELECT ON public.order_addresses TO authenticated;
GRANT ALL ON public.order_addresses TO service_role;
ALTER TABLE public.order_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_addresses_read" ON public.order_addresses FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'orders.read'));
CREATE TRIGGER order_addresses_immutable BEFORE UPDATE OR DELETE ON public.order_addresses
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_immutable();

CREATE TABLE public.order_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  promotion_id uuid,
  code_snapshot text,
  name_snapshot text NOT NULL,
  discount_minor bigint NOT NULL DEFAULT 0,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.order_promotions TO authenticated;
GRANT ALL ON public.order_promotions TO service_role;
ALTER TABLE public.order_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_promotions_read" ON public.order_promotions FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'orders.read'));
CREATE TRIGGER order_promotions_immutable BEFORE UPDATE OR DELETE ON public.order_promotions
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_immutable();

CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_session_id uuid REFERENCES public.payment_sessions(id) ON DELETE SET NULL,
  provider text NOT NULL,
  type public.payment_transaction_type NOT NULL,
  amount_minor bigint NOT NULL,
  currency_code text NOT NULL,
  provider_transaction_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_transactions_order_idx ON public.payment_transactions (order_id);
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_transactions_read" ON public.payment_transactions FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'payments.read'));

CREATE TABLE public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency_code text NOT NULL,
  reason text,
  status public.refund_status NOT NULL DEFAULT 'requested',
  provider text,
  provider_refund_id text,
  requested_by uuid,
  idempotency_key text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refunds_order_idx ON public.refunds (order_id);
GRANT SELECT ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "refunds_read" ON public.refunds FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'payments.read'));
CREATE TRIGGER refunds_updated_at BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ORDER NUMBER ============
CREATE OR REPLACE FUNCTION public.order_next_number(_org uuid, _shop uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE seq public.shop_order_sequences; v bigint;
BEGIN
  INSERT INTO public.shop_order_sequences (shop_id, organization_id)
  VALUES (_shop, _org) ON CONFLICT (shop_id) DO NOTHING;

  SELECT * INTO seq FROM public.shop_order_sequences WHERE shop_id = _shop FOR UPDATE;
  v := seq.next_value;
  UPDATE public.shop_order_sequences SET next_value = next_value + 1 WHERE shop_id = _shop;
  RETURN seq.prefix || '-' || lpad(v::text, seq.padding, '0');
END; $$;

-- ============ FINALIZE ORDER ============
CREATE OR REPLACE FUNCTION public.order_finalize_from_payment(
  _org uuid, _payment_session uuid, _provider_payment_id text,
  _amount_minor bigint, _currency text, _actor uuid DEFAULT NULL, _idem text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ps public.payment_sessions; sess public.checkout_sessions; snap public.checkout_snapshots;
  existing public.orders; oid uuid; onum text; ln jsonb; pr jsonb; totals jsonb;
  ci public.cart_items; res jsonb; r record; committed integer := 0;
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

  INSERT INTO public.orders (
    organization_id, shop_id, order_number, checkout_session_id, checkout_snapshot_id, cart_id,
    customer_id, email, environment, order_status, payment_status, fulfillment_status,
    currency_code, subtotal_minor, discount_minor, shipping_minor, tax_minor, total_minor,
    shipping_method)
  VALUES (_org, sess.shop_id, onum, sess.id, snap.id, sess.cart_id,
    sess.customer_id, COALESCE(snap.email, sess.email), ps.environment, 'confirmed', 'paid', 'unfulfilled',
    snap.currency_code,
    COALESCE((totals ->> 'subtotalMinor')::bigint, 0),
    COALESCE((totals ->> 'discountMinor')::bigint, 0),
    COALESCE((totals ->> 'shippingMinor')::bigint, 0),
    COALESCE((totals ->> 'taxMinor')::bigint, 0),
    COALESCE((totals ->> 'totalMinor')::bigint, 0),
    COALESCE(snap.shipping_method, '{}'::jsonb))
  RETURNING id INTO oid;

  FOR ln IN SELECT * FROM jsonb_array_elements(COALESCE(snap.lines, '[]'::jsonb)) LOOP
    SELECT * INTO ci FROM public.cart_items WHERE id = (ln ->> 'lineId')::uuid;
    INSERT INTO public.order_items (
      organization_id, order_id, product_id, variant_id, title_snapshot, variant_title_snapshot,
      sku_snapshot, quantity, unit_base_minor, unit_resolved_minor,
      line_subtotal_minor, line_discount_minor, line_total_minor, applied_rules, applied_promotions)
    VALUES (_org, oid, ci.product_id, COALESCE(ci.variant_id, (ln ->> 'variantId')::uuid),
      COALESCE(ci.title_snapshot, 'Position'), COALESCE(ci.variant_title_snapshot, ''), ci.sku_snapshot,
      (ln ->> 'quantity')::integer,
      COALESCE((ln ->> 'unitBaseMinor')::bigint, 0),
      COALESCE((ln ->> 'unitResolvedMinor')::bigint, 0),
      COALESCE((ln ->> 'lineSubtotalMinor')::bigint, 0),
      COALESCE((ln ->> 'lineDiscountMinor')::bigint, 0),
      COALESCE((ln ->> 'lineTotalMinor')::bigint, 0),
      COALESCE(ln -> 'appliedPriceRules', '[]'::jsonb),
      COALESCE(ln -> 'appliedPromotions', '[]'::jsonb));
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

-- ============ CANCEL ORDER ============
CREATE OR REPLACE FUNCTION public.order_cancel(_org uuid, _order uuid, _actor uuid, _reason text, _idem text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders; res jsonb;
BEGIN
  res := public.inv_idem_get(_org, 'order_cancel', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.inv_assert(_actor, _org, 'orders.cancel');

  SELECT * INTO o FROM public.orders WHERE id = _order AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bestellung nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
  IF o.order_status = 'cancelled' THEN
    res := jsonb_build_object('order_id', o.id, 'status', 'cancelled', 'changed', false);
    PERFORM public.inv_idem_put(_org, 'order_cancel', _idem, res);
    RETURN res;
  END IF;
  IF o.order_status = 'completed' OR o.fulfillment_status <> 'unfulfilled' THEN
    RAISE EXCEPTION 'Bereits abgeschlossene oder versendete Bestellungen können nicht storniert werden.'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.orders SET order_status = 'cancelled', cancelled_at = now(), cancel_reason = _reason
  WHERE id = o.id;

  PERFORM public.inv_audit(_org, _actor, 'order.cancelled', 'order', o.id::text,
    jsonb_build_object('reason', _reason));
  PERFORM public.inv_event(_org, 'order.cancelled', jsonb_build_object('order_id', o.id, 'reason', _reason));

  res := jsonb_build_object('order_id', o.id, 'status', 'cancelled', 'changed', true);
  PERFORM public.inv_idem_put(_org, 'order_cancel', _idem, res);
  RETURN res;
END; $$;

-- ============ REFUNDS ============
CREATE OR REPLACE FUNCTION public.refund_create(_org uuid, _order uuid, _actor uuid, _amount_minor bigint,
  _reason text DEFAULT NULL, _idem text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders; rid uuid; already bigint; res jsonb;
BEGIN
  res := public.inv_idem_get(_org, 'refund_create', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.inv_assert(_actor, _org, 'payments.refund');

  SELECT * INTO o FROM public.orders WHERE id = _order AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bestellung nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
  IF _amount_minor <= 0 THEN RAISE EXCEPTION 'Erstattungsbetrag muss größer als 0 sein.' USING ERRCODE = 'check_violation'; END IF;
  IF o.payment_status NOT IN ('paid','partially_refunded') THEN
    RAISE EXCEPTION 'Nur bezahlte Bestellungen können erstattet werden.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(SUM(amount_minor), 0) INTO already FROM public.refunds
  WHERE order_id = o.id AND status IN ('requested','processing','completed');
  IF already + _amount_minor > o.total_minor THEN
    RAISE EXCEPTION 'Erstattung übersteigt den bezahlten Betrag (bereits: %, offen: %).',
      already, o.total_minor - already USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.refunds (organization_id, order_id, amount_minor, currency_code, reason,
    status, requested_by, idempotency_key)
  VALUES (_org, o.id, _amount_minor, o.currency_code, _reason, 'requested', _actor, _idem)
  RETURNING id INTO rid;

  PERFORM public.inv_audit(_org, _actor, 'refund.requested', 'refund', rid::text,
    jsonb_build_object('order_id', o.id, 'amount_minor', _amount_minor, 'reason', _reason));

  res := jsonb_build_object('refund_id', rid, 'amount_minor', _amount_minor,
    'refundable_remaining_minor', o.total_minor - already - _amount_minor);
  PERFORM public.inv_idem_put(_org, 'refund_create', _idem, res);
  RETURN res;
END; $$;

CREATE OR REPLACE FUNCTION public.refund_settle(_org uuid, _refund uuid, _status public.refund_status,
  _provider text DEFAULT NULL, _provider_refund_id text DEFAULT NULL, _error text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rf public.refunds; o public.orders; completed_sum bigint;
BEGIN
  SELECT * INTO rf FROM public.refunds WHERE id = _refund AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Erstattung nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
  IF rf.status = _status THEN RETURN jsonb_build_object('refund_id', rf.id, 'status', rf.status, 'changed', false); END IF;

  UPDATE public.refunds SET status = _status, provider = COALESCE(_provider, provider),
    provider_refund_id = COALESCE(_provider_refund_id, provider_refund_id), error_message = _error
  WHERE id = rf.id;

  SELECT * INTO o FROM public.orders WHERE id = rf.order_id FOR UPDATE;
  SELECT COALESCE(SUM(amount_minor), 0) INTO completed_sum FROM public.refunds
  WHERE order_id = o.id AND status = 'completed';

  UPDATE public.orders SET refunded_minor = completed_sum,
    payment_status = CASE
      WHEN completed_sum >= o.total_minor AND completed_sum > 0 THEN 'refunded'::public.order_payment_status
      WHEN completed_sum > 0 THEN 'partially_refunded'::public.order_payment_status
      ELSE o.payment_status END
  WHERE id = o.id;

  IF _status = 'completed' THEN
    INSERT INTO public.payment_transactions (organization_id, order_id, provider, type, amount_minor,
      currency_code, provider_transaction_id)
    VALUES (_org, o.id,
      COALESCE(_provider, rf.provider, 'unknown'),
      CASE WHEN completed_sum >= o.total_minor THEN 'refund'::public.payment_transaction_type
           ELSE 'partial_refund'::public.payment_transaction_type END,
      rf.amount_minor, rf.currency_code, _provider_refund_id);
    PERFORM public.inv_event(_org, 'refund.completed',
      jsonb_build_object('refund_id', rf.id, 'order_id', o.id, 'amount_minor', rf.amount_minor));
  END IF;

  PERFORM public.inv_audit(_org, NULL, 'refund.' || _status::text, 'refund', rf.id::text,
    jsonb_build_object('order_id', o.id, 'amount_minor', rf.amount_minor));

  RETURN jsonb_build_object('refund_id', rf.id, 'status', _status, 'changed', true,
    'refunded_total_minor', completed_sum);
END; $$;

REVOKE ALL ON FUNCTION public.order_next_number(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.order_finalize_from_payment(uuid,uuid,text,bigint,text,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.order_cancel(uuid,uuid,uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_create(uuid,uuid,uuid,bigint,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_settle(uuid,uuid,public.refund_status,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.order_finalize_from_payment(uuid,uuid,text,bigint,text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_cancel(uuid,uuid,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_create(uuid,uuid,uuid,bigint,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_settle(uuid,uuid,public.refund_status,text,text,text) TO service_role;

-- ============ PERMISSIONS ============
INSERT INTO public.role_permissions (role, permission) VALUES
  ('owner','orders.read'),('owner','orders.manage'),('owner','orders.cancel'),
  ('owner','payments.read'),('owner','payments.manage'),('owner','payments.refund'),
  ('owner','payment_settings.read'),('owner','payment_settings.manage'),
  ('administrator','orders.read'),('administrator','orders.manage'),('administrator','orders.cancel'),
  ('administrator','payments.read'),('administrator','payments.manage'),('administrator','payments.refund'),
  ('administrator','payment_settings.read'),('administrator','payment_settings.manage'),
  ('operations','orders.read'),('operations','orders.manage'),('operations','orders.cancel'),
  ('operations','payments.read'),
  ('fulfillment','orders.read'),
  ('customer_support','orders.read'),('customer_support','orders.manage'),('customer_support','payments.read'),
  ('finance','orders.read'),('finance','payments.read'),('finance','payments.refund'),
  ('finance','payment_settings.read'),
  ('marketing','orders.read'),
  ('developer','orders.read'),('developer','payments.read'),('developer','payment_settings.read'),
  ('read_only','orders.read'),('read_only','payments.read')
ON CONFLICT DO NOTHING;