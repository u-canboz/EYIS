-- Phase 12: Storefront SDK & Public Store API

CREATE TABLE public.store_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  environment public.commerce_environment NOT NULL DEFAULT 'test',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  allowed_origins text[] NOT NULL DEFAULT '{}',
  rate_limit_profile text NOT NULL DEFAULT 'default',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  last_used_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_api_keys TO authenticated;
GRANT ALL ON public.store_api_keys TO service_role;
ALTER TABLE public.store_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY sak_read ON public.store_api_keys FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'developer.read'));
CREATE POLICY sak_write ON public.store_api_keys FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'developer.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'developer.manage')
    AND public.shop_in_org(shop_id, organization_id));
CREATE INDEX store_api_keys_org_idx ON public.store_api_keys (organization_id, shop_id);
CREATE TRIGGER store_api_keys_updated_at BEFORE UPDATE ON public.store_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.store_api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  key_id uuid REFERENCES public.store_api_keys(id) ON DELETE SET NULL,
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  method text NOT NULL,
  route text NOT NULL,
  status_code integer NOT NULL,
  duration_ms integer NOT NULL DEFAULT 0,
  ip_hash text,
  user_agent_summary text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_api_request_logs TO authenticated;
GRANT ALL ON public.store_api_request_logs TO service_role;
ALTER TABLE public.store_api_request_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY sarl_read ON public.store_api_request_logs FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'developer.read'));
CREATE INDEX store_api_logs_org_time_idx ON public.store_api_request_logs (organization_id, created_at DESC);
CREATE INDEX store_api_logs_request_idx ON public.store_api_request_logs (request_id);

-- Rotating salt so ip_hash is never permanently reversible or linkable over time.
CREATE TABLE public.store_privacy_salts (
  salt_date date PRIMARY KEY,
  salt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.store_privacy_salts TO service_role;
ALTER TABLE public.store_privacy_salts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.store_current_ip_salt()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_salt text;
BEGIN
  INSERT INTO public.store_privacy_salts (salt_date, salt)
  VALUES (current_date, encode(gen_random_bytes(32),'hex'))
  ON CONFLICT (salt_date) DO NOTHING;
  SELECT salt INTO v_salt FROM public.store_privacy_salts WHERE salt_date = current_date;
  DELETE FROM public.store_privacy_salts WHERE salt_date < current_date - 2;
  UPDATE public.store_api_request_logs SET ip_hash = NULL
    WHERE ip_hash IS NOT NULL AND created_at < now() - interval '30 days';
  RETURN v_salt;
END; $$;

CREATE TABLE public.store_api_rate_counters (
  key_id uuid NOT NULL,
  profile text NOT NULL,
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key_id, profile, bucket, window_start)
);
GRANT ALL ON public.store_api_rate_counters TO service_role;
ALTER TABLE public.store_api_rate_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.store_rate_hit(
  p_key_id uuid, p_profile text, p_bucket text, p_limit integer, p_window_seconds integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_start timestamptz; v_hits integer;
BEGIN
  v_start := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  INSERT INTO public.store_api_rate_counters (key_id, profile, bucket, window_start, hits)
  VALUES (p_key_id, p_profile, p_bucket, v_start, 1)
  ON CONFLICT (key_id, profile, bucket, window_start)
  DO UPDATE SET hits = public.store_api_rate_counters.hits + 1
  RETURNING hits INTO v_hits;
  DELETE FROM public.store_api_rate_counters WHERE window_start < now() - interval '1 hour';
  RETURN jsonb_build_object(
    'allowed', v_hits <= p_limit,
    'hits', v_hits,
    'limit', p_limit,
    'reset_at', v_start + make_interval(secs => p_window_seconds));
END; $$;

-- Short-lived, single-use confirmation token issued at checkout completion.
CREATE TABLE public.store_confirmation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.store_confirmation_tokens TO service_role;
ALTER TABLE public.store_confirmation_tokens ENABLE ROW LEVEL SECURITY;
CREATE INDEX store_confirmation_tokens_order_idx ON public.store_confirmation_tokens (order_id);

INSERT INTO public.role_permissions (role, permission) VALUES
  ('owner','developer.read'),('owner','developer.manage'),
  ('administrator','developer.read'),('administrator','developer.manage'),
  ('developer','developer.read'),('developer','developer.manage'),
  ('operations','developer.read')
ON CONFLICT DO NOTHING;