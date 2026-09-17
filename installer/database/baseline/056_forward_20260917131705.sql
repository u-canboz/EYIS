-- EYIS Baseline Unit 056 — Forward-Port der Migration 20260917131705.
-- Inhalt entspricht Byte-für-Byte der Migration; Fresh Install und Upgrade
-- erreichen damit denselben Schema-Zustand.

-- Aggregate on the server; large campaigns must not inherit the API row limit.
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
