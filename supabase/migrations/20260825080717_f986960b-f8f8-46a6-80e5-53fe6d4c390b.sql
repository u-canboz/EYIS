-- ENUMS
CREATE TYPE public.product_status AS ENUM ('draft','active','archived');
CREATE TYPE public.blueprint_status AS ENUM ('draft','active','deprecated');

-- BLUEPRINTS
CREATE TABLE public.product_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  version integer NOT NULL DEFAULT 1,
  status public.blueprint_status NOT NULL DEFAULT 'active',
  is_system boolean NOT NULL DEFAULT false,
  schema jsonb NOT NULL DEFAULT '{"groups":[]}'::jsonb,
  ui_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  variant_schema jsonb NOT NULL DEFAULT '{"axes":[]}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blueprint_owner_check CHECK ((is_system AND organization_id IS NULL) OR (NOT is_system AND organization_id IS NOT NULL))
);
CREATE UNIQUE INDEX product_blueprints_system_key_version ON public.product_blueprints (key, version) WHERE is_system;
CREATE UNIQUE INDEX product_blueprints_org_key_version ON public.product_blueprints (organization_id, key, version) WHERE NOT is_system;
CREATE INDEX product_blueprints_org_idx ON public.product_blueprints (organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_blueprints TO authenticated;
GRANT ALL ON public.product_blueprints TO service_role;
ALTER TABLE public.product_blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY blueprints_select ON public.product_blueprints FOR SELECT TO authenticated
  USING (is_system OR public.is_org_member(auth.uid(), organization_id));
CREATE POLICY blueprints_insert ON public.product_blueprints FOR INSERT TO authenticated
  WITH CHECK (NOT is_system AND organization_id IS NOT NULL AND public.has_permission(auth.uid(), organization_id, 'blueprints.manage_custom'));
CREATE POLICY blueprints_update ON public.product_blueprints FOR UPDATE TO authenticated
  USING (NOT is_system AND public.has_permission(auth.uid(), organization_id, 'blueprints.manage_custom'))
  WITH CHECK (NOT is_system AND public.has_permission(auth.uid(), organization_id, 'blueprints.manage_custom'));
CREATE POLICY blueprints_delete ON public.product_blueprints FOR DELETE TO authenticated
  USING (NOT is_system AND public.has_permission(auth.uid(), organization_id, 'blueprints.manage_custom'));

CREATE TRIGGER product_blueprints_updated_at BEFORE UPDATE ON public.product_blueprints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- shop belongs to org helper
CREATE OR REPLACE FUNCTION public.shop_in_org(_shop_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = _shop_id AND s.organization_id = _org_id);
$$;
REVOKE ALL ON FUNCTION public.shop_in_org(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.shop_in_org(uuid, uuid) TO authenticated, service_role;

-- PRODUCTS
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  blueprint_id uuid REFERENCES public.product_blueprints(id),
  blueprint_key text NOT NULL DEFAULT 'standard',
  blueprint_version integer NOT NULL DEFAULT 1,
  name text NOT NULL,
  handle text NOT NULL,
  subtitle text,
  description text,
  status public.product_status NOT NULL DEFAULT 'draft',
  product_type text,
  vendor text,
  featured boolean NOT NULL DEFAULT false,
  seo_title text,
  seo_description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  blueprint_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CONSTRAINT products_shop_org_check CHECK (shop_id IS NOT NULL)
);
CREATE UNIQUE INDEX products_shop_handle_unique ON public.products (shop_id, handle);
CREATE INDEX products_org_idx ON public.products (organization_id);
CREATE INDEX products_shop_idx ON public.products (shop_id);
CREATE INDEX products_status_idx ON public.products (organization_id, status);
CREATE INDEX products_blueprint_idx ON public.products (blueprint_key);
CREATE INDEX products_updated_idx ON public.products (organization_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_select ON public.products FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY products_insert ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'products.create') AND public.shop_in_org(shop_id, organization_id));
CREATE POLICY products_update ON public.products FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'products.update'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'products.update') AND public.shop_in_org(shop_id, organization_id));

CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- OPTIONS
CREATE TABLE public.product_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  key text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  display_type text NOT NULL DEFAULT 'list',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX product_options_key_unique ON public.product_options (product_id, key);
CREATE INDEX product_options_product_idx ON public.product_options (product_id);

