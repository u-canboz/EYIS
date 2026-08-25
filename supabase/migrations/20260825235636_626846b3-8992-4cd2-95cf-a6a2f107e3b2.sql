-- 1. Profiles: co-member visibility only for org administrators
CREATE OR REPLACE FUNCTION public.can_view_profile(_other_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _other_user = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.memberships a
        JOIN public.memberships b ON b.organization_id = a.organization_id
        WHERE a.user_id = auth.uid()
          AND b.user_id = _other_user
          AND public.has_permission(auth.uid(), a.organization_id, 'settings.manage')
      );
$$;

REVOKE ALL ON FUNCTION public.can_view_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS profiles_select_self ON public.profiles;
CREATE POLICY profiles_select_self ON public.profiles
FOR SELECT TO authenticated
USING (public.can_view_profile(id));

-- 2. Customer addresses: split the blanket ALL policy into scoped commands
DROP POLICY IF EXISTS customer_addresses_self ON public.customer_addresses;

CREATE POLICY customer_addresses_self_select ON public.customer_addresses
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.customers c
  WHERE c.id = customer_addresses.customer_id
    AND c.auth_user_id = auth.uid()
));

CREATE POLICY customer_addresses_self_insert ON public.customer_addresses
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.customers c
  WHERE c.id = customer_addresses.customer_id
    AND c.auth_user_id = auth.uid()
    AND c.status = 'active'
    AND c.organization_id = customer_addresses.organization_id
    AND c.shop_id IS NOT DISTINCT FROM customer_addresses.shop_id
));

CREATE POLICY customer_addresses_self_update ON public.customer_addresses
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.customers c
  WHERE c.id = customer_addresses.customer_id
    AND c.auth_user_id = auth.uid()
    AND c.status = 'active'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.customers c
  WHERE c.id = customer_addresses.customer_id
    AND c.auth_user_id = auth.uid()
    AND c.status = 'active'
    AND c.organization_id = customer_addresses.organization_id
    AND c.shop_id IS NOT DISTINCT FROM customer_addresses.shop_id
));

CREATE POLICY customer_addresses_self_delete ON public.customer_addresses
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.customers c
  WHERE c.id = customer_addresses.customer_id
    AND c.auth_user_id = auth.uid()
    AND c.status = 'active'
));

-- 3. Storage: documents upload requires the document permission, not mere membership
DROP POLICY IF EXISTS documents_write ON storage.objects;
CREATE POLICY documents_write ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.has_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'documents.settings')
);

-- 4. Remove leftover PUBLIC/anon/authenticated EXECUTE on internal trigger functions
REVOKE ALL ON FUNCTION public.automation_version_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_note_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.document_files_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoice_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoice_items_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.payment_events_immutable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snapshot_immutable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tax_snapshot_immutable() FROM PUBLIC, anon, authenticated;