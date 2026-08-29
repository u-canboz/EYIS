-- EYIS Database Install Pack — Tabellen: catalog (catalog-tables-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

CREATE TABLE public."categories" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "parent_id" uuid,
  "name" text NOT NULL,
  "handle" text NOT NULL,
  "description" text,
  "position" integer DEFAULT 0 NOT NULL,
  "status" entity_status DEFAULT 'active'::entity_status NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "categories_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."collections" (
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
  CONSTRAINT "collections_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."media_assets" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid,
  "storage_path" text NOT NULL,
  "filename" text NOT NULL,
  "mime_type" text,
  "size_bytes" bigint,
  "width" integer,
  "height" integer,
  "alt_text" text,
  "title" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "uploaded_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "media_assets_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."product_blueprints" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid,
  "key" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "icon" text,
  "version" integer DEFAULT 1 NOT NULL,
  "status" blueprint_status DEFAULT 'active'::blueprint_status NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "schema" jsonb DEFAULT '{"groups": []}'::jsonb NOT NULL,
  "ui_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "variant_schema" jsonb DEFAULT '{"axes": []}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "blueprint_owner_check" CHECK (((is_system AND (organization_id IS NULL)) OR ((NOT is_system) AND (organization_id IS NOT NULL)))),
  CONSTRAINT "product_blueprints_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."product_categories" (
  "product_id" uuid NOT NULL,
  "category_id" uuid NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "product_categories_pkey" PRIMARY KEY (product_id, category_id)
);

CREATE TABLE public."product_collections" (
  "product_id" uuid NOT NULL,
  "collection_id" uuid NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "product_collections_pkey" PRIMARY KEY (product_id, collection_id)
);

CREATE TABLE public."product_media" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL,
  "media_asset_id" uuid NOT NULL,
  "variant_id" uuid,
  "position" integer DEFAULT 0 NOT NULL,
  "role" text DEFAULT 'gallery'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_media_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."product_option_values" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "option_id" uuid NOT NULL,
  "value" text NOT NULL,
  "label" text,
  "position" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_option_values_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."product_options" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL,
  "name" text NOT NULL,
  "key" text NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "display_type" text DEFAULT 'list'::text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_options_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."product_variants" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "title" text NOT NULL,
  "sku" text,
  "barcode" text,
  "status" entity_status DEFAULT 'active'::entity_status NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "option_signature" text DEFAULT ''::text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "tax_class_id" uuid,
  CONSTRAINT "product_variants_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."products" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "blueprint_id" uuid,
  "blueprint_key" text DEFAULT 'standard'::text NOT NULL,
  "blueprint_version" integer DEFAULT 1 NOT NULL,
  "name" text NOT NULL,
  "handle" text NOT NULL,
  "subtitle" text,
  "description" text,
  "status" product_status DEFAULT 'draft'::product_status NOT NULL,
  "product_type" text,
  "vendor" text,
  "featured" boolean DEFAULT false NOT NULL,
  "seo_title" text,
  "seo_description" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "blueprint_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "archived_at" timestamp with time zone,
  "tax_class_id" uuid,
  "return_policy_type" return_policy_type DEFAULT 'standard'::return_policy_type NOT NULL,
  "return_policy_note" text,
  CONSTRAINT "products_pkey" PRIMARY KEY (id),
  CONSTRAINT "products_shop_org_check" CHECK ((shop_id IS NOT NULL))
);

CREATE TABLE public."variant_option_values" (
  "variant_id" uuid NOT NULL,
  "option_id" uuid NOT NULL,
  "option_value_id" uuid NOT NULL,
  CONSTRAINT "variant_option_values_pkey" PRIMARY KEY (variant_id, option_id)
);
