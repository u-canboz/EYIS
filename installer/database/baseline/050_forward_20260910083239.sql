-- EYIS Baseline Unit 050 — Forward-Port der Migration 20260910083239.
-- Inhalt entspricht Byte-für-Byte der Migration; Fresh Install und Upgrade
-- erreichen damit denselben Schema-Zustand.

CREATE TABLE public.storefront_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  shop_name text,
  claim text,
  logo_url text,
  favicon_url text,
  color_background text,
  color_foreground text,
  color_surface text,
  color_border text,
  color_accent text,
  color_accent_foreground text,
  color_deep text,
  font_display text,
  font_body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.storefront_branding TO authenticated;
GRANT ALL ON public.storefront_branding TO service_role;

ALTER TABLE public.storefront_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "storefront_branding_read" ON public.storefront_branding
  FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "storefront_branding_write" ON public.storefront_branding
  FOR ALL TO authenticated
  USING (has_permission(auth.uid(), organization_id, 'settings.manage'))
  WITH CHECK (has_permission(auth.uid(), organization_id, 'settings.manage') AND shop_in_org(shop_id, organization_id));

CREATE TRIGGER set_storefront_branding_updated_at
  BEFORE UPDATE ON public.storefront_branding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
