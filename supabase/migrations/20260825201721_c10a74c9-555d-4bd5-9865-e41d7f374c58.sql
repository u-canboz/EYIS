-- ============================================================
-- Phase 11 — Automation Engine, Tasks & Operational Inbox
-- ============================================================

-- ---------------------------- enums ------------------------------
CREATE TYPE public.automation_status AS ENUM ('draft', 'active', 'paused', 'archived');
CREATE TYPE public.automation_trigger_type AS ENUM ('domain_event', 'schedule', 'manual');
CREATE TYPE public.automation_execution_status AS ENUM ('queued','running','completed','partially_completed','failed','cancelled');
CREATE TYPE public.automation_action_status AS ENUM ('pending','running','succeeded','failed','skipped');
CREATE TYPE public.automation_job_status AS ENUM ('pending','running','completed','failed','cancelled');
CREATE TYPE public.task_status AS ENUM ('open','in_progress','completed','cancelled');
CREATE TYPE public.task_priority AS ENUM ('low','normal','high','urgent');
CREATE TYPE public.task_source AS ENUM ('manual','automation','system');

-- ---------------------- outbox extensions ------------------------
ALTER TABLE public.outbox_events
  ADD COLUMN IF NOT EXISTS shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS correlation_id uuid,
  ADD COLUMN IF NOT EXISTS causation_id uuid,
  ADD COLUMN IF NOT EXISTS chain_depth integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS outbox_events_shop_idx ON public.outbox_events (shop_id, event_type, created_at DESC);

-- ------------------------ automation_rules -----------------------
CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status public.automation_status NOT NULL DEFAULT 'draft',
  trigger_type public.automation_trigger_type NOT NULL DEFAULT 'domain_event',
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions jsonb NOT NULL DEFAULT '{"mode":"all","conditions":[]}'::jsonb,
  priority integer NOT NULL DEFAULT 100,
  stop_on_error boolean NOT NULL DEFAULT true,
  max_executions_per_event integer NOT NULL DEFAULT 1,
  max_per_hour integer,
  max_per_entity integer,
  error_threshold integer NOT NULL DEFAULT 50,
  error_window_minutes integer NOT NULL DEFAULT 5,
  auto_paused_at timestamptz,
  auto_pause_reason text,
  active_version integer,
  draft_version integer NOT NULL DEFAULT 1,
  template_key text,
  last_executed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_rules TO authenticated;
GRANT ALL ON public.automation_rules TO service_role;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY ar_read ON public.automation_rules FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'automations.read'));
CREATE POLICY ar_write ON public.automation_rules FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'automations.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'automations.manage')
    AND public.shop_in_org(shop_id, organization_id));
CREATE INDEX automation_rules_lookup_idx ON public.automation_rules (organization_id, shop_id, status, trigger_type);
CREATE TRIGGER automation_rules_updated_at BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------- automation_rule_versions -------------------
CREATE TABLE public.automation_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  version integer NOT NULL,
  trigger_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_at timestamptz,
  published_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_rule_versions TO authenticated;
GRANT ALL ON public.automation_rule_versions TO service_role;
ALTER TABLE public.automation_rule_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY arv_read ON public.automation_rule_versions FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'automations.read'));
CREATE POLICY arv_write ON public.automation_rule_versions FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'automations.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'automations.manage'));
CREATE TRIGGER automation_rule_versions_updated_at BEFORE UPDATE ON public.automation_rule_versions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.automation_version_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.published_at IS NOT NULL THEN
      RAISE EXCEPTION 'Veröffentlichte Automationsversionen können nicht gelöscht werden.';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'Veröffentlichte Automationsversionen sind unveränderbar.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER automation_version_guard_trg
  BEFORE UPDATE OR DELETE ON public.automation_rule_versions
  FOR EACH ROW EXECUTE FUNCTION public.automation_version_guard();

-- ----------------------- automation_actions ----------------------
CREATE TABLE public.automation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  position integer NOT NULL,
  action_type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  continue_on_failure boolean NOT NULL DEFAULT false,
  delay_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, position)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_actions TO authenticated;
GRANT ALL ON public.automation_actions TO service_role;
ALTER TABLE public.automation_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY aa_read ON public.automation_actions FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'automations.read'));
CREATE POLICY aa_write ON public.automation_actions FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'automations.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'automations.manage'));
CREATE TRIGGER automation_actions_updated_at BEFORE UPDATE ON public.automation_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------- automation_executions ---------------------
CREATE TABLE public.automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  rule_version integer NOT NULL DEFAULT 1,
  rule_version_id uuid REFERENCES public.automation_rule_versions(id) ON DELETE SET NULL,
  trigger_type public.automation_trigger_type NOT NULL,
  source_event_id uuid,
  source_event_type text,
  status public.automation_execution_status NOT NULL DEFAULT 'queued',
  error_code text,
  error text,
  current_action_position integer NOT NULL DEFAULT 0,
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  causation_id uuid,
  chain_depth integer NOT NULL DEFAULT 0,
  idempotency_key text,
  retry_of_execution_id uuid REFERENCES public.automation_executions(id) ON DELETE SET NULL,
  triggered_by uuid,
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_executions TO authenticated;
GRANT ALL ON public.automation_executions TO service_role;
ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ae_read ON public.automation_executions FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'automations.read'));
CREATE POLICY ae_write ON public.automation_executions FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'automations.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'automations.manage'));
CREATE UNIQUE INDEX automation_executions_event_uniq
  ON public.automation_executions (rule_id, source_event_id)
  WHERE source_event_id IS NOT NULL AND retry_of_execution_id IS NULL;
