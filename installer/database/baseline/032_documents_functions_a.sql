-- EYIS Database Install Pack — Funktionen: documents (documents-functions-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.credit_note_create(_org uuid, _invoice uuid, _actor uuid, _amount_minor bigint, _reason text DEFAULT NULL::text, _refund uuid DEFAULT NULL::uuid, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cached jsonb; inv public.invoices; cn_id uuid; remaining bigint;
  grp record; total_gross bigint; allocated bigint := 0; share bigint;
  net bigint; tax bigint; pos integer := 0; sum_net bigint := 0; sum_tax bigint := 0;
  breakdown jsonb := '[]'::jsonb; groups_count integer; idx integer := 0;
BEGIN
  cached := public.inv_idem_get(_org, 'credit_note_create', _idem);
  IF cached IS NOT NULL THEN RETURN cached; END IF;
  PERFORM public.doc_assert(_actor, _org, 'invoices.credit');

  SELECT * INTO inv FROM public.invoices WHERE id = _invoice AND organization_id = _org FOR UPDATE;
  IF inv IS NULL THEN RAISE EXCEPTION 'Rechnung nicht gefunden.'; END IF;
  IF inv.status NOT IN ('issued','partially_credited') THEN
    RAISE EXCEPTION 'Nur ausgestellte Rechnungen können gutgeschrieben werden.';
  END IF;

  remaining := inv.total_gross_minor - inv.credited_minor;
  IF _amount_minor IS NULL OR _amount_minor <= 0 THEN
    RAISE EXCEPTION 'Der Gutschriftbetrag muss größer als null sein.';
  END IF;
  IF _amount_minor > remaining THEN
    RAISE EXCEPTION 'Maximal gutschreibbar sind % (Minor Units).', remaining;
  END IF;

  SELECT coalesce(sum(line_gross_minor),0) INTO total_gross FROM public.invoice_items WHERE invoice_id = _invoice;
  IF total_gross <= 0 THEN RAISE EXCEPTION 'Rechnung ohne Bruttobetrag kann nicht gutgeschrieben werden.'; END IF;

  INSERT INTO public.credit_notes (
    organization_id, shop_id, order_id, invoice_id, refund_id, currency_code, reason,
    seller_snapshot, customer_snapshot, branding_snapshot, created_by)
  VALUES (_org, inv.shop_id, inv.order_id, _invoice, _refund, inv.currency_code, _reason,
    inv.seller_snapshot,
    jsonb_build_object('name', inv.customer_name, 'company', inv.customer_company,
                       'email', inv.customer_email, 'vat_id', inv.customer_vat_id,
                       'address', inv.billing_address_snapshot, 'customer_type', inv.customer_type),
    inv.branding_snapshot, _actor)
  RETURNING id INTO cn_id;

  SELECT count(*) INTO groups_count FROM (
    SELECT tax_rate_basis_points FROM public.invoice_items
     WHERE invoice_id = _invoice GROUP BY tax_rate_basis_points) g;

  FOR grp IN
    SELECT tax_rate_basis_points AS rate,
           sum(line_gross_minor) AS gross,
           min(tax_reason_code) AS reason_code
      FROM public.invoice_items WHERE invoice_id = _invoice
     GROUP BY tax_rate_basis_points ORDER BY tax_rate_basis_points DESC
  LOOP
    idx := idx + 1;
    IF idx = groups_count THEN
      share := _amount_minor - allocated;
    ELSE
      share := round(_amount_minor::numeric * grp.gross / total_gross);
    END IF;
    allocated := allocated + share;
    IF share = 0 THEN CONTINUE; END IF;

    net := round(share::numeric * 10000 / (10000 + grp.rate));
    tax := share - net;
    pos := pos + 1;
    sum_net := sum_net + net; sum_tax := sum_tax + tax;

    INSERT INTO public.credit_note_items (
      organization_id, credit_note_id, position, item_type, product_name, quantity,
      unit_net_minor, line_net_minor, tax_rate_basis_points, tax_reason_code, tax_minor, line_gross_minor)
    VALUES (_org, cn_id, pos, 'custom',
      'Gutschrift zu Rechnung ' || coalesce(inv.invoice_number, '') ||
        ' (' || replace(to_char(grp.rate / 100.0, 'FM990.99'), '.', ',') || ' %)',
      1, net, net, grp.rate, grp.reason_code, tax, share);

    breakdown := breakdown || jsonb_build_array(jsonb_build_object(
      'rateBasisPoints', grp.rate, 'netMinor', net, 'taxMinor', tax, 'grossMinor', share,
      'reasonCode', grp.reason_code));
  END LOOP;

  UPDATE public.credit_notes SET
    subtotal_net_minor = sum_net, tax_total_minor = sum_tax,
    total_gross_minor = sum_net + sum_tax, tax_breakdown = breakdown
  WHERE id = cn_id;

  PERFORM public.inv_audit(_org, _actor, 'credit_note.created', 'credit_note', cn_id::text,
    jsonb_build_object('invoice_id', _invoice, 'amount_minor', _amount_minor));
  cached := jsonb_build_object('credit_note_id', cn_id, 'total_gross_minor', sum_net + sum_tax);
  PERFORM public.inv_idem_put(_org, 'credit_note_create', _idem, cached);
  RETURN cached;
END; $function$;

CREATE OR REPLACE FUNCTION public.credit_note_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN IF TG_OP = 'DELETE' AND public.purge_mode() THEN RETURN OLD; END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Ausgestellte Gutschriften können nicht gelöscht werden.';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'draft' THEN RETURN NEW; END IF;
  IF NEW.status = 'draft' THEN
    RAISE EXCEPTION 'Eine ausgestellte Gutschrift kann nicht zurück auf Entwurf gesetzt werden.';
  END IF;
  IF NEW.credit_note_number IS DISTINCT FROM OLD.credit_note_number
     OR NEW.total_gross_minor IS DISTINCT FROM OLD.total_gross_minor
     OR NEW.tax_total_minor IS DISTINCT FROM OLD.tax_total_minor
     OR NEW.invoice_id IS DISTINCT FROM OLD.invoice_id THEN
    RAISE EXCEPTION 'Fachliche Gutschriftdaten sind nach der Ausstellung unveränderbar.';
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.credit_note_issue(_org uuid, _credit_note uuid, _actor uuid, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE cached jsonb; cn public.credit_notes; inv public.invoices; num text; new_credited bigint;
BEGIN
  cached := public.inv_idem_get(_org, 'credit_note_issue', _idem);
  IF cached IS NOT NULL THEN RETURN cached; END IF;
  PERFORM public.doc_assert(_actor, _org, 'invoices.credit');

  SELECT * INTO cn FROM public.credit_notes WHERE id = _credit_note AND organization_id = _org FOR UPDATE;
  IF cn IS NULL THEN RAISE EXCEPTION 'Gutschrift nicht gefunden.'; END IF;
  IF cn.status <> 'draft' THEN
    RETURN jsonb_build_object('credit_note_id', cn.id, 'credit_note_number', cn.credit_note_number, 'issued', false);
  END IF;

  SELECT * INTO inv FROM public.invoices WHERE id = cn.invoice_id FOR UPDATE;
  new_credited := inv.credited_minor + cn.total_gross_minor;
  IF new_credited > inv.total_gross_minor THEN
    RAISE EXCEPTION 'Die Gutschrift überschreitet den offenen Rechnungsbetrag.';
  END IF;

  num := public.doc_next_number(_org, cn.shop_id, 'credit_note');
  UPDATE public.credit_notes SET credit_note_number = num, status = 'issued',
         issued_at = now(), issued_by = _actor WHERE id = _credit_note;

  UPDATE public.invoices SET credited_minor = new_credited,
    status = CASE WHEN new_credited >= inv.total_gross_minor THEN 'credited'::public.invoice_status
                  ELSE 'partially_credited'::public.invoice_status END
  WHERE id = inv.id;

  PERFORM public.inv_audit(_org, _actor, 'credit_note.issued', 'credit_note', _credit_note::text,
    jsonb_build_object('credit_note_number', num, 'invoice_id', inv.id));
  PERFORM public.inv_event(_org, 'credit_note.issued',
    jsonb_build_object('credit_note_id', _credit_note, 'invoice_id', inv.id, 'number', num));

  cached := jsonb_build_object('credit_note_id', _credit_note, 'credit_note_number', num, 'issued', true);
  PERFORM public.inv_idem_put(_org, 'credit_note_issue', _idem, cached);
  RETURN cached;
END; $function$;

CREATE OR REPLACE FUNCTION public.document_files_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN IF TG_OP = 'DELETE' AND public.purge_mode() THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Dokumentdateien sind unveränderbar. Erzeuge eine neue Version.';
END; $function$;

CREATE OR REPLACE FUNCTION public.invoice_create_from_order(_org uuid, _order uuid, _actor uuid, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$;

CREATE OR REPLACE FUNCTION public.invoice_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN IF TG_OP = 'DELETE' AND public.purge_mode() THEN RETURN OLD; END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Ausgestellte Rechnungen können nicht gelöscht werden.';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'draft' THEN RETURN NEW; END IF;
  IF NEW.status = 'draft' THEN
    RAISE EXCEPTION 'Eine ausgestellte Rechnung kann nicht zurück auf Entwurf gesetzt werden.';
  END IF;
  IF NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
     OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
     OR NEW.total_gross_minor IS DISTINCT FROM OLD.total_gross_minor
     OR NEW.tax_total_minor IS DISTINCT FROM OLD.tax_total_minor
     OR NEW.subtotal_net_minor IS DISTINCT FROM OLD.subtotal_net_minor
     OR NEW.seller_snapshot IS DISTINCT FROM OLD.seller_snapshot
     OR NEW.billing_address_snapshot IS DISTINCT FROM OLD.billing_address_snapshot
     OR NEW.tax_breakdown IS DISTINCT FROM OLD.tax_breakdown
     OR NEW.currency_code IS DISTINCT FROM OLD.currency_code
     OR NEW.order_id IS DISTINCT FROM OLD.order_id THEN
    RAISE EXCEPTION 'Fachliche Rechnungsdaten sind nach der Ausstellung unveränderbar.';
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.invoice_issue(_org uuid, _invoice uuid, _actor uuid, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE cached jsonb; inv public.invoices; num text; missing text[]; terms integer := 14; o public.orders;
BEGIN
  cached := public.inv_idem_get(_org, 'invoice_issue', _idem);
  IF cached IS NOT NULL THEN RETURN cached; END IF;
  PERFORM public.doc_assert(_actor, _org, 'invoices.issue');

  SELECT * INTO inv FROM public.invoices WHERE id = _invoice AND organization_id = _org FOR UPDATE;
  IF inv IS NULL THEN RAISE EXCEPTION 'Rechnung nicht gefunden.'; END IF;
  IF inv.status <> 'draft' THEN
    RETURN jsonb_build_object('invoice_id', inv.id, 'invoice_number', inv.invoice_number, 'issued', false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.invoice_items WHERE invoice_id = _invoice) THEN
    RAISE EXCEPTION 'Eine Rechnung ohne Positionen kann nicht ausgestellt werden.';
  END IF;

  missing := public.doc_setup_missing(inv.shop_id);
  IF missing && ARRAY['company','address','tax'] THEN
    RAISE EXCEPTION 'Rechnungseinstellungen unvollständig: %', array_to_string(missing, ', ');
  END IF;

  SELECT * INTO o FROM public.orders WHERE id = inv.order_id;
  SELECT coalesce(payment_terms_days, 14) INTO terms FROM public.invoice_settings WHERE shop_id = inv.shop_id;
  num := public.doc_next_number(_org, inv.shop_id, 'invoice');

  UPDATE public.invoices SET
    invoice_number = num,
    status = 'issued',
    issue_date = current_date,
    service_date = coalesce(inv.service_date, o.placed_at::date),
    due_date = current_date + terms,
    seller_snapshot = coalesce(public.doc_seller_snapshot(inv.shop_id), inv.seller_snapshot),
    branding_snapshot = public.doc_branding_snapshot(inv.shop_id),
    issued_at = now(),
    issued_by = _actor
  WHERE id = _invoice;

  PERFORM public.inv_audit(_org, _actor, 'invoice.issued', 'invoice', _invoice::text,
    jsonb_build_object('invoice_number', num, 'total_gross_minor', inv.total_gross_minor));
  PERFORM public.inv_event(_org, 'invoice.issued',
    jsonb_build_object('invoice_id', _invoice, 'invoice_number', num, 'order_id', inv.order_id));

  cached := jsonb_build_object('invoice_id', _invoice, 'invoice_number', num, 'issued', true);
  PERFORM public.inv_idem_put(_org, 'invoice_issue', _idem, cached);
  RETURN cached;
END; $function$;
