-- EYIS Database Install Pack — Funktionen: tax-shipping (tax-shipping-functions-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

CREATE OR REPLACE FUNCTION public.fulfillment_items_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE ordered integer; planned integer;
BEGIN IF TG_OP = 'DELETE' AND public.purge_mode() THEN RETURN OLD; END IF;
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
END; $function$;

CREATE OR REPLACE FUNCTION public.tax_snapshot_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN IF TG_OP = 'DELETE' AND public.purge_mode() THEN RETURN OLD; END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Snapshots sind unveränderbar.' USING ERRCODE = 'check_violation';
  END IF;
  -- The only permitted mutation: linking the snapshot to its order exactly once.
  IF OLD.order_id IS NULL AND NEW.order_id IS NOT NULL
     AND to_jsonb(NEW) - 'order_id' = to_jsonb(OLD) - 'order_id' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Snapshots sind unveränderbar.' USING ERRCODE = 'check_violation';
END; $function$;

CREATE OR REPLACE FUNCTION public.tracking_events_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'tracking_events ist append-only und darf nicht geändert oder gelöscht werden.'
    USING ERRCODE = 'insufficient_privilege';
END; $function$;
