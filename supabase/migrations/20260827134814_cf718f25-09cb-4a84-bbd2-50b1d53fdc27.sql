CREATE TYPE public.integration_category AS ENUM ('payment', 'email', 'carrier');
CREATE TYPE public.integration_status AS ENUM ('not_connected', 'setup_required', 'verification_required', 'connected', 'error', 'disabled');
CREATE TYPE public.integration_health_status AS ENUM ('healthy', 'warning', 'error', 'unknown');
CREATE TYPE public.sender_domain_status AS ENUM ('not_configured', 'dns_required', 'verifying', 'verified', 'error');

CREATE TABLE public.integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category public.integration_category NOT NULL,
  provider text NOT NULL,
  status public.integration_status NOT NULL DEFAULT 'not_connected',
  environment text NOT NULL DEFAULT 'test' CHECK (environment IN ('test', 'live')),
  configuration_reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, category, provider, environment)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_connections TO authenticated;
GRANT ALL ON public.integration_connections TO service_role;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ic_read" ON public.integration_connections FOR SELECT TO authenticated
  USING (
    CASE category
      WHEN 'payment' THEN public.has_permission(auth.uid(), organization_id, 'payment_settings.read')
      WHEN 'email' THEN public.has_permission(auth.uid(), organization_id, 'communications.read')
      WHEN 'carrier' THEN public.has_permission(auth.uid(), organization_id, 'shipping_settings.read')
    END
  );
CREATE POLICY "ic_write" ON public.integration_connections FOR ALL TO authenticated
  USING (
    CASE category
      WHEN 'payment' THEN public.has_permission(auth.uid(), organization_id, 'payment_settings.manage')
      WHEN 'email' THEN public.has_permission(auth.uid(), organization_id, 'communications.settings')
      WHEN 'carrier' THEN public.has_permission(auth.uid(), organization_id, 'shipping_settings.manage')
    END
  )
  WITH CHECK (
    CASE category
      WHEN 'payment' THEN public.has_permission(auth.uid(), organization_id, 'payment_settings.manage')
      WHEN 'email' THEN public.has_permission(auth.uid(), organization_id, 'communications.settings')
      WHEN 'carrier' THEN public.has_permission(auth.uid(), organization_id, 'shipping_settings.manage')
    END
  );
CREATE TRIGGER ic_updated BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.integration_health (
  connection_id uuid PRIMARY KEY REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  status public.integration_health_status NOT NULL DEFAULT 'unknown',
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_health TO authenticated;
GRANT ALL ON public.integration_health TO service_role;
ALTER TABLE public.integration_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ih_read" ON public.integration_health FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'payment_settings.read')
    OR public.has_permission(auth.uid(), organization_id, 'communications.read')
    OR public.has_permission(auth.uid(), organization_id, 'shipping_settings.read'));
CREATE POLICY "ih_write" ON public.integration_health FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'payment_settings.manage')
    OR public.has_permission(auth.uid(), organization_id, 'communications.settings')
    OR public.has_permission(auth.uid(), organization_id, 'shipping_settings.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'payment_settings.manage')
    OR public.has_permission(auth.uid(), organization_id, 'communications.settings')
    OR public.has_permission(auth.uid(), organization_id, 'shipping_settings.manage'));
CREATE TRIGGER ih_updated BEFORE UPDATE ON public.integration_health
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sender_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  domain text NOT NULL,
  status public.sender_domain_status NOT NULL DEFAULT 'dns_required',
  dns_records jsonb NOT NULL DEFAULT '[]'::jsonb,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, domain)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sender_domains TO authenticated;
GRANT ALL ON public.sender_domains TO service_role;
ALTER TABLE public.sender_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sd_read" ON public.sender_domains FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'communications.read'));
CREATE POLICY "sd_write" ON public.sender_domains FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'communications.settings'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'communications.settings'));
CREATE TRIGGER sd_updated BEFORE UPDATE ON public.sender_domains
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.sender_domain_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'verified' AND (OLD.status IS DISTINCT FROM 'verified')
     AND current_setting('request.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Domain-Verifizierung nur über serverseitige Prüfung möglich';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER sd_verify_guard BEFORE UPDATE ON public.sender_domains
  FOR EACH ROW EXECUTE FUNCTION public.sender_domain_guard();

ALTER TABLE public.sender_identities
  ADD COLUMN IF NOT EXISTS sender_domain_id uuid REFERENCES public.sender_domains(id) ON DELETE SET NULL;

CREATE TABLE public.oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash text NOT NULL UNIQUE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  provider text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.oauth_states TO service_role;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;