CREATE TABLE public.product_option_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id uuid NOT NULL REFERENCES public.product_options(id) ON DELETE CASCADE,
  value text NOT NULL,
  label text,
  position integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX product_option_values_unique ON public.product_option_values (option_id, value);
CREATE INDEX product_option_values_option_idx ON public.product_option_values (option_id);

-- VARIANTS
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  title text NOT NULL,
  sku text,
  barcode text,
  status public.entity_status NOT NULL DEFAULT 'active',
  position integer NOT NULL DEFAULT 0,
  option_signature text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX product_variants_sku_unique ON public.product_variants (organization_id, sku) WHERE sku IS NOT NULL AND sku <> '';
CREATE UNIQUE INDEX product_variants_combination_unique ON public.product_variants (product_id, option_signature);
CREATE INDEX product_variants_product_idx ON public.product_variants (product_id);
CREATE INDEX product_variants_org_idx ON public.product_variants (organization_id);

CREATE TABLE public.variant_option_values (
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.product_options(id) ON DELETE CASCADE,
  option_value_id uuid NOT NULL REFERENCES public.product_option_values(id) ON DELETE CASCADE,
  PRIMARY KEY (variant_id, option_id)
);
CREATE INDEX variant_option_values_value_idx ON public.variant_option_values (option_value_id);

-- CATEGORIES
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  handle text NOT NULL,
  description text,
  position integer NOT NULL DEFAULT 0,
  status public.entity_status NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX categories_shop_handle_unique ON public.categories (shop_id, handle);
CREATE INDEX categories_org_idx ON public.categories (organization_id);
CREATE INDEX categories_parent_idx ON public.categories (parent_id);

CREATE TABLE public.product_categories (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, category_id)
);
CREATE INDEX product_categories_category_idx ON public.product_categories (category_id);

-- COLLECTIONS
CREATE TABLE public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  handle text NOT NULL,
  description text,
  status public.entity_status NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX collections_shop_handle_unique ON public.collections (shop_id, handle);
CREATE INDEX collections_org_idx ON public.collections (organization_id);

CREATE TABLE public.product_collections (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, collection_id)
);
CREATE INDEX product_collections_collection_idx ON public.product_collections (collection_id);

-- MEDIA
CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  width integer,
  height integer,
  alt_text text,
  title text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX media_assets_path_unique ON public.media_assets (storage_path);
CREATE INDEX media_assets_org_idx ON public.media_assets (organization_id, created_at DESC);

CREATE TABLE public.product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  media_asset_id uuid NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  role text NOT NULL DEFAULT 'gallery',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_media_product_idx ON public.product_media (product_id, position);
CREATE INDEX product_media_asset_idx ON public.product_media (media_asset_id);
CREATE INDEX product_media_variant_idx ON public.product_media (variant_id);

-- GRANTS + RLS for remaining tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_options TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_option_values TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.variant_option_values TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_media TO authenticated;
GRANT ALL ON public.product_options TO service_role;
GRANT ALL ON public.product_option_values TO service_role;
GRANT ALL ON public.product_variants TO service_role;
GRANT ALL ON public.variant_option_values TO service_role;
GRANT ALL ON public.categories TO service_role;
GRANT ALL ON public.product_categories TO service_role;
GRANT ALL ON public.collections TO service_role;
GRANT ALL ON public.product_collections TO service_role;
GRANT ALL ON public.media_assets TO service_role;
GRANT ALL ON public.product_media TO service_role;

ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_options_select ON public.product_options FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.is_org_member(auth.uid(), p.organization_id)));
CREATE POLICY product_options_write ON public.product_options FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.has_permission(auth.uid(), p.organization_id, 'products.update')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.has_permission(auth.uid(), p.organization_id, 'products.update')));

CREATE POLICY product_option_values_select ON public.product_option_values FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.product_options o JOIN public.products p ON p.id = o.product_id WHERE o.id = option_id AND public.is_org_member(auth.uid(), p.organization_id)));
CREATE POLICY product_option_values_write ON public.product_option_values FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.product_options o JOIN public.products p ON p.id = o.product_id WHERE o.id = option_id AND public.has_permission(auth.uid(), p.organization_id, 'products.update')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.product_options o JOIN public.products p ON p.id = o.product_id WHERE o.id = option_id AND public.has_permission(auth.uid(), p.organization_id, 'products.update')));

