-- EYIS Database Install Pack — Funktionen: store-api (store-api-functions-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.shop_in_org(_shop_id uuid, _org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = _shop_id AND s.organization_id = _org_id);
$function$;

CREATE OR REPLACE FUNCTION public.store_current_ip_salt()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$;

CREATE OR REPLACE FUNCTION public.store_rate_hit(p_key_id uuid, p_profile text, p_bucket text, p_limit integer, p_window_seconds integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END; $function$;
