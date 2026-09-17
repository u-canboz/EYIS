-- The fresh Install Pack owns public schema objects; platform Storage policies
-- must also be restored for browser uploads. Keep existing customer policies.
-- A plain Postgres compatibility cluster has no storage.objects; Supabase does.
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='media_read_own_org') THEN
      CREATE POLICY media_read_own_org ON storage.objects FOR SELECT TO authenticated
        USING (bucket_id='media' AND public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='media_insert_own_org') THEN
      CREATE POLICY media_insert_own_org ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (bucket_id='media' AND public.has_permission(auth.uid(), (storage.foldername(name))[1]::uuid, 'media.upload'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='media_update_own_org') THEN
      CREATE POLICY media_update_own_org ON storage.objects FOR UPDATE TO authenticated
        USING (bucket_id='media' AND public.has_permission(auth.uid(), (storage.foldername(name))[1]::uuid, 'media.manage'))
        WITH CHECK (bucket_id='media' AND public.has_permission(auth.uid(), (storage.foldername(name))[1]::uuid, 'media.manage'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='media_delete_own_org') THEN
      CREATE POLICY media_delete_own_org ON storage.objects FOR DELETE TO authenticated
        USING (bucket_id='media' AND public.has_permission(auth.uid(), (storage.foldername(name))[1]::uuid, 'media.manage'));
    END IF;
  END IF;
END $$;