CREATE POLICY product_variants_select ON public.product_variants FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY product_variants_write ON public.product_variants FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'products.update'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'products.update')
    AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.organization_id = organization_id));

CREATE POLICY variant_option_values_select ON public.variant_option_values FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.product_variants v WHERE v.id = variant_id AND public.is_org_member(auth.uid(), v.organization_id)));
CREATE POLICY variant_option_values_write ON public.variant_option_values FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.product_variants v WHERE v.id = variant_id AND public.has_permission(auth.uid(), v.organization_id, 'products.update')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.product_variants v WHERE v.id = variant_id AND public.has_permission(auth.uid(), v.organization_id, 'products.update')));

CREATE POLICY categories_select ON public.categories FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY categories_write ON public.categories FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'categories.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'categories.manage') AND public.shop_in_org(shop_id, organization_id));

CREATE POLICY product_categories_select ON public.product_categories FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.is_org_member(auth.uid(), p.organization_id)));
CREATE POLICY product_categories_write ON public.product_categories FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.has_permission(auth.uid(), p.organization_id, 'products.update')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.has_permission(auth.uid(), p.organization_id, 'products.update'))
    AND EXISTS (SELECT 1 FROM public.categories c WHERE c.id = category_id AND public.is_org_member(auth.uid(), c.organization_id)));

CREATE POLICY collections_select ON public.collections FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY collections_write ON public.collections FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'collections.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'collections.manage') AND public.shop_in_org(shop_id, organization_id));

CREATE POLICY product_collections_select ON public.product_collections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.is_org_member(auth.uid(), p.organization_id)));
CREATE POLICY product_collections_write ON public.product_collections FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.has_permission(auth.uid(), p.organization_id, 'products.update')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.has_permission(auth.uid(), p.organization_id, 'products.update'))
    AND EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND public.is_org_member(auth.uid(), c.organization_id)));

CREATE POLICY media_assets_select ON public.media_assets FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY media_assets_insert ON public.media_assets FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'media.upload'));
CREATE POLICY media_assets_update ON public.media_assets FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'media.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'media.manage'));
CREATE POLICY media_assets_delete ON public.media_assets FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'media.manage'));

CREATE POLICY product_media_select ON public.product_media FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.is_org_member(auth.uid(), p.organization_id)));
CREATE POLICY product_media_write ON public.product_media FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.has_permission(auth.uid(), p.organization_id, 'products.update')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND public.has_permission(auth.uid(), p.organization_id, 'products.update'))
    AND EXISTS (SELECT 1 FROM public.media_assets m WHERE m.id = media_asset_id AND public.is_org_member(auth.uid(), m.organization_id)));

CREATE TRIGGER product_options_updated_at BEFORE UPDATE ON public.product_options FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER product_variants_updated_at BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER collections_updated_at BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER media_assets_updated_at BEFORE UPDATE ON public.media_assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PERMISSIONS
INSERT INTO public.role_permissions (role, permission)
SELECT r.role::public.app_role, p.permission
FROM (VALUES
  ('owner','products.read'),('owner','products.create'),('owner','products.update'),('owner','products.archive'),
  ('owner','categories.read'),('owner','categories.manage'),('owner','collections.read'),('owner','collections.manage'),
  ('owner','media.read'),('owner','media.upload'),('owner','media.manage'),
  ('owner','blueprints.read'),('owner','blueprints.manage_custom'),
  ('administrator','products.read'),('administrator','products.create'),('administrator','products.update'),('administrator','products.archive'),
  ('administrator','categories.read'),('administrator','categories.manage'),('administrator','collections.read'),('administrator','collections.manage'),
  ('administrator','media.read'),('administrator','media.upload'),('administrator','media.manage'),
  ('administrator','blueprints.read'),('administrator','blueprints.manage_custom'),
  ('catalog_manager','products.read'),('catalog_manager','products.create'),('catalog_manager','products.update'),('catalog_manager','products.archive'),
  ('catalog_manager','categories.read'),('catalog_manager','categories.manage'),('catalog_manager','collections.read'),('catalog_manager','collections.manage'),
  ('catalog_manager','media.read'),('catalog_manager','media.upload'),('catalog_manager','media.manage'),
  ('catalog_manager','blueprints.read'),('catalog_manager','blueprints.manage_custom'),
  ('operations','products.read'),('operations','products.create'),('operations','products.update'),
  ('operations','categories.read'),('operations','categories.manage'),('operations','collections.read'),('operations','collections.manage'),
  ('operations','media.read'),('operations','media.upload'),('operations','blueprints.read'),
  ('marketing','products.read'),('marketing','products.update'),
  ('marketing','categories.read'),('marketing','collections.read'),('marketing','collections.manage'),
  ('marketing','media.read'),('marketing','media.upload'),('marketing','blueprints.read'),
  ('fulfillment','products.read'),('fulfillment','categories.read'),('fulfillment','collections.read'),('fulfillment','media.read'),('fulfillment','blueprints.read'),
  ('customer_support','products.read'),('customer_support','categories.read'),('customer_support','collections.read'),('customer_support','media.read'),('customer_support','blueprints.read'),
  ('finance','products.read'),('finance','categories.read'),('finance','collections.read'),('finance','media.read'),
  ('developer','products.read'),('developer','categories.read'),('developer','collections.read'),('developer','media.read'),('developer','blueprints.read'),
  ('read_only','products.read'),('read_only','categories.read'),('read_only','collections.read'),('read_only','media.read'),('read_only','blueprints.read')
) AS p(role, permission)
CROSS JOIN LATERAL (SELECT p.role AS role) r
ON CONFLICT DO NOTHING;

