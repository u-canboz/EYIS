-- EYIS Database Install Pack — Tabellen: system-updates (system-updates-tables-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

CREATE TABLE public."commerce_installation" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "singleton" boolean DEFAULT true NOT NULL,
  "installation_id" text NOT NULL,
  "mode" text DEFAULT 'shared'::text NOT NULL,
  "core_version" text NOT NULL,
  "schema_version" text,
  "api_version" text DEFAULT 'v1'::text NOT NULL,
  "sdk_version" text,
  "installed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_migrated_at" timestamp with time zone,
  "owner_claimed_at" timestamp with time zone,
  "setup_completed_at" timestamp with time zone,
  "health_status" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "setup_progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "storefront_origin" text,
  "claim_token_hash" text,
  "claim_token_expires_at" timestamp with time zone,
  "claim_token_used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "installed_release_id" text,
  "update_channel" text DEFAULT 'stable'::text NOT NULL,
  "auto_update_policy" text DEFAULT 'manual'::text NOT NULL,
  "system_seed_version" integer DEFAULT 1 NOT NULL,
  "last_update_check_at" timestamp with time zone,
  "last_successful_update_at" timestamp with time zone,
  "maintenance_state" text DEFAULT 'off'::text NOT NULL,
  "update_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "available_release" jsonb,
  "organization_id" uuid,
  "shop_id" uuid,
  "storefront_key_id" uuid,
  "storefront_publishable_key" text,
  CONSTRAINT "commerce_installation_auto_update_policy_check" CHECK ((auto_update_policy = ANY (ARRAY['manual'::text, 'security_only'::text, 'patch'::text]))),
  CONSTRAINT "commerce_installation_installation_id_key" UNIQUE (installation_id),
  CONSTRAINT "commerce_installation_maintenance_state_check" CHECK ((maintenance_state = ANY (ARRAY['off'::text, 'updating'::text, 'manual'::text]))),
  CONSTRAINT "commerce_installation_mode_check" CHECK ((mode = ANY (ARRAY['shared'::text, 'dedicated'::text]))),
  CONSTRAINT "commerce_installation_pkey" PRIMARY KEY (id),
  CONSTRAINT "commerce_installation_singleton" UNIQUE (singleton),
  CONSTRAINT "commerce_installation_update_channel_check" CHECK ((update_channel = ANY (ARRAY['stable'::text, 'beta'::text, 'development'::text])))
);

CREATE TABLE public."demo_environments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "seed_version" text NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "seeded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_reset_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "demo_environments_organization_id_key" UNIQUE (organization_id),
  CONSTRAINT "demo_environments_pkey" PRIMARY KEY (id),
  CONSTRAINT "demo_environments_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'reset_pending'::text])))
);

CREATE TABLE public."integration_connections" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "category" integration_category NOT NULL,
  "provider" text NOT NULL,
  "status" integration_status DEFAULT 'not_connected'::integration_status NOT NULL,
  "environment" text DEFAULT 'test'::text NOT NULL,
  "configuration_reference" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "integration_connections_environment_check" CHECK ((environment = ANY (ARRAY['test'::text, 'live'::text]))),
  CONSTRAINT "integration_connections_pkey" PRIMARY KEY (id),
  CONSTRAINT "integration_connections_shop_id_category_provider_environme_key" UNIQUE (shop_id, category, provider, environment)
);

CREATE TABLE public."integration_health" (
  "connection_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "status" integration_health_status DEFAULT 'unknown'::integration_health_status NOT NULL,
  "last_checked_at" timestamp with time zone,
  "last_success_at" timestamp with time zone,
  "last_error_code" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "integration_health_pkey" PRIMARY KEY (connection_id)
);

CREATE TABLE public."qa_fixtures" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid,
  "scenario" text NOT NULL,
  "run_ref" text NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "manifest" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "residual_notes" text,
  "destroyed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "qa_fixtures_organization_id_key" UNIQUE (organization_id),
  CONSTRAINT "qa_fixtures_pkey" PRIMARY KEY (id),
  CONSTRAINT "qa_fixtures_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'destroyed'::text, 'failed'::text])))
);

CREATE TABLE public."update_run_steps" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "update_run_id" uuid NOT NULL,
  "position" integer NOT NULL,
  "step" text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "output_summary" text,
  "error_code" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "update_run_steps_pkey" PRIMARY KEY (id),
  CONSTRAINT "update_run_steps_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'passed'::text, 'failed'::text, 'skipped'::text, 'blocked'::text]))),
  CONSTRAINT "update_run_steps_unique" UNIQUE (update_run_id, "position")
);

CREATE TABLE public."update_runs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "installation_id" text NOT NULL,
  "from_version" text NOT NULL,
  "to_version" text NOT NULL,
  "release_id" text NOT NULL,
  "channel" text DEFAULT 'stable'::text NOT NULL,
  "status" text DEFAULT 'preflight'::text NOT NULL,
  "initiated_by" uuid,
  "initiated_by_email" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "deployment_provider" text,
  "deployment_reference" text,
  "migration_provider" text,
  "migration_from" text,
  "migration_to" text,
  "backup_reference" text,
  "current_step" text,
  "error_code" text,
  "safe_error_message" text,
  "rollback_status" text DEFAULT 'none'::text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "update_runs_pkey" PRIMARY KEY (id),
  CONSTRAINT "update_runs_rollback_status_check" CHECK ((rollback_status = ANY (ARRAY['none'::text, 'requested'::text, 'running'::text, 'completed'::text, 'failed'::text, 'not_supported'::text]))),
  CONSTRAINT "update_runs_status_check" CHECK ((status = ANY (ARRAY['preflight'::text, 'ready'::text, 'backup_check'::text, 'maintenance'::text, 'deploying'::text, 'migrating'::text, 'seeding'::text, 'verifying'::text, 'completed'::text, 'failed'::text, 'rolling_back'::text, 'rolled_back'::text, 'manual_attention'::text])))
);
