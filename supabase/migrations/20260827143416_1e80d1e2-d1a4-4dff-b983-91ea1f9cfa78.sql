-- sender_domain_guard: Standard-PUBLIC-Grant entfernen (Rollen erben sonst über PUBLIC)
REVOKE EXECUTE ON FUNCTION public.sender_domain_guard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sender_domain_guard() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sender_domain_guard() FROM anon;