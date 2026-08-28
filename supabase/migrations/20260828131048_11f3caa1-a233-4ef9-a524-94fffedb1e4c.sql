-- Phase 21: Dedicated Deployment — installationsweiter Zustand (Singleton) + atomarer Owner-Claim

CREATE TABLE public.commerce_installation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true,
  installation_id text NOT NULL UNIQUE,
  mode text NOT NULL DEFAULT 'shared' CHECK (mode IN ('shared','dedicated')),
  core_version text NOT NULL,
  schema_version text,
  api_version text NOT NULL DEFAULT 'v1',
  sdk_version text,
  installed_at timestamptz NOT NULL DEFAULT now(),
  last_migrated_at timestamptz,
  owner_claimed_at timestamptz,
  setup_completed_at timestamptz,
  health_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  setup_progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  storefront_origin text,
  claim_token_hash text,
  claim_token_expires_at timestamptz,
  claim_token_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_installation_singleton UNIQUE (singleton)
);

GRANT ALL ON public.commerce_installation TO service_role;

ALTER TABLE public.commerce_installation ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER commerce_installation_updated BEFORE UPDATE ON public.commerce_installation
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Atomarer First-Owner-Claim: prüft den Token-Hash und erzeugt in EINER Transaktion
-- Organization, Main Shop und Owner-Membership. Parallele Claims: genau ein Gewinner
-- (Singleton-Zeile wird mit FOR UPDATE gesperrt). Nur service_role darf ausführen.
CREATE OR REPLACE FUNCTION public.claim_installation_owner(
  _claim_hash text,
  _user_id uuid,
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
  IF inst.claim_token_hash IS NULL
     OR inst.claim_token_used_at IS NOT NULL
     OR inst.claim_token_expires_at IS NULL
     OR inst.claim_token_expires_at < now()
     OR inst.claim_token_hash <> _claim_hash THEN
    RAISE EXCEPTION 'CLAIM_INVALID';
  END IF;

  INSERT INTO public.organizations (name, slug) VALUES (_org_name, _org_slug) RETURNING id INTO new_org_id;
  INSERT INTO public.shops (organization_id, name, slug) VALUES (new_org_id, _shop_name, _shop_slug) RETURNING id INTO new_shop_id;
  INSERT INTO public.memberships (organization_id, user_id, role) VALUES (new_org_id, _user_id, 'owner');

  UPDATE public.commerce_installation
    SET owner_claimed_at = now(), claim_token_used_at = now()
    WHERE singleton = true;

  RETURN jsonb_build_object('organization_id', new_org_id, 'shop_id', new_shop_id);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_installation_owner(text, uuid, text, text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.claim_installation_owner(text, uuid, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.claim_installation_owner(text, uuid, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_installation_owner(text, uuid, text, text, text, text) TO service_role;