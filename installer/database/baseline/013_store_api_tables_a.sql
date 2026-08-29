-- EYIS Database Install Pack — Tabellen: store-api (store-api-tables-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

CREATE TABLE public."oauth_states" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "state_hash" text NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "provider" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "oauth_states_pkey" PRIMARY KEY (id),
  CONSTRAINT "oauth_states_state_hash_key" UNIQUE (state_hash)
);

CREATE TABLE public."shop_domains" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "domain" text NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_domains_domain_key" UNIQUE (domain),
  CONSTRAINT "shop_domains_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."shop_order_sequences" (
  "shop_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "prefix" text DEFAULT 'ORD'::text NOT NULL,
  "padding" integer DEFAULT 6 NOT NULL,
  "next_value" bigint DEFAULT 1 NOT NULL,
  CONSTRAINT "shop_order_sequences_pkey" PRIMARY KEY (shop_id)
);

CREATE TABLE public."shops" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "currency" text DEFAULT 'EUR'::text NOT NULL,
  "locale" text DEFAULT 'de-DE'::text NOT NULL,
  "status" entity_status DEFAULT 'active'::entity_status NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shops_org_slug_unique" UNIQUE (organization_id, slug),
  CONSTRAINT "shops_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."store_api_keys" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "name" text NOT NULL,
  "key_prefix" text NOT NULL,
  "key_hash" text NOT NULL,
  "environment" commerce_environment DEFAULT 'test'::commerce_environment NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "allowed_origins" text[] DEFAULT '{}'::text[] NOT NULL,
  "rate_limit_profile" text DEFAULT 'default'::text NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  "last_used_at" timestamp with time zone,
  CONSTRAINT "store_api_keys_key_hash_key" UNIQUE (key_hash),
  CONSTRAINT "store_api_keys_pkey" PRIMARY KEY (id),
  CONSTRAINT "store_api_keys_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text])))
);

CREATE TABLE public."store_api_rate_counters" (
  "key_id" uuid NOT NULL,
  "profile" text NOT NULL,
  "bucket" text NOT NULL,
  "window_start" timestamp with time zone NOT NULL,
  "hits" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "store_api_rate_counters_pkey" PRIMARY KEY (key_id, profile, bucket, window_start)
);

CREATE TABLE public."store_api_request_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "request_id" uuid NOT NULL,
  "organization_id" uuid,
  "key_id" uuid,
  "shop_id" uuid,
  "method" text NOT NULL,
  "route" text NOT NULL,
  "status_code" integer NOT NULL,
  "duration_ms" integer DEFAULT 0 NOT NULL,
  "ip_hash" text,
  "user_agent_summary" text,
  "error_code" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "store_api_request_logs_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."store_confirmation_tokens" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "store_confirmation_tokens_pkey" PRIMARY KEY (id),
  CONSTRAINT "store_confirmation_tokens_token_hash_key" UNIQUE (token_hash)
);

CREATE TABLE public."store_privacy_salts" (
  "salt_date" date NOT NULL,
  "salt" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "store_privacy_salts_pkey" PRIMARY KEY (salt_date)
);
