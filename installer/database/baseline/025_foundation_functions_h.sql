-- EYIS Database Install Pack — Funktionen: foundation (foundation-functions-h)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.track_record_event(_org uuid, _shipment uuid, _provider text, _provider_event_id text, _code text, _normalized tracking_status, _description text, _location text, _occurred_at timestamp with time zone, _raw jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s public.shipments; f public.fulfillments; eid uuid; hash text; advanced boolean := false; ostatus text;
BEGIN
  SELECT * INTO s FROM public.shipments WHERE id = _shipment AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sendung nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;

  hash := COALESCE(NULLIF(_provider_event_id,''),
    md5(_code || '|' || _normalized::text || '|' || COALESCE(_occurred_at, now())::text));

  INSERT INTO public.tracking_events (organization_id, shop_id, shipment_id, carrier_provider, provider_event_id,
    event_code, normalized_status, description, location, occurred_at, dedupe_hash, raw_payload)
  VALUES (_org, s.shop_id, s.id, _provider, NULLIF(_provider_event_id,''), _code, _normalized, _description,
    _location, COALESCE(_occurred_at, now()), hash, COALESCE(_raw,'{}'::jsonb))
  ON CONFLICT (shipment_id, dedupe_hash) DO NOTHING
  RETURNING id INTO eid;

  IF eid IS NULL THEN
    RETURN jsonb_build_object('shipment_id', s.id, 'duplicate', true, 'status', s.status);
  END IF;

  -- Nur vorwärts: verspätete Events werden gespeichert, ändern den Status aber nicht.
  IF public.track_status_rank(_normalized) > public.track_status_rank(s.normalized_tracking_status)
     AND s.status <> 'cancelled' THEN
    advanced := true;
    UPDATE public.shipments SET normalized_tracking_status = _normalized,
      status = CASE _normalized
        WHEN 'in_transit' THEN 'in_transit'::public.shipment_status
        WHEN 'out_for_delivery' THEN 'out_for_delivery'::public.shipment_status
        WHEN 'delivered' THEN 'delivered'::public.shipment_status
        WHEN 'exception' THEN 'exception'::public.shipment_status
        WHEN 'cancelled' THEN 'cancelled'::public.shipment_status
        ELSE status END,
      shipped_at = CASE WHEN shipped_at IS NULL AND _normalized IN ('in_transit','out_for_delivery','delivered')
        THEN COALESCE(_occurred_at, now()) ELSE shipped_at END,
      delivered_at = CASE WHEN _normalized = 'delivered' THEN COALESCE(_occurred_at, now()) ELSE delivered_at END
    WHERE id = s.id;

    IF _normalized IN ('in_transit','out_for_delivery','delivered') AND s.shipped_at IS NULL THEN
      UPDATE public.fulfillment_items fi
      SET shipped_quantity = LEAST(fi.packed_quantity, fi.shipped_quantity + pi.quantity)
      FROM public.package_items pi
      WHERE pi.fulfillment_item_id = fi.id AND pi.package_id = s.package_id;
      UPDATE public.packages SET status = 'shipped' WHERE id = s.package_id AND status = 'packed';
      UPDATE public.fulfillments SET status = 'shipped', shipped_at = COALESCE(shipped_at, now())
      WHERE id = s.fulfillment_id AND status = 'packed';
    END IF;

    IF _normalized = 'delivered' THEN
      UPDATE public.packages SET status = 'delivered' WHERE id = s.package_id AND status <> 'cancelled';
      SELECT * INTO f FROM public.fulfillments WHERE id = s.fulfillment_id FOR UPDATE;
      IF NOT EXISTS (SELECT 1 FROM public.packages WHERE fulfillment_id = f.id AND status NOT IN ('delivered','cancelled')) THEN
        UPDATE public.fulfillments SET status = 'delivered', delivered_at = now() WHERE id = f.id AND status <> 'cancelled';
      END IF;
    END IF;

    SELECT order_id INTO f.order_id FROM public.fulfillments WHERE id = s.fulfillment_id;
    ostatus := public.ful_recompute_order_status(f.order_id)::text;

    PERFORM public.inv_event(_org, 'shipment.' || _normalized::text,
      jsonb_build_object('shipment_id', s.id, 'status', _normalized, 'order_fulfillment_status', ostatus));
  END IF;

  PERFORM public.inv_event(_org, 'tracking.updated',
    jsonb_build_object('shipment_id', s.id, 'event_id', eid, 'normalized_status', _normalized, 'advanced', advanced));

  RETURN jsonb_build_object('shipment_id', s.id, 'event_id', eid, 'duplicate', false, 'advanced', advanced);
END; $function$;

CREATE OR REPLACE FUNCTION public.track_status_rank(_status tracking_status)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE _status
    WHEN 'unknown' THEN 0
    WHEN 'pre_transit' THEN 10
    WHEN 'in_transit' THEN 20
    WHEN 'out_for_delivery' THEN 30
    WHEN 'exception' THEN 35
    WHEN 'returned' THEN 90
    WHEN 'cancelled' THEN 95
    WHEN 'delivered' THEN 100
  END;
$function$;
