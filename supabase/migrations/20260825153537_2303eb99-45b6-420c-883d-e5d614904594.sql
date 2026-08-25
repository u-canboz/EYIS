-- ========= ENUMS =========
CREATE TYPE public.fulfillment_state AS ENUM ('draft','ready','picking','packed','shipped','delivered','cancelled');
CREATE TYPE public.package_status AS ENUM ('draft','packed','shipped','delivered','cancelled');
CREATE TYPE public.shipment_status AS ENUM ('created','label_created','in_transit','out_for_delivery','delivered','exception','cancelled');
CREATE TYPE public.tracking_status AS ENUM ('pre_transit','in_transit','out_for_delivery','delivered','exception','returned','cancelled','unknown');

-- ========= FULFILLMENTS =========
CREATE TABLE public.fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
  status public.fulfillment_state NOT NULL DEFAULT 'draft',
  created_by uuid,
  assigned_to uuid,
  started_at timestamptz,
  packed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fulfillments_org_idx ON public.fulfillments (organization_id, status, created_at DESC);
CREATE INDEX fulfillments_shop_idx ON public.fulfillments (shop_id, status);
CREATE INDEX fulfillments_order_idx ON public.fulfillments (order_id);
CREATE INDEX fulfillments_location_idx ON public.fulfillments (location_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fulfillments TO authenticated;
GRANT ALL ON public.fulfillments TO service_role;
ALTER TABLE public.fulfillments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fulfillments_read" ON public.fulfillments FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'fulfillment.read'));
CREATE POLICY "fulfillments_write" ON public.fulfillments FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'fulfillment.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'fulfillment.manage'));
CREATE TRIGGER fulfillments_updated_at BEFORE UPDATE ON public.fulfillments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========= FULFILLMENT ITEMS =========
CREATE TABLE public.fulfillment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  fulfillment_id uuid NOT NULL REFERENCES public.fulfillments(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  picked_quantity integer NOT NULL DEFAULT 0 CHECK (picked_quantity >= 0),
  packed_quantity integer NOT NULL DEFAULT 0 CHECK (packed_quantity >= 0),
  shipped_quantity integer NOT NULL DEFAULT 0 CHECK (shipped_quantity >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fulfillment_id, order_item_id),
  CHECK (picked_quantity <= quantity),
  CHECK (packed_quantity <= picked_quantity),
  CHECK (shipped_quantity <= packed_quantity)
);
CREATE INDEX fulfillment_items_ful_idx ON public.fulfillment_items (fulfillment_id);
CREATE INDEX fulfillment_items_order_item_idx ON public.fulfillment_items (order_item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fulfillment_items TO authenticated;
GRANT ALL ON public.fulfillment_items TO service_role;
ALTER TABLE public.fulfillment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fulfillment_items_read" ON public.fulfillment_items FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'fulfillment.read'));
CREATE POLICY "fulfillment_items_write" ON public.fulfillment_items FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'fulfillment.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'fulfillment.manage'));
CREATE TRIGGER fulfillment_items_updated_at BEFORE UPDATE ON public.fulfillment_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Nie mehr einplanen als bestellt.
CREATE OR REPLACE FUNCTION public.fulfillment_items_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE ordered integer; planned integer;
BEGIN
  SELECT oi.quantity INTO ordered FROM public.order_items oi WHERE oi.id = NEW.order_item_id;
  IF ordered IS NULL THEN
    RAISE EXCEPTION 'Bestellposition nicht gefunden.' USING ERRCODE = 'check_violation';
  END IF;
  SELECT COALESCE(SUM(fi.quantity), 0) INTO planned
  FROM public.fulfillment_items fi
  JOIN public.fulfillments f ON f.id = fi.fulfillment_id
  WHERE fi.order_item_id = NEW.order_item_id
    AND f.status <> 'cancelled'
    AND fi.id <> NEW.id;
  IF planned + NEW.quantity > ordered THEN
    RAISE EXCEPTION 'Es kann nicht mehr versendet werden als bestellt (bestellt: %, bereits eingeplant: %).', ordered, planned
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER fulfillment_items_guard_trg BEFORE INSERT OR UPDATE ON public.fulfillment_items
  FOR EACH ROW EXECUTE FUNCTION public.fulfillment_items_guard();

-- ========= PACKAGE PRESETS =========
CREATE TABLE public.package_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  weight_grams integer,
  length_mm integer,
  width_mm integer,
  height_mm integer,
  packaging_type text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX package_presets_org_idx ON public.package_presets (organization_id, shop_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_presets TO authenticated;
GRANT ALL ON public.package_presets TO service_role;
ALTER TABLE public.package_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "package_presets_read" ON public.package_presets FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'shipping_settings.read'));
CREATE POLICY "package_presets_write" ON public.package_presets FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'shipping_settings.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'shipping_settings.manage'));
CREATE TRIGGER package_presets_updated_at BEFORE UPDATE ON public.package_presets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========= PACKAGES =========
CREATE TABLE public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  fulfillment_id uuid NOT NULL REFERENCES public.fulfillments(id) ON DELETE CASCADE,
  package_number integer NOT NULL,
  weight_grams integer,
  length_mm integer,
  width_mm integer,
  height_mm integer,
  packaging_type text,
  status public.package_status NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fulfillment_id, package_number)
);
CREATE INDEX packages_org_idx ON public.packages (organization_id, status);
CREATE INDEX packages_ful_idx ON public.packages (fulfillment_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packages TO authenticated;
GRANT ALL ON public.packages TO service_role;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packages_read" ON public.packages FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'fulfillment.read'));
CREATE POLICY "packages_write" ON public.packages FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'fulfillment.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'fulfillment.manage'));
CREATE TRIGGER packages_updated_at BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========= PACKAGE ITEMS =========
CREATE TABLE public.package_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  fulfillment_item_id uuid NOT NULL REFERENCES public.fulfillment_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, fulfillment_item_id)
);
CREATE INDEX package_items_package_idx ON public.package_items (package_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_items TO authenticated;
GRANT ALL ON public.package_items TO service_role;
ALTER TABLE public.package_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "package_items_read" ON public.package_items FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'fulfillment.read'));
CREATE POLICY "package_items_write" ON public.package_items FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'fulfillment.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'fulfillment.manage'));

