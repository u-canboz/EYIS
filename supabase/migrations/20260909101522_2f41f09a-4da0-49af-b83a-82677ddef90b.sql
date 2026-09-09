CREATE TABLE public.storefront_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  section text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  title text,
  subtitle text,
  body text,
  image_url text,
  link_url text,
  link_label text,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storefront_blocks TO authenticated;
GRANT ALL ON public.storefront_blocks TO service_role;
ALTER TABLE public.storefront_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY storefront_blocks_read ON public.storefront_blocks FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY storefront_blocks_write ON public.storefront_blocks FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'settings.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'settings.manage')
    AND public.shop_in_org(shop_id, organization_id));
CREATE INDEX storefront_blocks_shop_idx ON public.storefront_blocks (shop_id, section, position);
CREATE TRIGGER storefront_blocks_updated_at BEFORE UPDATE ON public.storefront_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.storefront_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  handle text NOT NULL,
  title text NOT NULL,
  excerpt text,
  body text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, handle)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storefront_pages TO authenticated;
GRANT ALL ON public.storefront_pages TO service_role;
ALTER TABLE public.storefront_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY storefront_pages_read ON public.storefront_pages FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY storefront_pages_write ON public.storefront_pages FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'settings.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'settings.manage')
    AND public.shop_in_org(shop_id, organization_id));
CREATE TRIGGER storefront_pages_updated_at BEFORE UPDATE ON public.storefront_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.search_synonyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  term text NOT NULL,
  synonyms text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, term)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_synonyms TO authenticated;
GRANT ALL ON public.search_synonyms TO service_role;
ALTER TABLE public.search_synonyms ENABLE ROW LEVEL SECURITY;
CREATE POLICY search_synonyms_read ON public.search_synonyms FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY search_synonyms_write ON public.search_synonyms FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'settings.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'settings.manage')
    AND public.shop_in_org(shop_id, organization_id));
CREATE TRIGGER search_synonyms_updated_at BEFORE UPDATE ON public.search_synonyms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.merchant_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google_merchant',
  merchant_id text,
  account_label text,
  status text NOT NULL DEFAULT 'not_connected' CHECK (status IN ('not_connected','connected','error','disabled')),
  credential_reference text,
  data_source_id text,
  auto_sync boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_connections TO authenticated;
GRANT ALL ON public.merchant_connections TO service_role;
ALTER TABLE public.merchant_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY merchant_connections_read ON public.merchant_connections FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'developer.read'));
CREATE POLICY merchant_connections_write ON public.merchant_connections FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'developer.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'developer.manage')
    AND public.shop_in_org(shop_id, organization_id));
CREATE TRIGGER merchant_connections_updated_at BEFORE UPDATE ON public.merchant_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.merchant_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.merchant_connections(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  trigger_source text NOT NULL DEFAULT 'manual',
  items_total integer NOT NULL DEFAULT 0,
  items_ok integer NOT NULL DEFAULT 0,
  items_failed integer NOT NULL DEFAULT 0,
  message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT ON public.merchant_sync_runs TO authenticated;
GRANT ALL ON public.merchant_sync_runs TO service_role;
ALTER TABLE public.merchant_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY merchant_sync_runs_read ON public.merchant_sync_runs FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'developer.read'));
CREATE INDEX merchant_sync_runs_conn_idx ON public.merchant_sync_runs (connection_id, started_at DESC);

CREATE TABLE public.merchant_sync_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.merchant_sync_runs(id) ON DELETE CASCADE,
  offer_id text,
  product_title text,
  code text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.merchant_sync_errors TO authenticated;
GRANT ALL ON public.merchant_sync_errors TO service_role;
ALTER TABLE public.merchant_sync_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY merchant_sync_errors_read ON public.merchant_sync_errors FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'developer.read'));
CREATE INDEX merchant_sync_errors_run_idx ON public.merchant_sync_errors (run_id, created_at DESC);