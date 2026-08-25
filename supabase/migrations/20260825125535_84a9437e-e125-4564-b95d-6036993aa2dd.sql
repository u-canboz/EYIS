REVOKE EXECUTE ON FUNCTION public.order_next_number(uuid,uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.order_finalize_from_payment(uuid,uuid,text,bigint,text,uuid,text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.order_cancel(uuid,uuid,uuid,text,text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_create(uuid,uuid,uuid,bigint,text,text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_settle(uuid,uuid,public.refund_status,text,text,text) FROM anon, authenticated;