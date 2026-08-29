-- EYIS Database Install Pack — Funktionen: inventory (inventory-functions-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.inventory_movements_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN IF TG_OP = 'DELETE' AND public.purge_mode() THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'inventory_movements ist append-only und darf nicht geändert oder gelöscht werden.'
    USING ERRCODE = 'insufficient_privilege';
END; $function$;
