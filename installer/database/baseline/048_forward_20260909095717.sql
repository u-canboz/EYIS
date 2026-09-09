-- EYIS Baseline Unit 048 — Forward-Port der Migration 20260909095717.
-- Inhalt entspricht Byte-für-Byte der Migration; Fresh Install und Upgrade
-- erreichen damit denselben Schema-Zustand.

CREATE TABLE public.product_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  format text NOT NULL DEFAULT 'google_shopping_xml' CHECK (format IN ('google_shopping_xml','google_shopping_csv')),
  name text NOT NULL DEFAULT 'Google Shopping',
  token_prefix text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  base_url text,
  default_brand text,
  include_out_of_stock boolean NOT NULL DEFAULT true,
  last_downloaded_at timestamptz,
  last_item_count integer,
  created_by uuid,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_feeds TO authenticated;
GRANT ALL ON public.product_feeds TO service_role;

ALTER TABLE public.product_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_feeds_read ON public.product_feeds FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'developer.read'));
CREATE POLICY product_feeds_write ON public.product_feeds FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'developer.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'developer.manage')
    AND public.shop_in_org(shop_id, organization_id));

CREATE INDEX product_feeds_org_shop_idx ON public.product_feeds (organization_id, shop_id);

CREATE TRIGGER product_feeds_updated_at BEFORE UPDATE ON public.product_feeds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