CREATE INDEX automation_executions_rule_idx ON public.automation_executions (rule_id, created_at DESC);
CREATE INDEX automation_executions_status_idx ON public.automation_executions (organization_id, status, created_at DESC);
CREATE TRIGGER automation_executions_updated_at BEFORE UPDATE ON public.automation_executions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------ automation_action_executions -----------------
CREATE TABLE public.automation_action_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES public.automation_executions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  position integer NOT NULL,
  action_type text NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  status public.automation_action_status NOT NULL DEFAULT 'pending',
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  error_message text,
  skipped_reason text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (execution_id, position, attempt)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_action_executions TO authenticated;
GRANT ALL ON public.automation_action_executions TO service_role;
ALTER TABLE public.automation_action_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY aae_read ON public.automation_action_executions FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'automations.read'));
CREATE POLICY aae_write ON public.automation_action_executions FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'automations.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'automations.manage'));
CREATE TRIGGER automation_action_executions_updated_at BEFORE UPDATE ON public.automation_action_executions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------ automation_jobs ------------------------
CREATE TABLE public.automation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  execution_id uuid REFERENCES public.automation_executions(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.automation_job_status NOT NULL DEFAULT 'pending',
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  last_error text,
  last_error_code text,
  locked_at timestamptz,
  locked_by text,
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.automation_jobs TO authenticated;
GRANT ALL ON public.automation_jobs TO service_role;
ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY aj_read ON public.automation_jobs FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'automations.read'));
CREATE UNIQUE INDEX automation_jobs_dedupe_uniq ON public.automation_jobs (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX automation_jobs_queue_idx ON public.automation_jobs (status, available_at);
CREATE TRIGGER automation_jobs_updated_at BEFORE UPDATE ON public.automation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------- automation_rule_counters -------------------
CREATE TABLE public.automation_rule_counters (
  rule_id uuid NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  bucket_kind text NOT NULL,
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rule_id, bucket_kind, bucket_key, window_start)
);
GRANT ALL ON public.automation_rule_counters TO service_role;
ALTER TABLE public.automation_rule_counters ENABLE ROW LEVEL SECURITY;

-- ------------------------------ tasks ----------------------------
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status public.task_status NOT NULL DEFAULT 'open',
  priority public.task_priority NOT NULL DEFAULT 'normal',
  entity_type text,
  entity_id uuid,
  assigned_to uuid,
  due_at timestamptz,
  source public.task_source NOT NULL DEFAULT 'manual',
  source_automation_execution_id uuid REFERENCES public.automation_executions(id) ON DELETE SET NULL,
  dedupe_key text,
  completed_at timestamptz,
  completed_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tasks_read ON public.tasks FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'tasks.read'));
CREATE POLICY tasks_write ON public.tasks FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'tasks.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'tasks.manage')
    AND public.shop_in_org(shop_id, organization_id));
CREATE UNIQUE INDEX tasks_dedupe_uniq ON public.tasks (shop_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status IN ('open','in_progress');
CREATE INDEX tasks_inbox_idx ON public.tasks (organization_id, shop_id, status, due_at);
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------- outgoing_webhook_endpoints ------------------
CREATE TABLE public.outgoing_webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  secret_reference text,
  status public.entity_status NOT NULL DEFAULT 'active',
  last_status_code integer,
  last_error text,
  last_called_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outgoing_webhook_endpoints TO authenticated;
GRANT ALL ON public.outgoing_webhook_endpoints TO service_role;
ALTER TABLE public.outgoing_webhook_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY owe_read ON public.outgoing_webhook_endpoints FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'webhooks.read'));
CREATE POLICY owe_write ON public.outgoing_webhook_endpoints FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, 'webhooks.manage'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, 'webhooks.manage')
    AND public.shop_in_org(shop_id, organization_id));
