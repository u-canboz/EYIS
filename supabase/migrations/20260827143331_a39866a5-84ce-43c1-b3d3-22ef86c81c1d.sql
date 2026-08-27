-- Nachbesserung Integration Center (Phase 18 QA):
-- 1) tenant-Index auf integration_health
CREATE INDEX IF NOT EXISTS integration_health_org_idx ON public.integration_health (organization_id);

-- 2) sender_domain_guard ist ein interner Trigger-Guard: kein direkter EXECUTE für Rollen
REVOKE EXECUTE ON FUNCTION public.sender_domain_guard() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sender_domain_guard() FROM anon;