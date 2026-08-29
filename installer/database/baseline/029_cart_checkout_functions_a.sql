-- EYIS Database Install Pack — Funktionen: cart-checkout (cart-checkout-functions-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

CREATE OR REPLACE FUNCTION public.cart_cancel_checkout(_org uuid, _session uuid, _actor uuid, _status checkout_session_status DEFAULT 'cancelled'::checkout_session_status, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s public.checkout_sessions; c public.carts; released integer; res jsonb;
BEGIN
  res := public.inv_idem_get(_org, 'cart_cancel_checkout', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;

  SELECT * INTO s FROM public.checkout_sessions WHERE id = _session AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Checkout-Sitzung nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;

  IF s.status NOT IN ('open','validated','awaiting_payment') THEN
    res := jsonb_build_object('checkout_session_id', s.id, 'status', s.status, 'changed', false);
    PERFORM public.inv_idem_put(_org, 'cart_cancel_checkout', _idem, res);
    RETURN res;
  END IF;

  released := public.cart_release_session_reservations(_org, s.id);
  UPDATE public.checkout_sessions SET status = _status WHERE id = s.id;

  SELECT * INTO c FROM public.carts WHERE id = s.cart_id FOR UPDATE;
  IF FOUND AND c.status = 'checkout' THEN
    IF c.expires_at > now() THEN
      UPDATE public.carts SET status = 'active', last_activity_at = now() WHERE id = c.id;
    ELSE
      UPDATE public.carts SET status = 'expired' WHERE id = c.id;
    END IF;
  END IF;

  PERFORM public.inv_audit(_org, _actor, 'checkout.session.' || _status::text, 'checkout_session', s.id::text,
    jsonb_build_object('released', released));
  PERFORM public.inv_event(_org, 'checkout.session.' || _status::text,
    jsonb_build_object('checkout_session_id', s.id, 'cart_id', s.cart_id, 'released', released));

  res := jsonb_build_object('checkout_session_id', s.id, 'status', _status, 'released', released, 'changed', true);
  PERFORM public.inv_idem_put(_org, 'cart_cancel_checkout', _idem, res);
  RETURN res;
END; $function$;

CREATE OR REPLACE FUNCTION public.cart_expire_checkout_sessions(_org uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s record; n integer := 0;
BEGIN
  FOR s IN
    SELECT id, organization_id FROM public.checkout_sessions
    WHERE status IN ('open','validated','awaiting_payment') AND expires_at <= now()
      AND (_org IS NULL OR organization_id = _org)
    ORDER BY expires_at
    LIMIT 500
  LOOP
    PERFORM public.cart_cancel_checkout(s.organization_id, s.id, NULL, 'expired'::public.checkout_session_status, NULL);
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('expired_sessions', n);
END; $function$;

CREATE OR REPLACE FUNCTION public.cart_pick_location(_org uuid, _shop uuid, _item uuid, _qty integer)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT l.id
  FROM public.inventory_locations l
  LEFT JOIN public.inventory_levels lv
    ON lv.location_id = l.id AND lv.inventory_item_id = _item AND lv.organization_id = _org
  WHERE l.organization_id = _org AND l.shop_id = _shop AND l.status = 'active'
  ORDER BY (coalesce(lv.on_hand,0) - coalesce(lv.damaged,0) - coalesce(lv.reserved,0)) >= _qty DESC,
           (coalesce(lv.on_hand,0) - coalesce(lv.damaged,0) - coalesce(lv.reserved,0)) DESC,
           l.priority ASC, l.id ASC
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.cart_release_session_reservations(_org uuid, _session uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record; n integer := 0;
BEGIN
  PERFORM set_config('commerce.system_op', 'on', true);
  FOR r IN
    SELECT cr.id, cr.inventory_reservation_id
    FROM public.checkout_reservations cr
    JOIN public.inventory_reservations ir ON ir.id = cr.inventory_reservation_id
    WHERE cr.checkout_session_id = _session AND cr.organization_id = _org AND ir.status = 'active'
  LOOP
    PERFORM public.inv_release_reservation(_org, NULL, r.inventory_reservation_id,
      'checkout-release:' || r.id::text);
    n := n + 1;
  END LOOP;
  PERFORM set_config('commerce.system_op', 'off', true);
  RETURN n;
END; $function$;

CREATE OR REPLACE FUNCTION public.cart_start_checkout(_org uuid, _shop uuid, _cart uuid, _snapshot uuid, _actor uuid, _email text DEFAULT NULL::text, _ttl_minutes integer DEFAULT 20, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c public.carts; it record; sess uuid; inv_item public.inventory_items;
  loc uuid; rr jsonb; res jsonb; cnt integer := 0; item_count integer;
BEGIN
  res := public.inv_idem_get(_org, 'cart_start_checkout', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;

  SELECT * INTO c FROM public.carts WHERE id = _cart AND organization_id = _org AND shop_id = _shop FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Warenkorb nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
  IF c.status <> 'active' THEN
    RAISE EXCEPTION 'Warenkorb ist nicht aktiv (Status: %).', c.status USING ERRCODE = 'check_violation';
  END IF;
  IF c.expires_at <= now() THEN
    RAISE EXCEPTION 'Warenkorb ist abgelaufen.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO item_count FROM public.cart_items WHERE cart_id = _cart;
  IF item_count = 0 THEN RAISE EXCEPTION 'Warenkorb ist leer.' USING ERRCODE = 'check_violation'; END IF;

  INSERT INTO public.checkout_sessions
    (organization_id, shop_id, cart_id, status, customer_id, email, price_snapshot_id, expires_at)
  VALUES (_org, _shop, _cart, 'open', c.customer_id, COALESCE(_email, c.customer_email), _snapshot,
          now() + make_interval(mins => GREATEST(_ttl_minutes, 1)))
  RETURNING id INTO sess;

  PERFORM set_config('commerce.system_op', 'on', true);

  FOR it IN
    SELECT ci.id, ci.variant_id, ci.quantity FROM public.cart_items ci
    WHERE ci.cart_id = _cart ORDER BY ci.variant_id, ci.id
  LOOP
    SELECT * INTO inv_item FROM public.inventory_items
    WHERE variant_id = it.variant_id AND organization_id = _org;
    IF NOT FOUND THEN CONTINUE; END IF;

    loc := public.cart_pick_location(_org, _shop, inv_item.id, it.quantity);
    IF loc IS NULL AND inv_item.track_inventory THEN
      RAISE EXCEPTION 'Kein Lagerort für Position % verfügbar.', it.variant_id USING ERRCODE = 'check_violation';
    END IF;

    rr := public.inv_reserve_stock(_org, _shop, NULL, inv_item.id, loc, it.quantity,
      'checkout_session', sess::text, now() + make_interval(mins => GREATEST(_ttl_minutes, 1)),
      'checkout:' || sess::text || ':' || it.id::text);

    INSERT INTO public.checkout_reservations
      (organization_id, shop_id, cart_id, checkout_session_id, inventory_reservation_id, cart_item_id, quantity)
    VALUES (_org, _shop, _cart, sess, (rr ->> 'reservation_id')::uuid, it.id, it.quantity);
    cnt := cnt + 1;
  END LOOP;

  PERFORM set_config('commerce.system_op', 'off', true);

  UPDATE public.carts SET status = 'checkout', last_activity_at = now() WHERE id = _cart;

  PERFORM public.inv_audit(_org, _actor, 'checkout.session.started', 'checkout_session', sess::text,
    jsonb_build_object('cart_id', _cart, 'reservations', cnt));
  PERFORM public.inv_event(_org, 'checkout.session.started',
    jsonb_build_object('checkout_session_id', sess, 'cart_id', _cart, 'reservations', cnt));

  res := jsonb_build_object('checkout_session_id', sess, 'cart_id', _cart, 'reservations', cnt);
  PERFORM public.inv_idem_put(_org, 'cart_start_checkout', _idem, res);
  RETURN res;
END; $function$;
