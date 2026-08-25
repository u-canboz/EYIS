-- Phase 10: Communication Studio & E-Mail Engine
CREATE TYPE public.communication_channel AS ENUM ('email','sms','push','whatsapp');
CREATE TYPE public.communication_status AS ENUM ('draft','queued','sending','sent','delivered','failed','cancelled','suppressed');
CREATE TYPE public.communication_delivery_status AS ENUM ('accepted','sent','delivered','soft_bounce','hard_bounce','complained','rejected','unknown');
CREATE TYPE public.communication_recipient_type AS ENUM ('customer','guest','admin','test');
CREATE TYPE public.communication_suppression_reason AS ENUM ('hard_bounce','complaint','manual','invalid_recipient');
CREATE TYPE public.communication_template_status AS ENUM ('draft','active','disabled');
CREATE TYPE public.sender_verification_status AS ENUM ('unverified','pending','verified','failed');
CREATE TYPE public.communication_provider_status AS ENUM ('inactive','active','error');

-- 1. Provider configs -------------------------------------------------------
CREATE TABLE public.communication_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  channel public.communication_channel NOT NULL DEFAULT 'email',
  provider text NOT NULL,
  display_name text NOT NULL,
  status public.communication_provider_status NOT NULL DEFAULT 'inactive',
  test_mode boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  configuration_reference text,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, shop_id, channel, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_provider_configs TO authenticated;
GRANT ALL ON public.communication_provider_configs TO service_role;
ALTER TABLE public.communication_provider_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cpc_read" ON public.communication_provider_configs FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'communications.read'));
CREATE POLICY "cpc_write" ON public.communication_provider_configs FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'communications.settings'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'communications.settings'));
CREATE TRIGGER cpc_updated BEFORE UPDATE ON public.communication_provider_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Sender identities ------------------------------------------------------
CREATE TABLE public.sender_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  channel public.communication_channel NOT NULL DEFAULT 'email',
  display_name text NOT NULL,
  sender_name text NOT NULL,
  sender_address text NOT NULL,
  reply_to text,
  status public.entity_status NOT NULL DEFAULT 'active',
  verification_status public.sender_verification_status NOT NULL DEFAULT 'unverified',
  provider_reference text,
  is_default boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, channel, sender_address)
);
CREATE UNIQUE INDEX sender_identities_default_idx ON public.sender_identities (shop_id, channel) WHERE is_default;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sender_identities TO authenticated;
GRANT ALL ON public.sender_identities TO service_role;
ALTER TABLE public.sender_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sid_read" ON public.sender_identities FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'communications.read'));
CREATE POLICY "sid_write" ON public.sender_identities FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'communications.settings'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'communications.settings'));
CREATE TRIGGER sid_updated BEFORE UPDATE ON public.sender_identities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Templates --------------------------------------------------------------
CREATE TABLE public.communication_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  key text NOT NULL,
  channel public.communication_channel NOT NULL DEFAULT 'email',
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  status public.communication_template_status NOT NULL DEFAULT 'active',
  is_system boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  default_locale text NOT NULL DEFAULT 'de-DE',
  subject_template text NOT NULL DEFAULT '',
  content_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX comm_templates_system_key_idx ON public.communication_templates (key, channel) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX comm_templates_org_key_idx ON public.communication_templates (organization_id, coalesce(shop_id, '00000000-0000-0000-0000-000000000000'::uuid), key, channel) WHERE organization_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_templates TO authenticated;
GRANT ALL ON public.communication_templates TO service_role;
ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ctpl_read" ON public.communication_templates FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.has_permission(auth.uid(), organization_id, 'communications.read'));
CREATE POLICY "ctpl_write" ON public.communication_templates FOR ALL TO authenticated
  USING (organization_id IS NOT NULL AND public.has_permission(auth.uid(), organization_id, 'communications.manage'))
  WITH CHECK (organization_id IS NOT NULL AND public.has_permission(auth.uid(), organization_id, 'communications.manage'));
CREATE TRIGGER ctpl_updated BEFORE UPDATE ON public.communication_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Template versions ------------------------------------------------------
CREATE TABLE public.communication_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.communication_templates(id) ON DELETE CASCADE,
  version integer NOT NULL,
  locale text NOT NULL DEFAULT 'de-DE',
  subject text NOT NULL,
  preheader text,
  body_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  text_body_template text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (template_id, version, locale)
);
CREATE INDEX ctv_template_idx ON public.communication_template_versions (template_id, locale, version DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_template_versions TO authenticated;
GRANT ALL ON public.communication_template_versions TO service_role;
ALTER TABLE public.communication_template_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ctv_read" ON public.communication_template_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.communication_templates t WHERE t.id = template_id
    AND (t.organization_id IS NULL OR public.has_permission(auth.uid(), t.organization_id, 'communications.read'))));
CREATE POLICY "ctv_write" ON public.communication_template_versions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.communication_templates t WHERE t.id = template_id
    AND t.organization_id IS NOT NULL AND public.has_permission(auth.uid(), t.organization_id, 'communications.manage')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.communication_templates t WHERE t.id = template_id
    AND t.organization_id IS NOT NULL AND public.has_permission(auth.uid(), t.organization_id, 'communications.manage')));

