-- EYIS Database Install Pack — Tabellen: customers-returns (customers-returns-tables-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

CREATE TABLE public."customer_addresses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "type" customer_address_type DEFAULT 'both'::customer_address_type NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "company" text,
  "street" text NOT NULL,
  "street2" text,
  "postal_code" text NOT NULL,
  "city" text NOT NULL,
  "state" text,
  "country_code" text NOT NULL,
  "phone" text,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_addresses_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."customer_group_members" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "customer_group_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_group_members_customer_id_customer_group_id_key" UNIQUE (customer_id, customer_group_id),
  CONSTRAINT "customer_group_members_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."customer_groups" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "name" text NOT NULL,
  "handle" text NOT NULL,
  "description" text,
  "status" entity_status DEFAULT 'active'::entity_status NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_groups_pkey" PRIMARY KEY (id),
  CONSTRAINT "customer_groups_shop_in_org" CHECK (true)
);

CREATE TABLE public."customer_notes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "body" text NOT NULL,
  "author_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_notes_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."customers" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "auth_user_id" uuid,
  "email" text NOT NULL,
  "first_name" text,
  "last_name" text,
  "phone" text,
  "status" customer_status DEFAULT 'active'::customer_status NOT NULL,
  "customer_type" customer_kind DEFAULT 'b2c'::customer_kind NOT NULL,
  "default_shipping_address_id" uuid,
  "default_billing_address_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customers_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."guest_order_access_tokens" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "guest_order_access_tokens_pkey" PRIMARY KEY (id),
  CONSTRAINT "guest_order_access_tokens_token_hash_key" UNIQUE (token_hash)
);

CREATE TABLE public."return_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "return_id" uuid NOT NULL,
  "order_item_id" uuid NOT NULL,
  "quantity_requested" integer NOT NULL,
  "quantity_received" integer DEFAULT 0 NOT NULL,
  "quantity_approved" integer DEFAULT 0 NOT NULL,
  "reason_code" return_reason_code DEFAULT 'other'::return_reason_code NOT NULL,
  "condition" return_item_condition DEFAULT 'unknown'::return_item_condition NOT NULL,
  "resolution" return_resolution DEFAULT 'refund'::return_resolution NOT NULL,
  "restock_decision" restock_decision DEFAULT 'pending'::restock_decision NOT NULL,
  "restocked_at" timestamp with time zone,
  "restock_location_id" uuid,
  "refund_amount_minor" bigint,
  "inspection_note" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "return_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "return_items_quantity_approved_check" CHECK ((quantity_approved >= 0)),
  CONSTRAINT "return_items_quantity_received_check" CHECK ((quantity_received >= 0)),
  CONSTRAINT "return_items_quantity_requested_check" CHECK ((quantity_requested > 0)),
  CONSTRAINT "return_items_return_id_order_item_id_key" UNIQUE (return_id, order_item_id)
);

CREATE TABLE public."return_media" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "return_id" uuid NOT NULL,
  "return_item_id" uuid,
  "media_asset_id" uuid NOT NULL,
  "uploaded_by_type" text DEFAULT 'customer'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "return_media_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."return_sequences" (
  "shop_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "prefix" text DEFAULT 'RMA'::text NOT NULL,
  "padding" integer DEFAULT 6 NOT NULL,
  "year" integer DEFAULT (EXTRACT(year FROM now()))::integer NOT NULL,
  "next_value" bigint DEFAULT 1 NOT NULL,
  CONSTRAINT "return_sequences_pkey" PRIMARY KEY (shop_id)
);

CREATE TABLE public."return_settings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "returns_enabled" boolean DEFAULT true NOT NULL,
  "default_return_window_days" integer DEFAULT 30 NOT NULL,
  "window_start" return_window_start DEFAULT 'delivery_date'::return_window_start NOT NULL,
  "approval_strategy" return_approval_strategy DEFAULT 'manual'::return_approval_strategy NOT NULL,
  "customer_pays_return_shipping" boolean DEFAULT true NOT NULL,
  "auto_refund_on_approval" boolean DEFAULT false NOT NULL,
  "auto_restock" boolean DEFAULT false NOT NULL,
  "instructions" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "return_settings_pkey" PRIMARY KEY (id),
  CONSTRAINT "return_settings_shop_id_key" UNIQUE (shop_id)
);

CREATE TABLE public."returns" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "customer_id" uuid,
  "return_number" text NOT NULL,
  "status" return_status DEFAULT 'requested'::return_status NOT NULL,
  "reason_category" return_reason_code DEFAULT 'other'::return_reason_code NOT NULL,
  "customer_note" text,
  "internal_note" text,
  "rejection_reason" text,
  "shipping_refund_mode" shipping_refund_mode DEFAULT 'none'::shipping_refund_mode NOT NULL,
  "shipping_refund_minor" bigint DEFAULT 0 NOT NULL,
  "refund_total_minor" bigint DEFAULT 0 NOT NULL,
  "currency_code" text DEFAULT 'EUR'::text NOT NULL,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "authorized_at" timestamp with time zone,
  "received_at" timestamp with time zone,
  "inspected_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "refund_id" uuid,
  "credit_note_id" uuid,
  "return_shipment_id" uuid,
  "idempotency_key" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "returns_organization_id_idempotency_key_key" UNIQUE (organization_id, idempotency_key),
  CONSTRAINT "returns_organization_id_return_number_key" UNIQUE (organization_id, return_number),
  CONSTRAINT "returns_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."vat_validations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "customer_id" uuid,
  "vat_id" text NOT NULL,
  "country_code" text NOT NULL,
  "normalized_vat_id" text NOT NULL,
  "status" vat_validation_status DEFAULT 'pending'::vat_validation_status NOT NULL,
  "provider" text DEFAULT 'none'::text NOT NULL,
  "provider_reference" text,
  "checked_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "response_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "vat_validations_pkey" PRIMARY KEY (id)
);
