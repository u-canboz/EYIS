-- Hosted Supabase may grant default table privileges. Make these new tables
-- independent of platform defaults; all mutations stay behind permission-checked server functions.
REVOKE ALL ON public.newsletter_subscribers, public.newsletter_campaigns, public.newsletter_deliveries, public.newsletter_consent_events FROM anon, authenticated;
GRANT SELECT ON public.newsletter_subscribers, public.newsletter_campaigns, public.newsletter_deliveries, public.newsletter_consent_events TO authenticated;
GRANT ALL ON public.newsletter_subscribers, public.newsletter_campaigns, public.newsletter_deliveries, public.newsletter_consent_events TO service_role;
