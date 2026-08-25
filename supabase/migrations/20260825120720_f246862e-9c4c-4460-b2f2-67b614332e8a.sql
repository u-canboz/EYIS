REVOKE ALL ON FUNCTION public.cart_start_checkout(uuid,uuid,uuid,uuid,uuid,text,integer,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cart_cancel_checkout(uuid,uuid,uuid,public.checkout_session_status,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cart_expire_checkout_sessions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cart_release_session_reservations(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cart_pick_location(uuid,uuid,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cart_start_checkout(uuid,uuid,uuid,uuid,uuid,text,integer,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cart_cancel_checkout(uuid,uuid,uuid,public.checkout_session_status,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cart_expire_checkout_sessions(uuid) TO service_role;