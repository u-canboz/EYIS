-- EYIS Database Install Pack — Funktionen: documents (documents-functions-b)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

CREATE OR REPLACE FUNCTION public.invoice_items_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE s public.invoice_status;
BEGIN IF TG_OP = 'DELETE' AND public.purge_mode() THEN RETURN OLD; END IF;
  SELECT status INTO s FROM public.invoices
   WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF s IS NOT NULL AND s <> 'draft' THEN
    RAISE EXCEPTION 'Positionen einer ausgestellten Rechnung sind unveränderbar.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $function$;

CREATE OR REPLACE FUNCTION public.invoice_void(_org uuid, _invoice uuid, _actor uuid, _reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE inv public.invoices;
BEGIN
  PERFORM public.doc_assert(_actor, _org, 'invoices.manage');
  SELECT * INTO inv FROM public.invoices WHERE id = _invoice AND organization_id = _org FOR UPDATE;
  IF inv IS NULL THEN RAISE EXCEPTION 'Rechnung nicht gefunden.'; END IF;

  IF inv.status = 'draft' THEN
    DELETE FROM public.invoice_items WHERE invoice_id = _invoice;
    DELETE FROM public.invoices WHERE id = _invoice;
    PERFORM public.inv_audit(_org, _actor, 'invoice.discarded', 'invoice', _invoice::text, '{}'::jsonb);
    RETURN jsonb_build_object('invoice_id', _invoice, 'deleted', true);
  END IF;

  IF inv.credited_minor > 0 THEN
    RAISE EXCEPTION 'Rechnungen mit Gutschriften können nicht storniert werden.';
  END IF;
  UPDATE public.invoices SET status = 'voided', voided_at = now(), void_reason = _reason WHERE id = _invoice;
  PERFORM public.inv_audit(_org, _actor, 'invoice.voided', 'invoice', _invoice::text,
    jsonb_build_object('reason', _reason));
  RETURN jsonb_build_object('invoice_id', _invoice, 'deleted', false);
END; $function$;
