-- EYIS Database Install Pack — Tabellen: inventory (inventory-tables-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

CREATE TABLE public."inventory_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "variant_id" uuid NOT NULL,
  "sku" text,
  "barcode" text,
  "track_inventory" boolean DEFAULT true NOT NULL,
  "allow_backorder" boolean DEFAULT false NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "inventory_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "inventory_items_variant_id_key" UNIQUE (variant_id)
);

CREATE TABLE public."inventory_levels" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "inventory_item_id" uuid NOT NULL,
  "location_id" uuid NOT NULL,
  "on_hand" integer DEFAULT 0 NOT NULL,
  "reserved" integer DEFAULT 0 NOT NULL,
  "incoming" integer DEFAULT 0 NOT NULL,
  "damaged" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "inventory_levels_damaged_check" CHECK ((damaged >= 0)),
  CONSTRAINT "inventory_levels_incoming_check" CHECK ((incoming >= 0)),
  CONSTRAINT "inventory_levels_inventory_item_id_location_id_key" UNIQUE (inventory_item_id, location_id),
  CONSTRAINT "inventory_levels_pkey" PRIMARY KEY (id),
  CONSTRAINT "inventory_levels_reserved_check" CHECK ((reserved >= 0))
);

CREATE TABLE public."inventory_locations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "type" location_type DEFAULT 'warehouse'::location_type NOT NULL,
  "status" entity_status DEFAULT 'active'::entity_status NOT NULL,
  "address" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "priority" integer DEFAULT 100 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "inventory_locations_pkey" PRIMARY KEY (id),
  CONSTRAINT "inventory_locations_shop_id_code_key" UNIQUE (shop_id, code)
);

CREATE TABLE public."inventory_movements" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "inventory_item_id" uuid NOT NULL,
  "location_id" uuid,
  "movement_type" inventory_movement_type NOT NULL,
  "quantity_delta" integer NOT NULL,
  "reference_type" text,
  "reference_id" text,
  "reason" text,
  "note" text,
  "actor_user_id" uuid,
  "idempotency_key" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "inventory_movements_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."inventory_reservations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "inventory_item_id" uuid NOT NULL,
  "location_id" uuid,
  "quantity" integer NOT NULL,
  "backordered_quantity" integer DEFAULT 0 NOT NULL,
  "status" reservation_status DEFAULT 'active'::reservation_status NOT NULL,
  "reference_type" text,
  "reference_id" text,
  "expires_at" timestamp with time zone,
  "idempotency_key" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "released_at" timestamp with time zone,
  "committed_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "inventory_reservations_backordered_quantity_check" CHECK ((backordered_quantity >= 0)),
  CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY (id),
  CONSTRAINT "inventory_reservations_quantity_check" CHECK ((quantity > 0))
);

CREATE TABLE public."inventory_transfer_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "transfer_id" uuid NOT NULL,
  "inventory_item_id" uuid NOT NULL,
  "quantity" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "inventory_transfer_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "inventory_transfer_items_quantity_check" CHECK ((quantity > 0)),
  CONSTRAINT "inventory_transfer_items_transfer_id_inventory_item_id_key" UNIQUE (transfer_id, inventory_item_id)
);

CREATE TABLE public."inventory_transfers" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "from_location_id" uuid NOT NULL,
  "to_location_id" uuid NOT NULL,
  "status" transfer_status DEFAULT 'draft'::transfer_status NOT NULL,
  "reference" text,
  "note" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  CONSTRAINT "inventory_transfers_check" CHECK ((from_location_id <> to_location_id)),
  CONSTRAINT "inventory_transfers_pkey" PRIMARY KEY (id)
);

CREATE TABLE public."stock_alert_rules" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "inventory_item_id" uuid,
  "location_id" uuid,
  "threshold" integer DEFAULT 5 NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "stock_alert_rules_pkey" PRIMARY KEY (id),
  CONSTRAINT "stock_alert_rules_threshold_check" CHECK ((threshold >= 0))
);
