-- ============ ENUMS ============
CREATE TYPE public.price_type AS ENUM ('base','sale','tier','customer_group','override');
CREATE TYPE public.promotion_type AS ENUM ('percentage','fixed_amount','fixed_price','buy_x_get_y','free_shipping');

-- ============ CUSTOMER GROUPS ============
CREATE TABLE public.customer_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  handle text NOT NULL,
  description text,
  status public.entity_status NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_groups_shop_in_org CHECK (true)
);
CREATE UNIQUE INDEX customer_groups_shop_handle_idx ON public.customer_groups(shop_id, handle);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_groups TO authenticated;
GRANT ALL ON public.customer_groups TO service_role;
ALTER TABLE public.customer_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer_groups_read" ON public.customer_groups FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) AND public.has_permission(auth.uid(), organization_id, 'customer_groups.read'));
CREATE POLICY "customer_groups_write" ON public.customer_groups FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'customer_groups.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'customer_groups.manage') AND public.shop_in_org(shop_id, organization_id));
CREATE TRIGGER customer_groups_updated_at BEFORE UPDATE ON public.customer_groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PRICE SETS ============
CREATE TABLE public.price_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  status public.entity_status NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT price_sets_exactly_one_target CHECK (
    (product_id IS NOT NULL AND variant_id IS NULL) OR (product_id IS NULL AND variant_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX price_sets_product_idx ON public.price_sets(product_id) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX price_sets_variant_idx ON public.price_sets(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX price_sets_shop_idx ON public.price_sets(shop_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_sets TO authenticated;
GRANT ALL ON public.price_sets TO service_role;
ALTER TABLE public.price_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_sets_read" ON public.price_sets FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) AND public.has_permission(auth.uid(), organization_id, 'pricing.read'));
CREATE POLICY "price_sets_write" ON public.price_sets FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'pricing.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'pricing.manage') AND public.shop_in_org(shop_id, organization_id));
CREATE TRIGGER price_sets_updated_at BEFORE UPDATE ON public.price_sets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PRICES ============
CREATE TABLE public.prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  price_set_id uuid NOT NULL REFERENCES public.price_sets(id) ON DELETE CASCADE,
  currency_code text NOT NULL,
  amount_minor bigint NOT NULL,
  type public.price_type NOT NULL DEFAULT 'base',
  starts_at timestamptz,
  ends_at timestamptz,
  min_quantity integer,
  max_quantity integer,
  customer_group_id uuid REFERENCES public.customer_groups(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 0,
  status public.entity_status NOT NULL DEFAULT 'active',
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prices_amount_non_negative CHECK (amount_minor >= 0),
  CONSTRAINT prices_currency_format CHECK (currency_code ~ '^[A-Z]{3}$'),
  CONSTRAINT prices_period_valid CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at),
  CONSTRAINT prices_min_qty_positive CHECK (min_quantity IS NULL OR min_quantity > 0),
  CONSTRAINT prices_max_qty_valid CHECK (max_quantity IS NULL OR (min_quantity IS NOT NULL AND max_quantity >= min_quantity)),
  CONSTRAINT prices_tier_needs_min CHECK (type <> 'tier' OR min_quantity IS NOT NULL),
  CONSTRAINT prices_group_needs_group CHECK (type <> 'customer_group' OR customer_group_id IS NOT NULL)
);
CREATE INDEX prices_set_idx ON public.prices(price_set_id, currency_code, status);
CREATE INDEX prices_group_idx ON public.prices(customer_group_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prices TO authenticated;
GRANT ALL ON public.prices TO service_role;
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prices_read" ON public.prices FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) AND public.has_permission(auth.uid(), organization_id, 'pricing.read'));
CREATE POLICY "prices_write" ON public.prices FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'pricing.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'pricing.manage') AND public.shop_in_org(shop_id, organization_id));
CREATE TRIGGER prices_updated_at BEFORE UPDATE ON public.prices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Integrity: referenced price_set / customer_group must belong to same org+shop; no overlapping tiers
CREATE OR REPLACE FUNCTION public.prices_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE conflict_count int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.price_sets ps
    WHERE ps.id = NEW.price_set_id AND ps.organization_id = NEW.organization_id AND ps.shop_id = NEW.shop_id) THEN
    RAISE EXCEPTION 'Price Set gehört nicht zu dieser Organisation oder diesem Shop.' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.customer_group_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.customer_groups cg
    WHERE cg.id = NEW.customer_group_id AND cg.organization_id = NEW.organization_id AND cg.shop_id = NEW.shop_id) THEN
    RAISE EXCEPTION 'Kundengruppe gehört nicht zu dieser Organisation oder diesem Shop.' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.type = 'tier' AND NEW.status = 'active' THEN
    SELECT count(*) INTO conflict_count FROM public.prices p
    WHERE p.price_set_id = NEW.price_set_id
      AND p.id <> NEW.id
      AND p.type = 'tier'
      AND p.status = 'active'
      AND p.currency_code = NEW.currency_code
      AND p.customer_group_id IS NOT DISTINCT FROM NEW.customer_group_id
      AND COALESCE(p.min_quantity, 1) <= COALESCE(NEW.max_quantity, 2147483647)
      AND COALESCE(NEW.min_quantity, 1) <= COALESCE(p.max_quantity, 2147483647);
    IF conflict_count > 0 THEN
      RAISE EXCEPTION 'Mengenstaffeln dürfen sich innerhalb eines Price Sets nicht überschneiden.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END; $$;
CREATE TRIGGER prices_validate_trg BEFORE INSERT OR UPDATE ON public.prices
  FOR EACH ROW EXECUTE FUNCTION public.prices_validate();
REVOKE ALL ON FUNCTION public.prices_validate() FROM PUBLIC, anon, authenticated;

-- ============ PROMOTIONS ============
CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  code text,
  type public.promotion_type NOT NULL,
  value bigint NOT NULL DEFAULT 0,
  currency_code text,
  status public.entity_status NOT NULL DEFAULT 'inactive',
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer,
  usage_limit_per_customer integer,
  priority integer NOT NULL DEFAULT 0,
  stackable boolean NOT NULL DEFAULT true,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promotions_value_non_negative CHECK (value >= 0),
  CONSTRAINT promotions_percentage_range CHECK (type <> 'percentage' OR (value >= 0 AND value <= 10000)),
  CONSTRAINT promotions_period_valid CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at),
  CONSTRAINT promotions_currency_format CHECK (currency_code IS NULL OR currency_code ~ '^[A-Z]{3}$'),
  CONSTRAINT promotions_usage_limits CHECK (
    (usage_limit IS NULL OR usage_limit > 0) AND (usage_limit_per_customer IS NULL OR usage_limit_per_customer > 0)
  )
);
CREATE UNIQUE INDEX promotions_shop_code_idx ON public.promotions(shop_id, upper(code)) WHERE code IS NOT NULL;
CREATE INDEX promotions_shop_status_idx ON public.promotions(shop_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promotions_read" ON public.promotions FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) AND public.has_permission(auth.uid(), organization_id, 'promotions.read'));
CREATE POLICY "promotions_write" ON public.promotions FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'promotions.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'promotions.manage') AND public.shop_in_org(shop_id, organization_id));
CREATE TRIGGER promotions_updated_at BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ BULK PRICE UPDATE (atomic) ============
CREATE OR REPLACE FUNCTION public.bulk_update_prices(
  _org_id uuid,
  _price_ids uuid[],
  _mode text,
  _amount_minor bigint,
  _percent_bp integer
)
RETURNS TABLE (id uuid, old_amount bigint, new_amount bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _mode NOT IN ('set','increase_percent','decrease_percent','increase_amount','decrease_amount') THEN
    RAISE EXCEPTION 'Unbekannter Bulk-Modus.' USING ERRCODE = 'check_violation';
  END IF;

  RETURN QUERY
  WITH target AS (
    SELECT p.id AS pid, p.amount_minor AS old_amt,
      CASE _mode
        WHEN 'set' THEN _amount_minor
        WHEN 'increase_percent' THEN round(p.amount_minor * (10000 + _percent_bp)::numeric / 10000)
        WHEN 'decrease_percent' THEN round(p.amount_minor * (10000 - _percent_bp)::numeric / 10000)
        WHEN 'increase_amount' THEN p.amount_minor + _amount_minor
        WHEN 'decrease_amount' THEN p.amount_minor - _amount_minor
      END::bigint AS new_amt
    FROM public.prices p
    WHERE p.id = ANY(_price_ids) AND p.organization_id = _org_id
  ), updated AS (
    UPDATE public.prices p
    SET amount_minor = GREATEST(t.new_amt, 0)
    FROM target t
    WHERE p.id = t.pid
    RETURNING p.id, t.old_amt, p.amount_minor
  )
  SELECT * FROM updated;
END; $$;
REVOKE ALL ON FUNCTION public.bulk_update_prices(uuid, uuid[], text, bigint, integer) FROM PUBLIC, anon, authenticated;

-- ============ PERMISSIONS ============
INSERT INTO public.role_permissions (role, permission) VALUES
  ('owner','pricing.read'),('owner','pricing.manage'),('owner','promotions.read'),('owner','promotions.manage'),('owner','customer_groups.read'),('owner','customer_groups.manage'),
  ('administrator','pricing.read'),('administrator','pricing.manage'),('administrator','promotions.read'),('administrator','promotions.manage'),('administrator','customer_groups.read'),('administrator','customer_groups.manage'),
  ('finance','pricing.read'),('finance','pricing.manage'),('finance','promotions.read'),('finance','customer_groups.read'),
  ('catalog_manager','pricing.read'),('catalog_manager','pricing.manage'),('catalog_manager','customer_groups.read'),('catalog_manager','promotions.read'),
  ('marketing','promotions.read'),('marketing','promotions.manage'),('marketing','pricing.read'),('marketing','customer_groups.read'),
  ('operations','pricing.read'),('operations','promotions.read'),('operations','customer_groups.read'),
  ('developer','pricing.read'),('developer','promotions.read'),('developer','customer_groups.read'),
  ('customer_support','pricing.read'),('customer_support','promotions.read'),
  ('read_only','pricing.read'),('read_only','promotions.read'),('read_only','customer_groups.read')
ON CONFLICT DO NOTHING;