-- EYIS Database Install Pack — Funktionen: payments-orders (payments-orders-functions-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.order_cancel(_org uuid, _order uuid, _actor uuid, _reason text, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$;

CREATE OR REPLACE FUNCTION public.order_finalize_from_payment(_org uuid, _payment_session uuid, _provider_payment_id text, _amount_minor bigint, _currency text, _actor uuid DEFAULT NULL::uuid, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$;

CREATE OR REPLACE FUNCTION public.order_next_number(_org uuid, _shop uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE seq public.shop_order_sequences; v bigint;
BEGIN
  INSERT INTO public.shop_order_sequences (shop_id, organization_id)
  VALUES (_shop, _org) ON CONFLICT (shop_id) DO NOTHING;

  SELECT * INTO seq FROM public.shop_order_sequences WHERE shop_id = _shop FOR UPDATE;
  v := seq.next_value;
  UPDATE public.shop_order_sequences SET next_value = next_value + 1 WHERE shop_id = _shop;
  RETURN seq.prefix || '-' || lpad(v::text, seq.padding, '0');
END; $function$;

CREATE OR REPLACE FUNCTION public.payment_events_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN IF TG_OP = 'DELETE' AND public.purge_mode() THEN RETURN OLD; END IF;
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
END; $function$;
