-- EYIS Database Install Pack — Tabellen: tax-shipping (tax-shipping-tables-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

CREATE TABLE public."delivery_notes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "fulfillment_id" uuid,
  "document_number" text,
  "status" delivery_note_status DEFAULT 'draft'::delivery_note_status NOT NULL,
  "recipient_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "seller_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "branding_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "items" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "notes" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" uuid,
  "issued_by" uuid,
  "issued_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "delivery_notes_organization_id_document_number_key" UNIQUE (organization_id, document_number),
  CONSTRAINT "delivery_notes_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."fulfillment_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "fulfillment_id" uuid NOT NULL,
  "order_item_id" uuid NOT NULL,
  "quantity" integer NOT NULL,
  "picked_quantity" integer DEFAULT 0 NOT NULL,
  "packed_quantity" integer DEFAULT 0 NOT NULL,
  "shipped_quantity" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fulfillment_items_check" CHECK ((picked_quantity <= quantity)),
  CONSTRAINT "fulfillment_items_check1" CHECK ((packed_quantity <= picked_quantity)),
  CONSTRAINT "fulfillment_items_check2" CHECK ((shipped_quantity <= packed_quantity)),
  CONSTRAINT "fulfillment_items_fulfillment_id_order_item_id_key" UNIQUE (fulfillment_id, order_item_id),
  CONSTRAINT "fulfillment_items_packed_quantity_check" CHECK ((packed_quantity >= 0)),
  CONSTRAINT "fulfillment_items_picked_quantity_check" CHECK ((picked_quantity >= 0)),
  CONSTRAINT "fulfillment_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "fulfillment_items_quantity_check" CHECK ((quantity > 0)),
  CONSTRAINT "fulfillment_items_shipped_quantity_check" CHECK ((shipped_quantity >= 0))
);

CREATE TABLE public."fulfillments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "location_id" uuid,
  "status" fulfillment_state DEFAULT 'draft'::fulfillment_state NOT NULL,
  "created_by" uuid,
  "assigned_to" uuid,
  "started_at" timestamp with time zone,
  "packed_at" timestamp with time zone,
  "shipped_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "notes" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fulfillments_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."package_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "package_id" uuid NOT NULL,
  "fulfillment_item_id" uuid NOT NULL,
  "quantity" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "package_items_package_id_fulfillment_item_id_key" UNIQUE (package_id, fulfillment_item_id),
  CONSTRAINT "package_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "package_items_quantity_check" CHECK ((quantity > 0))
);

CREATE TABLE public."package_presets" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid,
  "name" text NOT NULL,
  "weight_grams" integer,
  "length_mm" integer,
  "width_mm" integer,
  "height_mm" integer,
  "packaging_type" text,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "package_presets_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."packages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "fulfillment_id" uuid NOT NULL,
  "package_number" integer NOT NULL,
  "weight_grams" integer,
  "length_mm" integer,
  "width_mm" integer,
  "height_mm" integer,
  "packaging_type" text,
  "status" package_status DEFAULT 'draft'::package_status NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "packages_fulfillment_id_package_number_key" UNIQUE (fulfillment_id, package_number),
  CONSTRAINT "packages_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."shipments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "fulfillment_id" uuid NOT NULL,
  "package_id" uuid,
  "carrier_provider" text NOT NULL,
  "carrier_service" text,
  "provider_shipment_id" text,
  "tracking_number" text,
  "tracking_url" text,
  "status" shipment_status DEFAULT 'created'::shipment_status NOT NULL,
  "normalized_tracking_status" tracking_status DEFAULT 'pre_transit'::tracking_status NOT NULL,
  "shipped_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "label_id" uuid,
  "carrier_cost_minor" bigint,
  "currency_code" text,
  "last_error" jsonb,
  "idempotency_key" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "direction" shipment_direction DEFAULT 'outbound'::shipment_direction NOT NULL,
  CONSTRAINT "shipments_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."shipping_labels" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "shipment_id" uuid NOT NULL,
  "provider" text NOT NULL,
  "format" text DEFAULT 'pdf'::text NOT NULL,
  "storage_path" text NOT NULL,
  "mime_type" text DEFAULT 'application/pdf'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "voided_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "shipping_labels_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."shipping_methods" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "description" text,
  "pricing_type" shipping_pricing_type DEFAULT 'fixed'::shipping_pricing_type NOT NULL,
  "amount_minor" bigint DEFAULT 0 NOT NULL,
  "currency_code" text NOT NULL,
  "status" entity_status DEFAULT 'active'::entity_status NOT NULL,
  "countries" text[] DEFAULT '{}'::text[] NOT NULL,
  "min_subtotal_minor" bigint,
  "max_subtotal_minor" bigint,
  "free_above_minor" bigint,
  "position" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shipping_methods_pkey" PRIMARY KEY (id),
  CONSTRAINT "shipping_methods_shop_id_code_key" UNIQUE (shop_id, code)
);

