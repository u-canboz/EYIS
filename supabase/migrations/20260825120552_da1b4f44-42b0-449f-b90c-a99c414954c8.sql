-- ============ ENUMS ============
CREATE TYPE public.cart_status AS ENUM ('active','checkout','completed','abandoned','expired');
CREATE TYPE public.checkout_session_status AS ENUM ('open','validated','awaiting_payment','completed','expired','cancelled');
CREATE TYPE public.checkout_address_type AS ENUM ('shipping','billing');
CREATE TYPE public.shipping_pricing_type AS ENUM ('fixed','free');

-- ============ SHIPPING METHODS ============
CREATE TABLE public.shipping_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  description text,
  pricing_type public.shipping_pricing_type NOT NULL DEFAULT 'fixed',
  amount_minor bigint NOT NULL DEFAULT 0,
  currency_code text NOT NULL,
  status public.entity_status NOT NULL DEFAULT 'active',
  countries text[] NOT NULL DEFAULT '{}',
  min_subtotal_minor bigint,
  max_subtotal_minor bigint,
  free_above_minor bigint,
  position integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, code)
);
GRANT SELECT ON public.shipping_methods TO authenticated;
GRANT ALL ON public.shipping_methods TO service_role;
ALTER TABLE public.shipping_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shipping_methods_read" ON public.shipping_methods FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'shipping_methods.read'));

-- ============ CARTS ============
CREATE TABLE public.carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id uuid,
  anonymous_token_hash text,
  status public.cart_status NOT NULL DEFAULT 'active',
  currency_code text NOT NULL,
  customer_email text,
  region_code text,
  locale text NOT NULL DEFAULT 'de',
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  abandoned_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX carts_org_shop_idx ON public.carts (organization_id, shop_id);
CREATE INDEX carts_status_idx ON public.carts (status);
CREATE INDEX carts_customer_idx ON public.carts (customer_id);
CREATE INDEX carts_expires_idx ON public.carts (expires_at);
CREATE UNIQUE INDEX carts_token_hash_idx ON public.carts (anonymous_token_hash) WHERE anonymous_token_hash IS NOT NULL;
GRANT SELECT ON public.carts TO authenticated;
GRANT ALL ON public.carts TO service_role;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carts_read" ON public.carts FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'carts.read'));

-- ============ CART ITEMS ============
CREATE TABLE public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  title_snapshot text NOT NULL,
  variant_title_snapshot text NOT NULL,
  sku_snapshot text,
  image_snapshot text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, variant_id)
);
CREATE INDEX cart_items_cart_idx ON public.cart_items (cart_id);
CREATE INDEX cart_items_variant_idx ON public.cart_items (variant_id);
CREATE INDEX cart_items_org_shop_idx ON public.cart_items (organization_id, shop_id);
GRANT SELECT ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cart_items_read" ON public.cart_items FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'carts.read'));

-- ============ CART PRICE SNAPSHOTS ============
CREATE TABLE public.cart_price_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  version integer NOT NULL,
  currency_code text NOT NULL,
  subtotal_minor bigint NOT NULL DEFAULT 0,
  discount_minor bigint NOT NULL DEFAULT 0,
  shipping_minor bigint NOT NULL DEFAULT 0,
  tax_minor bigint NOT NULL DEFAULT 0,
  total_minor bigint NOT NULL DEFAULT 0,
  pricing_engine_version text NOT NULL,
  pricing_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculation_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, version)
);
CREATE INDEX cart_price_snapshots_cart_idx ON public.cart_price_snapshots (cart_id, version DESC);
GRANT SELECT ON public.cart_price_snapshots TO authenticated;
GRANT ALL ON public.cart_price_snapshots TO service_role;
ALTER TABLE public.cart_price_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cart_price_snapshots_read" ON public.cart_price_snapshots FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'carts.read'));

