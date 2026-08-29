-- EYIS Database Install Pack — Tabellen: automation (automation-tables-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

CREATE TABLE public."automation_action_executions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "execution_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "position" integer NOT NULL,
  "action_type" text NOT NULL,
  "attempt" integer DEFAULT 1 NOT NULL,
  "status" automation_action_status DEFAULT 'pending'::automation_action_status NOT NULL,
  "input_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "output_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error_code" text,
  "error_message" text,
  "skipped_reason" text,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "automation_action_executions_execution_id_position_attempt_key" UNIQUE (execution_id, "position", attempt),
  CONSTRAINT "automation_action_executions_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."automation_actions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "rule_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "position" integer NOT NULL,
  "action_type" text NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "continue_on_failure" boolean DEFAULT false NOT NULL,
  "delay_seconds" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "automation_actions_pkey" PRIMARY KEY (id),
  CONSTRAINT "automation_actions_rule_id_position_key" UNIQUE (rule_id, "position")
);

CREATE TABLE public."automation_executions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "rule_id" uuid NOT NULL,
  "rule_version" integer DEFAULT 1 NOT NULL,
  "rule_version_id" uuid,
  "trigger_type" automation_trigger_type NOT NULL,
  "source_event_id" uuid,
  "source_event_type" text,
  "status" automation_execution_status DEFAULT 'queued'::automation_execution_status NOT NULL,
  "error_code" text,
  "error" text,
  "current_action_position" integer DEFAULT 0 NOT NULL,
  "context_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "correlation_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "causation_id" uuid,
  "chain_depth" integer DEFAULT 0 NOT NULL,
  "idempotency_key" text,
  "retry_of_execution_id" uuid,
  "triggered_by" uuid,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "duration_ms" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "automation_executions_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."automation_jobs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "execution_id" uuid,
  "rule_id" uuid,
  "job_type" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" automation_job_status DEFAULT 'pending'::automation_job_status NOT NULL,
  "available_at" timestamp with time zone DEFAULT now() NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 5 NOT NULL,
  "last_error" text,
  "last_error_code" text,
  "locked_at" timestamp with time zone,
  "locked_by" text,
  "dedupe_key" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "automation_jobs_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."automation_rule_counters" (
  "rule_id" uuid NOT NULL,
  "bucket_kind" text NOT NULL,
  "bucket_key" text NOT NULL,
  "window_start" timestamp with time zone NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "automation_rule_counters_pkey" PRIMARY KEY (rule_id, bucket_kind, bucket_key, window_start)
);

CREATE TABLE public."automation_rule_versions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "rule_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "trigger_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "conditions_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "actions_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "published_at" timestamp with time zone,
  "published_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "automation_rule_versions_pkey" PRIMARY KEY (id),
  CONSTRAINT "automation_rule_versions_rule_id_version_key" UNIQUE (rule_id, version)
);

CREATE TABLE public."automation_rules" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "status" automation_status DEFAULT 'draft'::automation_status NOT NULL,
  "trigger_type" automation_trigger_type DEFAULT 'domain_event'::automation_trigger_type NOT NULL,
  "trigger_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "conditions" jsonb DEFAULT '{"mode": "all", "conditions": []}'::jsonb NOT NULL,
  "priority" integer DEFAULT 100 NOT NULL,
  "stop_on_error" boolean DEFAULT true NOT NULL,
  "max_executions_per_event" integer DEFAULT 1 NOT NULL,
  "max_per_hour" integer,
  "max_per_entity" integer,
  "error_threshold" integer DEFAULT 50 NOT NULL,
  "error_window_minutes" integer DEFAULT 5 NOT NULL,
  "auto_paused_at" timestamp with time zone,
  "auto_pause_reason" text,
  "active_version" integer,
  "draft_version" integer DEFAULT 1 NOT NULL,
  "template_key" text,
  "last_executed_at" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "automation_rules_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."idempotency_keys" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid,
  "endpoint" text NOT NULL,
  "key" text NOT NULL,
  "request_hash" text,
  "response" jsonb,
  "status" text DEFAULT 'in_progress'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL,
  CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY (id),
  CONSTRAINT "idempotency_keys_unique" UNIQUE (organization_id, endpoint, key)
);

CREATE TABLE public."outbox_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid,
  "event_type" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "available_at" timestamp with time zone DEFAULT now() NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone,
  "shop_id" uuid,
  "correlation_id" uuid,
  "causation_id" uuid,
  "chain_depth" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."tasks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "status" task_status DEFAULT 'open'::task_status NOT NULL,
  "priority" task_priority DEFAULT 'normal'::task_priority NOT NULL,
  "entity_type" text,
  "entity_id" uuid,
  "assigned_to" uuid,
  "due_at" timestamp with time zone,
  "source" task_source DEFAULT 'manual'::task_source NOT NULL,
  "source_automation_execution_id" uuid,
  "dedupe_key" text,
  "completed_at" timestamp with time zone,
  "completed_by" uuid,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tasks_pkey" PRIMARY KEY (id)
);
