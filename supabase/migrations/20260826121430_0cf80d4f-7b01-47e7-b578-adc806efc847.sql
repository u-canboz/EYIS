-- Purge-Modus: nur innerhalb einer expliziten Demo-/QA-Bereinigung aktiv
CREATE OR REPLACE FUNCTION public.purge_mode()
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(current_setting('app.purge_mode', true), '') = 'on'
$$;
REVOKE ALL ON FUNCTION public.purge_mode() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_mode() TO service_role;

-- Bestehende Schutz-Trigger um eine Purge-Ausnahme ergänzen (Definition bleibt sonst identisch)
DO $do$
DECLARE
  fn text;
  src text;
  patched text;
  names text[] := ARRAY[
    'audit_log_immutable','inventory_movements_immutable','payment_events_immutable',
    'tax_snapshot_immutable','snapshot_immutable','communication_snapshot_guard',
    'communication_provider_event_guard','invoice_guard','invoice_items_guard',
    'credit_note_guard','document_files_guard','fulfillment_items_guard',
    'automation_version_guard','comm_template_version_guard','protect_last_owner'
  ];
BEGIN
  FOREACH fn IN ARRAY names LOOP
    SELECT pg_get_functiondef(p.oid) INTO src
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = fn
     LIMIT 1;
    IF src IS NULL OR src LIKE '%purge_mode()%' THEN CONTINUE; END IF;
    patched := regexp_replace(
      src,
      E'\\mBEGIN\\M',
      'BEGIN IF TG_OP = ''DELETE'' AND public.purge_mode() THEN RETURN OLD; END IF;',
      ''
    );
    EXECUTE patched;
  END LOOP;
END
$do$;

-- Vollständige Entfernung einer Demo-/QA-Organisation
CREATE OR REPLACE FUNCTION public.demo_purge_organization(_org uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organizations o
     WHERE o.id = _org
       AND (
         o.slug LIKE 'qa-fixture%'
         OR o.slug LIKE 'commerce-os-demo%'
         OR EXISTS (SELECT 1 FROM public.demo_environments d WHERE d.organization_id = o.id)
         OR EXISTS (SELECT 1 FROM public.qa_fixtures f WHERE f.organization_id = o.id)
       )
  ) THEN
    RAISE EXCEPTION 'Nur Demo- oder QA-Organisationen dürfen vollständig entfernt werden.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM set_config('app.purge_mode', 'on', true);
  DELETE FROM public.payment_events WHERE organization_id = _org;
  DELETE FROM public.organizations WHERE id = _org;
  PERFORM set_config('app.purge_mode', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.demo_purge_organization(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_purge_organization(uuid) TO service_role;