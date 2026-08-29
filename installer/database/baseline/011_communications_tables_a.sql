-- EYIS Database Install Pack — Tabellen: communications (communications-tables-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

CREATE TABLE public."communication_attempts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "communication_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "provider" text NOT NULL,
  "attempt_number" integer NOT NULL,
  "provider_message_id" text,
  "status" communication_delivery_status DEFAULT 'unknown'::communication_delivery_status NOT NULL,
  "error_code" text,
  "error_message" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "communication_attempts_communication_id_attempt_number_key" UNIQUE (communication_id, attempt_number),
  CONSTRAINT "communication_attempts_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."communication_branding" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "logo_media_id" uuid,
  "primary_color" text DEFAULT '#1f2937'::text NOT NULL,
  "background_color" text DEFAULT '#f4f4f5'::text NOT NULL,
  "content_background_color" text DEFAULT '#ffffff'::text NOT NULL,
  "text_color" text DEFAULT '#18181b'::text NOT NULL,
  "muted_text_color" text DEFAULT '#71717a'::text NOT NULL,
  "button_style" text DEFAULT 'solid'::text NOT NULL,
  "border_radius" integer DEFAULT 8 NOT NULL,
  "font_family" text DEFAULT 'Helvetica, Arial, sans-serif'::text NOT NULL,
  "footer_text" text DEFAULT ''::text NOT NULL,
  "support_email" text,
  "website_url" text,
  "social_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "communication_branding_pkey" PRIMARY KEY (id),
  CONSTRAINT "communication_branding_shop_id_key" UNIQUE (shop_id)
);

CREATE TABLE public."communication_provider_configs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid,
  "channel" communication_channel DEFAULT 'email'::communication_channel NOT NULL,
  "provider" text NOT NULL,
  "display_name" text NOT NULL,
  "status" communication_provider_status DEFAULT 'inactive'::communication_provider_status NOT NULL,
  "test_mode" boolean DEFAULT true NOT NULL,
  "priority" integer DEFAULT 100 NOT NULL,
  "configuration_reference" text,
  "capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "communication_provider_config_organization_id_shop_id_chann_key" UNIQUE (organization_id, shop_id, channel, provider),
  CONSTRAINT "communication_provider_configs_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."communication_provider_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid,
  "shop_id" uuid,
  "provider" text NOT NULL,
  "provider_event_id" text NOT NULL,
  "provider_message_id" text,
  "event_type" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "signature_verified" boolean DEFAULT false NOT NULL,
  "processing_status" text DEFAULT 'pending'::text NOT NULL,
  "processing_error" text,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone,
  CONSTRAINT "communication_provider_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "communication_provider_events_provider_provider_event_id_key" UNIQUE (provider, provider_event_id)
);

CREATE TABLE public."communication_rules" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "channel" communication_channel DEFAULT 'email'::communication_channel NOT NULL,
  "template_key" text NOT NULL,
  "template_id" uuid,
  "enabled" boolean DEFAULT true NOT NULL,
  "delay_seconds" integer DEFAULT 0 NOT NULL,
  "conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "priority" integer DEFAULT 100 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "communication_rules_pkey" PRIMARY KEY (id),
  CONSTRAINT "communication_rules_shop_id_event_type_channel_template_key_key" UNIQUE (shop_id, event_type, channel, template_key)
);

CREATE TABLE public."communication_suppressions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid,
  "channel" communication_channel DEFAULT 'email'::communication_channel NOT NULL,
  "address" text NOT NULL,
  "reason" communication_suppression_reason NOT NULL,
  "source" text DEFAULT 'system'::text NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone,
  CONSTRAINT "communication_suppressions_organization_id_channel_address__key" UNIQUE (organization_id, channel, address, reason),
  CONSTRAINT "communication_suppressions_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."communication_template_versions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "locale" text DEFAULT 'de-DE'::text NOT NULL,
  "subject" text NOT NULL,
  "preheader" text,
  "body_schema" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "text_body_template" text DEFAULT ''::text NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "published_at" timestamp with time zone,
  CONSTRAINT "communication_template_versions_pkey" PRIMARY KEY (id),
  CONSTRAINT "communication_template_versions_template_id_version_locale_key" UNIQUE (template_id, version, locale)
);

CREATE TABLE public."communication_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid,
  "shop_id" uuid,
  "key" text NOT NULL,
  "channel" communication_channel DEFAULT 'email'::communication_channel NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text DEFAULT 'general'::text NOT NULL,
  "status" communication_template_status DEFAULT 'active'::communication_template_status NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "default_locale" text DEFAULT 'de-DE'::text NOT NULL,
  "subject_template" text DEFAULT ''::text NOT NULL,
  "content_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "communication_templates_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."communications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "channel" communication_channel DEFAULT 'email'::communication_channel NOT NULL,
  "template_key" text NOT NULL,
  "template_version_id" uuid,
  "communication_rule_id" uuid,
  "locale" text DEFAULT 'de-DE'::text NOT NULL,
  "recipient_type" communication_recipient_type DEFAULT 'customer'::communication_recipient_type NOT NULL,
  "recipient_reference_id" uuid,
  "recipient_address" text NOT NULL,
  "sender_identity_id" uuid,
  "sender_name" text,
  "sender_address" text,
  "subject_snapshot" text NOT NULL,
  "html_snapshot" text NOT NULL,
  "text_snapshot" text NOT NULL,
  "status" communication_status DEFAULT 'queued'::communication_status NOT NULL,
  "delivery_status" communication_delivery_status,
  "provider" text,
  "provider_status_raw" text,
  "test_mode" boolean DEFAULT false NOT NULL,
  "is_test_send" boolean DEFAULT false NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "next_attempt_at" timestamp with time zone,
  "resend_of_communication_id" uuid,
  "order_id" uuid,
  "customer_id" uuid,
  "source_event_type" text,
  "source_event_id" uuid,
  "scheduled_at" timestamp with time zone,
  "queued_at" timestamp with time zone,
  "sent_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "communications_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."outgoing_webhook_endpoints" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "name" text NOT NULL,
  "url" text NOT NULL,
  "secret_reference" text,
  "status" entity_status DEFAULT 'active'::entity_status NOT NULL,
  "last_status_code" integer,
  "last_error" text,
  "last_called_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "outgoing_webhook_endpoints_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."sender_domains" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "domain" text NOT NULL,
  "status" sender_domain_status DEFAULT 'dns_required'::sender_domain_status NOT NULL,
  "dns_records" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "provider" text,
  "provider_reference" text,
  CONSTRAINT "sender_domains_pkey" PRIMARY KEY (id),
  CONSTRAINT "sender_domains_shop_id_domain_key" UNIQUE (shop_id, domain)
);

CREATE TABLE public."sender_identities" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "channel" communication_channel DEFAULT 'email'::communication_channel NOT NULL,
  "display_name" text NOT NULL,
  "sender_name" text NOT NULL,
  "sender_address" text NOT NULL,
  "reply_to" text,
  "status" entity_status DEFAULT 'active'::entity_status NOT NULL,
  "verification_status" sender_verification_status DEFAULT 'unverified'::sender_verification_status NOT NULL,
  "provider_reference" text,
  "is_default" boolean DEFAULT false NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sender_domain_id" uuid,
  CONSTRAINT "sender_identities_pkey" PRIMARY KEY (id),
  CONSTRAINT "sender_identities_shop_id_channel_sender_address_key" UNIQUE (shop_id, channel, sender_address)
);
