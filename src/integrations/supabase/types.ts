export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          organization_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          organization_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_item_price_snapshots: {
        Row: {
          applied_promotions: Json
          applied_rules: Json
          cart_item_id: string
          created_at: string
          id: string
          line_discount_minor: number
          line_subtotal_minor: number
          line_total_minor: number
          organization_id: string
          quantity: number
          snapshot_id: string
          unit_base_minor: number
          unit_resolved_minor: number
          variant_id: string
        }
        Insert: {
          applied_promotions?: Json
          applied_rules?: Json
          cart_item_id: string
          created_at?: string
          id?: string
          line_discount_minor?: number
          line_subtotal_minor?: number
          line_total_minor?: number
          organization_id: string
          quantity: number
          snapshot_id: string
          unit_base_minor?: number
          unit_resolved_minor?: number
          variant_id: string
        }
        Update: {
          applied_promotions?: Json
          applied_rules?: Json
          cart_item_id?: string
          created_at?: string
          id?: string
          line_discount_minor?: number
          line_subtotal_minor?: number
          line_total_minor?: number
          organization_id?: string
          quantity?: number
          snapshot_id?: string
          unit_base_minor?: number
          unit_resolved_minor?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_item_price_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_item_price_snapshots_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "cart_price_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          image_snapshot: string | null
          organization_id: string
          product_id: string
          quantity: number
          shop_id: string
          sku_snapshot: string | null
          title_snapshot: string
          updated_at: string
          variant_id: string
          variant_title_snapshot: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          image_snapshot?: string | null
          organization_id: string
          product_id: string
          quantity: number
          shop_id: string
          sku_snapshot?: string | null
          title_snapshot: string
          updated_at?: string
          variant_id: string
          variant_title_snapshot: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          image_snapshot?: string | null
          organization_id?: string
          product_id?: string
          quantity?: number
          shop_id?: string
          sku_snapshot?: string | null
          title_snapshot?: string
          updated_at?: string
          variant_id?: string
          variant_title_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_price_snapshots: {
        Row: {
          calculation_result: Json
          cart_id: string
          created_at: string
          currency_code: string
          discount_minor: number
          id: string
          organization_id: string
          pricing_context: Json
          pricing_engine_version: string
          shipping_minor: number
          shop_id: string
          subtotal_minor: number
          tax_minor: number
          total_minor: number
          version: number
        }
        Insert: {
          calculation_result?: Json
          cart_id: string
          created_at?: string
          currency_code: string
          discount_minor?: number
          id?: string
          organization_id: string
          pricing_context?: Json
          pricing_engine_version: string
          shipping_minor?: number
          shop_id: string
          subtotal_minor?: number
          tax_minor?: number
          total_minor?: number
          version: number
        }
        Update: {
          calculation_result?: Json
          cart_id?: string
          created_at?: string
          currency_code?: string
          discount_minor?: number
          id?: string
          organization_id?: string
          pricing_context?: Json
          pricing_engine_version?: string
          shipping_minor?: number
          shop_id?: string
          subtotal_minor?: number
          tax_minor?: number
          total_minor?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cart_price_snapshots_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_price_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_price_snapshots_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_promotion_codes: {
        Row: {
          cart_id: string
          code_snapshot: string
          created_at: string
          id: string
          organization_id: string
          promotion_id: string | null
          shop_id: string
        }
        Insert: {
          cart_id: string
          code_snapshot: string
          created_at?: string
          id?: string
          organization_id: string
          promotion_id?: string | null
          shop_id: string
        }
        Update: {
          cart_id?: string
          code_snapshot?: string
          created_at?: string
          id?: string
          organization_id?: string
          promotion_id?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_promotion_codes_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_promotion_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_promotion_codes_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_promotion_codes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          abandoned_at: string | null
          anonymous_token_hash: string | null
          completed_at: string | null
          created_at: string
          currency_code: string
          customer_email: string | null
          customer_id: string | null
          expires_at: string
          id: string
          last_activity_at: string
          locale: string
          metadata: Json
          organization_id: string
          region_code: string | null
          shop_id: string
          status: Database["public"]["Enums"]["cart_status"]
          updated_at: string
        }
        Insert: {
          abandoned_at?: string | null
          anonymous_token_hash?: string | null
          completed_at?: string | null
          created_at?: string
          currency_code: string
          customer_email?: string | null
          customer_id?: string | null
          expires_at?: string
          id?: string
          last_activity_at?: string
          locale?: string
          metadata?: Json
          organization_id: string
          region_code?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["cart_status"]
          updated_at?: string
        }
        Update: {
          abandoned_at?: string | null
          anonymous_token_hash?: string | null
          completed_at?: string | null
          created_at?: string
          currency_code?: string
          customer_email?: string | null
          customer_id?: string | null
          expires_at?: string
          id?: string
          last_activity_at?: string
          locale?: string
          metadata?: Json
          organization_id?: string
          region_code?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["cart_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          handle: string
          id: string
          metadata: Json
          name: string
          organization_id: string
          parent_id: string | null
          position: number
          shop_id: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          handle: string
          id?: string
          metadata?: Json
          name: string
          organization_id: string
          parent_id?: string | null
          position?: number
          shop_id: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          handle?: string
          id?: string
          metadata?: Json
          name?: string
          organization_id?: string
          parent_id?: string | null
          position?: number
          shop_id?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_addresses: {
        Row: {
          checkout_session_id: string
          city: string
          company: string | null
          country_code: string
          created_at: string
          first_name: string
          id: string
          last_name: string
          organization_id: string
          phone: string | null
          postal_code: string
          shop_id: string
          state: string | null
          street: string
          street2: string | null
          type: Database["public"]["Enums"]["checkout_address_type"]
          updated_at: string
        }
        Insert: {
          checkout_session_id: string
          city: string
          company?: string | null
          country_code: string
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          organization_id: string
          phone?: string | null
          postal_code: string
          shop_id: string
          state?: string | null
          street: string
          street2?: string | null
          type: Database["public"]["Enums"]["checkout_address_type"]
          updated_at?: string
        }
        Update: {
          checkout_session_id?: string
          city?: string
          company?: string | null
          country_code?: string
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          organization_id?: string
          phone?: string | null
          postal_code?: string
          shop_id?: string
          state?: string | null
          street?: string
          street2?: string | null
          type?: Database["public"]["Enums"]["checkout_address_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_addresses_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_addresses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_addresses_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_reservations: {
        Row: {
          cart_id: string
          cart_item_id: string
          checkout_session_id: string
          created_at: string
          id: string
          inventory_reservation_id: string
          organization_id: string
          quantity: number
          shop_id: string
        }
        Insert: {
          cart_id: string
          cart_item_id: string
          checkout_session_id: string
          created_at?: string
          id?: string
          inventory_reservation_id: string
          organization_id: string
          quantity: number
          shop_id: string
        }
        Update: {
          cart_id?: string
          cart_item_id?: string
          checkout_session_id?: string
          created_at?: string
          id?: string
          inventory_reservation_id?: string
          organization_id?: string
          quantity?: number
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_reservations_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_reservations_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_reservations_inventory_reservation_id_fkey"
            columns: ["inventory_reservation_id"]
            isOneToOne: false
            referencedRelation: "inventory_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_reservations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_reservations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_sessions: {
        Row: {
          billing_address_id: string | null
          billing_same_as_shipping: boolean
          cart_id: string
          completed_at: string | null
          created_at: string
          customer_id: string | null
          email: string | null
          expires_at: string
          id: string
          metadata: Json
          organization_id: string
          price_snapshot_id: string | null
          shipping_address_id: string | null
          shipping_option_id: string | null
          shop_id: string
          status: Database["public"]["Enums"]["checkout_session_status"]
          updated_at: string
          validated_at: string | null
        }
        Insert: {
          billing_address_id?: string | null
          billing_same_as_shipping?: boolean
          cart_id: string
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          metadata?: Json
          organization_id: string
          price_snapshot_id?: string | null
          shipping_address_id?: string | null
          shipping_option_id?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["checkout_session_status"]
          updated_at?: string
          validated_at?: string | null
        }
        Update: {
          billing_address_id?: string | null
          billing_same_as_shipping?: boolean
          cart_id?: string
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          metadata?: Json
          organization_id?: string
          price_snapshot_id?: string | null
          shipping_address_id?: string | null
          shipping_option_id?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["checkout_session_status"]
          updated_at?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_sessions_billing_address_fk"
            columns: ["billing_address_id"]
            isOneToOne: false
            referencedRelation: "checkout_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_price_snapshot_id_fkey"
            columns: ["price_snapshot_id"]
            isOneToOne: false
            referencedRelation: "cart_price_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_shipping_address_fk"
            columns: ["shipping_address_id"]
            isOneToOne: false
            referencedRelation: "checkout_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_shipping_option_id_fkey"
            columns: ["shipping_option_id"]
            isOneToOne: false
            referencedRelation: "shipping_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_snapshots: {
        Row: {
          billing_address: Json
          cart_snapshot_id: string | null
          checkout_session_id: string
          created_at: string
          currency_code: string
          email: string | null
          id: string
          lines: Json
          organization_id: string
          promotions: Json
          shipping_address: Json
          shipping_method: Json
          shop_id: string
          totals: Json
          version: number
        }
        Insert: {
          billing_address?: Json
          cart_snapshot_id?: string | null
          checkout_session_id: string
          created_at?: string
          currency_code: string
          email?: string | null
          id?: string
          lines?: Json
          organization_id: string
          promotions?: Json
          shipping_address?: Json
          shipping_method?: Json
          shop_id: string
          totals?: Json
          version: number
        }
        Update: {
          billing_address?: Json
          cart_snapshot_id?: string | null
          checkout_session_id?: string
          created_at?: string
          currency_code?: string
          email?: string | null
          id?: string
          lines?: Json
          organization_id?: string
          promotions?: Json
          shipping_address?: Json
          shipping_method?: Json
          shop_id?: string
          totals?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "checkout_snapshots_cart_snapshot_id_fkey"
            columns: ["cart_snapshot_id"]
            isOneToOne: false
            referencedRelation: "cart_price_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_snapshots_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_snapshots_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          handle: string
          id: string
          metadata: Json
          name: string
          organization_id: string
          shop_id: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          handle: string
          id?: string
          metadata?: Json
          name: string
          organization_id: string
          shop_id: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          handle?: string
          id?: string
          metadata?: Json
          name?: string
          organization_id?: string
          shop_id?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_groups: {
        Row: {
          created_at: string
          description: string | null
          handle: string
          id: string
          metadata: Json
          name: string
          organization_id: string
          shop_id: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          handle: string
          id?: string
          metadata?: Json
          name: string
          organization_id: string
          shop_id: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          handle?: string
          id?: string
          metadata?: Json
          name?: string
          organization_id?: string
          shop_id?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_groups_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string
          endpoint: string
          expires_at: string
          id: string
          key: string
          organization_id: string | null
          request_hash: string | null
          response: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          expires_at?: string
          id?: string
          key: string
          organization_id?: string | null
          request_hash?: string | null
          response?: Json | null
          status?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          expires_at?: string
          id?: string
          key?: string
          organization_id?: string | null
          request_hash?: string | null
          response?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          allow_backorder: boolean
          barcode: string | null
          created_at: string
          id: string
          metadata: Json
          organization_id: string
          sku: string | null
          track_inventory: boolean
          updated_at: string
          variant_id: string
        }
        Insert: {
          allow_backorder?: boolean
          barcode?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          organization_id: string
          sku?: string | null
          track_inventory?: boolean
          updated_at?: string
          variant_id: string
        }
        Update: {
          allow_backorder?: boolean
          barcode?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          organization_id?: string
          sku?: string | null
          track_inventory?: boolean
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_levels: {
        Row: {
          damaged: number
          id: string
          incoming: number
          inventory_item_id: string
          location_id: string
          on_hand: number
          organization_id: string
          reserved: number
          shop_id: string
          updated_at: string
        }
        Insert: {
          damaged?: number
          id?: string
          incoming?: number
          inventory_item_id: string
          location_id: string
          on_hand?: number
          organization_id: string
          reserved?: number
          shop_id: string
          updated_at?: string
        }
        Update: {
          damaged?: number
          id?: string
          incoming?: number
          inventory_item_id?: string
          location_id?: string
          on_hand?: number
          organization_id?: string
          reserved?: number
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_levels_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_locations: {
        Row: {
          address: Json
          code: string
          created_at: string
          id: string
          metadata: Json
          name: string
          organization_id: string
          priority: number
          shop_id: string
          status: Database["public"]["Enums"]["entity_status"]
          type: Database["public"]["Enums"]["location_type"]
          updated_at: string
        }
        Insert: {
          address?: Json
          code: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          organization_id: string
          priority?: number
          shop_id: string
          status?: Database["public"]["Enums"]["entity_status"]
          type?: Database["public"]["Enums"]["location_type"]
          updated_at?: string
        }
        Update: {
          address?: Json
          code?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          organization_id?: string
          priority?: number
          shop_id?: string
          status?: Database["public"]["Enums"]["entity_status"]
          type?: Database["public"]["Enums"]["location_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_locations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          actor_user_id: string | null
          created_at: string
          id: string
          idempotency_key: string | null
          inventory_item_id: string
          location_id: string | null
          metadata: Json
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          note: string | null
          organization_id: string
          quantity_delta: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          shop_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          inventory_item_id: string
          location_id?: string | null
          metadata?: Json
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          note?: string | null
          organization_id: string
          quantity_delta: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          shop_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          inventory_item_id?: string
          location_id?: string | null
          metadata?: Json
          movement_type?: Database["public"]["Enums"]["inventory_movement_type"]
          note?: string | null
          organization_id?: string
          quantity_delta?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_reservations: {
        Row: {
          backordered_quantity: number
          committed_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          idempotency_key: string | null
          inventory_item_id: string
          location_id: string | null
          metadata: Json
          organization_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          released_at: string | null
          shop_id: string
          status: Database["public"]["Enums"]["reservation_status"]
        }
        Insert: {
          backordered_quantity?: number
          committed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          inventory_item_id: string
          location_id?: string | null
          metadata?: Json
          organization_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          released_at?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["reservation_status"]
        }
        Update: {
          backordered_quantity?: number
          committed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          inventory_item_id?: string
          location_id?: string | null
          metadata?: Json
          organization_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          released_at?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["reservation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfer_items: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string
          quantity: number
          transfer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id: string
          quantity: number
          transfer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string
          quantity?: number
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfer_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "inventory_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfers: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          from_location_id: string
          id: string
          note: string | null
          organization_id: string
          reference: string | null
          shop_id: string
          status: Database["public"]["Enums"]["transfer_status"]
          to_location_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          from_location_id: string
          id?: string
          note?: string | null
          organization_id: string
          reference?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["transfer_status"]
          to_location_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          from_location_id?: string
          id?: string
          note?: string | null
          organization_id?: string
          reference?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["transfer_status"]
          to_location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfers_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          alt_text: string | null
          created_at: string
          filename: string
          height: number | null
          id: string
          metadata: Json
          mime_type: string | null
          organization_id: string
          shop_id: string | null
          size_bytes: number | null
          storage_path: string
          title: string | null
          updated_at: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          filename: string
          height?: number | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          organization_id: string
          shop_id?: string | null
          size_bytes?: number | null
          storage_path: string
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          filename?: string
          height?: number | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          organization_id?: string
          shop_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: []
      }
      outbox_events: {
        Row: {
          attempts: number
          available_at: string
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          organization_id: string | null
          payload: Json
          processed_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          organization_id?: string | null
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          organization_id?: string | null
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbox_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      price_sets: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          organization_id: string
          product_id: string | null
          shop_id: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          organization_id: string
          product_id?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          organization_id?: string
          product_id?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_sets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_sets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_sets_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_sets_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      prices: {
        Row: {
          amount_minor: number
          conditions: Json
          created_at: string
          currency_code: string
          customer_group_id: string | null
          ends_at: string | null
          id: string
          max_quantity: number | null
          metadata: Json
          min_quantity: number | null
          organization_id: string
          price_set_id: string
          priority: number
          shop_id: string
          starts_at: string | null
          status: Database["public"]["Enums"]["entity_status"]
          type: Database["public"]["Enums"]["price_type"]
          updated_at: string
        }
        Insert: {
          amount_minor: number
          conditions?: Json
          created_at?: string
          currency_code: string
          customer_group_id?: string | null
          ends_at?: string | null
          id?: string
          max_quantity?: number | null
          metadata?: Json
          min_quantity?: number | null
          organization_id: string
          price_set_id: string
          priority?: number
          shop_id: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          type?: Database["public"]["Enums"]["price_type"]
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          conditions?: Json
          created_at?: string
          currency_code?: string
          customer_group_id?: string | null
          ends_at?: string | null
          id?: string
          max_quantity?: number | null
          metadata?: Json
          min_quantity?: number | null
          organization_id?: string
          price_set_id?: string
          priority?: number
          shop_id?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          type?: Database["public"]["Enums"]["price_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prices_customer_group_id_fkey"
            columns: ["customer_group_id"]
            isOneToOne: false
            referencedRelation: "customer_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prices_price_set_id_fkey"
            columns: ["price_set_id"]
            isOneToOne: false
            referencedRelation: "price_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      product_blueprints: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_system: boolean
          key: string
          name: string
          organization_id: string | null
          schema: Json
          status: Database["public"]["Enums"]["blueprint_status"]
          ui_schema: Json
          updated_at: string
          variant_schema: Json
          version: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean
          key: string
          name: string
          organization_id?: string | null
          schema?: Json
          status?: Database["public"]["Enums"]["blueprint_status"]
          ui_schema?: Json
          updated_at?: string
          variant_schema?: Json
          version?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          organization_id?: string | null
          schema?: Json
          status?: Database["public"]["Enums"]["blueprint_status"]
          ui_schema?: Json
          updated_at?: string
          variant_schema?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_blueprints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          category_id: string
          position: number
          product_id: string
        }
        Insert: {
          category_id: string
          position?: number
          product_id: string
        }
        Update: {
          category_id?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_collections: {
        Row: {
          collection_id: string
          position: number
          product_id: string
        }
        Insert: {
          collection_id: string
          position?: number
          product_id: string
        }
        Update: {
          collection_id?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_collections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_collections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          created_at: string
          id: string
          media_asset_id: string
          position: number
          product_id: string
          role: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          media_asset_id: string
          position?: number
          product_id: string
          role?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          media_asset_id?: string
          position?: number
          product_id?: string
          role?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_media_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_values: {
        Row: {
          created_at: string
          id: string
          label: string | null
          metadata: Json
          option_id: string
          position: number
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          metadata?: Json
          option_id: string
          position?: number
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          metadata?: Json
          option_id?: string
          position?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_values_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          created_at: string
          display_type: string
          id: string
          key: string
          metadata: Json
          name: string
          position: number
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_type?: string
          id?: string
          key: string
          metadata?: Json
          name: string
          position?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_type?: string
          id?: string
          key?: string
          metadata?: Json
          name?: string
          position?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          created_at: string
          id: string
          metadata: Json
          option_signature: string
          organization_id: string
          position: number
          product_id: string
          sku: string | null
          status: Database["public"]["Enums"]["entity_status"]
          title: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          option_signature?: string
          organization_id: string
          position?: number
          product_id: string
          sku?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          title: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          option_signature?: string
          organization_id?: string
          position?: number
          product_id?: string
          sku?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          archived_at: string | null
          blueprint_data: Json
          blueprint_id: string | null
          blueprint_key: string
          blueprint_version: number
          created_at: string
          created_by: string | null
          description: string | null
          featured: boolean
          handle: string
          id: string
          metadata: Json
          name: string
          organization_id: string
          product_type: string | null
          seo_description: string | null
          seo_title: string | null
          shop_id: string
          status: Database["public"]["Enums"]["product_status"]
          subtitle: string | null
          updated_at: string
          updated_by: string | null
          vendor: string | null
        }
        Insert: {
          archived_at?: string | null
          blueprint_data?: Json
          blueprint_id?: string | null
          blueprint_key?: string
          blueprint_version?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          featured?: boolean
          handle: string
          id?: string
          metadata?: Json
          name: string
          organization_id: string
          product_type?: string | null
          seo_description?: string | null
          seo_title?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["product_status"]
          subtitle?: string | null
          updated_at?: string
          updated_by?: string | null
          vendor?: string | null
        }
        Update: {
          archived_at?: string | null
          blueprint_data?: Json
          blueprint_id?: string | null
          blueprint_key?: string
          blueprint_version?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          featured?: boolean
          handle?: string
          id?: string
          metadata?: Json
          name?: string
          organization_id?: string
          product_type?: string | null
          seo_description?: string | null
          seo_title?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["product_status"]
          subtitle?: string | null
          updated_at?: string
          updated_by?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "product_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          actions: Json
          code: string | null
          conditions: Json
          created_at: string
          currency_code: string | null
          description: string | null
          ends_at: string | null
          id: string
          metadata: Json
          name: string
          organization_id: string
          priority: number
          shop_id: string
          stackable: boolean
          starts_at: string | null
          status: Database["public"]["Enums"]["entity_status"]
          type: Database["public"]["Enums"]["promotion_type"]
          updated_at: string
          usage_limit: number | null
          usage_limit_per_customer: number | null
          value: number
        }
        Insert: {
          actions?: Json
          code?: string | null
          conditions?: Json
          created_at?: string
          currency_code?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          metadata?: Json
          name: string
          organization_id: string
          priority?: number
          shop_id: string
          stackable?: boolean
          starts_at?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          type: Database["public"]["Enums"]["promotion_type"]
          updated_at?: string
          usage_limit?: number | null
          usage_limit_per_customer?: number | null
          value?: number
        }
        Update: {
          actions?: Json
          code?: string | null
          conditions?: Json
          created_at?: string
          currency_code?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          metadata?: Json
          name?: string
          organization_id?: string
          priority?: number
          shop_id?: string
          stackable?: boolean
          starts_at?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          type?: Database["public"]["Enums"]["promotion_type"]
          updated_at?: string
          usage_limit?: number | null
          usage_limit_per_customer?: number | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "promotions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      shipping_methods: {
        Row: {
          amount_minor: number
          code: string
          countries: string[]
          created_at: string
          currency_code: string
          description: string | null
          free_above_minor: number | null
          id: string
          max_subtotal_minor: number | null
          metadata: Json
          min_subtotal_minor: number | null
          name: string
          organization_id: string
          position: number
          pricing_type: Database["public"]["Enums"]["shipping_pricing_type"]
          shop_id: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          amount_minor?: number
          code: string
          countries?: string[]
          created_at?: string
          currency_code: string
          description?: string | null
          free_above_minor?: number | null
          id?: string
          max_subtotal_minor?: number | null
          metadata?: Json
          min_subtotal_minor?: number | null
          name: string
          organization_id: string
          position?: number
          pricing_type?: Database["public"]["Enums"]["shipping_pricing_type"]
          shop_id: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          code?: string
          countries?: string[]
          created_at?: string
          currency_code?: string
          description?: string | null
          free_above_minor?: number | null
          id?: string
          max_subtotal_minor?: number | null
          metadata?: Json
          min_subtotal_minor?: number | null
          name?: string
          organization_id?: string
          position?: number
          pricing_type?: Database["public"]["Enums"]["shipping_pricing_type"]
          shop_id?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_methods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_methods_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_primary: boolean
          organization_id: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_primary?: boolean
          organization_id: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_primary?: boolean
          organization_id?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_domains_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_domains_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          created_at: string
          currency: string
          id: string
          locale: string
          name: string
          organization_id: string
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          locale?: string
          name: string
          organization_id: string
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          locale?: string
          name?: string
          organization_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shops_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_alert_rules: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          inventory_item_id: string | null
          location_id: string | null
          organization_id: string
          shop_id: string
          threshold: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          inventory_item_id?: string | null
          location_id?: string | null
          organization_id: string
          shop_id: string
          threshold?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          inventory_item_id?: string | null
          location_id?: string | null
          organization_id?: string
          shop_id?: string
          threshold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_alert_rules_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alert_rules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alert_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alert_rules_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_option_values: {
        Row: {
          option_id: string
          option_value_id: string
          variant_id: string
        }
        Insert: {
          option_id: string
          option_value_id: string
          variant_id: string
        }
        Update: {
          option_id?: string
          option_value_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_option_values_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_option_values_option_value_id_fkey"
            columns: ["option_value_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_option_values_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bulk_update_prices: {
        Args: {
          _amount_minor: number
          _mode: string
          _org_id: string
          _percent_bp: number
          _price_ids: string[]
        }
        Returns: {
          id: string
          new_amount: number
          old_amount: number
        }[]
      }
      cart_cancel_checkout: {
        Args: {
          _actor: string
          _idem?: string
          _org: string
          _session: string
          _status?: Database["public"]["Enums"]["checkout_session_status"]
        }
        Returns: Json
      }
      cart_expire_checkout_sessions: { Args: { _org?: string }; Returns: Json }
      cart_pick_location: {
        Args: { _item: string; _org: string; _qty: number; _shop: string }
        Returns: string
      }
      cart_release_session_reservations: {
        Args: { _org: string; _session: string }
        Returns: number
      }
      cart_start_checkout: {
        Args: {
          _actor: string
          _cart: string
          _email?: string
          _idem?: string
          _org: string
          _shop: string
          _snapshot: string
          _ttl_minutes?: number
        }
        Returns: Json
      }
      current_org_ids: { Args: never; Returns: string[] }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_permission: {
        Args: { _org_id: string; _permission: string; _user_id: string }
        Returns: boolean
      }
      inv_adjust_stock: {
        Args: {
          _actor: string
          _counted: number
          _idem?: string
          _item: string
          _loc: string
          _note?: string
          _org: string
          _reason: string
          _shop: string
        }
        Returns: Json
      }
      inv_assert: {
        Args: { _actor: string; _org: string; _perm: string }
        Returns: undefined
      }
      inv_audit: {
        Args: {
          _action: string
          _actor: string
          _entity: string
          _entity_id: string
          _meta: Json
          _org: string
        }
        Returns: undefined
      }
      inv_available: {
        Args: { _lvl: Database["public"]["Tables"]["inventory_levels"]["Row"] }
        Returns: number
      }
      inv_commit_reservation: {
        Args: {
          _actor: string
          _idem?: string
          _org: string
          _reservation: string
        }
        Returns: Json
      }
      inv_event: {
        Args: { _org: string; _payload: Json; _type: string }
        Returns: undefined
      }
      inv_expire_reservations: {
        Args: { _actor: string; _org: string }
        Returns: Json
      }
      inv_health_check: {
        Args: { _actor: string; _org: string }
        Returns: Json
      }
      inv_idem_get: {
        Args: { _endpoint: string; _key: string; _org: string }
        Returns: Json
      }
      inv_idem_put: {
        Args: { _endpoint: string; _key: string; _org: string; _response: Json }
        Returns: undefined
      }
      inv_lock_level: {
        Args: { _item: string; _loc: string; _org: string; _shop: string }
        Returns: {
          damaged: number
          id: string
          incoming: number
          inventory_item_id: string
          location_id: string
          on_hand: number
          organization_id: string
          reserved: number
          shop_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "inventory_levels"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      inv_mark_damaged: {
        Args: {
          _actor: string
          _idem?: string
          _item: string
          _loc: string
          _note?: string
          _org: string
          _qty: number
          _reason?: string
          _shop: string
        }
        Returns: Json
      }
      inv_movement: {
        Args: {
          _actor: string
          _delta: number
          _idem: string
          _item: string
          _loc: string
          _note: string
          _org: string
          _reason: string
          _ref_id: string
          _ref_type: string
          _shop: string
          _type: Database["public"]["Enums"]["inventory_movement_type"]
        }
        Returns: string
      }
      inv_receive_stock: {
        Args: {
          _actor: string
          _idem?: string
          _incoming_delta?: number
          _item: string
          _loc: string
          _note?: string
          _org: string
          _qty: number
          _reference?: string
          _shop: string
        }
        Returns: Json
      }
      inv_release_reservation: {
        Args: {
          _actor: string
          _idem?: string
          _org: string
          _reservation: string
        }
        Returns: Json
      }
      inv_reserve_stock: {
        Args: {
          _actor: string
          _expires_at?: string
          _idem?: string
          _item: string
          _loc: string
          _org: string
          _qty: number
          _reference_id?: string
          _reference_type?: string
          _shop: string
        }
        Returns: Json
      }
      inv_status_events: {
        Args: {
          _item: string
          _loc: string
          _new: number
          _old: number
          _org: string
          _shop: string
        }
        Returns: undefined
      }
      inv_transfer_cancel: {
        Args: {
          _actor: string
          _idem?: string
          _org: string
          _transfer: string
        }
        Returns: Json
      }
      inv_transfer_complete: {
        Args: {
          _actor: string
          _idem?: string
          _org: string
          _transfer: string
        }
        Returns: Json
      }
      inv_transfer_start: {
        Args: {
          _actor: string
          _idem?: string
          _org: string
          _transfer: string
        }
        Returns: Json
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      shares_org_with: { Args: { _other_user: string }; Returns: boolean }
      shop_in_org: {
        Args: { _org_id: string; _shop_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "owner"
        | "administrator"
        | "operations"
        | "catalog_manager"
        | "fulfillment"
        | "customer_support"
        | "finance"
        | "marketing"
        | "developer"
        | "read_only"
      blueprint_status: "draft" | "active" | "deprecated"
      cart_status: "active" | "checkout" | "completed" | "abandoned" | "expired"
      checkout_address_type: "shipping" | "billing"
      checkout_session_status:
        | "open"
        | "validated"
        | "awaiting_payment"
        | "completed"
        | "expired"
        | "cancelled"
      entity_status: "active" | "inactive" | "archived"
      inventory_movement_type:
        | "initial_stock"
        | "receipt"
        | "adjustment"
        | "reservation"
        | "reservation_release"
        | "sale_commit"
        | "return"
        | "transfer_out"
        | "transfer_in"
        | "damage"
        | "correction"
      invitation_status: "pending" | "accepted" | "revoked" | "expired"
      location_type: "warehouse" | "store" | "fulfillment_center" | "virtual"
      price_type: "base" | "sale" | "tier" | "customer_group" | "override"
      product_status: "draft" | "active" | "archived"
      promotion_type:
        | "percentage"
        | "fixed_amount"
        | "fixed_price"
        | "buy_x_get_y"
        | "free_shipping"
      reservation_status: "active" | "released" | "committed" | "expired"
      shipping_pricing_type: "fixed" | "free"
      transfer_status: "draft" | "in_transit" | "completed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "owner",
        "administrator",
        "operations",
        "catalog_manager",
        "fulfillment",
        "customer_support",
        "finance",
        "marketing",
        "developer",
        "read_only",
      ],
      blueprint_status: ["draft", "active", "deprecated"],
      cart_status: ["active", "checkout", "completed", "abandoned", "expired"],
      checkout_address_type: ["shipping", "billing"],
      checkout_session_status: [
        "open",
        "validated",
        "awaiting_payment",
        "completed",
        "expired",
        "cancelled",
      ],
      entity_status: ["active", "inactive", "archived"],
      inventory_movement_type: [
        "initial_stock",
        "receipt",
        "adjustment",
        "reservation",
        "reservation_release",
        "sale_commit",
        "return",
        "transfer_out",
        "transfer_in",
        "damage",
        "correction",
      ],
      invitation_status: ["pending", "accepted", "revoked", "expired"],
      location_type: ["warehouse", "store", "fulfillment_center", "virtual"],
      price_type: ["base", "sale", "tier", "customer_group", "override"],
      product_status: ["draft", "active", "archived"],
      promotion_type: [
        "percentage",
        "fixed_amount",
        "fixed_price",
        "buy_x_get_y",
        "free_shipping",
      ],
      reservation_status: ["active", "released", "committed", "expired"],
      shipping_pricing_type: ["fixed", "free"],
      transfer_status: ["draft", "in_transit", "completed", "cancelled"],
    },
  },
} as const