CREATE TABLE public.cart_item_price_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  snapshot_id uuid NOT NULL REFERENCES public.cart_price_snapshots(id) ON DELETE CASCADE,
  cart_item_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  quantity integer NOT NULL,
  unit_base_minor bigint NOT NULL DEFAULT 0,
  unit_resolved_minor bigint NOT NULL DEFAULT 0,
  line_subtotal_minor bigint NOT NULL DEFAULT 0,
  line_discount_minor bigint NOT NULL DEFAULT 0,
  line_total_minor bigint NOT NULL DEFAULT 0,
  applied_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  applied_promotions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cart_item_price_snapshots_snapshot_idx ON public.cart_item_price_snapshots (snapshot_id);
GRANT SELECT ON public.cart_item_price_snapshots TO authenticated;
GRANT ALL ON public.cart_item_price_snapshots TO service_role;
ALTER TABLE public.cart_item_price_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cart_item_price_snapshots_read" ON public.cart_item_price_snapshots FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'carts.read'));

-- ============ CART PROMOTION CODES ============
CREATE TABLE public.cart_promotion_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  promotion_id uuid REFERENCES public.promotions(id) ON DELETE SET NULL,
  code_snapshot text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, code_snapshot)
);
CREATE INDEX cart_promotion_codes_cart_idx ON public.cart_promotion_codes (cart_id);
GRANT SELECT ON public.cart_promotion_codes TO authenticated;
GRANT ALL ON public.cart_promotion_codes TO service_role;
ALTER TABLE public.cart_promotion_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cart_promotion_codes_read" ON public.cart_promotion_codes FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'carts.read'));

-- ============ CHECKOUT SESSIONS ============
CREATE TABLE public.checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  status public.checkout_session_status NOT NULL DEFAULT 'open',
  customer_id uuid,
  email text,
  shipping_address_id uuid,
  billing_address_id uuid,
  billing_same_as_shipping boolean NOT NULL DEFAULT true,
  shipping_option_id uuid REFERENCES public.shipping_methods(id) ON DELETE SET NULL,
  price_snapshot_id uuid REFERENCES public.cart_price_snapshots(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '20 minutes',
  validated_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX checkout_sessions_cart_idx ON public.checkout_sessions (cart_id);
CREATE INDEX checkout_sessions_status_idx ON public.checkout_sessions (status);
CREATE INDEX checkout_sessions_expires_idx ON public.checkout_sessions (expires_at);
CREATE INDEX checkout_sessions_org_shop_idx ON public.checkout_sessions (organization_id, shop_id);
CREATE UNIQUE INDEX checkout_sessions_one_open_per_cart ON public.checkout_sessions (cart_id)
  WHERE status IN ('open','validated','awaiting_payment');
GRANT SELECT ON public.checkout_sessions TO authenticated;
GRANT ALL ON public.checkout_sessions TO service_role;
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkout_sessions_read" ON public.checkout_sessions FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'checkout.read'));

-- ============ CHECKOUT ADDRESSES ============
CREATE TABLE public.checkout_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  checkout_session_id uuid NOT NULL REFERENCES public.checkout_sessions(id) ON DELETE CASCADE,
  type public.checkout_address_type NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  company text,
  street text NOT NULL,
  street2 text,
  postal_code text NOT NULL,
  city text NOT NULL,
  state text,
  country_code text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checkout_session_id, type)
);
CREATE INDEX checkout_addresses_session_idx ON public.checkout_addresses (checkout_session_id);
GRANT SELECT ON public.checkout_addresses TO authenticated;
GRANT ALL ON public.checkout_addresses TO service_role;
ALTER TABLE public.checkout_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkout_addresses_read" ON public.checkout_addresses FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'checkout.read'));

ALTER TABLE public.checkout_sessions
  ADD CONSTRAINT checkout_sessions_shipping_address_fk
  FOREIGN KEY (shipping_address_id) REFERENCES public.checkout_addresses(id) ON DELETE SET NULL;
ALTER TABLE public.checkout_sessions
  ADD CONSTRAINT checkout_sessions_billing_address_fk
  FOREIGN KEY (billing_address_id) REFERENCES public.checkout_addresses(id) ON DELETE SET NULL;

