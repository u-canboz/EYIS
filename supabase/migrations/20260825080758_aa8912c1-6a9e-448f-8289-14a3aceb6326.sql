CREATE POLICY "media_read_own_org" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'media' AND public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid));

CREATE POLICY "media_insert_own_org" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND public.has_permission(auth.uid(), (storage.foldername(name))[1]::uuid, 'media.upload'));

CREATE POLICY "media_update_own_org" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND public.has_permission(auth.uid(), (storage.foldername(name))[1]::uuid, 'media.manage'))
  WITH CHECK (bucket_id = 'media' AND public.has_permission(auth.uid(), (storage.foldername(name))[1]::uuid, 'media.manage'));

CREATE POLICY "media_delete_own_org" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND public.has_permission(auth.uid(), (storage.foldername(name))[1]::uuid, 'media.manage'));