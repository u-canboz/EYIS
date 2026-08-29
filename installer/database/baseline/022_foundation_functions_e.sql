-- EYIS Database Install Pack — Funktionen: foundation (foundation-functions-e)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.inv_reserve_stock(_org uuid, _shop uuid, _actor uuid, _item uuid, _loc uuid, _qty integer, _reference_type text DEFAULT NULL::text, _reference_id text DEFAULT NULL::text, _expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE lvl public.inventory_levels; item public.inventory_items; old_av integer; new_av integer;
  avail_now integer; backordered integer; rid uuid; res jsonb;
BEGIN
  res := public.inv_idem_get(_org, 'inv_reserve_stock', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.inv_assert(_actor, _org, 'inventory.adjust');
  IF _qty <= 0 THEN RAISE EXCEPTION 'Menge muss größer als 0 sein.' USING ERRCODE = 'check_violation'; END IF;

  SELECT * INTO item FROM public.inventory_items WHERE id = _item AND organization_id = _org;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventarartikel nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;

  IF NOT item.track_inventory THEN
    INSERT INTO public.inventory_reservations
      (organization_id, shop_id, inventory_item_id, location_id, quantity, backordered_quantity,
       reference_type, reference_id, expires_at, idempotency_key, metadata)
    VALUES (_org, _shop, _item, _loc, _qty, 0, _reference_type, _reference_id, _expires_at, _idem,
            jsonb_build_object('untracked', true))
    RETURNING id INTO rid;
    PERFORM public.inv_audit(_org, _actor, 'inventory.reservation.created', 'inventory_reservation', rid::text,
      jsonb_build_object('quantity', _qty, 'untracked', true));
    PERFORM public.inv_event(_org, 'inventory.reservation.created',
      jsonb_build_object('reservation_id', rid, 'inventory_item_id', _item, 'quantity', _qty, 'untracked', true));
    res := jsonb_build_object('reservation_id', rid, 'tracked', false, 'quantity', _qty,
      'available_now', NULL, 'backordered_quantity', 0);
    PERFORM public.inv_idem_put(_org, 'inv_reserve_stock', _idem, res);
    RETURN res;
  END IF;

  lvl := public.inv_lock_level(_org, _shop, _item, _loc);
  old_av := public.inv_available(lvl);
  avail_now := LEAST(GREATEST(old_av, 0), _qty);
  backordered := _qty - avail_now;

  IF backordered > 0 AND NOT item.allow_backorder THEN
    RAISE EXCEPTION 'Nicht genügend Bestand verfügbar (verfügbar: %, angefragt: %).', GREATEST(old_av, 0), _qty
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.inventory_levels SET reserved = reserved + _qty WHERE id = lvl.id RETURNING * INTO lvl;
  new_av := public.inv_available(lvl);

  INSERT INTO public.inventory_reservations
    (organization_id, shop_id, inventory_item_id, location_id, quantity, backordered_quantity,
     reference_type, reference_id, expires_at, idempotency_key)
  VALUES (_org, _shop, _item, _loc, _qty, backordered, _reference_type, _reference_id, _expires_at, _idem)
  RETURNING id INTO rid;

  PERFORM public.inv_movement(_org, _shop, _item, _loc, 'reservation', _qty, 'reservation', rid::text, NULL, NULL, _actor, _idem);
  PERFORM public.inv_audit(_org, _actor, 'inventory.reservation.created', 'inventory_reservation', rid::text,
    jsonb_build_object('quantity', _qty, 'backordered', backordered, 'location_id', _loc));
  PERFORM public.inv_event(_org, 'inventory.reservation.created',
    jsonb_build_object('reservation_id', rid, 'inventory_item_id', _item, 'location_id', _loc,
      'quantity', _qty, 'backordered_quantity', backordered));
  PERFORM public.inv_status_events(_org, _shop, _item, _loc, old_av, new_av);

  res := jsonb_build_object('reservation_id', rid, 'tracked', true, 'quantity', _qty,
    'available_now', avail_now, 'backordered_quantity', backordered,
    'on_hand', lvl.on_hand, 'reserved', lvl.reserved, 'available', new_av);
  PERFORM public.inv_idem_put(_org, 'inv_reserve_stock', _idem, res);
  RETURN res;
END; $function$;

CREATE OR REPLACE FUNCTION public.inv_status_events(_org uuid, _shop uuid, _item uuid, _loc uuid, _old integer, _new integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE thr integer;
  payload jsonb;
BEGIN
  SELECT COALESCE(MIN(r.threshold), 0) INTO thr FROM public.stock_alert_rules r
  WHERE r.organization_id = _org AND r.enabled
    AND (r.inventory_item_id IS NULL OR r.inventory_item_id = _item)
    AND (r.location_id IS NULL OR r.location_id = _loc);
  thr := COALESCE(thr, 0);

  payload := jsonb_build_object('inventory_item_id', _item, 'location_id', _loc,
    'shop_id', _shop, 'available_before', _old, 'available_after', _new, 'threshold', thr);

  IF _old > 0 AND _new <= 0 THEN
    PERFORM public.inv_event(_org, 'inventory.out_of_stock', payload);
  ELSIF _old <= 0 AND _new > 0 THEN
    PERFORM public.inv_event(_org, 'inventory.back_in_stock', payload);
  ELSIF thr > 0 AND _old > thr AND _new <= thr THEN
    PERFORM public.inv_event(_org, 'inventory.low_stock', payload);
  END IF;
END; $function$;

CREATE OR REPLACE FUNCTION public.inv_transfer_cancel(_org uuid, _actor uuid, _transfer uuid, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE t public.inventory_transfers; ti record; lvl public.inventory_levels;
  old_av integer; new_av integer; res jsonb;
BEGIN
  res := public.inv_idem_get(_org, 'inv_transfer_cancel', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.inv_assert(_actor, _org, 'inventory.transfer');

  SELECT * INTO t FROM public.inventory_transfers WHERE id = _transfer AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Umlagerung nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
  IF t.status = 'cancelled' THEN
    res := jsonb_build_object('transfer_id', t.id, 'status', 'cancelled', 'changed', false);
    PERFORM public.inv_idem_put(_org, 'inv_transfer_cancel', _idem, res);
    RETURN res;
  END IF;
  IF t.status = 'completed' THEN
    RAISE EXCEPTION 'Abgeschlossene Umlagerungen können nicht storniert werden.' USING ERRCODE = 'check_violation';
  END IF;

  IF t.status = 'in_transit' THEN
    FOR ti IN SELECT * FROM public.inventory_transfer_items WHERE transfer_id = t.id LOOP
      lvl := public.inv_lock_level(_org, t.shop_id, ti.inventory_item_id, t.from_location_id);
      old_av := public.inv_available(lvl);
      UPDATE public.inventory_levels SET on_hand = on_hand + ti.quantity WHERE id = lvl.id RETURNING * INTO lvl;
      new_av := public.inv_available(lvl);
      PERFORM public.inv_movement(_org, t.shop_id, ti.inventory_item_id, t.from_location_id,
        'transfer_in', ti.quantity, 'transfer_cancel', t.id::text, NULL, NULL, _actor, _idem);
      PERFORM public.inv_status_events(_org, t.shop_id, ti.inventory_item_id, t.from_location_id, old_av, new_av);
    END LOOP;
  END IF;

  UPDATE public.inventory_transfers SET status = 'cancelled' WHERE id = t.id;
  PERFORM public.inv_audit(_org, _actor, 'inventory.transfer.cancelled', 'inventory_transfer', t.id::text, '{}'::jsonb);

  res := jsonb_build_object('transfer_id', t.id, 'status', 'cancelled', 'changed', true);
  PERFORM public.inv_idem_put(_org, 'inv_transfer_cancel', _idem, res);
  RETURN res;
END; $function$;

CREATE OR REPLACE FUNCTION public.inv_transfer_complete(_org uuid, _actor uuid, _transfer uuid, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE t public.inventory_transfers; ti record; lvl public.inventory_levels;
  old_av integer; new_av integer; res jsonb;
BEGIN
  res := public.inv_idem_get(_org, 'inv_transfer_complete', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.inv_assert(_actor, _org, 'inventory.transfer');

  SELECT * INTO t FROM public.inventory_transfers WHERE id = _transfer AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Umlagerung nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
  IF t.status = 'completed' THEN
    res := jsonb_build_object('transfer_id', t.id, 'status', 'completed', 'changed', false);
    PERFORM public.inv_idem_put(_org, 'inv_transfer_complete', _idem, res);
    RETURN res;
  END IF;
  IF t.status <> 'in_transit' THEN
    RAISE EXCEPTION 'Nur laufende Umlagerungen können abgeschlossen werden.' USING ERRCODE = 'check_violation';
  END IF;

  FOR ti IN SELECT * FROM public.inventory_transfer_items WHERE transfer_id = t.id LOOP
    lvl := public.inv_lock_level(_org, t.shop_id, ti.inventory_item_id, t.to_location_id);
    old_av := public.inv_available(lvl);
    UPDATE public.inventory_levels SET on_hand = on_hand + ti.quantity WHERE id = lvl.id RETURNING * INTO lvl;
    new_av := public.inv_available(lvl);
    PERFORM public.inv_movement(_org, t.shop_id, ti.inventory_item_id, t.to_location_id,
      'transfer_in', ti.quantity, 'transfer', t.id::text, NULL, NULL, _actor, _idem);
    PERFORM public.inv_status_events(_org, t.shop_id, ti.inventory_item_id, t.to_location_id, old_av, new_av);
  END LOOP;

  UPDATE public.inventory_transfers SET status = 'completed', completed_at = now() WHERE id = t.id;
  PERFORM public.inv_audit(_org, _actor, 'inventory.transfer.completed', 'inventory_transfer', t.id::text, '{}'::jsonb);
  PERFORM public.inv_event(_org, 'inventory.transfer.completed', jsonb_build_object('transfer_id', t.id));

  res := jsonb_build_object('transfer_id', t.id, 'status', 'completed', 'changed', true);
  PERFORM public.inv_idem_put(_org, 'inv_transfer_complete', _idem, res);
  RETURN res;
END; $function$;

CREATE OR REPLACE FUNCTION public.inv_transfer_start(_org uuid, _actor uuid, _transfer uuid, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE t public.inventory_transfers; ti record; lvl public.inventory_levels;
  old_av integer; new_av integer; res jsonb;
BEGIN
  res := public.inv_idem_get(_org, 'inv_transfer_start', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.inv_assert(_actor, _org, 'inventory.transfer');

  SELECT * INTO t FROM public.inventory_transfers WHERE id = _transfer AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Umlagerung nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
  IF t.status = 'in_transit' THEN
    res := jsonb_build_object('transfer_id', t.id, 'status', 'in_transit', 'changed', false);
    PERFORM public.inv_idem_put(_org, 'inv_transfer_start', _idem, res);
    RETURN res;
  END IF;
  IF t.status <> 'draft' THEN RAISE EXCEPTION 'Nur Entwürfe können gestartet werden.' USING ERRCODE = 'check_violation'; END IF;

  FOR ti IN SELECT * FROM public.inventory_transfer_items WHERE transfer_id = t.id LOOP
    lvl := public.inv_lock_level(_org, t.shop_id, ti.inventory_item_id, t.from_location_id);
    old_av := public.inv_available(lvl);
    IF old_av < ti.quantity THEN
      RAISE EXCEPTION 'Nicht genügend verfügbarer Bestand am Quelllager.' USING ERRCODE = 'check_violation';
    END IF;
    UPDATE public.inventory_levels SET on_hand = on_hand - ti.quantity WHERE id = lvl.id RETURNING * INTO lvl;
    new_av := public.inv_available(lvl);
    PERFORM public.inv_movement(_org, t.shop_id, ti.inventory_item_id, t.from_location_id,
      'transfer_out', -ti.quantity, 'transfer', t.id::text, NULL, NULL, _actor, _idem);
    PERFORM public.inv_status_events(_org, t.shop_id, ti.inventory_item_id, t.from_location_id, old_av, new_av);
  END LOOP;

  UPDATE public.inventory_transfers SET status = 'in_transit' WHERE id = t.id;
  PERFORM public.inv_audit(_org, _actor, 'inventory.transfer.created', 'inventory_transfer', t.id::text, '{}'::jsonb);
  PERFORM public.inv_event(_org, 'inventory.transfer.started', jsonb_build_object('transfer_id', t.id));

  res := jsonb_build_object('transfer_id', t.id, 'status', 'in_transit', 'changed', true);
  PERFORM public.inv_idem_put(_org, 'inv_transfer_start', _idem, res);
  RETURN res;
END; $function$;

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = _user_id AND m.organization_id = _org_id);
$function$;

CREATE OR REPLACE FUNCTION public.ops_expire_due()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  org record;
  sessions integer := 0;
  reservations integer := 0;
  carts integer := 0;
BEGIN
  sessions := coalesce((public.cart_expire_checkout_sessions(NULL) ->> 'expired_sessions')::int, 0);

  PERFORM set_config('commerce.system_op', 'on', true);
  FOR org IN
    SELECT DISTINCT organization_id FROM public.inventory_reservations
    WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= now()
    LIMIT 200
  LOOP
    reservations := reservations
      + coalesce((public.inv_expire_reservations(org.organization_id, NULL) ->> 'expired')::int, 0);
  END LOOP;
  PERFORM set_config('commerce.system_op', 'off', true);

  WITH due AS (
    SELECT id FROM public.carts
    WHERE status = 'active' AND expires_at <= now()
    ORDER BY expires_at
    LIMIT 1000
  )
  UPDATE public.carts c SET status = 'expired'
  FROM due WHERE c.id = due.id;
  GET DIAGNOSTICS carts = ROW_COUNT;

  RETURN jsonb_build_object(
    'expired_sessions', sessions,
    'expired_reservations', reservations,
    'expired_carts', carts
  );
END; $function$;

CREATE OR REPLACE FUNCTION public.protect_last_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE owner_count INT;
BEGIN IF TG_OP = 'DELETE' AND public.purge_mode() THEN RETURN OLD; END IF;
  -- Wird die Organisation selbst gelöscht (Kaskade), greift der Schutz nicht.
  IF TG_OP = 'DELETE'
     AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = OLD.organization_id) THEN
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role <> 'owner' THEN
    SELECT count(*) INTO owner_count FROM public.memberships
      WHERE organization_id = OLD.organization_id AND role = 'owner';
    IF owner_count <= 1 THEN
      RAISE EXCEPTION 'Die letzte Inhaber-Rolle einer Organisation kann nicht herabgestuft werden.'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.role = 'owner' THEN
    SELECT count(*) INTO owner_count FROM public.memberships
      WHERE organization_id = OLD.organization_id AND role = 'owner';
    IF owner_count <= 1 THEN
      RAISE EXCEPTION 'Der letzte Inhaber einer Organisation kann nicht entfernt werden.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END; $function$;

CREATE OR REPLACE FUNCTION public.purge_mode()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(current_setting('app.purge_mode', true), '') = 'on'
$function$;

CREATE OR REPLACE FUNCTION public.refund_create(_org uuid, _order uuid, _actor uuid, _amount_minor bigint, _reason text DEFAULT NULL::text, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$;
