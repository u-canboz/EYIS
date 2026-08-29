-- EYIS Database Install Pack — Tabellen: cart-checkout (cart-checkout-tables-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

CREATE TABLE public."cart_item_price_snapshots" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "cart_item_id" uuid NOT NULL,
  "variant_id" uuid NOT NULL,
  "quantity" integer NOT NULL,
  "unit_base_minor" bigint DEFAULT 0 NOT NULL,
  "unit_resolved_minor" bigint DEFAULT 0 NOT NULL,
  "line_subtotal_minor" bigint DEFAULT 0 NOT NULL,
  "line_discount_minor" bigint DEFAULT 0 NOT NULL,
  "line_total_minor" bigint DEFAULT 0 NOT NULL,
  "applied_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "applied_promotions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "cart_item_price_snapshots_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."cart_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "cart_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "variant_id" uuid NOT NULL,
  "quantity" integer NOT NULL,
  "title_snapshot" text NOT NULL,
  "variant_title_snapshot" text NOT NULL,
  "sku_snapshot" text,
  "image_snapshot" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "cart_items_cart_id_variant_id_key" UNIQUE (cart_id, variant_id),
  CONSTRAINT "cart_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "cart_items_quantity_check" CHECK ((quantity > 0))
);

CREATE TABLE public."cart_price_snapshots" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "cart_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "currency_code" text NOT NULL,
  "subtotal_minor" bigint DEFAULT 0 NOT NULL,
  "discount_minor" bigint DEFAULT 0 NOT NULL,
  "shipping_minor" bigint DEFAULT 0 NOT NULL,
  "tax_minor" bigint DEFAULT 0 NOT NULL,
  "total_minor" bigint DEFAULT 0 NOT NULL,
  "pricing_engine_version" text NOT NULL,
  "pricing_context" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "calculation_result" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "tax_breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "tax_engine_version" text DEFAULT 'none'::text NOT NULL,
  CONSTRAINT "cart_price_snapshots_cart_id_version_key" UNIQUE (cart_id, version),
  CONSTRAINT "cart_price_snapshots_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."cart_promotion_codes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "cart_id" uuid NOT NULL,
  "promotion_id" uuid,
  "code_snapshot" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "cart_promotion_codes_cart_id_code_snapshot_key" UNIQUE (cart_id, code_snapshot),
  CONSTRAINT "cart_promotion_codes_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."carts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "customer_id" uuid,
  "anonymous_token_hash" text,
  "status" cart_status DEFAULT 'active'::cart_status NOT NULL,
  "currency_code" text NOT NULL,
  "customer_email" text,
  "region_code" text,
  "locale" text DEFAULT 'de'::text NOT NULL,
  "expires_at" timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL,
  "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
  "abandoned_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "carts_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."checkout_addresses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "checkout_session_id" uuid NOT NULL,
  "type" checkout_address_type NOT NULL,
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
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "checkout_addresses_checkout_session_id_type_key" UNIQUE (checkout_session_id, type),
  CONSTRAINT "checkout_addresses_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."checkout_reservations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "cart_id" uuid NOT NULL,
  "checkout_session_id" uuid NOT NULL,
  "inventory_reservation_id" uuid NOT NULL,
  "cart_item_id" uuid NOT NULL,
  "quantity" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "checkout_reservations_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."checkout_sessions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "cart_id" uuid NOT NULL,
  "status" checkout_session_status DEFAULT 'open'::checkout_session_status NOT NULL,
  "customer_id" uuid,
  "email" text,
  "shipping_address_id" uuid,
  "billing_address_id" uuid,
  "billing_same_as_shipping" boolean DEFAULT true NOT NULL,
  "shipping_option_id" uuid,
  "price_snapshot_id" uuid,
  "expires_at" timestamp with time zone DEFAULT (now() + '00:20:00'::interval) NOT NULL,
  "validated_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "customer_type" tax_customer_type DEFAULT 'consumer'::tax_customer_type NOT NULL,
  "company_name" text,
  "customer_vat_id" text,
  "vat_validation_id" uuid,
  CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."checkout_snapshots" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "checkout_session_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "cart_snapshot_id" uuid,
  "email" text,
  "shipping_address" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "billing_address" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "shipping_method" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "promotions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "currency_code" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "tax_breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "tax_engine_version" text DEFAULT 'none'::text NOT NULL,
  CONSTRAINT "checkout_snapshots_checkout_session_id_version_key" UNIQUE (checkout_session_id, version),
  CONSTRAINT "checkout_snapshots_pkey" PRIMARY KEY (id)
);
