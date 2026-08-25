-- ============ ENUMS ============
CREATE TYPE public.location_type AS ENUM ('warehouse','store','fulfillment_center','virtual');
CREATE TYPE public.inventory_movement_type AS ENUM (
  'initial_stock','receipt','adjustment','reservation','reservation_release',
  'sale_commit','return','transfer_out','transfer_in','damage','correction'
);
CREATE TYPE public.reservation_status AS ENUM ('active','released','committed','expired');
CREATE TYPE public.transfer_status AS ENUM ('draft','in_transit','completed','cancelled');

-- ============ LOCATIONS ============
CREATE TABLE public.inventory_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  type public.location_type NOT NULL DEFAULT 'warehouse',
  status public.entity_status NOT NULL DEFAULT 'active',
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 100,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, code)
);
CREATE INDEX idx_inv_locations_org ON public.inventory_locations(organization_id);
CREATE INDEX idx_inv_locations_shop ON public.inventory_locations(shop_id, priority);
GRANT SELECT, INSERT, UPDATE ON public.inventory_locations TO authenticated;
GRANT ALL ON public.inventory_locations TO service_role;
ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "locations read" ON public.inventory_locations FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'inventory.read'));
CREATE POLICY "locations insert" ON public.inventory_locations FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'inventory.manage_locations')
    AND public.shop_in_org(shop_id, organization_id));
CREATE POLICY "locations update" ON public.inventory_locations FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'inventory.manage_locations'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'inventory.manage_locations')
    AND public.shop_in_org(shop_id, organization_id));
CREATE TRIGGER inventory_locations_updated_at BEFORE UPDATE ON public.inventory_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ITEMS ============
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL UNIQUE REFERENCES public.product_variants(id) ON DELETE CASCADE,
  sku text,
  barcode text,
  track_inventory boolean NOT NULL DEFAULT true,
  allow_backorder boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inv_items_org ON public.inventory_items(organization_id);
CREATE INDEX idx_inv_items_sku ON public.inventory_items(organization_id, sku);
CREATE INDEX idx_inv_items_barcode ON public.inventory_items(organization_id, barcode);
GRANT SELECT ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items read" ON public.inventory_items FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'inventory.read'));
CREATE TRIGGER inventory_items_updated_at BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ LEVELS ============
CREATE TABLE public.inventory_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.inventory_locations(id) ON DELETE RESTRICT,
  on_hand integer NOT NULL DEFAULT 0,
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  incoming integer NOT NULL DEFAULT 0 CHECK (incoming >= 0),
  damaged integer NOT NULL DEFAULT 0 CHECK (damaged >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inventory_item_id, location_id)
);
CREATE INDEX idx_inv_levels_org ON public.inventory_levels(organization_id);
CREATE INDEX idx_inv_levels_shop ON public.inventory_levels(shop_id);
CREATE INDEX idx_inv_levels_loc ON public.inventory_levels(location_id);
GRANT SELECT ON public.inventory_levels TO authenticated;
GRANT ALL ON public.inventory_levels TO service_role;
ALTER TABLE public.inventory_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "levels read" ON public.inventory_levels FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'inventory.read'));
CREATE TRIGGER inventory_levels_updated_at BEFORE UPDATE ON public.inventory_levels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ MOVEMENTS (append only) ============
CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
  movement_type public.inventory_movement_type NOT NULL,
  quantity_delta integer NOT NULL,
  reference_type text,
  reference_id text,
  reason text,
  note text,
  actor_user_id uuid,
  idempotency_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inv_mov_org_created ON public.inventory_movements(organization_id, created_at DESC);
CREATE INDEX idx_inv_mov_item ON public.inventory_movements(inventory_item_id, created_at DESC);
CREATE INDEX idx_inv_mov_loc ON public.inventory_movements(location_id);
CREATE INDEX idx_inv_mov_type ON public.inventory_movements(movement_type);
CREATE INDEX idx_inv_mov_ref ON public.inventory_movements(reference_type, reference_id);
GRANT SELECT ON public.inventory_movements TO authenticated;
GRANT SELECT, INSERT ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movements read" ON public.inventory_movements FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'inventory.read'));

CREATE OR REPLACE FUNCTION public.inventory_movements_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  RAISE EXCEPTION 'inventory_movements ist append-only und darf nicht geändert oder gelöscht werden.'
    USING ERRCODE = 'insufficient_privilege';