-- ============ CHECKOUT RESERVATIONS ============
CREATE TABLE public.checkout_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  checkout_session_id uuid NOT NULL REFERENCES public.checkout_sessions(id) ON DELETE CASCADE,
  inventory_reservation_id uuid NOT NULL REFERENCES public.inventory_reservations(id) ON DELETE CASCADE,
  cart_item_id uuid NOT NULL,
  quantity integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX checkout_reservations_session_idx ON public.checkout_reservations (checkout_session_id);
CREATE INDEX checkout_reservations_cart_idx ON public.checkout_reservations (cart_id);
GRANT SELECT ON public.checkout_reservations TO authenticated;
GRANT ALL ON public.checkout_reservations TO service_role;
ALTER TABLE public.checkout_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkout_reservations_read" ON public.checkout_reservations FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'checkout.read'));

-- ============ CHECKOUT SNAPSHOTS ============
CREATE TABLE public.checkout_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  checkout_session_id uuid NOT NULL REFERENCES public.checkout_sessions(id) ON DELETE CASCADE,
  version integer NOT NULL,
  cart_snapshot_id uuid REFERENCES public.cart_price_snapshots(id) ON DELETE SET NULL,
  email text,
  shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  billing_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  shipping_method jsonb NOT NULL DEFAULT '{}'::jsonb,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  promotions jsonb NOT NULL DEFAULT '[]'::jsonb,
  currency_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checkout_session_id, version)
);
CREATE INDEX checkout_snapshots_session_idx ON public.checkout_snapshots (checkout_session_id, version DESC);
GRANT SELECT ON public.checkout_snapshots TO authenticated;
GRANT ALL ON public.checkout_snapshots TO service_role;
ALTER TABLE public.checkout_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkout_snapshots_read" ON public.checkout_snapshots FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'checkout.read'));

-- ============ IMMUTABILITY ============
CREATE OR REPLACE FUNCTION public.snapshot_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Snapshots sind unveränderbar.' USING ERRCODE = 'check_violation';
END; $$;

CREATE TRIGGER cart_price_snapshots_immutable BEFORE UPDATE OR DELETE ON public.cart_price_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_immutable();
CREATE TRIGGER cart_item_price_snapshots_immutable BEFORE UPDATE OR DELETE ON public.cart_item_price_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_immutable();
CREATE TRIGGER checkout_snapshots_immutable BEFORE UPDATE OR DELETE ON public.checkout_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_immutable();

-- ============ UPDATED_AT ============
CREATE TRIGGER shipping_methods_updated_at BEFORE UPDATE ON public.shipping_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER carts_updated_at BEFORE UPDATE ON public.carts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER cart_items_updated_at BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER checkout_sessions_updated_at BEFORE UPDATE ON public.checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER checkout_addresses_updated_at BEFORE UPDATE ON public.checkout_addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PERMISSIONS ============
INSERT INTO public.role_permissions (role, permission) VALUES
  ('owner','carts.read'),('owner','carts.manage'),('owner','checkout.read'),('owner','checkout.manage'),
  ('owner','shipping_methods.read'),('owner','shipping_methods.manage'),
  ('administrator','carts.read'),('administrator','carts.manage'),('administrator','checkout.read'),
  ('administrator','checkout.manage'),('administrator','shipping_methods.read'),('administrator','shipping_methods.manage'),
  ('operations','carts.read'),('operations','carts.manage'),('operations','checkout.read'),
  ('operations','checkout.manage'),('operations','shipping_methods.read'),('operations','shipping_methods.manage'),
  ('catalog_manager','carts.read'),('catalog_manager','checkout.read'),('catalog_manager','shipping_methods.read'),
  ('fulfillment','carts.read'),('fulfillment','checkout.read'),('fulfillment','shipping_methods.read'),
  ('customer_support','carts.read'),('customer_support','carts.manage'),('customer_support','checkout.read'),
  ('customer_support','shipping_methods.read'),
  ('finance','carts.read'),('finance','checkout.read'),('finance','shipping_methods.read'),
  ('marketing','carts.read'),('marketing','checkout.read'),('marketing','shipping_methods.read'),
  ('developer','carts.read'),('developer','checkout.read'),('developer','shipping_methods.read'),
  ('read_only','carts.read'),('read_only','checkout.read'),('read_only','shipping_methods.read')
ON CONFLICT DO NOTHING;