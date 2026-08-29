-- EYIS Database Install Pack — Tabellen: identity (identity-tables-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

CREATE TABLE public."audit_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid,
  "actor_id" uuid,
  "actor_email" text,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "audit_log_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."invitations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "email" text NOT NULL,
  "role" app_role DEFAULT 'read_only'::app_role NOT NULL,
  "token_hash" text NOT NULL,
  "status" invitation_status DEFAULT 'pending'::invitation_status NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "invited_by" uuid,
  "accepted_at" timestamp with time zone,
  "accepted_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "invitations_pkey" PRIMARY KEY (id),
  CONSTRAINT "invitations_token_hash_key" UNIQUE (token_hash)
);

CREATE TABLE public."memberships" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" app_role DEFAULT 'read_only'::app_role NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "memberships_org_user_unique" UNIQUE (organization_id, user_id),
  CONSTRAINT "memberships_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."organizations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "status" entity_status DEFAULT 'active'::entity_status NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organizations_pkey" PRIMARY KEY (id),
  CONSTRAINT "organizations_slug_key" UNIQUE (slug)
);

CREATE TABLE public."profiles" (
  "id" uuid NOT NULL,
  "email" text,
  "full_name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."role_permissions" (
  "role" app_role NOT NULL,
  "permission" text NOT NULL,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY (role, permission)
);
