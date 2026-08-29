-- EYIS Database Install Pack — Funktionen: foundation (foundation-functions-f)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.refund_settle(_org uuid, _refund uuid, _status refund_status, _provider text DEFAULT NULL::text, _provider_refund_id text DEFAULT NULL::text, _error text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE rf public.refunds; o public.orders; completed_sum bigint;
BEGIN
  SELECT * INTO rf FROM public.refunds WHERE id = _refund AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Erstattung nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
  IF rf.status = _status THEN RETURN jsonb_build_object('refund_id', rf.id, 'status', rf.status, 'changed', false); END IF;

  UPDATE public.refunds SET status = _status, provider = COALESCE(_provider, provider),
    provider_refund_id = COALESCE(_provider_refund_id, provider_refund_id), error_message = _error
  WHERE id = rf.id;

  SELECT * INTO o FROM public.orders WHERE id = rf.order_id FOR UPDATE;
  SELECT COALESCE(SUM(amount_minor), 0) INTO completed_sum FROM public.refunds
  WHERE order_id = o.id AND status = 'completed';

  UPDATE public.orders SET refunded_minor = completed_sum,
    payment_status = CASE
      WHEN completed_sum >= o.total_minor AND completed_sum > 0 THEN 'refunded'::public.order_payment_status
      WHEN completed_sum > 0 THEN 'partially_refunded'::public.order_payment_status
      ELSE o.payment_status END
  WHERE id = o.id;

  IF _status = 'completed' THEN
    INSERT INTO public.payment_transactions (organization_id, order_id, provider, type, amount_minor,
      currency_code, provider_transaction_id)
    VALUES (_org, o.id,
      COALESCE(_provider, rf.provider, 'unknown'),
      CASE WHEN completed_sum >= o.total_minor THEN 'refund'::public.payment_transaction_type
           ELSE 'partial_refund'::public.payment_transaction_type END,
      rf.amount_minor, rf.currency_code, _provider_refund_id);
    PERFORM public.inv_event(_org, 'refund.completed',
      jsonb_build_object('refund_id', rf.id, 'order_id', o.id, 'amount_minor', rf.amount_minor));
  END IF;

  PERFORM public.inv_audit(_org, NULL, 'refund.' || _status::text, 'refund', rf.id::text,
    jsonb_build_object('order_id', o.id, 'amount_minor', rf.amount_minor));

  RETURN jsonb_build_object('refund_id', rf.id, 'status', _status, 'changed', true,
    'refunded_total_minor', completed_sum);
END; $function$;

CREATE OR REPLACE FUNCTION public.ret_assert(_actor uuid, _org uuid, _perm text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _actor IS NULL OR NOT public.has_permission(_actor, _org, _perm) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diese Retourenaktion.' USING ERRCODE = 'insufficient_privilege';
  END IF;
END; $function$;

CREATE OR REPLACE FUNCTION public.ret_authorize(_org uuid, _return uuid, _actor uuid, _instructions text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.returns;
BEGIN
  PERFORM public.ret_assert(_actor, _org, 'returns.approve');
  SELECT * INTO r FROM public.returns WHERE id = _return AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retoure nicht gefunden.' USING ERRCODE = 'no_data_found'; END IF;
  IF r.status <> 'requested' THEN RAISE EXCEPTION 'Nur angefragte Retouren können genehmigt werden.' USING ERRCODE = 'check_violation'; END IF;
  UPDATE public.returns SET status = 'authorized', authorized_at = now(),
    metadata = metadata || jsonb_build_object('return_instructions', _instructions)
  WHERE id = _return;
  PERFORM public.inv_audit(_org, _actor, 'return.authorized', 'return', _return::text, '{}'::jsonb);
  PERFORM public.inv_event(_org, 'return.authorized', jsonb_build_object('return_id', _return));
  RETURN jsonb_build_object('status', 'authorized');
END; $function$;

CREATE OR REPLACE FUNCTION public.ret_cancel(_org uuid, _return uuid, _actor uuid, _by_customer boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.returns;
BEGIN
  IF NOT _by_customer THEN PERFORM public.ret_assert(_actor, _org, 'returns.manage'); END IF;
  SELECT * INTO r FROM public.returns WHERE id = _return AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retoure nicht gefunden.' USING ERRCODE = 'no_data_found'; END IF;
  IF r.status NOT IN ('requested','authorized','in_transit') THEN
    RAISE EXCEPTION 'Retoure kann nicht mehr storniert werden.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.returns SET status = 'cancelled', cancelled_at = now() WHERE id = _return;
  PERFORM public.inv_event(_org, 'return.cancelled', jsonb_build_object('return_id', _return));
  RETURN jsonb_build_object('status', 'cancelled');
END; $function$;

CREATE OR REPLACE FUNCTION public.ret_complete(_org uuid, _return uuid, _actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.returns;
BEGIN
  PERFORM public.ret_assert(_actor, _org, 'returns.manage');
  SELECT * INTO r FROM public.returns WHERE id = _return AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retoure nicht gefunden.' USING ERRCODE = 'no_data_found'; END IF;
  IF r.status NOT IN ('approved','partially_approved','refunded') THEN
    RAISE EXCEPTION 'Retoure kann noch nicht abgeschlossen werden.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.returns SET status = 'completed', completed_at = now() WHERE id = _return;
  PERFORM public.inv_event(_org, 'return.completed', jsonb_build_object('return_id', _return));
  RETURN jsonb_build_object('status', 'completed');
END; $function$;

CREATE OR REPLACE FUNCTION public.ret_inspect(_org uuid, _return uuid, _actor uuid, _items jsonb, _shipping_mode shipping_refund_mode, _shipping_minor bigint, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.returns; it jsonb; ri public.return_items; oi public.order_items;
  amt bigint; total bigint := 0; approved_sum integer := 0; requested_sum integer := 0;
  new_status public.return_status; res jsonb;
BEGIN
  res := public.inv_idem_get(_org, 'ret_inspect', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.ret_assert(_actor, _org, 'returns.inspect');
  SELECT * INTO r FROM public.returns WHERE id = _return AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retoure nicht gefunden.' USING ERRCODE = 'no_data_found'; END IF;
  IF r.status NOT IN ('received','inspection') THEN
    RAISE EXCEPTION 'Prüfung ist in diesem Status nicht möglich.' USING ERRCODE = 'check_violation';
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb)) LOOP
    SELECT * INTO ri FROM public.return_items
      WHERE id = (it ->> 'return_item_id')::uuid AND return_id = _return FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Retourenposition nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
    SELECT * INTO oi FROM public.order_items WHERE id = ri.order_item_id;
    IF (it ->> 'quantity_approved')::int > GREATEST(ri.quantity_received, 0) THEN
      RAISE EXCEPTION 'Genehmigte Menge überschreitet die eingegangene Menge.' USING ERRCODE = 'check_violation';
    END IF;
    -- historical, proportional amount: paid line total after discount, never current prices
    amt := CASE WHEN oi.quantity > 0
      THEN round(COALESCE(oi.gross_minor, oi.line_total_minor)::numeric
                 * (it ->> 'quantity_approved')::int / oi.quantity)::bigint
      ELSE 0 END;
    UPDATE public.return_items
    SET quantity_approved = (it ->> 'quantity_approved')::int,
        condition = COALESCE((it ->> 'condition')::public.return_item_condition, condition),
        restock_decision = COALESCE((it ->> 'restock_decision')::public.restock_decision, restock_decision),
        inspection_note = COALESCE(it ->> 'note', inspection_note),
        refund_amount_minor = amt
    WHERE id = ri.id;
    total := total + amt;
  END LOOP;

  SELECT COALESCE(SUM(quantity_approved),0), COALESCE(SUM(quantity_requested),0)
  INTO approved_sum, requested_sum FROM public.return_items WHERE return_id = _return;

  total := total + GREATEST(COALESCE(_shipping_minor, 0), 0);
  IF approved_sum = 0 THEN new_status := 'rejected';
  ELSIF approved_sum < requested_sum THEN new_status := 'partially_approved';
  ELSE new_status := 'approved';
  END IF;

  UPDATE public.returns
  SET status = new_status, inspected_at = now(), refund_total_minor = total,
      shipping_refund_mode = COALESCE(_shipping_mode, shipping_refund_mode),
      shipping_refund_minor = GREATEST(COALESCE(_shipping_minor, 0), 0),
      rejection_reason = CASE WHEN new_status = 'rejected'
        THEN COALESCE(rejection_reason, 'Keine Position genehmigt.') ELSE rejection_reason END
  WHERE id = _return;

  PERFORM public.inv_audit(_org, _actor, 'return.inspected', 'return', _return::text,
    jsonb_build_object('approved', approved_sum, 'requested', requested_sum));
  PERFORM public.inv_event(_org, 'return.' || CASE WHEN new_status = 'partially_approved'
    THEN 'partially_approved' WHEN new_status = 'approved' THEN 'approved' ELSE 'rejected' END,
    jsonb_build_object('return_id', _return, 'refund_total_minor', total));

  res := jsonb_build_object('status', new_status, 'refund_total_minor', total);
  PERFORM public.inv_idem_put(_org, 'ret_inspect', _idem, res);
  RETURN res;
END; $function$;

CREATE OR REPLACE FUNCTION public.ret_link_settlement(_org uuid, _return uuid, _actor uuid, _refund uuid, _credit_note uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.returns
  SET refund_id = COALESCE(_refund, refund_id),
      credit_note_id = COALESCE(_credit_note, credit_note_id),
      status = CASE WHEN _refund IS NOT NULL THEN 'refunded'::public.return_status ELSE status END
  WHERE id = _return AND organization_id = _org;
  PERFORM public.inv_event(_org, 'return.refunded',
    jsonb_build_object('return_id', _return, 'refund_id', _refund, 'credit_note_id', _credit_note));
  RETURN jsonb_build_object('status', 'linked');
END; $function$;

CREATE OR REPLACE FUNCTION public.ret_mark_in_transit(_org uuid, _return uuid, _actor uuid, _shipment uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.returns;
BEGIN
  PERFORM public.ret_assert(_actor, _org, 'returns.manage');
  SELECT * INTO r FROM public.returns WHERE id = _return AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retoure nicht gefunden.' USING ERRCODE = 'no_data_found'; END IF;
  IF r.status <> 'authorized' THEN RAISE EXCEPTION 'Retoure ist nicht genehmigt.' USING ERRCODE = 'check_violation'; END IF;
  UPDATE public.returns SET status = 'in_transit', return_shipment_id = COALESCE(_shipment, return_shipment_id)
  WHERE id = _return;
  PERFORM public.inv_event(_org, 'return.in_transit', jsonb_build_object('return_id', _return));
  RETURN jsonb_build_object('status', 'in_transit');
END; $function$;

CREATE OR REPLACE FUNCTION public.ret_next_number(_org uuid, _shop uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE seq public.return_sequences; v bigint; y integer := EXTRACT(YEAR FROM now())::int;
BEGIN
  INSERT INTO public.return_sequences (shop_id, organization_id)
  VALUES (_shop, _org) ON CONFLICT (shop_id) DO NOTHING;
  SELECT * INTO seq FROM public.return_sequences WHERE shop_id = _shop FOR UPDATE;
  IF seq.year <> y THEN
    UPDATE public.return_sequences SET year = y, next_value = 1 WHERE shop_id = _shop RETURNING * INTO seq;
  END IF;
  v := seq.next_value;
  UPDATE public.return_sequences SET next_value = next_value + 1 WHERE shop_id = _shop;
  RETURN seq.prefix || '-' || y::text || '-' || lpad(v::text, seq.padding, '0');
END; $function$;

CREATE OR REPLACE FUNCTION public.ret_receive(_org uuid, _return uuid, _actor uuid, _items jsonb, _idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.returns; it jsonb; ri public.return_items; res jsonb;
BEGIN
  res := public.inv_idem_get(_org, 'ret_receive', _idem);
  IF res IS NOT NULL THEN RETURN res; END IF;
  PERFORM public.ret_assert(_actor, _org, 'returns.inspect');
  SELECT * INTO r FROM public.returns WHERE id = _return AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retoure nicht gefunden.' USING ERRCODE = 'no_data_found'; END IF;
  IF r.status NOT IN ('authorized','in_transit','received') THEN
    RAISE EXCEPTION 'Wareneingang ist in diesem Status nicht möglich.' USING ERRCODE = 'check_violation';
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb)) LOOP
    SELECT * INTO ri FROM public.return_items
      WHERE id = (it ->> 'return_item_id')::uuid AND return_id = _return FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Retourenposition nicht gefunden.' USING ERRCODE = 'check_violation'; END IF;
    IF (it ->> 'quantity_received')::int > ri.quantity_requested THEN
      RAISE EXCEPTION 'Eingegangene Menge überschreitet die angefragte Menge.' USING ERRCODE = 'check_violation';
    END IF;
    UPDATE public.return_items
    SET quantity_received = (it ->> 'quantity_received')::int,
        condition = COALESCE((it ->> 'condition')::public.return_item_condition, condition)
    WHERE id = ri.id;
  END LOOP;

  UPDATE public.returns SET status = 'received', received_at = COALESCE(received_at, now()) WHERE id = _return;
  PERFORM public.inv_audit(_org, _actor, 'return.received', 'return', _return::text, '{}'::jsonb);
  PERFORM public.inv_event(_org, 'return.received', jsonb_build_object('return_id', _return));
  res := jsonb_build_object('status', 'received');
  PERFORM public.inv_idem_put(_org, 'ret_receive', _idem, res);
  RETURN res;
END; $function$;

CREATE OR REPLACE FUNCTION public.ret_reject(_org uuid, _return uuid, _actor uuid, _reason text, _internal text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.returns;
BEGIN
  PERFORM public.ret_assert(_actor, _org, 'returns.approve');
  IF _reason IS NULL OR length(btrim(_reason)) = 0 THEN
    RAISE EXCEPTION 'Ablehnung benötigt einen Grund.' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO r FROM public.returns WHERE id = _return AND organization_id = _org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Retoure nicht gefunden.' USING ERRCODE = 'no_data_found'; END IF;
  IF r.status NOT IN ('requested','inspection','received') THEN
    RAISE EXCEPTION 'Diese Retoure kann nicht mehr abgelehnt werden.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.returns SET status = 'rejected', rejection_reason = _reason,
    internal_note = COALESCE(_internal, internal_note), completed_at = now()
  WHERE id = _return;
  PERFORM public.inv_audit(_org, _actor, 'return.rejected', 'return', _return::text, '{}'::jsonb);
  PERFORM public.inv_event(_org, 'return.rejected', jsonb_build_object('return_id', _return));
  RETURN jsonb_build_object('status', 'rejected');
END; $function$;
