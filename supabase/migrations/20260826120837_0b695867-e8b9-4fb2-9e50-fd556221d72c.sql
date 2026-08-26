CREATE OR REPLACE FUNCTION public.protect_last_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_count INT;
BEGIN
  -- Wird die Organisation selbst gelöscht (Kaskade), greift der Schutz nicht.
  IF TG_OP = 'DELETE'
     AND NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = OLD.organization_id) THEN
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role <> 'owner' THEN
    SELECT count(*) INTO owner_count FROM public.memberships
      WHERE organization_id = OLD.organization_id AND role = 'owner';
    IF owner_count <= 1 THEN
      RAISE EXCEPTION 'Die letzte Inhaber-Rolle einer Organisation kann nicht herabgestuft werden.'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.role = 'owner' THEN
    SELECT count(*) INTO owner_count FROM public.memberships
      WHERE organization_id = OLD.organization_id AND role = 'owner';
    IF owner_count <= 1 THEN
      RAISE EXCEPTION 'Der letzte Inhaber einer Organisation kann nicht entfernt werden.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END; $$;

REVOKE ALL ON FUNCTION public.protect_last_owner() FROM PUBLIC, anon, authenticated;