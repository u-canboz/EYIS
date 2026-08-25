REVOKE EXECUTE ON FUNCTION public.store_rate_hit(uuid, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.store_current_ip_salt() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_rate_hit(uuid, text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.store_current_ip_salt() TO service_role;