END; $$;
CREATE TRIGGER inventory_movements_no_update BEFORE UPDATE ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.inventory_movements_immutable();
CREATE TRIGGER inventory_movements_no_delete BEFORE DELETE ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.inventory_movements_immutable();

-- ============ RESERVATIONS ============
CREATE TABLE public.inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  backordered_quantity integer NOT NULL DEFAULT 0 CHECK (backordered_quantity >= 0),
  status public.reservation_status NOT NULL DEFAULT 'active',
  reference_type text,
  reference_id text,
  expires_at timestamptz,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  committed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX idx_inv_res_idem ON public.inventory_reservations(organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_inv_res_org ON public.inventory_reservations(organization_id, status);
CREATE INDEX idx_inv_res_item ON public.inventory_reservations(inventory_item_id, status);
CREATE INDEX idx_inv_res_expires ON public.inventory_reservations(expires_at) WHERE status = 'active';
CREATE INDEX idx_inv_res_created ON public.inventory_reservations(created_at DESC);
GRANT SELECT ON public.inventory_reservations TO authenticated;
GRANT ALL ON public.inventory_reservations TO service_role;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reservations read" ON public.inventory_reservations FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'inventory.read'));

-- ============ TRANSFERS ============
CREATE TABLE public.inventory_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  from_location_id uuid NOT NULL REFERENCES public.inventory_locations(id) ON DELETE RESTRICT,
  to_location_id uuid NOT NULL REFERENCES public.inventory_locations(id) ON DELETE RESTRICT,
  status public.transfer_status NOT NULL DEFAULT 'draft',
  reference text,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (from_location_id <> to_location_id)
);
CREATE INDEX idx_inv_transfers_org ON public.inventory_transfers(organization_id, status, created_at DESC);
GRANT SELECT ON public.inventory_transfers TO authenticated;
GRANT ALL ON public.inventory_transfers TO service_role;
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transfers read" ON public.inventory_transfers FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'inventory.read'));

CREATE TABLE public.inventory_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.inventory_transfers(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transfer_id, inventory_item_id)
);
CREATE INDEX idx_inv_transfer_items_transfer ON public.inventory_transfer_items(transfer_id);
GRANT SELECT ON public.inventory_transfer_items TO authenticated;
GRANT ALL ON public.inventory_transfer_items TO service_role;
ALTER TABLE public.inventory_transfer_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transfer items read" ON public.inventory_transfer_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inventory_transfers t
    WHERE t.id = transfer_id AND public.has_permission(auth.uid(), t.organization_id, 'inventory.read')));

-- ============ ALERT RULES ============
CREATE TABLE public.stock_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.inventory_locations(id) ON DELETE CASCADE,
  threshold integer NOT NULL DEFAULT 5 CHECK (threshold >= 0),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_alert_org ON public.stock_alert_rules(organization_id, shop_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_alert_rules TO authenticated;
GRANT ALL ON public.stock_alert_rules TO service_role;
ALTER TABLE public.stock_alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alert rules read" ON public.stock_alert_rules FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'inventory.read'));
CREATE POLICY "alert rules write" ON public.stock_alert_rules FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'inventory.manage_settings'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'inventory.manage_settings')
    AND public.shop_in_org(shop_id, organization_id));
CREATE TRIGGER stock_alert_rules_updated_at BEFORE UPDATE ON public.stock_alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PERMISSIONS ============
INSERT INTO public.role_permissions (role, permission) VALUES
  ('owner','inventory.read'),('owner','inventory.adjust'),('owner','inventory.receive'),
  ('owner','inventory.transfer'),('owner','inventory.manage_locations'),('owner','inventory.manage_settings'),
  ('administrator','inventory.read'),('administrator','inventory.adjust'),('administrator','inventory.receive'),
  ('administrator','inventory.transfer'),('administrator','inventory.manage_locations'),('administrator','inventory.manage_settings'),
  ('operations','inventory.read'),('operations','inventory.adjust'),('operations','inventory.receive'),
  ('operations','inventory.transfer'),('operations','inventory.manage_locations'),
  ('catalog_manager','inventory.read'),('catalog_manager','inventory.manage_settings'),
  ('fulfillment','inventory.read'),('fulfillment','inventory.receive'),('fulfillment','inventory.transfer'),
  ('customer_support','inventory.read'),
  ('finance','inventory.read'),
  ('marketing','inventory.read'),
  ('developer','inventory.read'),
  ('read_only','inventory.read')
ON CONFLICT DO NOTHING;