CREATE TABLE public."shipping_provider_configs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "provider" text NOT NULL,
  "display_name" text NOT NULL,
  "status" entity_status DEFAULT 'active'::entity_status NOT NULL,
  "test_mode" boolean DEFAULT true NOT NULL,
  "priority" integer DEFAULT 100 NOT NULL,
  "configuration_reference" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shipping_provider_configs_pkey" PRIMARY KEY (id),
  CONSTRAINT "shipping_provider_configs_shop_id_provider_key" UNIQUE (shop_id, provider)
);

CREATE TABLE public."tax_classes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid,
  "shop_id" uuid,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "description" text,
  "status" entity_status DEFAULT 'active'::entity_status NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tax_classes_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."tax_rates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid,
  "shop_id" uuid,
  "tax_class_id" uuid NOT NULL,
  "country_code" text NOT NULL,
  "region_code" text,
  "rate_basis_points" integer NOT NULL,
  "valid_from" timestamp with time zone DEFAULT now() NOT NULL,
  "valid_until" timestamp with time zone,
  "customer_type" tax_customer_type DEFAULT 'any'::tax_customer_type NOT NULL,
  "transaction_type" text DEFAULT 'goods'::text NOT NULL,
  "status" entity_status DEFAULT 'active'::entity_status NOT NULL,
  "priority" integer DEFAULT 100 NOT NULL,
  "source" text DEFAULT 'manual'::text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tax_rates_pkey" PRIMARY KEY (id),
  CONSTRAINT "tax_rates_rate_basis_points_check" CHECK (((rate_basis_points >= 0) AND (rate_basis_points <= 10000)))
);

CREATE TABLE public."tax_settings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "calculation_mode" tax_calculation_mode DEFAULT 'gross'::tax_calculation_mode NOT NULL,
  "home_country_code" text DEFAULT 'DE'::text NOT NULL,
  "default_tax_class_id" uuid,
  "prices_include_tax" boolean DEFAULT true NOT NULL,
  "display_prices_including_tax" boolean DEFAULT true NOT NULL,
  "shipping_tax_strategy" shipping_tax_strategy DEFAULT 'fixed_class'::shipping_tax_strategy NOT NULL,
  "shipping_tax_class_id" uuid,
  "b2b_enabled" boolean DEFAULT false NOT NULL,
  "eu_oss_enabled" boolean DEFAULT false NOT NULL,
  "small_business_exemption_enabled" boolean DEFAULT false NOT NULL,
  "tax_number" text,
  "vat_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tax_settings_pkey" PRIMARY KEY (id),
  CONSTRAINT "tax_settings_shop_id_key" UNIQUE (shop_id)
);

CREATE TABLE public."tax_snapshots" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "cart_id" uuid,
  "checkout_session_id" uuid,
  "order_id" uuid,
  "calculation_mode" tax_calculation_mode NOT NULL,
  "jurisdiction" text NOT NULL,
  "customer_type" tax_customer_type DEFAULT 'consumer'::tax_customer_type NOT NULL,
  "result" jsonb NOT NULL,
  "engine_version" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tax_snapshots_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."tracking_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "shipment_id" uuid NOT NULL,
  "carrier_provider" text NOT NULL,
  "provider_event_id" text,
  "event_code" text NOT NULL,
  "normalized_status" tracking_status DEFAULT 'unknown'::tracking_status NOT NULL,
  "description" text,
  "location" text,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "dedupe_hash" text NOT NULL,
  "raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tracking_events_pkey" PRIMARY KEY (id)
);
