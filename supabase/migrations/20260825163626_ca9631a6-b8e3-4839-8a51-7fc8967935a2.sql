CREATE OR REPLACE FUNCTION public.invoice_create_from_order(
  _org uuid, _order uuid, _actor uuid, _idem text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cached jsonb; o public.orders; inv_id uuid; existing uuid;
  billing jsonb; snap public.tax_snapshots; missing text[];
  items_net bigint := 0; items_tax bigint := 0; ship_net bigint; ship_tax bigint;
  pos integer := 0; r record; ctype public.tax_customer_type := 'consumer';
  paid bigint := 0; terms integer := 14; legacy boolean;
  line_net bigint; line_tax bigint; line_gross bigint;
BEGIN
  cached := public.inv_idem_get(_org, 'invoice_create_from_order', _idem);
  IF cached IS NOT NULL THEN RETURN cached; END IF;
  PERFORM public.doc_assert(_actor, _org, 'invoices.manage');

  SELECT * INTO o FROM public.orders WHERE id = _order AND organization_id = _org FOR UPDATE;
  IF o IS NULL THEN RAISE EXCEPTION 'Bestellung nicht gefunden.'; END IF;
  IF o.order_status = 'cancelled' THEN RAISE EXCEPTION 'Für stornierte Bestellungen wird keine Rechnung erstellt.'; END IF;

  SELECT id INTO existing FROM public.invoices WHERE order_id = _order AND status <> 'voided';
  IF existing IS NOT NULL THEN
    RETURN jsonb_build_object('invoice_id', existing, 'created', false);
  END IF;

  missing := public.doc_setup_missing(o.shop_id);
  IF missing && ARRAY['company','address','tax'] THEN
    RAISE EXCEPTION 'Rechnungseinstellungen unvollständig: %', array_to_string(missing, ', ');
  END IF;

  SELECT address INTO billing FROM public.order_addresses
   WHERE order_id = _order ORDER BY (type = 'billing') DESC LIMIT 1;
  IF billing IS NULL THEN RAISE EXCEPTION 'Für diese Bestellung ist keine Rechnungsadresse hinterlegt.'; END IF;

  SELECT * INTO snap FROM public.tax_snapshots WHERE order_id = _order ORDER BY created_at DESC LIMIT 1;
  IF snap.id IS NOT NULL AND snap.customer_type <> 'any' THEN ctype := snap.customer_type; END IF;

  -- Bestellungen vor der Steuer-Engine haben keine getrennten Netto-/Steuerwerte.
  legacy := coalesce(o.net_total_minor, 0) = 0 AND coalesce(o.tax_total_minor, 0) = 0;

  SELECT coalesce(sum(CASE WHEN legacy THEN line_total_minor ELSE net_minor END), 0),
         coalesce(sum(CASE WHEN legacy THEN 0 ELSE tax_minor END), 0)
    INTO items_net, items_tax
    FROM public.order_items WHERE order_id = _order;

  IF legacy THEN
    ship_net := coalesce(o.shipping_minor, 0);
    ship_tax := 0;
  ELSE
    ship_net := greatest(o.net_total_minor - items_net, 0);
    ship_tax := greatest(o.tax_total_minor - items_tax, 0);
  END IF;

  SELECT coalesce(sum(CASE WHEN type IN ('capture','charge') THEN amount_minor
                           WHEN type IN ('refund','partial_refund') THEN -amount_minor
                           ELSE 0 END), 0)
    INTO paid FROM public.payment_transactions WHERE order_id = _order;
  IF paid <= 0 AND o.payment_status = 'paid' THEN paid := o.total_minor; END IF;

  SELECT coalesce(payment_terms_days, 14) INTO terms FROM public.invoice_settings WHERE shop_id = o.shop_id;
  terms := coalesce(terms, 14);

  INSERT INTO public.invoices (
    organization_id, shop_id, order_id, currency_code, customer_type,
    customer_email, customer_name, customer_company, customer_vat_id,
    billing_address_snapshot, seller_snapshot, branding_snapshot, payment_snapshot,
    subtotal_net_minor, discount_minor, shipping_net_minor, tax_total_minor,
    total_gross_minor, paid_minor, tax_breakdown, tax_engine_version,
    source_order_snapshot, payment_terms, created_by)
  VALUES (
    _org, o.shop_id, _order, o.currency_code, ctype,
    o.email,
    nullif(trim(coalesce(billing->>'firstName','') || ' ' || coalesce(billing->>'lastName','')), ''),
    billing->>'company', billing->>'vatId',
    billing, coalesce(public.doc_seller_snapshot(o.shop_id), '{}'::jsonb),
    public.doc_branding_snapshot(o.shop_id),
    jsonb_build_object('payment_status', o.payment_status, 'paid_minor', paid),
    items_net, o.discount_minor, ship_net, coalesce(o.tax_total_minor, 0),
    coalesce(nullif(o.gross_total_minor, 0), o.total_minor), greatest(paid, 0),
    coalesce(o.tax_breakdown, '[]'::jsonb), o.tax_engine_version,
    jsonb_build_object('order_number', o.order_number, 'placed_at', o.placed_at,
                       'shipping_method', o.shipping_method, 'environment', o.environment),
    'Zahlbar innerhalb von ' || terms || ' Tagen ohne Abzug.',
    _actor)
  RETURNING id INTO inv_id;

  FOR r IN SELECT * FROM public.order_items WHERE order_id = _order ORDER BY created_at, id LOOP
    IF legacy THEN
      line_net := r.line_total_minor; line_tax := 0; line_gross := r.line_total_minor;
    ELSE
      line_net := r.net_minor; line_tax := r.tax_minor; line_gross := r.gross_minor;
    END IF;
    pos := pos + 1;
    INSERT INTO public.invoice_items (
      organization_id, invoice_id, order_item_id, position, item_type,
      product_name, variant_name, sku, quantity, unit_net_minor, discount_minor,
      line_net_minor, tax_rate_basis_points, tax_reason_code, tax_minor, line_gross_minor)
    VALUES (
      _org, inv_id, r.id, pos, 'product',
      r.title_snapshot, r.variant_title_snapshot, r.sku_snapshot, r.quantity,
      CASE WHEN r.quantity > 0 THEN round(line_net::numeric / r.quantity) ELSE 0 END,
      r.line_discount_minor, line_net,
      CASE WHEN legacy THEN 0 ELSE coalesce(r.tax_rate_basis_points, 0) END,
      CASE WHEN legacy THEN 'zero_rate' ELSE coalesce(r.tax_reason_code, 'standard_rate') END,
      line_tax, line_gross);
  END LOOP;

  IF ship_net > 0 OR ship_tax > 0 THEN
    pos := pos + 1;
    INSERT INTO public.invoice_items (
      organization_id, invoice_id, position, item_type, product_name, quantity,
      unit_net_minor, line_net_minor, tax_rate_basis_points, tax_reason_code,
      tax_minor, line_gross_minor)
    VALUES (_org, inv_id, pos, 'shipping',
      coalesce(o.shipping_method->>'name', 'Versand'), 1, ship_net, ship_net,
      CASE WHEN ship_net > 0 AND ship_tax > 0 THEN round(ship_tax::numeric * 10000 / ship_net) ELSE 0 END,
      CASE WHEN ship_tax > 0 THEN 'standard_rate' ELSE 'zero_rate' END,
      ship_tax, ship_net + ship_tax);
  END IF;

  PERFORM public.inv_audit(_org, _actor, 'invoice.created', 'invoice', inv_id::text,
    jsonb_build_object('order_id', _order));
  cached := jsonb_build_object('invoice_id', inv_id, 'created', true);
  PERFORM public.inv_idem_put(_org, 'invoice_create_from_order', _idem, cached);
  RETURN cached;
END; $$;

REVOKE EXECUTE ON FUNCTION public.invoice_create_from_order(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;