-- EYIS Database Install Pack — Funktionen: pricing (pricing-functions-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

CREATE OR REPLACE FUNCTION public.prices_validate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE conflict_count int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.price_sets ps
    WHERE ps.id = NEW.price_set_id AND ps.organization_id = NEW.organization_id AND ps.shop_id = NEW.shop_id) THEN
    RAISE EXCEPTION 'Price Set gehört nicht zu dieser Organisation oder diesem Shop.' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.customer_group_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.customer_groups cg
    WHERE cg.id = NEW.customer_group_id AND cg.organization_id = NEW.organization_id AND cg.shop_id = NEW.shop_id) THEN
    RAISE EXCEPTION 'Kundengruppe gehört nicht zu dieser Organisation oder diesem Shop.' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.type = 'tier' AND NEW.status = 'active' THEN
    SELECT count(*) INTO conflict_count FROM public.prices p
    WHERE p.price_set_id = NEW.price_set_id
      AND p.id <> NEW.id
      AND p.type = 'tier'
      AND p.status = 'active'
      AND p.currency_code = NEW.currency_code
      AND p.customer_group_id IS NOT DISTINCT FROM NEW.customer_group_id
      AND COALESCE(p.min_quantity, 1) <= COALESCE(NEW.max_quantity, 2147483647)
      AND COALESCE(NEW.min_quantity, 1) <= COALESCE(p.max_quantity, 2147483647);
    IF conflict_count > 0 THEN
      RAISE EXCEPTION 'Mengenstaffeln dürfen sich innerhalb eines Price Sets nicht überschneiden.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END; $function$;