-- Published versions are frozen: a change creates version n+1.
CREATE OR REPLACE FUNCTION public.comm_template_version_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.published_at IS NOT NULL THEN
      RAISE EXCEPTION 'Veröffentlichte Vorlagenversionen können nicht gelöscht werden.';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.published_at IS NOT NULL THEN
    IF NEW.subject IS DISTINCT FROM OLD.subject
       OR NEW.preheader IS DISTINCT FROM OLD.preheader
       OR NEW.body_schema IS DISTINCT FROM OLD.body_schema
       OR NEW.text_body_template IS DISTINCT FROM OLD.text_body_template
       OR NEW.locale IS DISTINCT FROM OLD.locale
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.template_id IS DISTINCT FROM OLD.template_id
       OR NEW.published_at IS DISTINCT FROM OLD.published_at THEN
      RAISE EXCEPTION 'Diese Version ist veröffentlicht. Änderungen erzeugen eine neue Version.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER ctv_guard BEFORE UPDATE OR DELETE ON public.communication_template_versions
  FOR EACH ROW EXECUTE FUNCTION public.comm_template_version_guard();

-- 5. Branding ---------------------------------------------------------------
CREATE TABLE public.communication_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  logo_media_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  primary_color text NOT NULL DEFAULT '#1f2937',
  background_color text NOT NULL DEFAULT '#f4f4f5',
  content_background_color text NOT NULL DEFAULT '#ffffff',
  text_color text NOT NULL DEFAULT '#18181b',
  muted_text_color text NOT NULL DEFAULT '#71717a',
  button_style text NOT NULL DEFAULT 'solid',
  border_radius integer NOT NULL DEFAULT 8,
  font_family text NOT NULL DEFAULT 'Helvetica, Arial, sans-serif',
  footer_text text NOT NULL DEFAULT '',
  support_email text,
  website_url text,
  social_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_branding TO authenticated;
GRANT ALL ON public.communication_branding TO service_role;
ALTER TABLE public.communication_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cbr_read" ON public.communication_branding FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'communications.read'));
CREATE POLICY "cbr_write" ON public.communication_branding FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'communications.settings'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'communications.settings'));
CREATE TRIGGER cbr_updated BEFORE UPDATE ON public.communication_branding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Rules ------------------------------------------------------------------
CREATE TABLE public.communication_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  channel public.communication_channel NOT NULL DEFAULT 'email',
  template_key text NOT NULL,
  template_id uuid REFERENCES public.communication_templates(id) ON DELETE SET NULL,
  enabled boolean NOT NULL DEFAULT true,
  delay_seconds integer NOT NULL DEFAULT 0,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 100,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, event_type, channel, template_key)
);
CREATE INDEX comm_rules_event_idx ON public.communication_rules (event_type, enabled);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_rules TO authenticated;
GRANT ALL ON public.communication_rules TO service_role;
ALTER TABLE public.communication_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crl_read" ON public.communication_rules FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'communications.read'));
CREATE POLICY "crl_write" ON public.communication_rules FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'communications.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'communications.manage'));
CREATE TRIGGER crl_updated BEFORE UPDATE ON public.communication_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Communications (snapshot per send) -------------------------------------
CREATE TABLE public.communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  channel public.communication_channel NOT NULL DEFAULT 'email',
  template_key text NOT NULL,
  template_version_id uuid REFERENCES public.communication_template_versions(id) ON DELETE SET NULL,
  communication_rule_id uuid REFERENCES public.communication_rules(id) ON DELETE SET NULL,
  locale text NOT NULL DEFAULT 'de-DE',
  recipient_type public.communication_recipient_type NOT NULL DEFAULT 'customer',
  recipient_reference_id uuid,
  recipient_address text NOT NULL,
  sender_identity_id uuid REFERENCES public.sender_identities(id) ON DELETE SET NULL,
  sender_name text,
  sender_address text,
  subject_snapshot text NOT NULL,
  html_snapshot text NOT NULL,
  text_snapshot text NOT NULL,
  status public.communication_status NOT NULL DEFAULT 'queued',
  delivery_status public.communication_delivery_status,
  provider text,
  provider_status_raw text,
  test_mode boolean NOT NULL DEFAULT false,
  is_test_send boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz,
  resend_of_communication_id uuid REFERENCES public.communications(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  source_event_type text,
  source_event_id uuid,
  scheduled_at timestamptz,
  queued_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX communications_event_idem_idx
  ON public.communications (shop_id, source_event_id, communication_rule_id, recipient_address)
  WHERE source_event_id IS NOT NULL AND communication_rule_id IS NOT NULL;
CREATE INDEX communications_status_idx ON public.communications (organization_id, status, created_at DESC);
CREATE INDEX communications_queue_idx ON public.communications (status, scheduled_at) WHERE status = 'queued';
CREATE INDEX communications_order_idx ON public.communications (order_id);
CREATE INDEX communications_customer_idx ON public.communications (customer_id);
CREATE INDEX communications_recipient_idx ON public.communications (shop_id, recipient_address);
GRANT SELECT ON public.communications TO authenticated;
GRANT ALL ON public.communications TO service_role;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comm_read" ON public.communications FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'communications.read'));
CREATE TRIGGER comm_updated BEFORE UPDATE ON public.communications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Snapshots never change after creation.
CREATE OR REPLACE FUNCTION public.communication_snapshot_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.subject_snapshot IS DISTINCT FROM OLD.subject_snapshot
     OR NEW.html_snapshot IS DISTINCT FROM OLD.html_snapshot
     OR NEW.text_snapshot IS DISTINCT FROM OLD.text_snapshot
     OR NEW.recipient_address IS DISTINCT FROM OLD.recipient_address
     OR NEW.template_version_id IS DISTINCT FROM OLD.template_version_id
     OR NEW.source_event_id IS DISTINCT FROM OLD.source_event_id THEN
    RAISE EXCEPTION 'Der Kommunikations-Snapshot ist unveränderbar.';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER comm_snapshot_guard BEFORE UPDATE ON public.communications
  FOR EACH ROW EXECUTE FUNCTION public.communication_snapshot_guard();

-- 8. Attempts ---------------------------------------------------------------
CREATE TABLE public.communication_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid NOT NULL REFERENCES public.communications(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  attempt_number integer NOT NULL,
  provider_message_id text,
  status public.communication_delivery_status NOT NULL DEFAULT 'unknown',
  error_code text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (communication_id, attempt_number)
);
CREATE INDEX comm_attempts_msg_idx ON public.communication_attempts (provider, provider_message_id);
GRANT SELECT ON public.communication_attempts TO authenticated;
GRANT ALL ON public.communication_attempts TO service_role;
ALTER TABLE public.communication_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_read" ON public.communication_attempts FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'communications.read'));

-- 9. Provider events (immutable journal) ------------------------------------
CREATE TABLE public.communication_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  provider_message_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_verified boolean NOT NULL DEFAULT false,
  processing_status text NOT NULL DEFAULT 'pending',
  processing_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, provider_event_id)
);
CREATE INDEX cpe_pending_idx ON public.communication_provider_events (processing_status, received_at);
GRANT SELECT ON public.communication_provider_events TO authenticated;
GRANT ALL ON public.communication_provider_events TO service_role;
ALTER TABLE public.communication_provider_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cpe_read" ON public.communication_provider_events FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.has_permission(auth.uid(), organization_id, 'communications.read'));

