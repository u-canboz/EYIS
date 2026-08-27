-- oauth_states: service-role-only — keine direkten Tabellenrechte für App-Rollen
REVOKE ALL ON public.oauth_states FROM authenticated;
REVOKE ALL ON public.oauth_states FROM anon;