-- ========= SHIPPING PROVIDER CONFIGS =========
CREATE TABLE public.shipping_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  provider text NOT NULL,
  display_name text NOT NULL,
  status public.entity_status NOT NULL DEFAULT 'active',
  test_mode boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  configuration_reference jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, provider)
);
CREATE INDEX shipping_provider_configs_org_idx ON public.shipping_provider_configs (organization_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_provider_configs TO authenticated;
GRANT ALL ON public.shipping_provider_configs TO service_role;
ALTER TABLE public.shipping_provider_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shipping_provider_configs_read" ON public.shipping_provider_configs FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'shipping_settings.read'));
CREATE POLICY "shipping_provider_configs_write" ON public.shipping_provider_configs FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'shipping_settings.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'shipping_settings.manage'));
CREATE TRIGGER shipping_provider_configs_updated_at BEFORE UPDATE ON public.shipping_provider_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========= SHIPMENTS =========
CREATE TABLE public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  fulfillment_id uuid NOT NULL REFERENCES public.fulfillments(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.packages(id) ON DELETE SET NULL,
  carrier_provider text NOT NULL,
  carrier_service text,
  provider_shipment_id text,
  tracking_number text,
  tracking_url text,
  status public.shipment_status NOT NULL DEFAULT 'created',
  normalized_tracking_status public.tracking_status NOT NULL DEFAULT 'pre_transit',
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  label_id uuid,
  carrier_cost_minor bigint,
  currency_code text,
  last_error jsonb,
  idempotency_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX shipments_package_active_idx ON public.shipments (package_id)
  WHERE package_id IS NOT NULL AND status <> 'cancelled';
CREATE UNIQUE INDEX shipments_idem_idx ON public.shipments (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX shipments_org_idx ON public.shipments (organization_id, status, created_at DESC);
CREATE INDEX shipments_ful_idx ON public.shipments (fulfillment_id);
CREATE INDEX shipments_tracking_idx ON public.shipments (tracking_number);
CREATE INDEX shipments_provider_shipment_idx ON public.shipments (carrier_provider, provider_shipment_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipments TO authenticated;
GRANT ALL ON public.shipments TO service_role;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shipments_read" ON public.shipments FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'shipping.read'));
CREATE POLICY "shipments_write" ON public.shipments FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'shipping.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'shipping.manage'));
CREATE TRIGGER shipments_updated_at BEFORE UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========= SHIPPING LABELS =========
CREATE TABLE public.shipping_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  provider text NOT NULL,
  format text NOT NULL DEFAULT 'pdf',
  storage_path text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX shipping_labels_active_idx ON public.shipping_labels (shipment_id) WHERE voided_at IS NULL;
CREATE INDEX shipping_labels_org_idx ON public.shipping_labels (organization_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_labels TO authenticated;
GRANT ALL ON public.shipping_labels TO service_role;
ALTER TABLE public.shipping_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shipping_labels_read" ON public.shipping_labels FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'shipping.read'));
CREATE POLICY "shipping_labels_write" ON public.shipping_labels FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'shipping.create_label'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'shipping.create_label'));

-- ========= TRACKING EVENTS (append-only) =========
CREATE TABLE public.tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  carrier_provider text NOT NULL,
  provider_event_id text,
  event_code text NOT NULL,
  normalized_status public.tracking_status NOT NULL DEFAULT 'unknown',
  description text,
  location text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  dedupe_hash text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX tracking_events_dedupe_idx ON public.tracking_events (shipment_id, dedupe_hash);
CREATE INDEX tracking_events_shipment_idx ON public.tracking_events (shipment_id, occurred_at DESC);
CREATE INDEX tracking_events_org_idx ON public.tracking_events (organization_id, occurred_at DESC);
GRANT SELECT, INSERT ON public.tracking_events TO authenticated;
GRANT ALL ON public.tracking_events TO service_role;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tracking_events_read" ON public.tracking_events FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'tracking.read'));

CREATE OR REPLACE FUNCTION public.tracking_events_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  RAISE EXCEPTION 'tracking_events ist append-only und darf nicht geändert oder gelöscht werden.'
    USING ERRCODE = 'insufficient_privilege';
END; $$;
CREATE TRIGGER tracking_events_no_update BEFORE UPDATE OR DELETE ON public.tracking_events
  FOR EACH ROW EXECUTE FUNCTION public.tracking_events_immutable();

-- ========= STATE HELPERS =========
CREATE OR REPLACE FUNCTION public.track_status_rank(_status public.tracking_status)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.ful_recompute_order_status(_order uuid)
RETURNS public.order_fulfillment_status LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
END; $$;

-- ========= FULFILLMENT LIFECYCLE =========
CREATE OR REPLACE FUNCTION public.ful_create(_org uuid, _shop uuid, _order uuid, _location uuid, _actor uuid,
  _items jsonb, _notes text DEFAULT NULL, _idem text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
END; $$;

CREATE OR REPLACE FUNCTION public.ful_start_picking(_org uuid, _ful uuid, _actor uuid, _idem text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
END; $$;

CREATE OR REPLACE FUNCTION public.ful_complete_picking(_org uuid, _ful uuid, _actor uuid, _picked jsonb, _idem text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
END; $$;

CREATE OR REPLACE FUNCTION public.ful_pack(_org uuid, _ful uuid, _actor uuid, _packages jsonb, _idem text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
END; $$;

CREATE OR REPLACE FUNCTION public.ful_cancel(_org uuid, _ful uuid, _actor uuid, _reason text DEFAULT NULL, _idem text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE f public.fulfillments; res jsonb;
BEGIN
  res := public.inv_idem_get(_org, 'ful_cancel', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.inv_assert(_actor, _org, 'fulfillment.manage');
  SELECT * INTO f FROM public.fulfillments WHERE id = _ful AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fulfillment nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
  IF f.status = 'cancelled' THEN
    res := jsonb_build_object('fulfillment_id', f.id, 'status', 'cancelled', 'changed', false);
    PERFORM public.inv_idem_put(_org, 'ful_cancel', _idem, res); RETURN res;
  END IF;
  IF f.status IN ('shipped','delivered') THEN
    RAISE EXCEPTION 'Versendete Fulfillments können nicht storniert werden.' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.shipments s WHERE s.fulfillment_id = f.id AND s.status NOT IN ('cancelled')) THEN
    RAISE EXCEPTION 'Es existiert noch eine aktive Sendung. Bitte zuerst die Sendung stornieren.' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.fulfillments SET status = 'cancelled', cancelled_at = now(),
    metadata = metadata || jsonb_build_object('cancel_reason', _reason) WHERE id = f.id;
  UPDATE public.packages SET status = 'cancelled' WHERE fulfillment_id = f.id AND status <> 'cancelled';

  PERFORM public.ful_recompute_order_status(f.order_id);
  PERFORM public.inv_audit(_org, _actor, 'fulfillment.cancelled', 'fulfillment', f.id::text,
    jsonb_build_object('reason', _reason));
  PERFORM public.inv_event(_org, 'fulfillment.cancelled', jsonb_build_object('fulfillment_id', f.id, 'reason', _reason));

  res := jsonb_build_object('fulfillment_id', f.id, 'status', 'cancelled', 'changed', true);
  PERFORM public.inv_idem_put(_org, 'ful_cancel', _idem, res);
  RETURN res;
END; $$;

-- ========= SHIPMENT LIFECYCLE =========
CREATE OR REPLACE FUNCTION public.ship_create(_org uuid, _ful uuid, _package uuid, _provider text, _service text,
  _actor uuid, _idem text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
END; $$;

CREATE OR REPLACE FUNCTION public.ship_record_label(_org uuid, _shipment uuid, _actor uuid, _provider text,
  _format text, _storage_path text, _mime text, _provider_shipment_id text, _tracking_number text,
  _tracking_url text, _cost_minor bigint DEFAULT NULL, _currency text DEFAULT NULL, _idem text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
END; $$;

CREATE OR REPLACE FUNCTION public.ship_mark_shipped(_org uuid, _shipment uuid, _actor uuid, _idem text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
END; $$;

CREATE OR REPLACE FUNCTION public.ship_cancel(_org uuid, _shipment uuid, _actor uuid, _reason text DEFAULT NULL, _idem text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
END; $$;

-- ========= TRACKING =========
CREATE OR REPLACE FUNCTION public.track_record_event(_org uuid, _shipment uuid, _provider text,
  _provider_event_id text, _code text, _normalized public.tracking_status, _description text,
  _location text, _occurred_at timestamptz, _raw jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s public.shipments; f public.fulfillments; eid uuid; hash text; advanced boolean := false; ostatus text;
BEGIN
  SELECT * INTO s FROM public.shipments WHERE id = _shipment AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sendung nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;

  hash := COALESCE(NULLIF(_provider_event_id,''),
    encode(digest(_code || '|' || _normalized::text || '|' || COALESCE(_occurred_at, now())::text, 'sha256'), 'hex'));

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
END; $$;

-- ========= PERMISSIONS =========
INSERT INTO public.role_permissions (role, permission) VALUES
  ('owner','fulfillment.read'),('owner','fulfillment.manage'),('owner','fulfillment.pick'),('owner','fulfillment.pack'),
  ('owner','shipping.read'),('owner','shipping.manage'),('owner','shipping.create_label'),('owner','shipping.cancel'),
  ('owner','tracking.read'),('owner','shipping_settings.read'),('owner','shipping_settings.manage'),
  ('administrator','fulfillment.read'),('administrator','fulfillment.manage'),('administrator','fulfillment.pick'),('administrator','fulfillment.pack'),
  ('administrator','shipping.read'),('administrator','shipping.manage'),('administrator','shipping.create_label'),('administrator','shipping.cancel'),
  ('administrator','tracking.read'),('administrator','shipping_settings.read'),('administrator','shipping_settings.manage'),
  ('fulfillment','fulfillment.read'),('fulfillment','fulfillment.manage'),('fulfillment','fulfillment.pick'),('fulfillment','fulfillment.pack'),
  ('fulfillment','shipping.read'),('fulfillment','shipping.manage'),('fulfillment','shipping.create_label'),('fulfillment','shipping.cancel'),
  ('fulfillment','tracking.read'),('fulfillment','shipping_settings.read'),
  ('operations','fulfillment.read'),('operations','fulfillment.manage'),('operations','fulfillment.pick'),('operations','fulfillment.pack'),
  ('operations','shipping.read'),('operations','shipping.manage'),('operations','shipping.create_label'),('operations','shipping.cancel'),
  ('operations','tracking.read'),('operations','shipping_settings.read'),('operations','shipping_settings.manage'),
  ('customer_support','fulfillment.read'),('customer_support','shipping.read'),('customer_support','tracking.read'),
  ('finance','fulfillment.read'),('finance','shipping.read'),('finance','tracking.read'),('finance','shipping_settings.read'),
  ('read_only','fulfillment.read'),('read_only','shipping.read'),('read_only','tracking.read'),('read_only','shipping_settings.read')
ON CONFLICT DO NOTHING;

-- ========= STORAGE POLICIES (Labels) =========
CREATE POLICY "shipping_labels_storage_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'shipping-labels'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "shipping_labels_storage_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shipping-labels'
    AND public.has_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'shipping.create_label'));