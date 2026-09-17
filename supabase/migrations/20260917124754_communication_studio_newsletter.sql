-- Additive upgrade. Existing documents and published template versions are unchanged.
-- Rollback: pause newsletter campaigns; retain subscriber consent and delivery history.
ALTER TABLE public.communication_branding
  ADD COLUMN legal_text text NOT NULL DEFAULT '',
  ADD COLUMN attachment_media_ids uuid[] NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS shops_organization_id_id_unique ON public.shops(organization_id, id);
CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL,
  email text NOT NULL CHECK (email = lower(trim(email)) AND length(email) <= 254),
  first_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','subscribed','unsubscribed')),
  source text NOT NULL DEFAULT 'storefront',
  consent_text text NOT NULL,
  confirmation_token_hash text,
  confirmation_expires_at timestamptz,
  confirmation_requested_at timestamptz,
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shop_id,email),
  UNIQUE(organization_id,shop_id,id),
  FOREIGN KEY (organization_id,shop_id) REFERENCES public.shops(organization_id,id) ON DELETE CASCADE
);
GRANT SELECT ON public.newsletter_subscribers TO authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY newsletter_subscribers_read ON public.newsletter_subscribers FOR SELECT TO authenticated
  USING(public.has_permission(auth.uid(),organization_id,'communications.read'));
CREATE INDEX ON public.newsletter_subscribers(organization_id,shop_id,status,confirmed_at);
CREATE INDEX ON public.newsletter_subscribers(confirmation_token_hash) WHERE confirmation_token_hash IS NOT NULL;
CREATE UNIQUE INDEX ON public.newsletter_subscribers(unsubscribe_token);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.newsletter_subscribers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.newsletter_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL,
  name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
  subject text NOT NULL DEFAULT '',
  preheader text NOT NULL DEFAULT '',
  blocks jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(blocks)='array'),
  kind text NOT NULL DEFAULT 'broadcast' CHECK(kind IN ('broadcast','welcome')),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','active','paused','completed')),
  delay_minutes integer NOT NULL DEFAULT 0 CHECK(delay_minutes BETWEEN 0 AND 43200),
  scheduled_at timestamptz,
  activated_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,shop_id,id),
  FOREIGN KEY(organization_id,shop_id) REFERENCES public.shops(organization_id,id) ON DELETE CASCADE
);
GRANT SELECT ON public.newsletter_campaigns TO authenticated;
GRANT ALL ON public.newsletter_campaigns TO service_role;
ALTER TABLE public.newsletter_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY newsletter_campaigns_read ON public.newsletter_campaigns FOR SELECT TO authenticated
  USING(public.has_permission(auth.uid(),organization_id,'communications.read'));
CREATE INDEX ON public.newsletter_campaigns(organization_id,shop_id,status);
CREATE INDEX ON public.newsletter_campaigns(created_by);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.newsletter_campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.newsletter_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  subscriber_id uuid NOT NULL,
  communication_id uuid UNIQUE REFERENCES public.communications(id) ON DELETE SET NULL,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id,subscriber_id),
  FOREIGN KEY(organization_id,shop_id,campaign_id) REFERENCES public.newsletter_campaigns(organization_id,shop_id,id) ON DELETE CASCADE,
  FOREIGN KEY(organization_id,shop_id,subscriber_id) REFERENCES public.newsletter_subscribers(organization_id,shop_id,id) ON DELETE CASCADE
);
GRANT SELECT ON public.newsletter_deliveries TO authenticated;
GRANT ALL ON public.newsletter_deliveries TO service_role;
ALTER TABLE public.newsletter_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY newsletter_deliveries_read ON public.newsletter_deliveries FOR SELECT TO authenticated
  USING(public.has_permission(auth.uid(),organization_id,'communications.read'));
CREATE INDEX ON public.newsletter_deliveries(organization_id,shop_id);
CREATE INDEX ON public.newsletter_deliveries(subscriber_id);
-- Atomic deduplication even if multiple scheduler workers render the same recipient.
CREATE UNIQUE INDEX communications_newsletter_once ON public.communications
  (organization_id,shop_id,(metadata->>'newsletter_campaign_id'),(metadata->>'newsletter_subscriber_id'))
  WHERE metadata->>'newsletter_campaign_id' IS NOT NULL;
