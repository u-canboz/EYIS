-- EYIS Database Install Pack — Funktionen: foundation (foundation-functions-b)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.ful_complete_picking(_org uuid, _ful uuid, _actor uuid, _picked jsonb, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE f public.fulfillments; it jsonb; res jsonb; total integer := 0;
BEGIN
  res := public.inv_idem_get(_org, 'ful_complete_picking', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.inv_assert(_actor, _org, 'fulfillment.pick');
  SELECT * INTO f FROM public.fulfillments WHERE id = _ful AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fulfillment nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
  IF f.status <> 'picking' THEN
    RAISE EXCEPTION 'Picking ist in Status % nicht aktiv.', f.status USING ERRCODE = 'check_violation';
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(_picked,'[]'::jsonb)) LOOP
    UPDATE public.fulfillment_items
    SET picked_quantity = LEAST((it ->> 'pickedQuantity')::integer, quantity)
    WHERE id = (it ->> 'fulfillmentItemId')::uuid AND fulfillment_id = f.id;
  END LOOP;

  SELECT COALESCE(SUM(picked_quantity),0) INTO total FROM public.fulfillment_items WHERE fulfillment_id = f.id;
  IF total <= 0 THEN RAISE EXCEPTION 'Es wurde nichts gepickt.' USING ERRCODE = 'check_violation'; END IF;

  PERFORM public.inv_audit(_org, _actor, 'fulfillment.updated', 'fulfillment', f.id::text,
    jsonb_build_object('status','picked','picked_total', total));
  res := jsonb_build_object('fulfillment_id', f.id, 'status', 'picking', 'picked_total', total);
  PERFORM public.inv_idem_put(_org, 'ful_complete_picking', _idem, res);
  RETURN res;
END; $function$;

CREATE OR REPLACE FUNCTION public.ful_create(_org uuid, _shop uuid, _order uuid, _location uuid, _actor uuid, _items jsonb, _notes text DEFAULT NULL::text, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o public.orders; fid uuid; it jsonb; res jsonb; n integer := 0;
BEGIN
  res := public.inv_idem_get(_org, 'ful_create', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.inv_assert(_actor, _org, 'fulfillment.manage');

  SELECT * INTO o FROM public.orders WHERE id = _order AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bestellung nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
  IF o.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'Nur bezahlte Bestellungen können kommissioniert werden.' USING ERRCODE = 'check_violation';
  END IF;
  IF o.order_status = 'cancelled' THEN
    RAISE EXCEPTION 'Stornierte Bestellungen können nicht kommissioniert werden.' USING ERRCODE = 'check_violation';
  END IF;
  IF _location IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.inventory_locations l WHERE l.id = _location AND l.organization_id = _org AND l.shop_id = o.shop_id
  ) THEN
    RAISE EXCEPTION 'Lagerort gehört nicht zu diesem Shop.' USING ERRCODE = 'check_violation';
  END IF;
  IF jsonb_array_length(COALESCE(_items,'[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Mindestens eine Position ist erforderlich.' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.fulfillments (organization_id, shop_id, order_id, location_id, status, created_by, notes)
  VALUES (_org, o.shop_id, _order, _location, 'ready', _actor, _notes)
  RETURNING id INTO fid;

  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.order_items oi
                   WHERE oi.id = (it ->> 'orderItemId')::uuid AND oi.order_id = _order) THEN
      RAISE EXCEPTION 'Bestellposition gehört nicht zu dieser Bestellung.' USING ERRCODE = 'check_violation';
    END IF;
    INSERT INTO public.fulfillment_items (organization_id, fulfillment_id, order_item_id, quantity)
    VALUES (_org, fid, (it ->> 'orderItemId')::uuid, (it ->> 'quantity')::integer);
    n := n + 1;
  END LOOP;

  PERFORM public.inv_audit(_org, _actor, 'fulfillment.created', 'fulfillment', fid::text,
    jsonb_build_object('order_id', _order, 'location_id', _location, 'items', n));
  PERFORM public.inv_event(_org, 'fulfillment.created',
    jsonb_build_object('fulfillment_id', fid, 'order_id', _order, 'location_id', _location));

  res := jsonb_build_object('fulfillment_id', fid, 'items', n, 'status', 'ready');
  PERFORM public.inv_idem_put(_org, 'ful_create', _idem, res);
  RETURN res;
END; $function$;

CREATE OR REPLACE FUNCTION public.ful_pack(_org uuid, _ful uuid, _actor uuid, _packages jsonb, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE f public.fulfillments; pk jsonb; li jsonb; pid uuid; num integer; res jsonb;
  created uuid[] := '{}'; fi public.fulfillment_items;
BEGIN
  res := public.inv_idem_get(_org, 'ful_pack', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.inv_assert(_actor, _org, 'fulfillment.pack');
  SELECT * INTO f FROM public.fulfillments WHERE id = _ful AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fulfillment nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
  IF f.status NOT IN ('picking','packed') THEN
    RAISE EXCEPTION 'Packen ist in Status % nicht möglich.', f.status USING ERRCODE = 'check_violation';
  END IF;
  IF jsonb_array_length(COALESCE(_packages,'[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Mindestens ein Paket ist erforderlich.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(MAX(package_number),0) INTO num FROM public.packages WHERE fulfillment_id = f.id;

  FOR pk IN SELECT * FROM jsonb_array_elements(_packages) LOOP
    num := num + 1;
    INSERT INTO public.packages (organization_id, shop_id, fulfillment_id, package_number, weight_grams,
      length_mm, width_mm, height_mm, packaging_type, status)
    VALUES (_org, f.shop_id, f.id, num,
      NULLIF(pk ->> 'weightGrams','')::integer, NULLIF(pk ->> 'lengthMm','')::integer,
      NULLIF(pk ->> 'widthMm','')::integer, NULLIF(pk ->> 'heightMm','')::integer,
      NULLIF(pk ->> 'packagingType',''), 'packed')
    RETURNING id INTO pid;
    created := created || pid;

    FOR li IN SELECT * FROM jsonb_array_elements(COALESCE(pk -> 'items','[]'::jsonb)) LOOP
      SELECT * INTO fi FROM public.fulfillment_items
      WHERE id = (li ->> 'fulfillmentItemId')::uuid AND fulfillment_id = f.id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Position gehört nicht zu diesem Fulfillment.' USING ERRCODE = 'check_violation'; END IF;

      INSERT INTO public.package_items (organization_id, package_id, fulfillment_item_id, quantity)
      VALUES (_org, pid, fi.id, (li ->> 'quantity')::integer);

      UPDATE public.fulfillment_items
      SET packed_quantity = packed_quantity + (li ->> 'quantity')::integer
      WHERE id = fi.id;
    END LOOP;

    PERFORM public.inv_audit(_org, _actor, 'package.created', 'package', pid::text,
      jsonb_build_object('fulfillment_id', f.id, 'package_number', num));
  END LOOP;

  UPDATE public.fulfillments SET status = 'packed', packed_at = now() WHERE id = f.id;
  PERFORM public.inv_event(_org, 'fulfillment.packed',
    jsonb_build_object('fulfillment_id', f.id, 'packages', array_length(created,1)));

  res := jsonb_build_object('fulfillment_id', f.id, 'status', 'packed', 'package_ids', to_jsonb(created));
  PERFORM public.inv_idem_put(_org, 'ful_pack', _idem, res);
  RETURN res;
END; $function$;

CREATE OR REPLACE FUNCTION public.ful_recompute_order_status(_order uuid)
 RETURNS order_fulfillment_status
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE ordered bigint; shipped bigint; st public.order_fulfillment_status;
BEGIN
  SELECT COALESCE(SUM(oi.quantity),0) INTO ordered FROM public.order_items oi WHERE oi.order_id = _order;
  SELECT COALESCE(SUM(fi.shipped_quantity),0) INTO shipped
  FROM public.fulfillment_items fi
  JOIN public.fulfillments f ON f.id = fi.fulfillment_id
  WHERE f.order_id = _order AND f.status <> 'cancelled';

  st := CASE WHEN shipped <= 0 THEN 'unfulfilled'::public.order_fulfillment_status
             WHEN shipped >= ordered THEN 'fulfilled'::public.order_fulfillment_status
             ELSE 'partially_fulfilled'::public.order_fulfillment_status END;

  UPDATE public.orders SET fulfillment_status = st WHERE id = _order AND fulfillment_status <> st;
  RETURN st;
END; $function$;

CREATE OR REPLACE FUNCTION public.ful_start_picking(_org uuid, _ful uuid, _actor uuid, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE f public.fulfillments; res jsonb;
BEGIN
  res := public.inv_idem_get(_org, 'ful_start_picking', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.inv_assert(_actor, _org, 'fulfillment.pick');
  SELECT * INTO f FROM public.fulfillments WHERE id = _ful AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fulfillment nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
  IF f.status = 'picking' THEN
    res := jsonb_build_object('fulfillment_id', f.id, 'status', 'picking', 'changed', false);
    PERFORM public.inv_idem_put(_org, 'ful_start_picking', _idem, res); RETURN res;
  END IF;
  IF f.status NOT IN ('draft','ready') THEN
    RAISE EXCEPTION 'Picking kann in Status % nicht gestartet werden.', f.status USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.fulfillments SET status = 'picking', started_at = now(), assigned_to = COALESCE(assigned_to, _actor)
  WHERE id = f.id;
  PERFORM public.inv_audit(_org, _actor, 'fulfillment.updated', 'fulfillment', f.id::text, jsonb_build_object('status','picking'));
  PERFORM public.inv_event(_org, 'fulfillment.picking_started', jsonb_build_object('fulfillment_id', f.id));
  res := jsonb_build_object('fulfillment_id', f.id, 'status', 'picking', 'changed', true);
  PERFORM public.inv_idem_put(_org, 'ful_start_picking', _idem, res);
  RETURN res;
END; $function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NULLIF(NEW.raw_user_meta_data->>'full_name',''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.memberships m
    WHERE m.user_id = _user_id AND m.organization_id = _org_id AND m.role = _role);
$function$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _org_id uuid, _permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.role_permissions rp ON rp.role = m.role
    WHERE m.user_id = _user_id AND m.organization_id = _org_id AND rp.permission = _permission
  );
$function$;
