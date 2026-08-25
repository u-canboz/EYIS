CREATE OR REPLACE FUNCTION public.ops_expire_due()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  org record;
  sessions integer := 0;
  reservations integer := 0;
  carts integer := 0;
BEGIN
  sessions := coalesce((public.cart_expire_checkout_sessions(NULL) ->> 'expired_sessions')::int, 0);

  PERFORM set_config('commerce.system_op', 'on', true);
  FOR org IN
    SELECT DISTINCT organization_id FROM public.inventory_reservations
    WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= now()
    LIMIT 200
  LOOP
    reservations := reservations
      + coalesce((public.inv_expire_reservations(org.organization_id, NULL) ->> 'expired')::int, 0);
  END LOOP;
  PERFORM set_config('commerce.system_op', 'off', true);

  WITH due AS (
    SELECT id FROM public.carts
    WHERE status = 'active' AND expires_at <= now()
    ORDER BY expires_at
    LIMIT 1000
  )
  UPDATE public.carts c SET status = 'expired'
  FROM due WHERE c.id = due.id;
  GET DIAGNOSTICS carts = ROW_COUNT;

  RETURN jsonb_build_object(
    'expired_sessions', sessions,
    'expired_reservations', reservations,
    'expired_carts', carts
  );
END; $$;

REVOKE ALL ON FUNCTION public.ops_expire_due() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_expire_due() TO service_role;