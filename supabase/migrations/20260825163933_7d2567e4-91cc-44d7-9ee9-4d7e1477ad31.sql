CREATE OR REPLACE FUNCTION public.credit_note_create(
  _org uuid, _invoice uuid, _actor uuid, _amount_minor bigint,
  _reason text DEFAULT NULL, _refund uuid DEFAULT NULL, _idem text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END; $$;
REVOKE EXECUTE ON FUNCTION public.credit_note_create(uuid, uuid, uuid, bigint, text, uuid, text) FROM PUBLIC, anon, authenticated;