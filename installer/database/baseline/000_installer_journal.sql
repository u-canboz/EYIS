-- EYIS Database Install Pack — Unit 000: Installations-Journal
--
-- Diese Unit ist die einzige Unit des Packs, die bewusst wiederholbar ist:
-- sie legt die Metastruktur an, über die alle weiteren Units genau einmal
-- ausgeführt werden. Alle folgenden Units gehen von einem definierten,
-- leeren EYIS-Zustand aus und werden über dieses Journal gesteuert.

CREATE TABLE IF NOT EXISTS public.eyis_installation_state (
  id boolean PRIMARY KEY DEFAULT true,
  singleton boolean NOT NULL DEFAULT true,
  baseline_version text NOT NULL,
  schema_version text NOT NULL,
  migration_head text NOT NULL,
  schema_fingerprint text NOT NULL,
  state text NOT NULL DEFAULT 'INSTALLING',
  system_seed_version text,
  migration_history_reconciled boolean NOT NULL DEFAULT false,
  resources_verified boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eyis_installation_state_singleton CHECK (id),
  CONSTRAINT eyis_installation_state_state_check
    CHECK (state IN ('NOT_INSTALLED', 'INSTALLING', 'PARTIAL_INSTALL', 'INSTALLED', 'RECOVERY'))
);

CREATE TABLE IF NOT EXISTS public.eyis_installation_units (
  unit_id text PRIMARY KEY,
  position integer NOT NULL,
  checksum text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eyis_installation_units_status_check
    CHECK (status IN ('PENDING', 'RUNNING', 'PASS', 'FAIL', 'SKIPPED'))
);

-- Das Journal ist reine Systeminfrastruktur des Installers. Es enthält keine
-- Mandanten- oder Kundendaten und wird ausschließlich serverseitig gelesen.
GRANT ALL ON public.eyis_installation_state TO service_role;
GRANT ALL ON public.eyis_installation_units TO service_role;

ALTER TABLE public.eyis_installation_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eyis_installation_units ENABLE ROW LEVEL SECURITY;
