-- EYIS Baseline Unit 043 — Forward-Port der Migration 20260830131955.
-- Inhalt entspricht Byte-für-Byte der Migration; Fresh Install und Upgrade
-- erreichen damit denselben Schema-Zustand.

ALTER TABLE public.commerce_installation
  ADD COLUMN IF NOT EXISTS pending_owner_email text,
  ADD COLUMN IF NOT EXISTS pending_owner_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_owner_consumed_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_installation_owner_verified(
  _user_id uuid,
  _verified_email text,
  _org_name text,
  _org_slug text,
  _shop_name text,
  _shop_slug text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inst public.commerce_installation%ROWTYPE;
  new_org_id uuid;
  new_shop_id uuid;
BEGIN
  SELECT * INTO inst FROM public.commerce_installation WHERE singleton = true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSTALLATION_NOT_FOUND';
  END IF;
  IF inst.owner_claimed_at IS NOT NULL THEN
    RAISE EXCEPTION 'OWNER_ALREADY_CLAIMED';
  END IF;
  IF inst.pending_owner_email IS NULL OR inst.pending_owner_consumed_at IS NOT NULL THEN
    RAISE EXCEPTION 'OWNER_NOT_PREAUTHORIZED';
  END IF;
  IF _verified_email IS NULL
     OR lower(btrim(_verified_email)) <> lower(btrim(inst.pending_owner_email)) THEN
    RAISE EXCEPTION 'OWNER_NOT_PREAUTHORIZED';
  END IF;

  INSERT INTO public.organizations (name, slug) VALUES (_org_name, _org_slug) RETURNING id INTO new_org_id;
  INSERT INTO public.shops (organization_id, name, slug) VALUES (new_org_id, _shop_name, _shop_slug) RETURNING id INTO new_shop_id;
  INSERT INTO public.memberships (organization_id, user_id, role) VALUES (new_org_id, _user_id, 'owner');

  UPDATE public.commerce_installation
    SET owner_claimed_at = now(),
        pending_owner_consumed_at = now()
    WHERE singleton = true;

  RETURN jsonb_build_object('organization_id', new_org_id, 'shop_id', new_shop_id);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_installation_owner_verified(uuid, text, text, text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.claim_installation_owner_verified(uuid, text, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.claim_installation_owner_verified(uuid, text, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_installation_owner_verified(uuid, text, text, text, text, text) TO service_role;
