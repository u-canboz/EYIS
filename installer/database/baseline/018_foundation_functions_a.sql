-- EYIS Database Install Pack — Funktionen: foundation (foundation-functions-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

CREATE OR REPLACE FUNCTION public.bulk_update_prices(_org_id uuid, _price_ids uuid[], _mode text, _amount_minor bigint, _percent_bp integer)
 RETURNS TABLE(id uuid, old_amount bigint, new_amount bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _mode NOT IN ('set','increase_percent','decrease_percent','increase_amount','decrease_amount') THEN
    RAISE EXCEPTION 'Unbekannter Bulk-Modus.' USING ERRCODE = 'check_violation';
  END IF;

  RETURN QUERY
  WITH target AS (
    SELECT p.id AS pid, p.amount_minor AS old_amt,
      CASE _mode
        WHEN 'set' THEN _amount_minor
        WHEN 'increase_percent' THEN round(p.amount_minor * (10000 + _percent_bp)::numeric / 10000)
        WHEN 'decrease_percent' THEN round(p.amount_minor * (10000 - _percent_bp)::numeric / 10000)
        WHEN 'increase_amount' THEN p.amount_minor + _amount_minor
        WHEN 'decrease_amount' THEN p.amount_minor - _amount_minor
      END::bigint AS new_amt
    FROM public.prices p
    WHERE p.id = ANY(_price_ids) AND p.organization_id = _org_id
  ), updated AS (
    UPDATE public.prices p
    SET amount_minor = GREATEST(t.new_amt, 0)
    FROM target t
    WHERE p.id = t.pid
    RETURNING p.id, t.old_amt, p.amount_minor
  )
  SELECT * FROM updated;
END; $function$;

CREATE OR REPLACE FUNCTION public.can_view_profile(_other_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _other_user = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.memberships a
        JOIN public.memberships b ON b.organization_id = a.organization_id
        WHERE a.user_id = auth.uid()
          AND b.user_id = _other_user
          AND public.has_permission(auth.uid(), a.organization_id, 'settings.manage')
      );
$function$;

CREATE OR REPLACE FUNCTION public.claim_installation_owner(_claim_hash text, _user_id uuid, _org_name text, _org_slug text, _shop_name text, _shop_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inst public.commerce_installation%ROWTYPE;
  new_org_id uuid;
  new_shop_id uuid;
BEGIN
  SELECT * INTO inst FROM public.commerce_installation WHERE singleton = true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSTALLATION_NOT_FOUND';
  END IF;
  IF inst.owner_claimed_at IS NOT NULL THEN
    RAISE EXCEPTION 'OWNER_ALREADY_CLAIMED';
  END IF;
  IF inst.claim_token_hash IS NULL
     OR inst.claim_token_used_at IS NOT NULL
     OR inst.claim_token_expires_at IS NULL
     OR inst.claim_token_expires_at < now()
     OR inst.claim_token_hash <> _claim_hash THEN
    RAISE EXCEPTION 'CLAIM_INVALID';
  END IF;

  INSERT INTO public.organizations (name, slug) VALUES (_org_name, _org_slug) RETURNING id INTO new_org_id;
  INSERT INTO public.shops (organization_id, name, slug) VALUES (new_org_id, _shop_name, _shop_slug) RETURNING id INTO new_shop_id;
  INSERT INTO public.memberships (organization_id, user_id, role) VALUES (new_org_id, _user_id, 'owner');

  UPDATE public.commerce_installation
    SET owner_claimed_at = now(), claim_token_used_at = now()
    WHERE singleton = true;

  RETURN jsonb_build_object('organization_id', new_org_id, 'shop_id', new_shop_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.comm_ensure_shop_defaults(_org uuid, _shop uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.communication_branding (organization_id, shop_id, footer_text)
  SELECT _org, _shop, s.name || ' · Diese E-Mail wurde automatisch erzeugt.'
  FROM public.shops s WHERE s.id = _shop
  ON CONFLICT (shop_id) DO NOTHING;

  INSERT INTO public.communication_provider_configs
    (organization_id, shop_id, channel, provider, display_name, status, test_mode, priority, capabilities)
  VALUES (_org, _shop, 'email', 'test', 'Interner Testversand', 'active', true, 10,
    '{"supportsAttachments":false,"supportsTags":true,"supportsTemplates":false,"supportsDeliveryWebhooks":false,"supportsBounceWebhooks":false,"supportsOpenTracking":false}'::jsonb)
  ON CONFLICT (organization_id, shop_id, channel, provider) DO NOTHING;

  INSERT INTO public.communication_rules
    (organization_id, shop_id, event_type, channel, template_key, template_id, enabled, delay_seconds, priority)
  SELECT _org, _shop, m.event_type, 'email', m.template_key, t.id, m.enabled, 0, 100
  FROM (VALUES
    ('order.created','order.confirmed',true),
    ('payment.succeeded','payment.confirmed',false),
    ('payment.failed','payment.failed',true),
    ('refund.completed','refund.completed',true),
    ('shipment.created','shipment.created',false),
    ('shipment.shipped','shipment.shipped',true),
    ('shipment.out_for_delivery','shipment.out_for_delivery',false),
    ('shipment.delivered','shipment.delivered',false),
    ('shipment.exception','shipment.exception',true),
    ('invoice.issued','invoice.issued',true),
    ('credit_note.issued','credit_note.issued',true),
    ('return.requested','return.requested',true),
    ('return.authorized','return.authorized',true),
    ('return.rejected','return.rejected',true),
    ('return.received','return.received',true),
    ('return.approved','return.approved',true),
    ('return.partially_approved','return.partially_approved',true),
    ('return.refunded','return.refunded',true),
    ('return.completed','return.completed',true),
    ('customer.created','customer.welcome',true),
    ('customer.guest_access_requested','guest_order_access',true)
  ) AS m(event_type, template_key, enabled)
  JOIN public.communication_templates t
    ON t.key = m.template_key AND t.organization_id IS NULL AND t.channel = 'email'
  ON CONFLICT (shop_id, event_type, channel, template_key) DO NOTHING;
END; $function$;

CREATE OR REPLACE FUNCTION public.comm_template_version_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN IF TG_OP = 'DELETE' AND public.purge_mode() THEN RETURN OLD; END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.published_at IS NOT NULL THEN
      RAISE EXCEPTION 'Veröffentlichte Vorlagenversionen können nicht gelöscht werden.';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.published_at IS NOT NULL THEN
    IF NEW.subject IS DISTINCT FROM OLD.subject
       OR NEW.preheader IS DISTINCT FROM OLD.preheader
       OR NEW.body_schema IS DISTINCT FROM OLD.body_schema
       OR NEW.text_body_template IS DISTINCT FROM OLD.text_body_template
       OR NEW.locale IS DISTINCT FROM OLD.locale
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.template_id IS DISTINCT FROM OLD.template_id
       OR NEW.published_at IS DISTINCT FROM OLD.published_at THEN
      RAISE EXCEPTION 'Diese Version ist veröffentlicht. Änderungen erzeugen eine neue Version.';
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.current_org_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT organization_id FROM public.memberships WHERE user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.delivery_note_create(_org uuid, _fulfillment uuid, _actor uuid, _notes text DEFAULT NULL::text, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE cached jsonb; f public.fulfillments; o public.orders; recipient jsonb;
        items jsonb; num text; dn_id uuid;
BEGIN
  cached := public.inv_idem_get(_org, 'delivery_note_create', _idem);
  IF cached IS NOT NULL THEN RETURN cached; END IF;
  PERFORM public.doc_assert(_actor, _org, 'invoices.manage');

  SELECT * INTO f FROM public.fulfillments WHERE id = _fulfillment AND organization_id = _org;
  IF f IS NULL THEN RAISE EXCEPTION 'Fulfillment nicht gefunden.'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = f.order_id;

  SELECT address INTO recipient FROM public.order_addresses
   WHERE order_id = o.id ORDER BY (type = 'shipping') DESC LIMIT 1;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'productName', oi.title_snapshot, 'variantName', oi.variant_title_snapshot,
           'sku', oi.sku_snapshot,
           'quantity', COALESCE(NULLIF(fi.packed_quantity, 0), NULLIF(fi.picked_quantity, 0), fi.quantity))
         ORDER BY oi.created_at), '[]'::jsonb)
    INTO items
    FROM public.fulfillment_items fi
    JOIN public.order_items oi ON oi.id = fi.order_item_id
   WHERE fi.fulfillment_id = _fulfillment;

  num := public.doc_next_number(_org, f.shop_id, 'delivery_note');

  INSERT INTO public.delivery_notes (
    organization_id, shop_id, order_id, fulfillment_id, document_number, status,
    recipient_snapshot, seller_snapshot, branding_snapshot, items, notes,
    created_by, issued_by, issued_at, metadata)
  VALUES (_org, f.shop_id, o.id, _fulfillment, num, 'issued',
    coalesce(recipient, '{}'::jsonb), coalesce(public.doc_seller_snapshot(f.shop_id), '{}'::jsonb),
    public.doc_branding_snapshot(f.shop_id), items, _notes, _actor, _actor, now(),
    jsonb_build_object('order_number', o.order_number))
  RETURNING id INTO dn_id;

  PERFORM public.inv_audit(_org, _actor, 'delivery_note.created', 'delivery_note', dn_id::text,
    jsonb_build_object('number', num, 'fulfillment_id', _fulfillment));
  cached := jsonb_build_object('delivery_note_id', dn_id, 'document_number', num);
  PERFORM public.inv_idem_put(_org, 'delivery_note_create', _idem, cached);
  RETURN cached;
END; $function$;

CREATE OR REPLACE FUNCTION public.demo_purge_organization(_org uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organizations o
     WHERE o.id = _org
       AND (
         o.slug LIKE 'qa-fixture%'
         OR o.slug LIKE 'commerce-os-demo%'
         OR EXISTS (SELECT 1 FROM public.demo_environments d WHERE d.organization_id = o.id)
         OR EXISTS (SELECT 1 FROM public.qa_fixtures f WHERE f.organization_id = o.id)
       )
  ) THEN
    RAISE EXCEPTION 'Nur Demo- oder QA-Organisationen dürfen vollständig entfernt werden.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM set_config('app.purge_mode', 'on', true);
  DELETE FROM public.payment_events WHERE organization_id = _org;
  DELETE FROM public.organizations WHERE id = _org;
  PERFORM set_config('app.purge_mode', 'off', true);
END $function$;

CREATE OR REPLACE FUNCTION public.doc_assert(_actor uuid, _org uuid, _perm text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _actor IS NULL OR NOT public.has_permission(_actor, _org, _perm) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diese Dokumentaktion.' USING ERRCODE = 'insufficient_privilege';
  END IF;
END; $function$;

CREATE OR REPLACE FUNCTION public.doc_branding_snapshot(_shop uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT to_jsonb(b) - 'id' - 'organization_id' - 'shop_id' - 'created_at' - 'updated_at'
       FROM public.document_branding b WHERE b.shop_id = _shop),
    '{"preset":"clean","primary_color":"#1F2937","font_family":"helvetica","show_product_sku":true,"show_tax_breakdown":true}'::jsonb);
$function$;

CREATE OR REPLACE FUNCTION public.doc_next_number(_org uuid, _shop uuid, _type document_type)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE seq public.document_sequences; period text; v bigint; body text;
BEGIN
  INSERT INTO public.document_sequences (organization_id, shop_id, document_type, prefix)
  VALUES (_org, _shop, _type,
    CASE _type WHEN 'invoice' THEN 'RE' WHEN 'credit_note' THEN 'GS' WHEN 'delivery_note' THEN 'LS' ELSE 'DOC' END)
  ON CONFLICT (shop_id, document_type) DO NOTHING;

  SELECT * INTO seq FROM public.document_sequences
   WHERE shop_id = _shop AND document_type = _type FOR UPDATE;

  period := CASE seq.reset_policy
    WHEN 'yearly' THEN to_char(now(), 'YYYY')
    WHEN 'monthly' THEN to_char(now(), 'YYYY-MM')
    ELSE NULL END;

  IF seq.reset_policy <> 'never' AND seq.current_period IS DISTINCT FROM period THEN
    v := 1;
    UPDATE public.document_sequences SET next_number = 2, current_period = period WHERE id = seq.id;
  ELSE
    v := seq.next_number;
    UPDATE public.document_sequences SET next_number = seq.next_number + 1 WHERE id = seq.id;
  END IF;

  body := seq.prefix;
  IF seq.include_period AND period IS NOT NULL THEN body := body || '-' || period; END IF;
  body := body || '-' || lpad(v::text, seq.padding, '0');
  IF seq.suffix IS NOT NULL AND seq.suffix <> '' THEN body := body || '-' || seq.suffix; END IF;
  RETURN body;
END; $function$;

CREATE OR REPLACE FUNCTION public.doc_seller_snapshot(_shop uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT to_jsonb(s) - 'id' - 'organization_id' - 'shop_id' - 'created_at' - 'updated_at'
  FROM public.invoice_settings s WHERE s.shop_id = _shop;
$function$;

CREATE OR REPLACE FUNCTION public.doc_setup_missing(_shop uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s public.invoice_settings; missing text[] := '{}';
BEGIN
  SELECT * INTO s FROM public.invoice_settings WHERE shop_id = _shop;
  IF s IS NULL THEN RETURN ARRAY['company','address','tax','sequence']; END IF;
  IF coalesce(s.company_name,'') = '' THEN missing := missing || 'company'; END IF;
  IF coalesce(s.address_line1,'') = '' OR coalesce(s.postal_code,'') = '' OR coalesce(s.city,'') = ''
    THEN missing := missing || 'address'; END IF;
  IF coalesce(s.tax_number,'') = '' AND coalesce(s.vat_id,'') = '' THEN missing := missing || 'tax'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.document_sequences q WHERE q.shop_id = _shop AND q.document_type = 'invoice')
    THEN missing := missing || 'sequence'; END IF;
  RETURN missing;
END; $function$;

CREATE OR REPLACE FUNCTION public.ful_cancel(_org uuid, _ful uuid, _actor uuid, _reason text DEFAULT NULL::text, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$;

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
