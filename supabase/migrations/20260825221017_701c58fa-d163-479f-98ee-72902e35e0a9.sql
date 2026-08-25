CREATE OR REPLACE FUNCTION public.tax_snapshot_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Snapshots sind unveränderbar.' USING ERRCODE = 'check_violation';
  END IF;
  -- The only permitted mutation: linking the snapshot to its order exactly once.
  IF OLD.order_id IS NULL AND NEW.order_id IS NOT NULL
     AND to_jsonb(NEW) - 'order_id' = to_jsonb(OLD) - 'order_id' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Snapshots sind unveränderbar.' USING ERRCODE = 'check_violation';
END; $$;

DROP TRIGGER IF EXISTS tax_snapshots_immutable ON public.tax_snapshots;
CREATE TRIGGER tax_snapshots_immutable BEFORE UPDATE OR DELETE ON public.tax_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.tax_snapshot_immutable();