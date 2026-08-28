-- ============================================================
-- Phase 22: Update Center & One-Click Updater
-- ============================================================

-- 1. Installation um Update-Felder erweitern
ALTER TABLE public.commerce_installation
  ADD COLUMN IF NOT EXISTS installed_release_id TEXT,
  ADD COLUMN IF NOT EXISTS update_channel TEXT NOT NULL DEFAULT 'stable',
  ADD COLUMN IF NOT EXISTS auto_update_policy TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS system_seed_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_update_check_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_successful_update_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS maintenance_state TEXT NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS update_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS available_release JSONB;

ALTER TABLE public.commerce_installation
  DROP CONSTRAINT IF EXISTS commerce_installation_update_channel_check;
ALTER TABLE public.commerce_installation
  ADD CONSTRAINT commerce_installation_update_channel_check
  CHECK (update_channel IN ('stable','beta','development'));

ALTER TABLE public.commerce_installation
  DROP CONSTRAINT IF EXISTS commerce_installation_auto_update_policy_check;
ALTER TABLE public.commerce_installation
  ADD CONSTRAINT commerce_installation_auto_update_policy_check
  CHECK (auto_update_policy IN ('manual','security_only','patch'));

ALTER TABLE public.commerce_installation
  DROP CONSTRAINT IF EXISTS commerce_installation_maintenance_state_check;
ALTER TABLE public.commerce_installation
  ADD CONSTRAINT commerce_installation_maintenance_state_check
  CHECK (maintenance_state IN ('off','updating','manual'));

-- 2. Update-Läufe (Systemtabelle, server-only)
CREATE TABLE IF NOT EXISTS public.update_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  installation_id TEXT NOT NULL,
  from_version TEXT NOT NULL,
  to_version TEXT NOT NULL,
  release_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'stable',
  status TEXT NOT NULL DEFAULT 'preflight',
  initiated_by UUID,
  initiated_by_email TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  deployment_provider TEXT,
  deployment_reference TEXT,
  migration_provider TEXT,
  migration_from TEXT,
  migration_to TEXT,
  backup_reference TEXT,
  current_step TEXT,
  error_code TEXT,
  safe_error_message TEXT,
  rollback_status TEXT NOT NULL DEFAULT 'none',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT update_runs_status_check CHECK (status IN (
    'preflight','ready','backup_check','maintenance','deploying','migrating',
    'seeding','verifying','completed','failed','rolling_back','rolled_back','manual_attention'
  )),
  CONSTRAINT update_runs_rollback_status_check CHECK (rollback_status IN (
    'none','requested','running','completed','failed','not_supported'
  ))
);

GRANT ALL ON public.update_runs TO service_role;
ALTER TABLE public.update_runs ENABLE ROW LEVEL SECURITY;
-- Bewusst keine Policies: Zugriff ausschliesslich ueber geprüfte Serverfunktionen
-- mit dem Service-Role-Client (wie commerce_installation).

-- Genau ein aktiver Update-Lauf gleichzeitig
CREATE UNIQUE INDEX IF NOT EXISTS update_runs_single_active
  ON public.update_runs ((true))
  WHERE status IN ('preflight','ready','backup_check','maintenance','deploying',
                   'migrating','seeding','verifying','rolling_back');

CREATE INDEX IF NOT EXISTS update_runs_started_at_idx ON public.update_runs (started_at DESC);

-- 3. Update-Schritte
CREATE TABLE IF NOT EXISTS public.update_run_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  update_run_id UUID NOT NULL REFERENCES public.update_runs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  step TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  output_summary TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT update_run_steps_status_check CHECK (status IN
    ('pending','running','passed','failed','skipped','blocked')),
  CONSTRAINT update_run_steps_unique UNIQUE (update_run_id, position)
);

GRANT ALL ON public.update_run_steps TO service_role;
ALTER TABLE public.update_run_steps ENABLE ROW LEVEL SECURITY;
-- Bewusst keine Policies (server-only, siehe update_runs).

-- 4. updated_at-Trigger
CREATE TRIGGER update_runs_set_updated_at
  BEFORE UPDATE ON public.update_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_run_steps_set_updated_at
  BEFORE UPDATE ON public.update_run_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Berechtigungen
INSERT INTO public.role_permissions (role, permission) VALUES
  ('owner','system_updates.read'),('owner','system_updates.manage'),
  ('owner','system_updates.install'),('owner','system_updates.channel'),
  ('administrator','system_updates.read'),('administrator','system_updates.manage'),
  ('administrator','system_updates.install'),('administrator','system_updates.channel'),
  ('developer','system_updates.read'),('developer','system_updates.manage'),
  ('operations','system_updates.read'),
  ('finance','system_updates.read'),
  ('read_only','system_updates.read')
ON CONFLICT DO NOTHING;