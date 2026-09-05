-- 1) Netzwerk-Erweiterung aus dem öffentlichen Schema entfernen
DROP EXTENSION IF EXISTS pg_net;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2) Ausführungsrechte aller public-Funktionen härten
DO $$
DECLARE
  r record;
  keep text[] := ARRAY[
    'has_permission','is_org_member','can_view_profile','shop_in_org',
    'has_org_role','has_role','current_org_ids','shares_org_with',
    'health_run_checks'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    IF r.proname = ANY(keep) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
  END LOOP;
END $$;

-- 3) Künftige Funktionen erhalten keine offenen Ausführungsrechte
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;