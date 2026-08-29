-- EYIS Database Install Pack — Funktionen: foundation (foundation-functions-d)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.inv_adjust_stock(_org uuid, _shop uuid, _actor uuid, _item uuid, _loc uuid, _counted integer, _reason text, _note text DEFAULT NULL::text, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE lvl public.inventory_levels; old_av integer; new_av integer; delta integer; res jsonb;
BEGIN
  res := public.inv_idem_get(_org, 'inv_adjust_stock', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.inv_assert(_actor, _org, 'inventory.adjust');
  IF _counted < 0 THEN RAISE EXCEPTION 'Gezählter Bestand darf nicht negativ sein.' USING ERRCODE = 'check_violation'; END IF;
  IF _reason IS NULL OR btrim(_reason) = '' THEN
    RAISE EXCEPTION 'Für eine Bestandskorrektur ist ein Grund erforderlich.' USING ERRCODE = 'check_violation';
  END IF;

  lvl := public.inv_lock_level(_org, _shop, _item, _loc);
  old_av := public.inv_available(lvl);
  delta := _counted - lvl.on_hand;

  UPDATE public.inventory_levels SET on_hand = _counted WHERE id = lvl.id RETURNING * INTO lvl;
  new_av := public.inv_available(lvl);

  IF delta <> 0 THEN
    PERFORM public.inv_movement(_org, _shop, _item, _loc, 'adjustment', delta, 'manual', NULL, _reason, _note, _actor, _idem);
  END IF;
  PERFORM public.inv_audit(_org, _actor, 'inventory.adjusted', 'inventory_item', _item::text,
    jsonb_build_object('delta', delta, 'counted', _counted, 'reason', _reason, 'location_id', _loc));
  PERFORM public.inv_event(_org, 'inventory.stock.adjusted',
    jsonb_build_object('inventory_item_id', _item, 'location_id', _loc, 'delta', delta, 'reason', _reason));
  PERFORM public.inv_status_events(_org, _shop, _item, _loc, old_av, new_av);

  res := jsonb_build_object('on_hand', lvl.on_hand, 'reserved', lvl.reserved,
    'damaged', lvl.damaged, 'incoming', lvl.incoming, 'available', new_av, 'delta', delta);
  PERFORM public.inv_idem_put(_org, 'inv_adjust_stock', _idem, res);
  RETURN res;
END; $function$;

CREATE OR REPLACE FUNCTION public.inv_assert(_actor uuid, _org uuid, _perm text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(current_setting('commerce.system_op', true), '') = 'on' THEN RETURN; END IF;
  IF _actor IS NULL OR NOT public.has_permission(_actor, _org, _perm) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diese Bestandsaktion.' USING ERRCODE = 'insufficient_privilege';
  END IF;
END; $function$;

CREATE OR REPLACE FUNCTION public.inv_audit(_org uuid, _actor uuid, _action text, _entity text, _entity_id text, _meta jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.audit_log (organization_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (_org, _actor, _action, _entity, _entity_id, COALESCE(_meta, '{}'::jsonb));
END; $function$;

CREATE OR REPLACE FUNCTION public.inv_available(_lvl inventory_levels)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT _lvl.on_hand - _lvl.damaged - _lvl.reserved;
$function$;

CREATE OR REPLACE FUNCTION public.inv_commit_reservation(_org uuid, _actor uuid, _reservation uuid, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.inventory_reservations; lvl public.inventory_levels; old_av integer; new_av integer; res jsonb;
BEGIN
  res := public.inv_idem_get(_org, 'inv_commit_reservation', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.inv_assert(_actor, _org, 'inventory.adjust');

  SELECT * INTO r FROM public.inventory_reservations
  WHERE id = _reservation AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservierung nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;

  IF r.status = 'committed' THEN
    res := jsonb_build_object('reservation_id', r.id, 'status', 'committed', 'changed', false);
    PERFORM public.inv_idem_put(_org, 'inv_commit_reservation', _idem, res);
    RETURN res;
  END IF;
  IF r.status <> 'active' THEN
    RAISE EXCEPTION 'Nur aktive Reservierungen können verbucht werden.' USING ERRCODE = 'check_violation';
  END IF;

  IF (r.metadata ->> 'untracked') IS DISTINCT FROM 'true' AND r.location_id IS NOT NULL THEN
    lvl := public.inv_lock_level(_org, r.shop_id, r.inventory_item_id, r.location_id);
    old_av := public.inv_available(lvl);
    UPDATE public.inventory_levels
    SET reserved = GREATEST(reserved - r.quantity, 0), on_hand = on_hand - r.quantity
    WHERE id = lvl.id RETURNING * INTO lvl;
    new_av := public.inv_available(lvl);
    PERFORM public.inv_movement(_org, r.shop_id, r.inventory_item_id, r.location_id,
      'sale_commit', -r.quantity, 'reservation', r.id::text, NULL, NULL, _actor, _idem);
    PERFORM public.inv_status_events(_org, r.shop_id, r.inventory_item_id, r.location_id, old_av, new_av);
  END IF;

  UPDATE public.inventory_reservations SET status = 'committed', committed_at = now() WHERE id = r.id;
  PERFORM public.inv_audit(_org, _actor, 'inventory.reservation.committed', 'inventory_reservation', r.id::text,
    jsonb_build_object('quantity', r.quantity));
  PERFORM public.inv_event(_org, 'inventory.reservation.committed',
    jsonb_build_object('reservation_id', r.id, 'inventory_item_id', r.inventory_item_id, 'quantity', r.quantity));

  res := jsonb_build_object('reservation_id', r.id, 'status', 'committed', 'changed', true,
    'on_hand', lvl.on_hand, 'reserved', lvl.reserved, 'available', new_av);
  PERFORM public.inv_idem_put(_org, 'inv_commit_reservation', _idem, res);
  RETURN res;
END; $function$;

CREATE OR REPLACE FUNCTION public.inv_event(_org uuid, _type text, _payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.outbox_events (organization_id, event_type, payload)
  VALUES (_org, _type, COALESCE(_payload, '{}'::jsonb));
END; $function$;

CREATE OR REPLACE FUNCTION public.inv_expire_reservations(_org uuid, _actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.inventory_reservations; lvl public.inventory_levels; old_av integer; new_av integer; n integer := 0;
BEGIN
  PERFORM public.inv_assert(_actor, _org, 'inventory.adjust');
  FOR r IN SELECT * FROM public.inventory_reservations
           WHERE organization_id = _org AND status = 'active'
             AND expires_at IS NOT NULL AND expires_at <= now()
           FOR UPDATE
  LOOP
    IF (r.metadata ->> 'untracked') IS DISTINCT FROM 'true' AND r.location_id IS NOT NULL THEN
      lvl := public.inv_lock_level(_org, r.shop_id, r.inventory_item_id, r.location_id);
      old_av := public.inv_available(lvl);
      UPDATE public.inventory_levels SET reserved = GREATEST(reserved - r.quantity, 0)
      WHERE id = lvl.id RETURNING * INTO lvl;
      new_av := public.inv_available(lvl);
      PERFORM public.inv_movement(_org, r.shop_id, r.inventory_item_id, r.location_id,
        'reservation_release', -r.quantity, 'reservation_expiry', r.id::text, 'expired', NULL, _actor, NULL);
      PERFORM public.inv_status_events(_org, r.shop_id, r.inventory_item_id, r.location_id, old_av, new_av);
    END IF;
    UPDATE public.inventory_reservations SET status = 'expired', released_at = now() WHERE id = r.id;
    PERFORM public.inv_event(_org, 'inventory.reservation.expired',
      jsonb_build_object('reservation_id', r.id, 'inventory_item_id', r.inventory_item_id, 'quantity', r.quantity));
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('expired', n);
END; $function$;

CREATE OR REPLACE FUNCTION public.inv_health_check(_org uuid, _actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE problems jsonb;
BEGIN
  PERFORM public.inv_assert(_actor, _org, 'inventory.read');
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'level_id', l.id, 'inventory_item_id', l.inventory_item_id, 'location_id', l.location_id,
    'on_hand', l.on_hand, 'reserved', l.reserved, 'damaged', l.damaged, 'incoming', l.incoming,
    'available', l.on_hand - l.damaged - l.reserved,
    'issue', CASE
      WHEN l.reserved < 0 THEN 'reserved_negative'
      WHEN l.damaged < 0 THEN 'damaged_negative'
      WHEN l.incoming < 0 THEN 'incoming_negative'
      ELSE 'available_negative' END)), '[]'::jsonb)
  INTO problems
  FROM public.inventory_levels l
  JOIN public.inventory_items i ON i.id = l.inventory_item_id
  WHERE l.organization_id = _org
    AND (l.reserved < 0 OR l.damaged < 0 OR l.incoming < 0
      OR (NOT i.allow_backorder AND l.on_hand - l.damaged - l.reserved < 0));
  RETURN jsonb_build_object('healthy', jsonb_array_length(problems) = 0, 'problems', problems);
END; $function$;

CREATE OR REPLACE FUNCTION public.inv_idem_get(_org uuid, _endpoint text, _key text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT response FROM public.idempotency_keys
  WHERE organization_id = _org AND endpoint = _endpoint AND key = _key AND _key IS NOT NULL;
$function$;

CREATE OR REPLACE FUNCTION public.inv_idem_put(_org uuid, _endpoint text, _key text, _response jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _key IS NULL THEN RETURN; END IF;
  INSERT INTO public.idempotency_keys (organization_id, endpoint, key, response, status, expires_at)
  VALUES (_org, _endpoint, _key, _response, 'completed', now() + interval '30 days')
  ON CONFLICT (organization_id, endpoint, key) DO NOTHING;
END; $function$;

CREATE OR REPLACE FUNCTION public.inv_lock_level(_org uuid, _shop uuid, _item uuid, _loc uuid)
 RETURNS inventory_levels
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE lvl public.inventory_levels;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.inventory_items i WHERE i.id = _item AND i.organization_id = _org) THEN
    RAISE EXCEPTION 'Inventarartikel gehört nicht zu dieser Organisation.' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.inventory_locations l
                 WHERE l.id = _loc AND l.organization_id = _org AND l.shop_id = _shop) THEN
    RAISE EXCEPTION 'Lagerort gehört nicht zu dieser Organisation oder diesem Shop.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO lvl FROM public.inventory_levels
  WHERE inventory_item_id = _item AND location_id = _loc FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.inventory_levels (organization_id, shop_id, inventory_item_id, location_id)
    VALUES (_org, _shop, _item, _loc)
    ON CONFLICT (inventory_item_id, location_id) DO NOTHING;
    SELECT * INTO lvl FROM public.inventory_levels
    WHERE inventory_item_id = _item AND location_id = _loc FOR UPDATE;
  END IF;
  RETURN lvl;
END; $function$;

CREATE OR REPLACE FUNCTION public.inv_mark_damaged(_org uuid, _shop uuid, _actor uuid, _item uuid, _loc uuid, _qty integer, _reason text DEFAULT NULL::text, _note text DEFAULT NULL::text, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE lvl public.inventory_levels; old_av integer; new_av integer; res jsonb;
BEGIN
  res := public.inv_idem_get(_org, 'inv_mark_damaged', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.inv_assert(_actor, _org, 'inventory.adjust');
  IF _qty = 0 THEN RAISE EXCEPTION 'Menge darf nicht 0 sein.' USING ERRCODE = 'check_violation'; END IF;

  lvl := public.inv_lock_level(_org, _shop, _item, _loc);
  old_av := public.inv_available(lvl);

  IF lvl.damaged + _qty < 0 THEN
    RAISE EXCEPTION 'Beschädigte Menge darf nicht negativ werden.' USING ERRCODE = 'check_violation';
  END IF;
  IF lvl.on_hand - (lvl.damaged + _qty) - lvl.reserved < 0 THEN
    RAISE EXCEPTION 'Nicht genügend verfügbarer Bestand, um diese Menge als beschädigt zu buchen.' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.inventory_levels SET damaged = damaged + _qty WHERE id = lvl.id RETURNING * INTO lvl;
  new_av := public.inv_available(lvl);

  PERFORM public.inv_movement(_org, _shop, _item, _loc, 'damage', _qty, 'manual', NULL, _reason, _note, _actor, _idem);
  PERFORM public.inv_audit(_org, _actor, 'inventory.damaged', 'inventory_item', _item::text,
    jsonb_build_object('quantity', _qty, 'reason', _reason, 'location_id', _loc));
  PERFORM public.inv_event(_org, 'inventory.stock.damaged',
    jsonb_build_object('inventory_item_id', _item, 'location_id', _loc, 'quantity', _qty));
  PERFORM public.inv_status_events(_org, _shop, _item, _loc, old_av, new_av);

  res := jsonb_build_object('on_hand', lvl.on_hand, 'reserved', lvl.reserved,
    'damaged', lvl.damaged, 'incoming', lvl.incoming, 'available', new_av);
  PERFORM public.inv_idem_put(_org, 'inv_mark_damaged', _idem, res);
  RETURN res;
END; $function$;

CREATE OR REPLACE FUNCTION public.inv_movement(_org uuid, _shop uuid, _item uuid, _loc uuid, _type inventory_movement_type, _delta integer, _ref_type text, _ref_id text, _reason text, _note text, _actor uuid, _idem text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE mid uuid;
BEGIN
  INSERT INTO public.inventory_movements
    (organization_id, shop_id, inventory_item_id, location_id, movement_type, quantity_delta,
     reference_type, reference_id, reason, note, actor_user_id, idempotency_key)
  VALUES (_org, _shop, _item, _loc, _type, _delta, _ref_type, _ref_id, _reason, _note, _actor, _idem)
  RETURNING id INTO mid;
  RETURN mid;
END; $function$;

CREATE OR REPLACE FUNCTION public.inv_receive_stock(_org uuid, _shop uuid, _actor uuid, _item uuid, _loc uuid, _qty integer, _reference text DEFAULT NULL::text, _note text DEFAULT NULL::text, _incoming_delta integer DEFAULT 0, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE lvl public.inventory_levels; old_av integer; new_av integer; res jsonb;
BEGIN
  res := public.inv_idem_get(_org, 'inv_receive_stock', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.inv_assert(_actor, _org, 'inventory.receive');
  IF _qty < 0 THEN RAISE EXCEPTION 'Menge darf nicht negativ sein.' USING ERRCODE = 'check_violation'; END IF;

  lvl := public.inv_lock_level(_org, _shop, _item, _loc);
  old_av := public.inv_available(lvl);

  UPDATE public.inventory_levels
  SET on_hand = on_hand + _qty,
      incoming = GREATEST(incoming + COALESCE(_incoming_delta, 0), 0)
  WHERE id = lvl.id RETURNING * INTO lvl;
  new_av := public.inv_available(lvl);

  IF _qty > 0 THEN
    PERFORM public.inv_movement(_org, _shop, _item, _loc, 'receipt', _qty, 'manual', _reference, NULL, _note, _actor, _idem);
  END IF;
  PERFORM public.inv_audit(_org, _actor, 'inventory.received', 'inventory_item', _item::text,
    jsonb_build_object('quantity', _qty, 'location_id', _loc, 'reference', _reference));
  PERFORM public.inv_event(_org, 'inventory.stock.received',
    jsonb_build_object('inventory_item_id', _item, 'location_id', _loc, 'quantity', _qty));
  PERFORM public.inv_status_events(_org, _shop, _item, _loc, old_av, new_av);

  res := jsonb_build_object('on_hand', lvl.on_hand, 'reserved', lvl.reserved,
    'damaged', lvl.damaged, 'incoming', lvl.incoming, 'available', new_av);
  PERFORM public.inv_idem_put(_org, 'inv_receive_stock', _idem, res);
  RETURN res;
END; $function$;

CREATE OR REPLACE FUNCTION public.inv_release_reservation(_org uuid, _actor uuid, _reservation uuid, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.inventory_reservations; lvl public.inventory_levels; old_av integer; new_av integer; res jsonb;
BEGIN
  res := public.inv_idem_get(_org, 'inv_release_reservation', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.inv_assert(_actor, _org, 'inventory.adjust');

  SELECT * INTO r FROM public.inventory_reservations
  WHERE id = _reservation AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservierung nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;

  IF r.status <> 'active' THEN
    res := jsonb_build_object('reservation_id', r.id, 'status', r.status, 'changed', false);
    PERFORM public.inv_idem_put(_org, 'inv_release_reservation', _idem, res);
    RETURN res;
  END IF;

  IF (r.metadata ->> 'untracked') IS DISTINCT FROM 'true' AND r.location_id IS NOT NULL THEN
    lvl := public.inv_lock_level(_org, r.shop_id, r.inventory_item_id, r.location_id);
    old_av := public.inv_available(lvl);
    UPDATE public.inventory_levels SET reserved = GREATEST(reserved - r.quantity, 0)
    WHERE id = lvl.id RETURNING * INTO lvl;
    new_av := public.inv_available(lvl);
    PERFORM public.inv_movement(_org, r.shop_id, r.inventory_item_id, r.location_id,
      'reservation_release', -r.quantity, 'reservation', r.id::text, NULL, NULL, _actor, _idem);
    PERFORM public.inv_status_events(_org, r.shop_id, r.inventory_item_id, r.location_id, old_av, new_av);
  END IF;

  UPDATE public.inventory_reservations SET status = 'released', released_at = now() WHERE id = r.id;
  PERFORM public.inv_audit(_org, _actor, 'inventory.reservation.released', 'inventory_reservation', r.id::text,
    jsonb_build_object('quantity', r.quantity));
  PERFORM public.inv_event(_org, 'inventory.reservation.released',
    jsonb_build_object('reservation_id', r.id, 'inventory_item_id', r.inventory_item_id, 'quantity', r.quantity));

  res := jsonb_build_object('reservation_id', r.id, 'status', 'released', 'changed', true);
  PERFORM public.inv_idem_put(_org, 'inv_release_reservation', _idem, res);
  RETURN res;
END; $function$;
