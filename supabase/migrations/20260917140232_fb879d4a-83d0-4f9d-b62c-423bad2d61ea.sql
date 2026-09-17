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
CREATE UNIQUE INDEX communications_newsletter_once ON public.communications
  (organization_id,shop_id,(metadata->>'newsletter_campaign_id'),(metadata->>'newsletter_subscriber_id'))
  WHERE metadata->>'newsletter_campaign_id' IS NOT NULL;

ALTER TABLE public.communication_branding ADD COLUMN product_url_template text NOT NULL DEFAULT '/produkt/{handle}';
ALTER TABLE public.newsletter_campaigns ADD COLUMN last_processed_at timestamptz;
CREATE TABLE public.newsletter_consent_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 shop_id uuid NOT NULL,
 subscriber_id uuid NOT NULL,
 event_type text NOT NULL CHECK(event_type IN ('requested','confirmed','unsubscribed')),
 consent_text text NOT NULL,
 source text NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,shop_id,subscriber_id) REFERENCES public.newsletter_subscribers(organization_id,shop_id,id) ON DELETE CASCADE
);
GRANT SELECT ON public.newsletter_consent_events TO authenticated;
GRANT ALL ON public.newsletter_consent_events TO service_role;
ALTER TABLE public.newsletter_consent_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY newsletter_consent_events_read ON public.newsletter_consent_events FOR SELECT TO authenticated
 USING(public.has_permission(auth.uid(),organization_id,'communications.read'));
CREATE INDEX ON public.newsletter_consent_events(organization_id,shop_id,subscriber_id,occurred_at);
CREATE INDEX ON public.newsletter_consent_events(subscriber_id);
CREATE FUNCTION public.newsletter_record_consent() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR NEW.confirmation_requested_at IS DISTINCT FROM OLD.confirmation_requested_at THEN
  INSERT INTO public.newsletter_consent_events(organization_id,shop_id,subscriber_id,event_type,consent_text,source)
  VALUES(NEW.organization_id,NEW.shop_id,NEW.id,CASE NEW.status WHEN 'subscribed' THEN 'confirmed' WHEN 'unsubscribed' THEN 'unsubscribed' ELSE 'requested' END,NEW.consent_text,NEW.source);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.newsletter_record_consent() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.newsletter_record_consent() TO service_role;
CREATE TRIGGER newsletter_record_consent AFTER INSERT OR UPDATE ON public.newsletter_subscribers FOR EACH ROW EXECUTE FUNCTION public.newsletter_record_consent();
CREATE FUNCTION public.newsletter_consent_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'Newsletter consent events cannot be changed'; END $$;
REVOKE ALL ON FUNCTION public.newsletter_consent_immutable() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.newsletter_consent_immutable() TO service_role;
CREATE TRIGGER newsletter_consent_immutable BEFORE UPDATE ON public.newsletter_consent_events FOR EACH ROW EXECUTE FUNCTION public.newsletter_consent_immutable();

CREATE FUNCTION public.newsletter_request_subscription(p_org uuid,p_shop uuid,p_email text,p_first_name text,p_consent text,p_token_hash text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid;
BEGIN
 INSERT INTO public.newsletter_subscribers(organization_id,shop_id,email,first_name,consent_text,status,confirmation_token_hash,confirmation_expires_at,confirmation_requested_at)
 VALUES(p_org,p_shop,lower(trim(p_email)),p_first_name,p_consent,'pending',p_token_hash,now()+interval '48 hours',now())
 ON CONFLICT(shop_id,email) DO UPDATE SET first_name=excluded.first_name,consent_text=excluded.consent_text,status='pending',confirmation_token_hash=excluded.confirmation_token_hash,confirmation_expires_at=excluded.confirmation_expires_at,confirmation_requested_at=excluded.confirmation_requested_at
 WHERE newsletter_subscribers.organization_id=p_org AND newsletter_subscribers.status<>'subscribed' AND (newsletter_subscribers.confirmation_requested_at IS NULL OR newsletter_subscribers.confirmation_requested_at<now()-interval '15 minutes')
 RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.newsletter_request_subscription(uuid,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.newsletter_request_subscription(uuid,uuid,text,text,text,text) TO service_role;

REVOKE ALL ON public.newsletter_subscribers, public.newsletter_campaigns, public.newsletter_deliveries, public.newsletter_consent_events FROM anon, authenticated;
GRANT SELECT ON public.newsletter_subscribers, public.newsletter_campaigns, public.newsletter_deliveries, public.newsletter_consent_events TO authenticated;
GRANT ALL ON public.newsletter_subscribers, public.newsletter_campaigns, public.newsletter_deliveries, public.newsletter_consent_events TO service_role;

CREATE FUNCTION public.newsletter_campaign_stats(p_org uuid, p_shop uuid)
RETURNS TABLE(campaign_id uuid, sent bigint, queued bigint, failed bigint, suppressed bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT n.id,
    count(c.id) FILTER (WHERE c.status IN ('sent', 'delivered')),
    count(c.id) FILTER (WHERE c.status IN ('queued', 'sending')),
    count(c.id) FILTER (WHERE c.status = 'failed'),
    count(c.id) FILTER (WHERE c.status = 'suppressed')
  FROM public.newsletter_campaigns n
  LEFT JOIN public.communications c
    ON c.organization_id = n.organization_id AND c.shop_id = n.shop_id
    AND c.metadata->>'newsletter_campaign_id' = n.id::text
  WHERE n.organization_id = p_org AND n.shop_id = p_shop
  GROUP BY n.id;
$$;
REVOKE ALL ON FUNCTION public.newsletter_campaign_stats(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.newsletter_campaign_stats(uuid, uuid) TO service_role;