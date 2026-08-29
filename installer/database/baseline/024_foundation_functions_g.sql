-- EYIS Database Install Pack — Funktionen: foundation (foundation-functions-g)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

CREATE OR REPLACE FUNCTION public.ret_request(_org uuid, _shop uuid, _order uuid, _customer uuid, _actor uuid, _items jsonb, _reason return_reason_code, _note text, _idem text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$;

CREATE OR REPLACE FUNCTION public.ret_restock(_org uuid, _return_item uuid, _actor uuid, _location uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$;

CREATE OR REPLACE FUNCTION public.ret_returned_qty(_order_item uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(
    CASE WHEN r.status IN ('rejected','cancelled') THEN 0
         WHEN r.status IN ('approved','partially_approved','refunded','completed') THEN ri.quantity_approved
         ELSE ri.quantity_requested END), 0)::int
  FROM public.return_items ri
  JOIN public.returns r ON r.id = ri.return_id
  WHERE ri.order_item_id = _order_item;
$function$;

CREATE OR REPLACE FUNCTION public.ret_start_inspection(_org uuid, _return uuid, _actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.returns;
BEGIN
  PERFORM public.ret_assert(_actor, _org, 'returns.inspect');
  SELECT * INTO r FROM public.returns WHERE id = _return AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retoure nicht gefunden.' USING ERRCODE = 'no_data_found'; END IF;
  IF r.status <> 'received' THEN RAISE EXCEPTION 'Ware ist noch nicht eingegangen.' USING ERRCODE = 'check_violation'; END IF;
  UPDATE public.returns SET status = 'inspection' WHERE id = _return;
  PERFORM public.inv_event(_org, 'return.inspection_started', jsonb_build_object('return_id', _return));
  RETURN jsonb_build_object('status', 'inspection');
END; $function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.shares_org_with(_other_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships a
    JOIN public.memberships b ON b.organization_id = a.organization_id
    WHERE a.user_id = auth.uid() AND b.user_id = _other_user
  );
$function$;

CREATE OR REPLACE FUNCTION public.ship_cancel(_org uuid, _shipment uuid, _actor uuid, _reason text DEFAULT NULL::text, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s public.shipments; res jsonb;
BEGIN
  res := public.inv_idem_get(_org, 'ship_cancel', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.inv_assert(_actor, _org, 'shipping.cancel');
  SELECT * INTO s FROM public.shipments WHERE id = _shipment AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sendung nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
  IF s.status = 'cancelled' THEN
    res := jsonb_build_object('shipment_id', s.id, 'status', 'cancelled', 'changed', false);
    PERFORM public.inv_idem_put(_org, 'ship_cancel', _idem, res); RETURN res;
  END IF;
  IF s.status IN ('in_transit','out_for_delivery','delivered') OR s.shipped_at IS NOT NULL THEN
    RAISE EXCEPTION 'Übergebene Sendungen können nicht mehr storniert werden.' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.shipping_labels SET voided_at = now() WHERE shipment_id = s.id AND voided_at IS NULL;
  UPDATE public.shipments SET status = 'cancelled', normalized_tracking_status = 'cancelled', cancelled_at = now(),
    label_id = NULL, metadata = metadata || jsonb_build_object('cancel_reason', _reason)
  WHERE id = s.id;
  UPDATE public.packages SET status = 'packed' WHERE id = s.package_id AND status = 'shipped';

  PERFORM public.inv_audit(_org, _actor, 'shipment.cancelled', 'shipment', s.id::text, jsonb_build_object('reason', _reason));
  PERFORM public.inv_event(_org, 'shipment.cancelled', jsonb_build_object('shipment_id', s.id, 'reason', _reason));

  res := jsonb_build_object('shipment_id', s.id, 'status', 'cancelled', 'changed', true);
  PERFORM public.inv_idem_put(_org, 'ship_cancel', _idem, res);
  RETURN res;
END; $function$;

CREATE OR REPLACE FUNCTION public.ship_create(_org uuid, _ful uuid, _package uuid, _provider text, _service text, _actor uuid, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE f public.fulfillments; p public.packages; sid uuid; res jsonb; existing public.shipments;
BEGIN
  res := public.inv_idem_get(_org, 'ship_create', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.inv_assert(_actor, _org, 'shipping.manage');

  SELECT * INTO f FROM public.fulfillments WHERE id = _ful AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fulfillment nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
  IF f.status NOT IN ('packed','shipped') THEN
    RAISE EXCEPTION 'Sendung erfordert ein gepacktes Fulfillment.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO p FROM public.packages WHERE id = _package AND fulfillment_id = f.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paket gehört nicht zu diesem Fulfillment.' USING ERRCODE = 'check_violation'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.package_items pi WHERE pi.package_id = p.id) THEN
    RAISE EXCEPTION 'Das Paket enthält keine Positionen.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO existing FROM public.shipments
  WHERE package_id = p.id AND status <> 'cancelled' AND organization_id = _org;
  IF FOUND THEN
    res := jsonb_build_object('shipment_id', existing.id, 'status', existing.status, 'created', false);
    PERFORM public.inv_idem_put(_org, 'ship_create', _idem, res);
    RETURN res;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.shipping_provider_configs c
                 WHERE c.organization_id = _org AND c.shop_id = f.shop_id
                   AND c.provider = _provider AND c.status = 'active') THEN
    RAISE EXCEPTION 'Versanddienstleister % ist für diesen Shop nicht aktiv.', _provider USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.shipments (organization_id, shop_id, fulfillment_id, package_id, carrier_provider,
    carrier_service, status, idempotency_key)
  VALUES (_org, f.shop_id, f.id, p.id, _provider, _service, 'created', _idem)
  RETURNING id INTO sid;

  PERFORM public.inv_audit(_org, _actor, 'shipment.created', 'shipment', sid::text,
    jsonb_build_object('fulfillment_id', f.id, 'package_id', p.id, 'provider', _provider, 'service', _service));
  PERFORM public.inv_event(_org, 'shipment.created',
    jsonb_build_object('shipment_id', sid, 'fulfillment_id', f.id, 'package_id', p.id, 'provider', _provider));

  res := jsonb_build_object('shipment_id', sid, 'status', 'created', 'created', true);
  PERFORM public.inv_idem_put(_org, 'ship_create', _idem, res);
  RETURN res;
END; $function$;

CREATE OR REPLACE FUNCTION public.ship_mark_shipped(_org uuid, _shipment uuid, _actor uuid, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s public.shipments; f public.fulfillments; res jsonb; ostatus text;
BEGIN
  res := public.inv_idem_get(_org, 'ship_mark_shipped', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.inv_assert(_actor, _org, 'shipping.manage');
  SELECT * INTO s FROM public.shipments WHERE id = _shipment AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sendung nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
  IF s.status = 'cancelled' THEN RAISE EXCEPTION 'Sendung ist storniert.' USING ERRCODE = 'check_violation'; END IF;

  IF s.shipped_at IS NULL THEN
    UPDATE public.shipments SET status = CASE WHEN public.track_status_rank(normalized_tracking_status) >= 20
        THEN status ELSE 'in_transit'::public.shipment_status END,
      normalized_tracking_status = CASE WHEN public.track_status_rank(normalized_tracking_status) >= 20
        THEN normalized_tracking_status ELSE 'in_transit'::public.tracking_status END,
      shipped_at = now()
    WHERE id = s.id;
    UPDATE public.packages SET status = 'shipped' WHERE id = s.package_id AND status <> 'cancelled';

    UPDATE public.fulfillment_items fi
    SET shipped_quantity = LEAST(fi.packed_quantity, fi.shipped_quantity + pi.quantity)
    FROM public.package_items pi
    WHERE pi.fulfillment_item_id = fi.id AND pi.package_id = s.package_id;

    SELECT * INTO f FROM public.fulfillments WHERE id = s.fulfillment_id FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM public.packages WHERE fulfillment_id = f.id AND status NOT IN ('shipped','delivered','cancelled')) THEN
      UPDATE public.fulfillments SET status = 'shipped', shipped_at = now() WHERE id = f.id AND status = 'packed';
    END IF;
    ostatus := public.ful_recompute_order_status(f.order_id)::text;

    PERFORM public.inv_event(_org, 'shipment.shipped',
      jsonb_build_object('shipment_id', s.id, 'fulfillment_id', s.fulfillment_id, 'order_fulfillment_status', ostatus));
  END IF;

  res := jsonb_build_object('shipment_id', s.id, 'status', 'shipped', 'order_fulfillment_status', ostatus);
  PERFORM public.inv_idem_put(_org, 'ship_mark_shipped', _idem, res);
  RETURN res;
END; $function$;

CREATE OR REPLACE FUNCTION public.ship_record_label(_org uuid, _shipment uuid, _actor uuid, _provider text, _format text, _storage_path text, _mime text, _provider_shipment_id text, _tracking_number text, _tracking_url text, _cost_minor bigint DEFAULT NULL::bigint, _currency text DEFAULT NULL::text, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s public.shipments; lid uuid; res jsonb;
BEGIN
  res := public.inv_idem_get(_org, 'ship_record_label', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.inv_assert(_actor, _org, 'shipping.create_label');

  SELECT * INTO s FROM public.shipments WHERE id = _shipment AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sendung nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
  IF s.status = 'cancelled' THEN RAISE EXCEPTION 'Sendung ist storniert.' USING ERRCODE = 'check_violation'; END IF;

  SELECT id INTO lid FROM public.shipping_labels WHERE shipment_id = s.id AND voided_at IS NULL;
  IF lid IS NOT NULL THEN
    res := jsonb_build_object('shipment_id', s.id, 'label_id', lid, 'tracking_number', s.tracking_number, 'created', false);
    PERFORM public.inv_idem_put(_org, 'ship_record_label', _idem, res);
    RETURN res;
  END IF;

  INSERT INTO public.shipping_labels (organization_id, shop_id, shipment_id, provider, format, storage_path, mime_type)
  VALUES (_org, s.shop_id, s.id, _provider, COALESCE(_format,'pdf'), _storage_path, COALESCE(_mime,'application/pdf'))
  RETURNING id INTO lid;

  UPDATE public.shipments SET status = CASE WHEN status = 'created' THEN 'label_created' ELSE status END,
    label_id = lid, provider_shipment_id = COALESCE(_provider_shipment_id, provider_shipment_id),
    tracking_number = COALESCE(_tracking_number, tracking_number),
    tracking_url = COALESCE(_tracking_url, tracking_url),
    carrier_cost_minor = COALESCE(_cost_minor, carrier_cost_minor),
    currency_code = COALESCE(_currency, currency_code),
    last_error = NULL
  WHERE id = s.id;

  PERFORM public.inv_audit(_org, _actor, 'shipping.label.created', 'shipment', s.id::text,
    jsonb_build_object('label_id', lid, 'provider', _provider, 'tracking_number', _tracking_number));
  PERFORM public.inv_event(_org, 'shipment.label_created',
    jsonb_build_object('shipment_id', s.id, 'label_id', lid, 'tracking_number', _tracking_number));

  res := jsonb_build_object('shipment_id', s.id, 'label_id', lid, 'tracking_number', _tracking_number, 'created', true);
  PERFORM public.inv_idem_put(_org, 'ship_record_label', _idem, res);
  RETURN res;
END; $function$;

CREATE OR REPLACE FUNCTION public.snapshot_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN IF TG_OP = 'DELETE' AND public.purge_mode() THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Snapshots sind unveränderbar.' USING ERRCODE = 'check_violation';
END; $function$;