CREATE OR REPLACE FUNCTION public.communication_provider_event_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Provider-Events sind unveränderbar und werden nicht gelöscht.';
  END IF;
  IF NEW.payload IS DISTINCT FROM OLD.payload
     OR NEW.provider IS DISTINCT FROM OLD.provider
     OR NEW.provider_event_id IS DISTINCT FROM OLD.provider_event_id
     OR NEW.provider_message_id IS DISTINCT FROM OLD.provider_message_id
     OR NEW.event_type IS DISTINCT FROM OLD.event_type
     OR NEW.signature_verified IS DISTINCT FROM OLD.signature_verified
     OR NEW.received_at IS DISTINCT FROM OLD.received_at
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.shop_id IS DISTINCT FROM OLD.shop_id THEN
    RAISE EXCEPTION 'Nur der Verarbeitungsstatus eines Provider-Events darf geändert werden.';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER cpe_guard BEFORE UPDATE OR DELETE ON public.communication_provider_events
  FOR EACH ROW EXECUTE FUNCTION public.communication_provider_event_guard();

-- 10. Suppressions ----------------------------------------------------------
CREATE TABLE public.communication_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  channel public.communication_channel NOT NULL DEFAULT 'email',
  address text NOT NULL,
  reason public.communication_suppression_reason NOT NULL,
  source text NOT NULL DEFAULT 'system',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  UNIQUE (organization_id, channel, address, reason)
);
CREATE INDEX csup_address_idx ON public.communication_suppressions (channel, lower(address));
GRANT SELECT, INSERT, DELETE ON public.communication_suppressions TO authenticated;
GRANT ALL ON public.communication_suppressions TO service_role;
ALTER TABLE public.communication_suppressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "csup_read" ON public.communication_suppressions FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'communications.read'));
CREATE POLICY "csup_write" ON public.communication_suppressions FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'communications.settings'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'communications.settings'));

-- Permissions ---------------------------------------------------------------
INSERT INTO public.role_permissions (role, permission) VALUES
  ('owner','communications.read'),('owner','communications.manage'),('owner','communications.send_test'),('owner','communications.settings'),
  ('administrator','communications.read'),('administrator','communications.manage'),('administrator','communications.send_test'),('administrator','communications.settings'),
  ('operations','communications.read'),('operations','communications.manage'),('operations','communications.send_test'),
  ('marketing','communications.read'),('marketing','communications.manage'),('marketing','communications.send_test'),
  ('customer_support','communications.read'),('customer_support','communications.send_test'),
  ('fulfillment','communications.read'),
  ('finance','communications.read'),
  ('developer','communications.read'),('developer','communications.settings'),
  ('catalog_manager','communications.read'),
  ('read_only','communications.read')
ON CONFLICT DO NOTHING;