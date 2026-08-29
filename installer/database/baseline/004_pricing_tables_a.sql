-- EYIS Database Install Pack — Tabellen: pricing (pricing-tables-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

CREATE TABLE public."price_sets" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "product_id" uuid,
  "variant_id" uuid,
  "status" entity_status DEFAULT 'active'::entity_status NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "price_sets_exactly_one_target" CHECK ((((product_id IS NOT NULL) AND (variant_id IS NULL)) OR ((product_id IS NULL) AND (variant_id IS NOT NULL)))),
  CONSTRAINT "price_sets_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."prices" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "price_set_id" uuid NOT NULL,
  "currency_code" text NOT NULL,
  "amount_minor" bigint NOT NULL,
  "type" price_type DEFAULT 'base'::price_type NOT NULL,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "min_quantity" integer,
  "max_quantity" integer,
  "customer_group_id" uuid,
  "priority" integer DEFAULT 0 NOT NULL,
  "status" entity_status DEFAULT 'active'::entity_status NOT NULL,
  "conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "prices_amount_non_negative" CHECK ((amount_minor >= 0)),
  CONSTRAINT "prices_currency_format" CHECK ((currency_code ~ '^[A-Z]{3}$'::text)),
  CONSTRAINT "prices_group_needs_group" CHECK (((type <> 'customer_group'::price_type) OR (customer_group_id IS NOT NULL))),
  CONSTRAINT "prices_max_qty_valid" CHECK (((max_quantity IS NULL) OR ((min_quantity IS NOT NULL) AND (max_quantity >= min_quantity)))),
  CONSTRAINT "prices_min_qty_positive" CHECK (((min_quantity IS NULL) OR (min_quantity > 0))),
  CONSTRAINT "prices_period_valid" CHECK (((starts_at IS NULL) OR (ends_at IS NULL) OR (starts_at < ends_at))),
  CONSTRAINT "prices_pkey" PRIMARY KEY (id),
  CONSTRAINT "prices_tier_needs_min" CHECK (((type <> 'tier'::price_type) OR (min_quantity IS NOT NULL)))
);

CREATE TABLE public."promotions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "code" text,
  "type" promotion_type NOT NULL,
  "value" bigint DEFAULT 0 NOT NULL,
  "currency_code" text,
  "status" entity_status DEFAULT 'inactive'::entity_status NOT NULL,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "usage_limit" integer,
  "usage_limit_per_customer" integer,
  "priority" integer DEFAULT 0 NOT NULL,
  "stackable" boolean DEFAULT true NOT NULL,
  "conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "promotions_currency_format" CHECK (((currency_code IS NULL) OR (currency_code ~ '^[A-Z]{3}$'::text))),
  CONSTRAINT "promotions_percentage_range" CHECK (((type <> 'percentage'::promotion_type) OR ((value >= 0) AND (value <= 10000)))),
  CONSTRAINT "promotions_period_valid" CHECK (((starts_at IS NULL) OR (ends_at IS NULL) OR (starts_at < ends_at))),
  CONSTRAINT "promotions_pkey" PRIMARY KEY (id),
  CONSTRAINT "promotions_usage_limits" CHECK ((((usage_limit IS NULL) OR (usage_limit > 0)) AND ((usage_limit_per_customer IS NULL) OR (usage_limit_per_customer > 0)))),
  CONSTRAINT "promotions_value_non_negative" CHECK ((value >= 0))
);