CREATE TRIGGER owe_updated_at BEFORE UPDATE ON public.outgoing_webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------- atomic counters -----------------------
-- Single call: increments and decides. No read-then-decide race.
CREATE OR REPLACE FUNCTION public.automation_check_limits(
  _rule_id uuid,
  _entity_key text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  hour_start timestamptz := date_trunc('hour', now());
  c integer;
BEGIN
  SELECT auto_paused_at, status, max_per_hour, max_per_entity
    INTO r FROM public.automation_rules WHERE id = _rule_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF r.auto_paused_at IS NOT NULL THEN RETURN 'circuit_open'; END IF;
  IF r.status <> 'active' THEN RETURN 'inactive'; END IF;

  IF r.max_per_hour IS NOT NULL THEN
    INSERT INTO public.automation_rule_counters (rule_id, bucket_kind, bucket_key, window_start, count)
    VALUES (_rule_id, 'hour', 'all', hour_start, 1)
    ON CONFLICT (rule_id, bucket_kind, bucket_key, window_start)
      DO UPDATE SET count = public.automation_rule_counters.count + 1, updated_at = now()
    RETURNING count INTO c;
    IF c > r.max_per_hour THEN RETURN 'rate_limited'; END IF;
  END IF;

  IF r.max_per_entity IS NOT NULL AND _entity_key IS NOT NULL THEN
    INSERT INTO public.automation_rule_counters (rule_id, bucket_kind, bucket_key, window_start, count)
    VALUES (_rule_id, 'entity', _entity_key, 'epoch'::timestamptz, 1)
    ON CONFLICT (rule_id, bucket_kind, bucket_key, window_start)
      DO UPDATE SET count = public.automation_rule_counters.count + 1, updated_at = now()
    RETURNING count INTO c;
    IF c > r.max_per_entity THEN RETURN 'rate_limited'; END IF;
  END IF;

  RETURN 'allow';
END;
$$;

CREATE OR REPLACE FUNCTION public.automation_record_error(_rule_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  win timestamptz;
  c integer;
BEGIN
  SELECT error_threshold, error_window_minutes, auto_paused_at
    INTO r FROM public.automation_rules WHERE id = _rule_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF r.auto_paused_at IS NOT NULL THEN RETURN 'circuit_open'; END IF;

  win := to_timestamp(floor(extract(epoch FROM now()) / (r.error_window_minutes * 60)) * (r.error_window_minutes * 60));
  INSERT INTO public.automation_rule_counters (rule_id, bucket_kind, bucket_key, window_start, count)
  VALUES (_rule_id, 'error', 'all', win, 1)
  ON CONFLICT (rule_id, bucket_kind, bucket_key, window_start)
    DO UPDATE SET count = public.automation_rule_counters.count + 1, updated_at = now()
  RETURNING count INTO c;

  IF c >= r.error_threshold THEN
    UPDATE public.automation_rules
      SET auto_paused_at = now(),
          auto_pause_reason = format('Automatisch pausiert: %s Fehler in %s Minuten.', c, r.error_window_minutes),
          status = 'paused'
      WHERE id = _rule_id;
    RETURN 'circuit_open';
  END IF;
  RETURN 'recorded';
END;
$$;

-- --------------------------- job claiming ------------------------
CREATE OR REPLACE FUNCTION public.automation_claim_jobs(_limit integer, _worker text)
RETURNS SETOF public.automation_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE public.automation_jobs j
     SET status = 'running', locked_at = now(), locked_by = _worker,
         attempts = j.attempts + 1, updated_at = now()
   WHERE j.id IN (
     SELECT id FROM public.automation_jobs
      WHERE status = 'pending' AND available_at <= now()
      ORDER BY available_at
      LIMIT _limit
      FOR UPDATE SKIP LOCKED
   )
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.automation_check_limits(uuid, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.automation_record_error(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.automation_claim_jobs(integer, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automation_check_limits(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.automation_record_error(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.automation_claim_jobs(integer, text) TO service_role;

-- --------------------------- permissions -------------------------
INSERT INTO public.role_permissions (role, permission) VALUES
  ('owner','automations.read'),('owner','automations.manage'),('owner','automations.activate'),
  ('owner','automations.run'),('owner','automations.debug'),
  ('owner','tasks.read'),('owner','tasks.manage'),('owner','tasks.assign'),
  ('owner','webhooks.read'),('owner','webhooks.manage'),
  ('administrator','automations.read'),('administrator','automations.manage'),('administrator','automations.activate'),
  ('administrator','automations.run'),('administrator','automations.debug'),
  ('administrator','tasks.read'),('administrator','tasks.manage'),('administrator','tasks.assign'),
  ('administrator','webhooks.read'),('administrator','webhooks.manage'),
  ('operations','automations.read'),('operations','automations.run'),
  ('operations','tasks.read'),('operations','tasks.manage'),('operations','tasks.assign'),
  ('marketing','automations.read'),('marketing','tasks.read'),
  ('developer','automations.read'),('developer','automations.manage'),('developer','automations.debug'),
  ('developer','webhooks.read'),('developer','webhooks.manage'),('developer','tasks.read'),
  ('customer_support','automations.read'),('customer_support','tasks.read'),('customer_support','tasks.manage'),
  ('fulfillment','automations.read'),('fulfillment','tasks.read'),('fulfillment','tasks.manage'),
  ('finance','automations.read'),('finance','tasks.read'),
  ('catalog_manager','automations.read'),('catalog_manager','tasks.read'),
  ('read_only','automations.read'),('read_only','tasks.read')
ON CONFLICT DO NOTHING;