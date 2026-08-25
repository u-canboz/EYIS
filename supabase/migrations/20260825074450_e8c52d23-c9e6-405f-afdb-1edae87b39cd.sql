-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM (
  'owner','administrator','operations','catalog_manager','fulfillment',
  'customer_support','finance','marketing','developer','read_only'
);

CREATE TYPE public.entity_status AS ENUM ('active','inactive','archived');

CREATE TYPE public.invitation_status AS ENUM ('pending','accepted','revoked','expired');

-- ============ SHARED ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NULLIF(NEW.raw_user_meta_data->>'full_name',''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ORGANIZATIONS ============
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status public.entity_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ MEMBERSHIPS ============
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL DEFAULT 'read_only',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT memberships_org_user_unique UNIQUE (organization_id, user_id)
);
CREATE INDEX memberships_user_idx ON public.memberships(user_id);
GRANT SELECT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER memberships_updated_at BEFORE UPDATE ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ROLE PERMISSIONS ============
CREATE TABLE public.role_permissions (
  role public.app_role NOT NULL,
  permission TEXT NOT NULL,
  PRIMARY KEY (role, permission)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_permissions_read ON public.role_permissions
FOR SELECT TO authenticated USING (true);

INSERT INTO public.role_permissions (role, permission) VALUES
('owner','products.read'),('owner','products.write'),('owner','prices.write'),
('owner','orders.read'),('owner','orders.fulfill'),('owner','orders.refund'),
('owner','customers.read'),('owner','customers.export'),('owner','invoices.issue'),
('owner','settings.manage'),('owner','integrations.manage'),('owner','audit.read'),
('administrator','products.read'),('administrator','products.write'),('administrator','prices.write'),
('administrator','orders.read'),('administrator','orders.fulfill'),('administrator','orders.refund'),
('administrator','customers.read'),('administrator','customers.export'),('administrator','invoices.issue'),
('administrator','settings.manage'),('administrator','integrations.manage'),('administrator','audit.read'),
('operations','products.read'),('operations','products.write'),('operations','orders.read'),
('operations','orders.fulfill'),('operations','customers.read'),('operations','audit.read'),
('catalog_manager','products.read'),('catalog_manager','products.write'),('catalog_manager','prices.write'),
('fulfillment','products.read'),('fulfillment','orders.read'),('fulfillment','orders.fulfill'),
('customer_support','products.read'),('customer_support','orders.read'),('customer_support','customers.read'),
('finance','orders.read'),('finance','orders.refund'),('finance','invoices.issue'),('finance','customers.read'),
('marketing','products.read'),('marketing','prices.write'),('marketing','customers.read'),
('developer','products.read'),('developer','orders.read'),('developer','integrations.manage'),('developer','audit.read'),
('read_only','products.read'),('read_only','orders.read'),('read_only','customers.read');

-- ============ SECURITY DEFINER HELPERS ============
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = _user_id AND m.organization_id = _org_id);
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id UUID, _org_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m
    WHERE m.user_id = _user_id AND m.organization_id = _org_id AND m.role = _role);
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _org_id UUID, _permission TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.role_permissions rp ON rp.role = m.role
    WHERE m.user_id = _user_id AND m.organization_id = _org_id AND rp.permission = _permission
  );
$$;

CREATE OR REPLACE FUNCTION public.current_org_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.memberships WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.shares_org_with(_other_user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships a
    JOIN public.memberships b ON b.organization_id = a.organization_id
    WHERE a.user_id = auth.uid() AND b.user_id = _other_user
  );
$$;

-- ============ PROFILE POLICIES ============
CREATE POLICY profiles_select_self ON public.profiles
FOR SELECT TO authenticated USING (id = auth.uid() OR public.shares_org_with(id));
CREATE POLICY profiles_update_self ON public.profiles
FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ============ ORGANIZATION POLICIES ============
CREATE POLICY organizations_select ON public.organizations
FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), id));
CREATE POLICY organizations_update ON public.organizations
FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), id, 'settings.manage'))
WITH CHECK (public.has_permission(auth.uid(), id, 'settings.manage'));