-- SYSTEM BLUEPRINTS
INSERT INTO public.product_blueprints (key, name, description, icon, version, is_system, schema, variant_schema) VALUES
('standard','Standardprodukt','Für alles, was keine besonderen Branchenangaben braucht.','package',1,true,
 '{"groups":[{"key":"basis","label":"Produktdetails","fields":[{"key":"sku","type":"text","label":"Artikelnummer (SKU)","description":"Optional, wenn du mit Varianten arbeitest."},{"key":"barcode","type":"text","label":"Barcode / EAN"},{"key":"hinweise","type":"textarea","label":"Interne Hinweise"}]}]}'::jsonb,
 '{"axes":[]}'::jsonb),
('textil','Textilien','Kleidung und Stoffe mit Größen, Farben und Pflegehinweisen.','shirt',1,true,
 '{"groups":[{"key":"produkt","label":"Produktangaben","fields":[{"key":"marke","type":"text","label":"Marke"},{"key":"material","type":"text","label":"Material"},{"key":"materialzusammensetzung","type":"key_value","label":"Materialzusammensetzung","description":"Zum Beispiel Baumwolle 80 %, Polyester 20 %."},{"key":"passform","type":"select","label":"Passform","options":["Slim","Regular","Oversized","Loose"]},{"key":"zielgruppe","type":"select","label":"Zielgruppe","options":["Damen","Herren","Unisex","Kinder"]},{"key":"saison","type":"select","label":"Saison","options":["Ganzjährig","Frühjahr/Sommer","Herbst/Winter"]}]},{"key":"pflege","label":"Pflege & Herkunft","fields":[{"key":"pflegehinweise","type":"tags","label":"Pflegehinweise","description":"Zum Beispiel 30 Grad Wäsche, nicht bleichen."},{"key":"herkunft","type":"text","label":"Herkunftsland"},{"key":"groessentabelle","type":"key_value","label":"Größentabelle","description":"Größe und Maße, zum Beispiel M = Brust 102 cm."}]}]}'::jsonb,
 '{"axes":[{"key":"groesse","name":"Größe","display_type":"chips","presets":["XXS","XS","S","M","L","XL","XXL","3XL"],"allow_custom":true},{"key":"farbe","name":"Farbe","display_type":"color","presets":["Schwarz","Weiß","Grau","Beige","Navy","Rot","Grün"],"allow_custom":true}]}'::jsonb),
