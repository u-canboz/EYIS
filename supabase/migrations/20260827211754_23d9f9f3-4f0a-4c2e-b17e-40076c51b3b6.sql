CREATE TABLE public.provider_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category public.integration_category NOT NULL,
  provider text NOT NULL,
  environment text NOT NULL DEFAULT 'test' CHECK (environment IN ('test','live')),
  reference text NOT NULL UNIQUE,
  ciphertext text NOT NULL,
  iv text NOT NULL,
  key_version integer NOT NULL DEFAULT 1,
  hints jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, category, provider, environment)
);

GRANT ALL ON public.provider_credentials TO service_role;

ALTER TABLE public.provider_credentials ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER pc_updated BEFORE UPDATE ON public.provider_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sender_domains
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_reference text;