-- ============ MEMBERSHIP POLICIES ============
CREATE POLICY memberships_select ON public.memberships
FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY memberships_update ON public.memberships
FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), organization_id, 'settings.manage'))
WITH CHECK (public.has_permission(auth.uid(), organization_id, 'settings.manage'));
CREATE POLICY memberships_delete ON public.memberships
FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), organization_id, 'settings.manage'));

-- Owner protection: last owner cannot be removed or demoted
CREATE OR REPLACE FUNCTION public.protect_last_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_count INT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role <> 'owner' THEN
    SELECT count(*) INTO owner_count FROM public.memberships
      WHERE organization_id = OLD.organization_id AND role = 'owner';
    IF owner_count <= 1 THEN
      RAISE EXCEPTION 'Die letzte Inhaber-Rolle einer Organisation kann nicht herabgestuft werden.'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.role = 'owner' THEN
    SELECT count(*) INTO owner_count FROM public.memberships
      WHERE organization_id = OLD.organization_id AND role = 'owner';
    IF owner_count <= 1 THEN
      RAISE EXCEPTION 'Der letzte Inhaber einer Organisation kann nicht entfernt werden.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END; $$;

CREATE TRIGGER memberships_protect_last_owner
BEFORE UPDATE OR DELETE ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.protect_last_owner();

-- ============ SHOPS ============
CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  locale TEXT NOT NULL DEFAULT 'de-DE',
  status public.entity_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shops_org_slug_unique UNIQUE (organization_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT ALL ON public.shops TO service_role;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER shops_updated_at BEFORE UPDATE ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY shops_select ON public.shops
FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY shops_insert ON public.shops
FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), organization_id, 'settings.manage'));
CREATE POLICY shops_update ON public.shops
FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), organization_id, 'settings.manage'))
WITH CHECK (public.has_permission(auth.uid(), organization_id, 'settings.manage'));
CREATE POLICY shops_delete ON public.shops
FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), organization_id, 'settings.manage'));

-- ============ SHOP DOMAINS ============
CREATE TABLE public.shop_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_domains TO authenticated;
GRANT ALL ON public.shop_domains TO service_role;
ALTER TABLE public.shop_domains ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER shop_domains_updated_at BEFORE UPDATE ON public.shop_domains
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY shop_domains_select ON public.shop_domains
FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY shop_domains_write ON public.shop_domains
FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), organization_id, 'settings.manage'))
WITH CHECK (public.has_permission(auth.uid(), organization_id, 'settings.manage'));

-- ============ INVITATIONS ============
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'read_only',
  token_hash TEXT NOT NULL UNIQUE,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  invited_by UUID,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX invitations_one_pending_per_email
  ON public.invitations (organization_id, lower(email)) WHERE status = 'pending';
GRANT SELECT ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER invitations_updated_at BEFORE UPDATE ON public.invitations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY invitations_select ON public.invitations
FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), organization_id, 'settings.manage'));

-- ============ AUDIT LOG (append only) ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_org_created_idx ON public.audit_log(organization_id, created_at DESC);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT SELECT, INSERT ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select ON public.audit_log
FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), organization_id, 'audit.read'));

CREATE OR REPLACE FUNCTION public.audit_log_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'audit_log ist append-only und darf nicht geändert oder gelöscht werden.'
    USING ERRCODE = 'insufficient_privilege';
END; $$;

CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.audit_log_immutable();
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.audit_log_immutable();

-- ============ OUTBOX EVENTS (server only) ============
CREATE TABLE public.outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX outbox_events_pending_idx ON public.outbox_events(status, available_at);
GRANT ALL ON public.outbox_events TO service_role;
ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;

-- ============ IDEMPOTENCY KEYS (server only) ============
CREATE TABLE public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  key TEXT NOT NULL,
  request_hash TEXT,
  response JSONB,
  status TEXT NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours',
  CONSTRAINT idempotency_keys_unique UNIQUE (organization_id, endpoint, key)
);
GRANT ALL ON public.idempotency_keys TO service_role;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;