('lebensmittel','Lebensmittel','Produkte mit Inhalt, Zutaten, Allergenen und Nährwerten.','apple',1,true,
 '{"groups":[{"key":"inhalt","label":"Inhalt","fields":[{"key":"inhalt","type":"number","label":"Inhalt"},{"key":"einheit","type":"select","label":"Einheit","options":["g","kg","ml","l","Stück"]},{"key":"grundpreiseinheit","type":"select","label":"Grundpreiseinheit","options":["100 g","1 kg","100 ml","1 l","1 Stück"]}]},{"key":"zusammensetzung","label":"Zusammensetzung","fields":[{"key":"zutaten","type":"textarea","label":"Zutaten"},{"key":"allergene","type":"multiselect","label":"Allergene","options":["Gluten","Krebstiere","Eier","Fisch","Erdnüsse","Soja","Milch","Schalenfrüchte","Sellerie","Senf","Sesam","Schwefeldioxid","Lupinen","Weichtiere"]},{"key":"naehrwerte","type":"key_value","label":"Nährwerte je 100 g/ml","description":"Zum Beispiel Energie = 250 kcal."},{"key":"alkoholgehalt","type":"measurement","label":"Alkoholgehalt","unit":"% vol"}]},{"key":"herkunft","label":"Herkunft & Lagerung","fields":[{"key":"herkunft","type":"text","label":"Herkunft"},{"key":"hersteller","type":"text","label":"Hersteller"},{"key":"aufbewahrung","type":"textarea","label":"Aufbewahrung"},{"key":"mhd_relevant","type":"boolean","label":"Mindesthaltbarkeitsdatum relevant"},{"key":"pfand_relevant","type":"boolean","label":"Pfand relevant"},{"key":"hinweise","type":"textarea","label":"Weitere Hinweise"}]}]}'::jsonb,
 '{"axes":[{"key":"groesse","name":"Größe / Inhalt","display_type":"chips","presets":[],"allow_custom":true}]}'::jsonb),
('kosmetik','Kosmetik','Pflege- und Beautyprodukte mit INCI und Anwendungshinweisen.','sparkles',1,true,
 '{"groups":[{"key":"inhalt","label":"Inhalt","fields":[{"key":"inhalt","type":"number","label":"Inhalt"},{"key":"einheit","type":"select","label":"Einheit","options":["ml","l","g","kg","Stück"]},{"key":"grundpreiseinheit","type":"select","label":"Grundpreiseinheit","options":["100 ml","1 l","100 g","1 kg"]}]},{"key":"details","label":"Produktangaben","fields":[{"key":"inci","type":"textarea","label":"INCI"},{"key":"hauttyp","type":"multiselect","label":"Hauttyp","options":["Normal","Trocken","Fettig","Mischhaut","Empfindlich","Reife Haut"]},{"key":"anwendung","type":"textarea","label":"Anwendung"},{"key":"warnhinweise","type":"textarea","label":"Warnhinweise"},{"key":"duft","type":"text","label":"Duft"},{"key":"farbe","type":"color","label":"Farbe"},{"key":"hersteller","type":"text","label":"Hersteller"},{"key":"herkunft","type":"text","label":"Herkunft"}]}]}'::jsonb,
 '{"axes":[{"key":"groesse","name":"Größe","display_type":"chips","presets":[],"allow_custom":true},{"key":"farbe","name":"Farbton","display_type":"color","presets":[],"allow_custom":true}]}'::jsonb),
('elektronik','Elektronik','Geräte mit technischen Spezifikationen und Lieferumfang.','cpu',1,true,
 '{"groups":[{"key":"geraet","label":"Gerät","fields":[{"key":"hersteller","type":"text","label":"Hersteller"},{"key":"modell","type":"text","label":"Modell"},{"key":"ean","type":"text","label":"EAN"},{"key":"leistung","type":"measurement","label":"Leistung","unit":"W"},{"key":"gewicht","type":"measurement","label":"Gewicht","unit":"g"},{"key":"abmessungen","type":"key_value","label":"Abmessungen","description":"Breite, Höhe, Tiefe."}]},{"key":"technik","label":"Technische Daten","fields":[{"key":"spezifikationen","type":"key_value","label":"Technische Spezifikationen"},{"key":"lieferumfang","type":"tags","label":"Lieferumfang"},{"key":"garantie","type":"textarea","label":"Garantiehinweise"}]}]}'::jsonb,
 '{"axes":[{"key":"farbe","name":"Farbe","display_type":"color","presets":["Schwarz","Weiß","Silber","Space Grau"],"allow_custom":true},{"key":"speicher","name":"Speicher","display_type":"chips","presets":["64 GB","128 GB","256 GB","512 GB","1 TB"],"allow_custom":true}]}'::jsonb),
