-- Gate A4: least-privilege GRANTs. Alle Policies dieses Projekts adressieren
-- ausschließlich die Rolle authenticated; anon braucht keinerlei Tabellenrechte.
DO $$
DECLARE
  t record;
  cmds text;
BEGIN
  FOR t IN
    SELECT c.oid, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t.relname);

    SELECT string_agg(DISTINCT p, ', ')
      INTO cmds
      FROM (
        SELECT unnest(
          CASE pol.polcmd
            WHEN 'r' THEN ARRAY['SELECT']
            WHEN 'a' THEN ARRAY['INSERT']
            WHEN 'w' THEN ARRAY['UPDATE']
            WHEN 'd' THEN ARRAY['DELETE']
            ELSE ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
          END
        ) AS p
        FROM pg_policy pol
        WHERE pol.polrelid = t.oid
      ) s;

    IF cmds IS NOT NULL THEN
      EXECUTE format('GRANT %s ON public.%I TO authenticated', cmds, t.relname);
    END IF;

    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t.relname);
  END LOOP;
END $$;

-- Keine Standardrechte mehr für künftige Objekte an anon.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;