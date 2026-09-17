-- Consent evidence survives subsequent re-subscriptions. No historical consent is fabricated.
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

-- Atomic request gate prevents concurrent subscribe requests from resetting a confirmed consent.
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
