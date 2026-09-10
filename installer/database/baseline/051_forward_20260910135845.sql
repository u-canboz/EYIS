-- EYIS Baseline Unit 051 — Forward-Port der Migration 20260910135845.
-- Inhalt entspricht Byte-für-Byte der Migration; Fresh Install und Upgrade
-- erreichen damit denselben Schema-Zustand.

REVOKE ALL ON TABLE public.provider_credentials FROM anon, authenticated;
REVOKE ALL ON TABLE public.update_runs FROM anon, authenticated;
REVOKE ALL ON TABLE public.update_run_steps FROM anon, authenticated;
REVOKE ALL ON TABLE public.commerce_installation FROM anon, authenticated;
