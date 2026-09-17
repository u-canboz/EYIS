-- EYIS Baseline Unit 055 — Forward-Port der Migration 20260917131010.
-- Inhalt entspricht Byte-für-Byte der Migration; Fresh Install und Upgrade
-- erreichen damit denselben Schema-Zustand.

-- The installer journal is system infrastructure. Hosted default grants must
-- not expose it to API roles. Shared installations may have no journal yet.
DO $$
DECLARE journal text;
BEGIN
 FOREACH journal IN ARRAY ARRAY['eyis_installation_state','eyis_installation_units'] LOOP
  IF to_regclass('public.' || journal) IS NOT NULL THEN
   EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated',journal);
   EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role',journal);
  END IF;
 END LOOP;
END $$;
