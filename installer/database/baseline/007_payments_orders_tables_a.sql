-- EYIS Database Install Pack — Tabellen: payments-orders (payments-orders-tables-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

CREATE TABLE public."order_addresses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "type" checkout_address_type NOT NULL,
  "address" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "order_addresses_order_id_type_key" UNIQUE (order_id, type),
  CONSTRAINT "order_addresses_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."order_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "product_id" uuid,
  "variant_id" uuid,
  "title_snapshot" text NOT NULL,
  "variant_title_snapshot" text NOT NULL,
  "sku_snapshot" text,
  "quantity" integer NOT NULL,
  "unit_base_minor" bigint NOT NULL,
  "unit_resolved_minor" bigint NOT NULL,
  "line_subtotal_minor" bigint NOT NULL,
  "line_discount_minor" bigint NOT NULL,
  "line_total_minor" bigint NOT NULL,
  "applied_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "applied_promotions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "net_minor" bigint DEFAULT 0 NOT NULL,
  "tax_minor" bigint DEFAULT 0 NOT NULL,
  "gross_minor" bigint DEFAULT 0 NOT NULL,
  "tax_rate_basis_points" integer DEFAULT 0 NOT NULL,
  "tax_class_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "tax_reason_code" text DEFAULT 'unknown'::text NOT NULL,
  "tax_country_code" text,
  CONSTRAINT "order_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "order_items_quantity_check" CHECK ((quantity > 0))
);

CREATE TABLE public."order_promotions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "promotion_id" uuid,
  "code_snapshot" text,
  "name_snapshot" text NOT NULL,
  "discount_minor" bigint DEFAULT 0 NOT NULL,
  "detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "order_promotions_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."orders" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "order_number" text NOT NULL,
  "checkout_session_id" uuid NOT NULL,
  "checkout_snapshot_id" uuid NOT NULL,
  "cart_id" uuid,
  "customer_id" uuid,
  "email" text,
  "environment" commerce_environment DEFAULT 'test'::commerce_environment NOT NULL,
  "order_status" order_state DEFAULT 'confirmed'::order_state NOT NULL,
  "payment_status" order_payment_status DEFAULT 'paid'::order_payment_status NOT NULL,
  "fulfillment_status" order_fulfillment_status DEFAULT 'unfulfilled'::order_fulfillment_status NOT NULL,
  "currency_code" text NOT NULL,
  "subtotal_minor" bigint DEFAULT 0 NOT NULL,
  "discount_minor" bigint DEFAULT 0 NOT NULL,
  "shipping_minor" bigint DEFAULT 0 NOT NULL,
  "tax_minor" bigint DEFAULT 0 NOT NULL,
  "total_minor" bigint DEFAULT 0 NOT NULL,
  "refunded_minor" bigint DEFAULT 0 NOT NULL,
  "shipping_method" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "internal_note" text,
  "cancelled_at" timestamp with time zone,
  "cancel_reason" text,
  "placed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "net_total_minor" bigint DEFAULT 0 NOT NULL,
  "tax_total_minor" bigint DEFAULT 0 NOT NULL,
  "gross_total_minor" bigint DEFAULT 0 NOT NULL,
  "tax_breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "tax_engine_version" text DEFAULT 'none'::text NOT NULL,
  "tax_snapshot_id" uuid,
  CONSTRAINT "orders_checkout_session_id_key" UNIQUE (checkout_session_id),
  CONSTRAINT "orders_pkey" PRIMARY KEY (id),
  CONSTRAINT "orders_shop_id_order_number_key" UNIQUE (shop_id, order_number)
);

CREATE TABLE public."payment_attempts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "payment_session_id" uuid NOT NULL,
  "attempt_number" integer NOT NULL,
  "status" payment_attempt_status DEFAULT 'started'::payment_attempt_status NOT NULL,
  "provider_payment_id" text,
  "error_code" text,
  "error_message" text,
  "provider_response" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payment_attempts_payment_session_id_attempt_number_key" UNIQUE (payment_session_id, attempt_number),
  CONSTRAINT "payment_attempts_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."payment_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid,
  "provider" text NOT NULL,
  "provider_event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "signature_verified" boolean DEFAULT false NOT NULL,
  "processed" boolean DEFAULT false NOT NULL,
  "processed_at" timestamp with time zone,
  "process_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payment_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "payment_events_provider_provider_event_id_key" UNIQUE (provider, provider_event_id)
);

CREATE TABLE public."payment_provider_configs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "provider" text NOT NULL,
  "display_name" text NOT NULL,
  "environment" commerce_environment DEFAULT 'test'::commerce_environment NOT NULL,
  "status" entity_status DEFAULT 'inactive'::entity_status NOT NULL,
  "priority" integer DEFAULT 100 NOT NULL,
  "secret_ref" text,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payment_provider_configs_pkey" PRIMARY KEY (id),
  CONSTRAINT "payment_provider_configs_shop_id_provider_environment_key" UNIQUE (shop_id, provider, environment)
);

CREATE TABLE public."payment_sessions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "checkout_session_id" uuid NOT NULL,
  "checkout_snapshot_id" uuid NOT NULL,
  "provider" text NOT NULL,
  "environment" commerce_environment DEFAULT 'test'::commerce_environment NOT NULL,
  "status" payment_session_status DEFAULT 'created'::payment_session_status NOT NULL,
  "amount_minor" bigint NOT NULL,
  "currency_code" text NOT NULL,
  "provider_session_id" text,
  "provider_payment_id" text,
  "redirect_url" text,
  "idempotency_key" text,
  "last_error" text,
  "expires_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payment_sessions_amount_minor_check" CHECK ((amount_minor >= 0)),
  CONSTRAINT "payment_sessions_organization_id_provider_provider_session__key" UNIQUE (organization_id, provider, provider_session_id),
  CONSTRAINT "payment_sessions_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."payment_transactions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "order_id" uuid,
  "payment_session_id" uuid,
  "provider" text NOT NULL,
  "type" payment_transaction_type NOT NULL,
  "amount_minor" bigint NOT NULL,
  "currency_code" text NOT NULL,
  "provider_transaction_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payment_transactions_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."provider_credentials" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "category" integration_category NOT NULL,
  "provider" text NOT NULL,
  "environment" text DEFAULT 'test'::text NOT NULL,
  "reference" text NOT NULL,
  "ciphertext" text NOT NULL,
  "iv" text NOT NULL,
  "key_version" integer DEFAULT 1 NOT NULL,
  "hints" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "provider_credentials_environment_check" CHECK ((environment = ANY (ARRAY['test'::text, 'live'::text]))),
  CONSTRAINT "provider_credentials_pkey" PRIMARY KEY (id),
  CONSTRAINT "provider_credentials_reference_key" UNIQUE (reference),
  CONSTRAINT "provider_credentials_shop_id_category_provider_environment_key" UNIQUE (shop_id, category, provider, environment),
  CONSTRAINT "provider_credentials_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text])))
);

CREATE TABLE public."refunds" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "amount_minor" bigint NOT NULL,
  "currency_code" text NOT NULL,
  "reason" text,
  "status" refund_status DEFAULT 'requested'::refund_status NOT NULL,
  "provider" text,
  "provider_refund_id" text,
  "requested_by" uuid,
  "idempotency_key" text,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "refunds_amount_minor_check" CHECK ((amount_minor > 0)),
  CONSTRAINT "refunds_pkey" PRIMARY KEY (id)
);