('moebel','Möbel','Möbelstücke mit Maßen, Material und Montagehinweisen.','sofa',1,true,
 '{"groups":[{"key":"masse","label":"Maße","fields":[{"key":"breite","type":"measurement","label":"Breite","unit":"cm"},{"key":"hoehe","type":"measurement","label":"Höhe","unit":"cm"},{"key":"tiefe","type":"measurement","label":"Tiefe","unit":"cm"},{"key":"gewicht","type":"measurement","label":"Gewicht","unit":"kg"}]},{"key":"details","label":"Ausführung","fields":[{"key":"material","type":"text","label":"Material"},{"key":"farbe","type":"color","label":"Farbe"},{"key":"stil","type":"select","label":"Stil","options":["Modern","Skandinavisch","Industrial","Klassisch","Landhaus"]},{"key":"montage","type":"boolean","label":"Montage erforderlich"},{"key":"lieferumfang","type":"tags","label":"Lieferumfang"},{"key":"pflegehinweise","type":"textarea","label":"Pflegehinweise"}]}]}'::jsonb,
 '{"axes":[{"key":"farbe","name":"Farbe","display_type":"color","presets":["Eiche","Nussbaum","Weiß","Schwarz","Grau"],"allow_custom":true},{"key":"groesse","name":"Größe","display_type":"chips","presets":[],"allow_custom":true}]}'::jsonb),
('schmuck','Schmuck','Schmuckstücke mit Material, Steinen und Größen.','gem',1,true,
 '{"groups":[{"key":"art","label":"Art","fields":[{"key":"schmucktyp","type":"select","label":"Schmucktyp","options":["Ring","Kette","Armband","Ohrring","Anhänger"]},{"key":"material","type":"text","label":"Material"},{"key":"legierung","type":"text","label":"Legierung"},{"key":"farbe","type":"color","label":"Farbe"},{"key":"stein","type":"text","label":"Stein"},{"key":"gewicht","type":"measurement","label":"Gewicht","unit":"g"}]},{"key":"masse","label":"Maße","fields":[{"key":"ringgroesse","type":"text","label":"Ringgröße","visible_if":{"field":"schmucktyp","equals":"Ring"}},{"key":"laenge","type":"measurement","label":"Länge","unit":"cm","visible_if":{"field":"schmucktyp","in":["Kette","Armband"]}},{"key":"pflegehinweise","type":"textarea","label":"Pflegehinweise"}]}]}'::jsonb,
 '{"axes":[{"key":"groesse","name":"Größe","display_type":"chips","presets":[],"allow_custom":true},{"key":"material","name":"Material","display_type":"chips","presets":["Silber 925","Gold 585","Edelstahl"],"allow_custom":true}]}'::jsonb),
('digital','Digitales Produkt','Downloads und Lizenzen ohne Versand.','download',1,true,
 '{"groups":[{"key":"datei","label":"Datei & Lizenz","fields":[{"key":"dateityp","type":"select","label":"Dateityp","options":["PDF","ZIP","MP3","MP4","EPUB","Sonstiges"]},{"key":"datei","type":"media","label":"Download-Datei"},{"key":"lizenztyp","type":"select","label":"Lizenztyp","options":["Einzellizenz","Mehrplatzlizenz","Kommerziell","Privat"]},{"key":"downloadlimit","type":"number","label":"Downloadlimit"},{"key":"ablaufzeit","type":"number","label":"Ablaufzeit in Tagen"}]}]}'::jsonb,
 '{"axes":[]}'::jsonb),
('dienstleistung','Dienstleistung','Leistungen mit Dauer und Durchführungsort.','handshake',1,true,
 '{"groups":[{"key":"leistung","label":"Leistung","fields":[{"key":"leistungsart","type":"text","label":"Leistungsart"},{"key":"dauer","type":"measurement","label":"Dauer","unit":"Minuten"},{"key":"leistungsbeschreibung","type":"textarea","label":"Leistungsbeschreibung"},{"key":"ort","type":"select","label":"Ort","options":["Vor Ort","Remote","Hybrid"]},{"key":"vorbereitung","type":"textarea","label":"Vorbereitungshinweise"}]}]}'::jsonb,
 '{"axes":[]}'::jsonb);