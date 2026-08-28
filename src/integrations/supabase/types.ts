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
    PostgrestVersion: "14.5"
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
      automation_action_executions: {
        Row: {
          action_type: string
          attempt: number
          created_at: string
          error_code: string | null
          error_message: string | null
          execution_id: string
          finished_at: string | null
          id: string
          input_snapshot: Json
          organization_id: string
          output_snapshot: Json
          position: number
          skipped_reason: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["automation_action_status"]
          updated_at: string
        }
        Insert: {
          action_type: string
          attempt?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          execution_id: string
          finished_at?: string | null
          id?: string
          input_snapshot?: Json
          organization_id: string
          output_snapshot?: Json
          position: number
          skipped_reason?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["automation_action_status"]
          updated_at?: string
        }
        Update: {
          action_type?: string
          attempt?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          execution_id?: string
          finished_at?: string | null
          id?: string
          input_snapshot?: Json
          organization_id?: string
          output_snapshot?: Json
          position?: number
          skipped_reason?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["automation_action_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_action_executions_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "automation_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_action_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_actions: {
        Row: {
          action_type: string
          config: Json
          continue_on_failure: boolean
          created_at: string
          delay_seconds: number
          id: string
          organization_id: string
          position: number
          rule_id: string
          updated_at: string
        }
        Insert: {
          action_type: string
          config?: Json
          continue_on_failure?: boolean
          created_at?: string
          delay_seconds?: number
          id?: string
          organization_id: string
          position: number
          rule_id: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          config?: Json
          continue_on_failure?: boolean
          created_at?: string
          delay_seconds?: number
          id?: string
          organization_id?: string
          position?: number
          rule_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_actions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_executions: {
        Row: {
          causation_id: string | null
          chain_depth: number
          context_snapshot: Json
          correlation_id: string
          created_at: string
          current_action_position: number
          duration_ms: number | null
          error: string | null
          error_code: string | null
          finished_at: string | null
          id: string
          idempotency_key: string | null
          organization_id: string
          retry_of_execution_id: string | null
          rule_id: string
          rule_version: number
          rule_version_id: string | null
          shop_id: string
          source_event_id: string | null
          source_event_type: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["automation_execution_status"]
          trigger_type: Database["public"]["Enums"]["automation_trigger_type"]
          triggered_by: string | null
          updated_at: string
        }
        Insert: {
          causation_id?: string | null
          chain_depth?: number
          context_snapshot?: Json
          correlation_id?: string
          created_at?: string
          current_action_position?: number
          duration_ms?: number | null
          error?: string | null
          error_code?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          organization_id: string
          retry_of_execution_id?: string | null
          rule_id: string
          rule_version?: number
          rule_version_id?: string | null
          shop_id: string
          source_event_id?: string | null
          source_event_type?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["automation_execution_status"]
          trigger_type: Database["public"]["Enums"]["automation_trigger_type"]
          triggered_by?: string | null
          updated_at?: string
        }
        Update: {
          causation_id?: string | null
          chain_depth?: number
          context_snapshot?: Json
          correlation_id?: string
          created_at?: string
          current_action_position?: number
          duration_ms?: number | null
          error?: string | null
          error_code?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          organization_id?: string
          retry_of_execution_id?: string | null
          rule_id?: string
          rule_version?: number
          rule_version_id?: string | null
          shop_id?: string
          source_event_id?: string | null
          source_event_type?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["automation_execution_status"]
          trigger_type?: Database["public"]["Enums"]["automation_trigger_type"]
          triggered_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_retry_of_execution_id_fkey"
            columns: ["retry_of_execution_id"]
            isOneToOne: false
            referencedRelation: "automation_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_rule_version_id_fkey"
            columns: ["rule_version_id"]
            isOneToOne: false
            referencedRelation: "automation_rule_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_jobs: {
        Row: {
          attempts: number
          available_at: string
          created_at: string
          dedupe_key: string | null
          execution_id: string | null
          id: string
          job_type: string
          last_error: string | null
          last_error_code: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          organization_id: string
          payload: Json
          rule_id: string | null
          shop_id: string
          status: Database["public"]["Enums"]["automation_job_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          created_at?: string
          dedupe_key?: string | null
          execution_id?: string | null
          id?: string
          job_type: string
          last_error?: string | null
          last_error_code?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          organization_id: string
          payload?: Json
          rule_id?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["automation_job_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          created_at?: string
          dedupe_key?: string | null
          execution_id?: string | null
          id?: string
          job_type?: string
          last_error?: string | null
          last_error_code?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          organization_id?: string
          payload?: Json
          rule_id?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["automation_job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_jobs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "automation_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_jobs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_jobs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rule_counters: {
        Row: {
          bucket_key: string
          bucket_kind: string
          count: number
          rule_id: string
          updated_at: string
          window_start: string
        }
        Insert: {
          bucket_key: string
          bucket_kind: string
          count?: number
          rule_id: string
          updated_at?: string
          window_start: string
        }
        Update: {
          bucket_key?: string
          bucket_kind?: string
          count?: number
          rule_id?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rule_counters_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rule_versions: {
        Row: {
          actions_snapshot: Json
          conditions_snapshot: Json
          created_at: string
          id: string
          organization_id: string
          published_at: string | null
          published_by: string | null
          rule_id: string
          trigger_snapshot: Json
          updated_at: string
          version: number
        }
        Insert: {
          actions_snapshot?: Json
          conditions_snapshot?: Json
          created_at?: string
          id?: string
          organization_id: string
          published_at?: string | null
          published_by?: string | null
          rule_id: string
          trigger_snapshot?: Json
          updated_at?: string
          version: number
        }
        Update: {
          actions_snapshot?: Json
          conditions_snapshot?: Json
          created_at?: string
          id?: string
          organization_id?: string
          published_at?: string | null
          published_by?: string | null
          rule_id?: string
          trigger_snapshot?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "automation_rule_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rule_versions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          active_version: number | null
          auto_pause_reason: string | null
          auto_paused_at: string | null
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          draft_version: number
          error_threshold: number
          error_window_minutes: number
          id: string
          last_executed_at: string | null
          max_executions_per_event: number
          max_per_entity: number | null
          max_per_hour: number | null
          name: string
          organization_id: string
          priority: number
          shop_id: string
          status: Database["public"]["Enums"]["automation_status"]
          stop_on_error: boolean
          template_key: string | null
          trigger_config: Json
          trigger_type: Database["public"]["Enums"]["automation_trigger_type"]
          updated_at: string
        }
        Insert: {
          active_version?: number | null
          auto_pause_reason?: string | null
          auto_paused_at?: string | null
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          draft_version?: number
          error_threshold?: number
          error_window_minutes?: number
          id?: string
          last_executed_at?: string | null
          max_executions_per_event?: number
          max_per_entity?: number | null
          max_per_hour?: number | null
          name: string
          organization_id: string
          priority?: number
          shop_id: string
          status?: Database["public"]["Enums"]["automation_status"]
          stop_on_error?: boolean
          template_key?: string | null
          trigger_config?: Json
          trigger_type?: Database["public"]["Enums"]["automation_trigger_type"]
          updated_at?: string
        }
        Update: {
          active_version?: number | null
          auto_pause_reason?: string | null
          auto_paused_at?: string | null
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          draft_version?: number
          error_threshold?: number
          error_window_minutes?: number
          id?: string
          last_executed_at?: string | null
          max_executions_per_event?: number
          max_per_entity?: number | null
          max_per_hour?: number | null
          name?: string
          organization_id?: string
          priority?: number
          shop_id?: string
          status?: Database["public"]["Enums"]["automation_status"]
          stop_on_error?: boolean
          template_key?: string | null
          trigger_config?: Json
          trigger_type?: Database["public"]["Enums"]["automation_trigger_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
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
          tax_breakdown: Json
          tax_engine_version: string
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
          tax_breakdown?: Json
          tax_engine_version?: string
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
          tax_breakdown?: Json
          tax_engine_version?: string
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
          company_name: string | null
          completed_at: string | null
          created_at: string
          customer_id: string | null
          customer_type: Database["public"]["Enums"]["tax_customer_type"]
          customer_vat_id: string | null
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
          vat_validation_id: string | null
        }
        Insert: {
          billing_address_id?: string | null
          billing_same_as_shipping?: boolean
          cart_id: string
          company_name?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_type?: Database["public"]["Enums"]["tax_customer_type"]
          customer_vat_id?: string | null
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
          vat_validation_id?: string | null
        }
        Update: {
          billing_address_id?: string | null
          billing_same_as_shipping?: boolean
          cart_id?: string
          company_name?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_type?: Database["public"]["Enums"]["tax_customer_type"]
          customer_vat_id?: string | null
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
          vat_validation_id?: string | null
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
          {
            foreignKeyName: "checkout_sessions_vat_validation_id_fkey"
            columns: ["vat_validation_id"]
            isOneToOne: false
            referencedRelation: "vat_validations"
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
          tax_breakdown: Json
          tax_engine_version: string
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
          tax_breakdown?: Json
          tax_engine_version?: string
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
          tax_breakdown?: Json
          tax_engine_version?: string
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
      commerce_installation: {
        Row: {
          api_version: string
          auto_update_policy: string
          available_release: Json | null
          claim_token_expires_at: string | null
          claim_token_hash: string | null
          claim_token_used_at: string | null
          core_version: string
          created_at: string
          health_status: Json
          id: string
          installation_id: string
          installed_at: string
          installed_release_id: string | null
          last_migrated_at: string | null
          last_successful_update_at: string | null
          last_update_check_at: string | null
          maintenance_state: string
          mode: string
          owner_claimed_at: string | null
          schema_version: string | null
          sdk_version: string | null
          setup_completed_at: string | null
          setup_progress: Json
          singleton: boolean
          storefront_origin: string | null
          system_seed_version: number
          update_channel: string
          update_config: Json
          updated_at: string
        }
        Insert: {
          api_version?: string
          auto_update_policy?: string
          available_release?: Json | null
          claim_token_expires_at?: string | null
          claim_token_hash?: string | null
          claim_token_used_at?: string | null
          core_version: string
          created_at?: string
          health_status?: Json
          id?: string
          installation_id: string
          installed_at?: string
          installed_release_id?: string | null
          last_migrated_at?: string | null
          last_successful_update_at?: string | null
          last_update_check_at?: string | null
          maintenance_state?: string
          mode?: string
          owner_claimed_at?: string | null
          schema_version?: string | null
          sdk_version?: string | null
          setup_completed_at?: string | null
          setup_progress?: Json
          singleton?: boolean
          storefront_origin?: string | null
          system_seed_version?: number
          update_channel?: string
          update_config?: Json
          updated_at?: string
        }
        Update: {
          api_version?: string
          auto_update_policy?: string
          available_release?: Json | null
          claim_token_expires_at?: string | null
          claim_token_hash?: string | null
          claim_token_used_at?: string | null
          core_version?: string
          created_at?: string
          health_status?: Json
          id?: string
          installation_id?: string
          installed_at?: string
          installed_release_id?: string | null
          last_migrated_at?: string | null
          last_successful_update_at?: string | null
          last_update_check_at?: string | null
          maintenance_state?: string
          mode?: string
          owner_claimed_at?: string | null
          schema_version?: string | null
          sdk_version?: string | null
          setup_completed_at?: string | null
          setup_progress?: Json
          singleton?: boolean
          storefront_origin?: string | null
          system_seed_version?: number
          update_channel?: string
          update_config?: Json
          updated_at?: string
        }
        Relationships: []
      }
      communication_attempts: {
        Row: {
          attempt_number: number
          communication_id: string
          completed_at: string | null
          error_code: string | null
          error_message: string | null
          id: string
          metadata: Json
          organization_id: string
          provider: string
          provider_message_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["communication_delivery_status"]
        }
        Insert: {
          attempt_number: number
          communication_id: string
          completed_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          provider: string
          provider_message_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["communication_delivery_status"]
        }
        Update: {
          attempt_number?: number
          communication_id?: string
          completed_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          provider?: string
          provider_message_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["communication_delivery_status"]
        }
        Relationships: [
          {
            foreignKeyName: "communication_attempts_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_attempts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_branding: {
        Row: {
          background_color: string
          border_radius: number
          button_style: string
          content_background_color: string
          created_at: string
          font_family: string
          footer_text: string
          id: string
          logo_media_id: string | null
          metadata: Json
          muted_text_color: string
          organization_id: string
          primary_color: string
          shop_id: string
          social_links: Json
          support_email: string | null
          text_color: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          background_color?: string
          border_radius?: number
          button_style?: string
          content_background_color?: string
          created_at?: string
          font_family?: string
          footer_text?: string
          id?: string
          logo_media_id?: string | null
          metadata?: Json
          muted_text_color?: string
          organization_id: string
          primary_color?: string
          shop_id: string
          social_links?: Json
          support_email?: string | null
          text_color?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          background_color?: string
          border_radius?: number
          button_style?: string
          content_background_color?: string
          created_at?: string
          font_family?: string
          footer_text?: string
          id?: string
          logo_media_id?: string | null
          metadata?: Json
          muted_text_color?: string
          organization_id?: string
          primary_color?: string
          shop_id?: string
          social_links?: Json
          support_email?: string | null
          text_color?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_branding_logo_media_id_fkey"
            columns: ["logo_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_branding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_branding_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_provider_configs: {
        Row: {
          capabilities: Json
          channel: Database["public"]["Enums"]["communication_channel"]
          configuration_reference: string | null
          created_at: string
          display_name: string
          id: string
          metadata: Json
          organization_id: string
          priority: number
          provider: string
          shop_id: string | null
          status: Database["public"]["Enums"]["communication_provider_status"]
          test_mode: boolean
          updated_at: string
        }
        Insert: {
          capabilities?: Json
          channel?: Database["public"]["Enums"]["communication_channel"]
          configuration_reference?: string | null
          created_at?: string
          display_name: string
          id?: string
          metadata?: Json
          organization_id: string
          priority?: number
          provider: string
          shop_id?: string | null
          status?: Database["public"]["Enums"]["communication_provider_status"]
          test_mode?: boolean
          updated_at?: string
        }
        Update: {
          capabilities?: Json
          channel?: Database["public"]["Enums"]["communication_channel"]
          configuration_reference?: string | null
          created_at?: string
          display_name?: string
          id?: string
          metadata?: Json
          organization_id?: string
          priority?: number
          provider?: string
          shop_id?: string | null
          status?: Database["public"]["Enums"]["communication_provider_status"]
          test_mode?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_provider_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_provider_configs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_provider_events: {
        Row: {
          event_type: string
          id: string
          organization_id: string | null
          payload: Json
          processed_at: string | null
          processing_error: string | null
          processing_status: string
          provider: string
          provider_event_id: string
          provider_message_id: string | null
          received_at: string
          shop_id: string | null
          signature_verified: boolean
        }
        Insert: {
          event_type: string
          id?: string
          organization_id?: string | null
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string
          provider: string
          provider_event_id: string
          provider_message_id?: string | null
          received_at?: string
          shop_id?: string | null
          signature_verified?: boolean
        }
        Update: {
          event_type?: string
          id?: string
          organization_id?: string | null
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string
          provider?: string
          provider_event_id?: string
          provider_message_id?: string | null
          received_at?: string
          shop_id?: string | null
          signature_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "communication_provider_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_provider_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_rules: {
        Row: {
          channel: Database["public"]["Enums"]["communication_channel"]
          conditions: Json
          created_at: string
          delay_seconds: number
          enabled: boolean
          event_type: string
          id: string
          metadata: Json
          organization_id: string
          priority: number
          shop_id: string
          template_id: string | null
          template_key: string
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["communication_channel"]
          conditions?: Json
          created_at?: string
          delay_seconds?: number
          enabled?: boolean
          event_type: string
          id?: string
          metadata?: Json
          organization_id: string
          priority?: number
          shop_id: string
          template_id?: string | null
          template_key: string
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["communication_channel"]
          conditions?: Json
          created_at?: string
          delay_seconds?: number
          enabled?: boolean
          event_type?: string
          id?: string
          metadata?: Json
          organization_id?: string
          priority?: number
          shop_id?: string
          template_id?: string | null
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_rules_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "communication_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_suppressions: {
        Row: {
          address: string
          channel: Database["public"]["Enums"]["communication_channel"]
          created_at: string
          expires_at: string | null
          id: string
          note: string | null
          organization_id: string
          reason: Database["public"]["Enums"]["communication_suppression_reason"]
          shop_id: string | null
          source: string
        }
        Insert: {
          address: string
          channel?: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          organization_id: string
          reason: Database["public"]["Enums"]["communication_suppression_reason"]
          shop_id?: string | null
          source?: string
        }
        Update: {
          address?: string
          channel?: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          organization_id?: string
          reason?: Database["public"]["Enums"]["communication_suppression_reason"]
          shop_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_suppressions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_suppressions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_template_versions: {
        Row: {
          body_schema: Json
          created_at: string
          created_by: string | null
          id: string
          locale: string
          preheader: string | null
          published_at: string | null
          subject: string
          template_id: string
          text_body_template: string
          version: number
        }
        Insert: {
          body_schema?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          locale?: string
          preheader?: string | null
          published_at?: string | null
          subject: string
          template_id: string
          text_body_template?: string
          version: number
        }
        Update: {
          body_schema?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          locale?: string
          preheader?: string | null
          published_at?: string | null
          subject?: string
          template_id?: string
          text_body_template?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "communication_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "communication_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_templates: {
        Row: {
          category: string
          channel: Database["public"]["Enums"]["communication_channel"]
          content_schema: Json
          created_at: string
          default_locale: string
          description: string | null
          id: string
          is_system: boolean
          key: string
          name: string
          organization_id: string | null
          shop_id: string | null
          status: Database["public"]["Enums"]["communication_template_status"]
          subject_template: string
          updated_at: string
          version: number
        }
        Insert: {
          category?: string
          channel?: Database["public"]["Enums"]["communication_channel"]
          content_schema?: Json
          created_at?: string
          default_locale?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          name: string
          organization_id?: string | null
          shop_id?: string | null
          status?: Database["public"]["Enums"]["communication_template_status"]
          subject_template?: string
          updated_at?: string
          version?: number
        }
        Update: {
          category?: string
          channel?: Database["public"]["Enums"]["communication_channel"]
          content_schema?: Json
          created_at?: string
          default_locale?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          organization_id?: string | null
          shop_id?: string | null
          status?: Database["public"]["Enums"]["communication_template_status"]
          subject_template?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "communication_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_templates_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          attempts: number
          channel: Database["public"]["Enums"]["communication_channel"]
          communication_rule_id: string | null
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          delivery_status:
            | Database["public"]["Enums"]["communication_delivery_status"]
            | null
          failed_at: string | null
          html_snapshot: string
          id: string
          is_test_send: boolean
          last_error: string | null
          locale: string
          metadata: Json
          next_attempt_at: string | null
          order_id: string | null
          organization_id: string
          provider: string | null
          provider_status_raw: string | null
          queued_at: string | null
          recipient_address: string
          recipient_reference_id: string | null
          recipient_type: Database["public"]["Enums"]["communication_recipient_type"]
          resend_of_communication_id: string | null
          scheduled_at: string | null
          sender_address: string | null
          sender_identity_id: string | null
          sender_name: string | null
          sent_at: string | null
          shop_id: string
          source_event_id: string | null
          source_event_type: string | null
          status: Database["public"]["Enums"]["communication_status"]
          subject_snapshot: string
          template_key: string
          template_version_id: string | null
          test_mode: boolean
          text_snapshot: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel?: Database["public"]["Enums"]["communication_channel"]
          communication_rule_id?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["communication_delivery_status"]
            | null
          failed_at?: string | null
          html_snapshot: string
          id?: string
          is_test_send?: boolean
          last_error?: string | null
          locale?: string
          metadata?: Json
          next_attempt_at?: string | null
          order_id?: string | null
          organization_id: string
          provider?: string | null
          provider_status_raw?: string | null
          queued_at?: string | null
          recipient_address: string
          recipient_reference_id?: string | null
          recipient_type?: Database["public"]["Enums"]["communication_recipient_type"]
          resend_of_communication_id?: string | null
          scheduled_at?: string | null
          sender_address?: string | null
          sender_identity_id?: string | null
          sender_name?: string | null
          sent_at?: string | null
          shop_id: string
          source_event_id?: string | null
          source_event_type?: string | null
          status?: Database["public"]["Enums"]["communication_status"]
          subject_snapshot: string
          template_key: string
          template_version_id?: string | null
          test_mode?: boolean
          text_snapshot: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: Database["public"]["Enums"]["communication_channel"]
          communication_rule_id?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["communication_delivery_status"]
            | null
          failed_at?: string | null
          html_snapshot?: string
          id?: string
          is_test_send?: boolean
          last_error?: string | null
          locale?: string
          metadata?: Json
          next_attempt_at?: string | null
          order_id?: string | null
          organization_id?: string
          provider?: string | null
          provider_status_raw?: string | null
          queued_at?: string | null
          recipient_address?: string
          recipient_reference_id?: string | null
          recipient_type?: Database["public"]["Enums"]["communication_recipient_type"]
          resend_of_communication_id?: string | null
          scheduled_at?: string | null
          sender_address?: string | null
          sender_identity_id?: string | null
          sender_name?: string | null
          sent_at?: string | null
          shop_id?: string
          source_event_id?: string | null
          source_event_type?: string | null
          status?: Database["public"]["Enums"]["communication_status"]
          subject_snapshot?: string
          template_key?: string
          template_version_id?: string | null
          test_mode?: boolean
          text_snapshot?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communications_communication_rule_id_fkey"
            columns: ["communication_rule_id"]
            isOneToOne: false
            referencedRelation: "communication_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_resend_of_communication_id_fkey"
            columns: ["resend_of_communication_id"]
            isOneToOne: false
            referencedRelation: "communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_sender_identity_id_fkey"
            columns: ["sender_identity_id"]
            isOneToOne: false
            referencedRelation: "sender_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "communication_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_note_items: {
        Row: {
          created_at: string
          credit_note_id: string
          description: string | null
          id: string
          invoice_item_id: string | null
          item_type: Database["public"]["Enums"]["invoice_item_type"]
          line_gross_minor: number
          line_net_minor: number
          metadata: Json
          organization_id: string
          position: number
          product_name: string
          quantity: number
          sku: string | null
          tax_minor: number
          tax_rate_basis_points: number
          tax_reason_code: string
          unit: string
          unit_net_minor: number
          variant_name: string | null
        }
        Insert: {
          created_at?: string
          credit_note_id: string
          description?: string | null
          id?: string
          invoice_item_id?: string | null
          item_type?: Database["public"]["Enums"]["invoice_item_type"]
          line_gross_minor?: number
          line_net_minor?: number
          metadata?: Json
          organization_id: string
          position: number
          product_name: string
          quantity?: number
          sku?: string | null
          tax_minor?: number
          tax_rate_basis_points?: number
          tax_reason_code?: string
          unit?: string
          unit_net_minor?: number
          variant_name?: string | null
        }
        Update: {
          created_at?: string
          credit_note_id?: string
          description?: string | null
          id?: string
          invoice_item_id?: string | null
          item_type?: Database["public"]["Enums"]["invoice_item_type"]
          line_gross_minor?: number
          line_net_minor?: number
          metadata?: Json
          organization_id?: string
          position?: number
          product_name?: string
          quantity?: number
          sku?: string | null
          tax_minor?: number
          tax_rate_basis_points?: number
          tax_reason_code?: string
          unit?: string
          unit_net_minor?: number
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_items_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_items_invoice_item_id_fkey"
            columns: ["invoice_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          branding_snapshot: Json
          created_at: string
          created_by: string | null
          credit_note_number: string | null
          currency_code: string
          customer_snapshot: Json
          id: string
          invoice_id: string
          issued_at: string | null
          issued_by: string | null
          metadata: Json
          order_id: string
          organization_id: string
          reason: string | null
          refund_id: string | null
          seller_snapshot: Json
          shop_id: string
          status: Database["public"]["Enums"]["credit_note_status"]
          subtotal_net_minor: number
          tax_breakdown: Json
          tax_total_minor: number
          total_gross_minor: number
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          branding_snapshot?: Json
          created_at?: string
          created_by?: string | null
          credit_note_number?: string | null
          currency_code: string
          customer_snapshot?: Json
          id?: string
          invoice_id: string
          issued_at?: string | null
          issued_by?: string | null
          metadata?: Json
          order_id: string
          organization_id: string
          reason?: string | null
          refund_id?: string | null
          seller_snapshot?: Json
          shop_id: string
          status?: Database["public"]["Enums"]["credit_note_status"]
          subtotal_net_minor?: number
          tax_breakdown?: Json
          tax_total_minor?: number
          total_gross_minor?: number
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          branding_snapshot?: Json
          created_at?: string
          created_by?: string | null
          credit_note_number?: string | null
          currency_code?: string
          customer_snapshot?: Json
          id?: string
          invoice_id?: string
          issued_at?: string | null
          issued_by?: string | null
          metadata?: Json
          order_id?: string
          organization_id?: string
          reason?: string | null
          refund_id?: string | null
          seller_snapshot?: Json
          shop_id?: string
          status?: Database["public"]["Enums"]["credit_note_status"]
          subtotal_net_minor?: number
          tax_breakdown?: Json
          tax_total_minor?: number
          total_gross_minor?: number
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "refunds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          city: string
          company: string | null
          country_code: string
          created_at: string
          customer_id: string
          first_name: string
          id: string
          is_default: boolean
          last_name: string
          organization_id: string
          phone: string | null
          postal_code: string
          shop_id: string
          state: string | null
          street: string
          street2: string | null
          type: Database["public"]["Enums"]["customer_address_type"]
          updated_at: string
        }
        Insert: {
          city: string
          company?: string | null
          country_code: string
          created_at?: string
          customer_id: string
          first_name: string
          id?: string
          is_default?: boolean
          last_name: string
          organization_id: string
          phone?: string | null
          postal_code: string
          shop_id: string
          state?: string | null
          street: string
          street2?: string | null
          type?: Database["public"]["Enums"]["customer_address_type"]
          updated_at?: string
        }
        Update: {
          city?: string
          company?: string | null
          country_code?: string
          created_at?: string
          customer_id?: string
          first_name?: string
          id?: string
          is_default?: boolean
          last_name?: string
          organization_id?: string
          phone?: string | null
          postal_code?: string
          shop_id?: string
          state?: string | null
          street?: string
          street2?: string | null
          type?: Database["public"]["Enums"]["customer_address_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_group_members: {
        Row: {
          created_at: string
          customer_group_id: string
          customer_id: string
          id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          customer_group_id: string
          customer_id: string
          id?: string
          organization_id: string
        }
        Update: {
          created_at?: string
          customer_group_id?: string
          customer_id?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_group_members_customer_group_id_fkey"
            columns: ["customer_group_id"]
            isOneToOne: false
            referencedRelation: "customer_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_group_members_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_group_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      customer_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          customer_id: string
          id: string
          organization_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          customer_id: string
          id?: string
          organization_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          customer_id?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          auth_user_id: string | null
          created_at: string
          customer_type: Database["public"]["Enums"]["customer_kind"]
          default_billing_address_id: string | null
          default_shipping_address_id: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          metadata: Json
          organization_id: string
          phone: string | null
          shop_id: string
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          customer_type?: Database["public"]["Enums"]["customer_kind"]
          default_billing_address_id?: string | null
          default_shipping_address_id?: string | null
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json
          organization_id: string
          phone?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          customer_type?: Database["public"]["Enums"]["customer_kind"]
          default_billing_address_id?: string | null
          default_shipping_address_id?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json
          organization_id?: string
          phone?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_default_billing_fk"
            columns: ["default_billing_address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_default_shipping_fk"
            columns: ["default_shipping_address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_notes: {
        Row: {
          branding_snapshot: Json
          created_at: string
          created_by: string | null
          document_number: string | null
          fulfillment_id: string | null
          id: string
          issued_at: string | null
          issued_by: string | null
          items: Json
          metadata: Json
          notes: string | null
          order_id: string
          organization_id: string
          recipient_snapshot: Json
          seller_snapshot: Json
          shop_id: string
          status: Database["public"]["Enums"]["delivery_note_status"]
          updated_at: string
        }
        Insert: {
          branding_snapshot?: Json
          created_at?: string
          created_by?: string | null
          document_number?: string | null
          fulfillment_id?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          items?: Json
          metadata?: Json
          notes?: string | null
          order_id: string
          organization_id: string
          recipient_snapshot?: Json
          seller_snapshot?: Json
          shop_id: string
          status?: Database["public"]["Enums"]["delivery_note_status"]
          updated_at?: string
        }
        Update: {
          branding_snapshot?: Json
          created_at?: string
          created_by?: string | null
          document_number?: string | null
          fulfillment_id?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          items?: Json
          metadata?: Json
          notes?: string | null
          order_id?: string
          organization_id?: string
          recipient_snapshot?: Json
          seller_snapshot?: Json
          shop_id?: string
          status?: Database["public"]["Enums"]["delivery_note_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notes_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "fulfillments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_environments: {
        Row: {
          created_at: string
          id: string
          last_reset_at: string | null
          organization_id: string
          seed_version: string
          seeded_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_reset_at?: string | null
          organization_id: string
          seed_version: string
          seeded_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_reset_at?: string | null
          organization_id?: string
          seed_version?: string
          seeded_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_environments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_branding: {
        Row: {
          bank_details: Json
          created_at: string
          font_family: string
          footer_text: string | null
          id: string
          legal_footer: string | null
          logo_media_id: string | null
          metadata: Json
          organization_id: string
          payment_details: string | null
          preset: string
          primary_color: string
          secondary_color: string | null
          sender_block: string | null
          shop_id: string
          show_product_images: boolean
          show_product_sku: boolean
          show_tax_breakdown: boolean
          updated_at: string
        }
        Insert: {
          bank_details?: Json
          created_at?: string
          font_family?: string
          footer_text?: string | null
          id?: string
          legal_footer?: string | null
          logo_media_id?: string | null
          metadata?: Json
          organization_id: string
          payment_details?: string | null
          preset?: string
          primary_color?: string
          secondary_color?: string | null
          sender_block?: string | null
          shop_id: string
          show_product_images?: boolean
          show_product_sku?: boolean
          show_tax_breakdown?: boolean
          updated_at?: string
        }
        Update: {
          bank_details?: Json
          created_at?: string
          font_family?: string
          footer_text?: string | null
          id?: string
          legal_footer?: string | null
          logo_media_id?: string | null
          metadata?: Json
          organization_id?: string
          payment_details?: string | null
          preset?: string
          primary_color?: string
          secondary_color?: string | null
          sender_block?: string | null
          shop_id?: string
          show_product_images?: boolean
          show_product_sku?: boolean
          show_tax_breakdown?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_branding_logo_media_id_fkey"
            columns: ["logo_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_branding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_branding_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      document_files: {
        Row: {
          checksum: string | null
          created_at: string
          created_by: string | null
          document_id: string
          document_type: Database["public"]["Enums"]["document_type"]
          file_size: number | null
          format: Database["public"]["Enums"]["document_format"]
          id: string
          mime_type: string
          organization_id: string
          renderer_version: string | null
          shop_id: string
          status: Database["public"]["Enums"]["document_format_status"]
          storage_path: string | null
          validation_errors: Json
          version: number
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          document_id: string
          document_type: Database["public"]["Enums"]["document_type"]
          file_size?: number | null
          format?: Database["public"]["Enums"]["document_format"]
          id?: string
          mime_type?: string
          organization_id: string
          renderer_version?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["document_format_status"]
          storage_path?: string | null
          validation_errors?: Json
          version?: number
        }
        Update: {
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string
          document_type?: Database["public"]["Enums"]["document_type"]
          file_size?: number | null
          format?: Database["public"]["Enums"]["document_format"]
          id?: string
          mime_type?: string
          organization_id?: string
          renderer_version?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["document_format_status"]
          storage_path?: string | null
          validation_errors?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_files_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_files_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      document_sequences: {
        Row: {
          created_at: string
          current_period: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          id: string
          include_period: boolean
          next_number: number
          organization_id: string
          padding: number
          prefix: string
          reset_policy: Database["public"]["Enums"]["sequence_reset_policy"]
          shop_id: string
          suffix: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period?: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          id?: string
          include_period?: boolean
          next_number?: number
          organization_id: string
          padding?: number
          prefix?: string
          reset_policy?: Database["public"]["Enums"]["sequence_reset_policy"]
          shop_id: string
          suffix?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          id?: string
          include_period?: boolean
          next_number?: number
          organization_id?: string
          padding?: number
          prefix?: string
          reset_policy?: Database["public"]["Enums"]["sequence_reset_policy"]
          shop_id?: string
          suffix?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_sequences_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfillment_items: {
        Row: {
          created_at: string
          fulfillment_id: string
          id: string
          metadata: Json
          order_item_id: string
          organization_id: string
          packed_quantity: number
          picked_quantity: number
          quantity: number
          shipped_quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          fulfillment_id: string
          id?: string
          metadata?: Json
          order_item_id: string
          organization_id: string
          packed_quantity?: number
          picked_quantity?: number
          quantity: number
          shipped_quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fulfillment_id?: string
          id?: string
          metadata?: Json
          order_item_id?: string
          organization_id?: string
          packed_quantity?: number
          picked_quantity?: number
          quantity?: number
          shipped_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fulfillment_items_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "fulfillments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillment_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfillments: {
        Row: {
          assigned_to: string | null
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          id: string
          location_id: string | null
          metadata: Json
          notes: string | null
          order_id: string
          organization_id: string
          packed_at: string | null
          shipped_at: string | null
          shop_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["fulfillment_state"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          id?: string
          location_id?: string | null
          metadata?: Json
          notes?: string | null
          order_id: string
          organization_id: string
          packed_at?: string | null
          shipped_at?: string | null
          shop_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["fulfillment_state"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          id?: string
          location_id?: string | null
          metadata?: Json
          notes?: string | null
          order_id?: string
          organization_id?: string
          packed_at?: string | null
          shipped_at?: string | null
          shop_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["fulfillment_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fulfillments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfillments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_order_access_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          order_id: string
          organization_id: string
          revoked_at: string | null
          shop_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          order_id: string
          organization_id: string
          revoked_at?: string | null
          shop_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          order_id?: string
          organization_id?: string
          revoked_at?: string | null
          shop_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_order_access_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_order_access_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_order_access_tokens_shop_id_fkey"
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
      integration_connections: {
        Row: {
          category: Database["public"]["Enums"]["integration_category"]
          configuration_reference: string | null
          created_at: string
          environment: string
          id: string
          metadata: Json
          organization_id: string
          provider: string
          shop_id: string
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["integration_category"]
          configuration_reference?: string | null
          created_at?: string
          environment?: string
          id?: string
          metadata?: Json
          organization_id: string
          provider: string
          shop_id: string
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["integration_category"]
          configuration_reference?: string | null
          created_at?: string
          environment?: string
          id?: string
          metadata?: Json
          organization_id?: string
          provider?: string
          shop_id?: string
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_connections_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_health: {
        Row: {
          connection_id: string
          created_at: string
          last_checked_at: string | null
          last_error_code: string | null
          last_success_at: string | null
          organization_id: string
          shop_id: string
          status: Database["public"]["Enums"]["integration_health_status"]
          updated_at: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          last_checked_at?: string | null
          last_error_code?: string | null
          last_success_at?: string | null
          organization_id: string
          shop_id: string
          status?: Database["public"]["Enums"]["integration_health_status"]
          updated_at?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          last_checked_at?: string | null
          last_error_code?: string | null
          last_success_at?: string | null
          organization_id?: string
          shop_id?: string
          status?: Database["public"]["Enums"]["integration_health_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_health_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_health_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_health_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
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
      invoice_items: {
        Row: {
          created_at: string
          description: string | null
          discount_minor: number
          id: string
          invoice_id: string
          item_type: Database["public"]["Enums"]["invoice_item_type"]
          line_gross_minor: number
          line_net_minor: number
          metadata: Json
          order_item_id: string | null
          organization_id: string
          position: number
          product_name: string
          quantity: number
          sku: string | null
          tax_minor: number
          tax_rate_basis_points: number
          tax_reason_code: string
          unit: string
          unit_net_minor: number
          variant_name: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_minor?: number
          id?: string
          invoice_id: string
          item_type?: Database["public"]["Enums"]["invoice_item_type"]
          line_gross_minor?: number
          line_net_minor?: number
          metadata?: Json
          order_item_id?: string | null
          organization_id: string
          position: number
          product_name: string
          quantity?: number
          sku?: string | null
          tax_minor?: number
          tax_rate_basis_points?: number
          tax_reason_code?: string
          unit?: string
          unit_net_minor?: number
          variant_name?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_minor?: number
          id?: string
          invoice_id?: string
          item_type?: Database["public"]["Enums"]["invoice_item_type"]
          line_gross_minor?: number
          line_net_minor?: number
          metadata?: Json
          order_item_id?: string | null
          organization_id?: string
          position?: number
          product_name?: string
          quantity?: number
          sku?: string | null
          tax_minor?: number
          tax_rate_basis_points?: number
          tax_reason_code?: string
          unit?: string
          unit_net_minor?: number
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_settings: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          automatically_create_invoice: boolean
          automatically_issue_invoice: boolean
          bank_account_holder: string | null
          bank_bic: string | null
          bank_iban: string | null
          bank_name: string | null
          city: string | null
          company_name: string | null
          contact_email: string | null
          contact_phone: string | null
          country_code: string
          created_at: string
          credit_note_draft_on_refund: boolean
          einvoice_xrechnung_enabled: boolean
          einvoice_zugferd_enabled: boolean
          id: string
          invoice_creation_strategy: Database["public"]["Enums"]["invoice_creation_strategy"]
          legal_form: string | null
          leitweg_id: string | null
          managing_director: string | null
          metadata: Json
          organization_id: string
          payment_terms_days: number
          payment_terms_text: string | null
          postal_code: string | null
          register_court: string | null
          register_number: string | null
          shop_id: string
          tax_number: string | null
          updated_at: string
          vat_id: string | null
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          automatically_create_invoice?: boolean
          automatically_issue_invoice?: boolean
          bank_account_holder?: string | null
          bank_bic?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          city?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country_code?: string
          created_at?: string
          credit_note_draft_on_refund?: boolean
          einvoice_xrechnung_enabled?: boolean
          einvoice_zugferd_enabled?: boolean
          id?: string
          invoice_creation_strategy?: Database["public"]["Enums"]["invoice_creation_strategy"]
          legal_form?: string | null
          leitweg_id?: string | null
          managing_director?: string | null
          metadata?: Json
          organization_id: string
          payment_terms_days?: number
          payment_terms_text?: string | null
          postal_code?: string | null
          register_court?: string | null
          register_number?: string | null
          shop_id: string
          tax_number?: string | null
          updated_at?: string
          vat_id?: string | null
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          automatically_create_invoice?: boolean
          automatically_issue_invoice?: boolean
          bank_account_holder?: string | null
          bank_bic?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          city?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country_code?: string
          created_at?: string
          credit_note_draft_on_refund?: boolean
          einvoice_xrechnung_enabled?: boolean
          einvoice_zugferd_enabled?: boolean
          id?: string
          invoice_creation_strategy?: Database["public"]["Enums"]["invoice_creation_strategy"]
          legal_form?: string | null
          leitweg_id?: string | null
          managing_director?: string | null
          metadata?: Json
          organization_id?: string
          payment_terms_days?: number
          payment_terms_text?: string | null
          postal_code?: string | null
          register_court?: string | null
          register_number?: string | null
          shop_id?: string
          tax_number?: string | null
          updated_at?: string
          vat_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          billing_address_snapshot: Json
          branding_snapshot: Json
          buyer_reference: string | null
          contract_reference: string | null
          created_at: string
          created_by: string | null
          credited_minor: number
          currency_code: string
          customer_company: string | null
          customer_email: string | null
          customer_name: string | null
          customer_type: Database["public"]["Enums"]["tax_customer_type"]
          customer_vat_id: string | null
          discount_minor: number
          due_date: string | null
          id: string
          invoice_number: string | null
          issue_date: string | null
          issued_at: string | null
          issued_by: string | null
          metadata: Json
          notes: string | null
          order_id: string
          organization_id: string
          paid_minor: number
          payment_snapshot: Json
          payment_terms: string | null
          purchase_order_reference: string | null
          seller_snapshot: Json
          service_date: string | null
          shipping_net_minor: number
          shop_id: string
          source_order_snapshot: Json
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal_net_minor: number
          tax_breakdown: Json
          tax_engine_version: string | null
          tax_total_minor: number
          total_gross_minor: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          billing_address_snapshot?: Json
          branding_snapshot?: Json
          buyer_reference?: string | null
          contract_reference?: string | null
          created_at?: string
          created_by?: string | null
          credited_minor?: number
          currency_code: string
          customer_company?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_type?: Database["public"]["Enums"]["tax_customer_type"]
          customer_vat_id?: string | null
          discount_minor?: number
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          issued_at?: string | null
          issued_by?: string | null
          metadata?: Json
          notes?: string | null
          order_id: string
          organization_id: string
          paid_minor?: number
          payment_snapshot?: Json
          payment_terms?: string | null
          purchase_order_reference?: string | null
          seller_snapshot?: Json
          service_date?: string | null
          shipping_net_minor?: number
          shop_id: string
          source_order_snapshot?: Json
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_net_minor?: number
          tax_breakdown?: Json
          tax_engine_version?: string | null
          tax_total_minor?: number
          total_gross_minor?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          billing_address_snapshot?: Json
          branding_snapshot?: Json
          buyer_reference?: string | null
          contract_reference?: string | null
          created_at?: string
          created_by?: string | null
          credited_minor?: number
          currency_code?: string
          customer_company?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_type?: Database["public"]["Enums"]["tax_customer_type"]
          customer_vat_id?: string | null
          discount_minor?: number
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          issued_at?: string | null
          issued_by?: string | null
          metadata?: Json
          notes?: string | null
          order_id?: string
          organization_id?: string
          paid_minor?: number
          payment_snapshot?: Json
          payment_terms?: string | null
          purchase_order_reference?: string | null
          seller_snapshot?: Json
          service_date?: string | null
          shipping_net_minor?: number
          shop_id?: string
          source_order_snapshot?: Json
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_net_minor?: number
          tax_breakdown?: Json
          tax_engine_version?: string | null
          tax_total_minor?: number
          total_gross_minor?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
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
      oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          organization_id: string
          provider: string
          shop_id: string
          state_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          organization_id: string
          provider: string
          shop_id: string
          state_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          organization_id?: string
          provider?: string
          shop_id?: string
          state_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_states_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      order_addresses: {
        Row: {
          address: Json
          created_at: string
          id: string
          order_id: string
          organization_id: string
          type: Database["public"]["Enums"]["checkout_address_type"]
        }
        Insert: {
          address: Json
          created_at?: string
          id?: string
          order_id: string
          organization_id: string
          type: Database["public"]["Enums"]["checkout_address_type"]
        }
        Update: {
          address?: Json
          created_at?: string
          id?: string
          order_id?: string
          organization_id?: string
          type?: Database["public"]["Enums"]["checkout_address_type"]
        }
        Relationships: [
          {
            foreignKeyName: "order_addresses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_addresses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          applied_promotions: Json
          applied_rules: Json
          created_at: string
          gross_minor: number
          id: string
          line_discount_minor: number
          line_subtotal_minor: number
          line_total_minor: number
          net_minor: number
          order_id: string
          organization_id: string
          product_id: string | null
          quantity: number
          sku_snapshot: string | null
          tax_class_snapshot: Json
          tax_country_code: string | null
          tax_minor: number
          tax_rate_basis_points: number
          tax_reason_code: string
          title_snapshot: string
          unit_base_minor: number
          unit_resolved_minor: number
          variant_id: string | null
          variant_title_snapshot: string
        }
        Insert: {
          applied_promotions?: Json
          applied_rules?: Json
          created_at?: string
          gross_minor?: number
          id?: string
          line_discount_minor: number
          line_subtotal_minor: number
          line_total_minor: number
          net_minor?: number
          order_id: string
          organization_id: string
          product_id?: string | null
          quantity: number
          sku_snapshot?: string | null
          tax_class_snapshot?: Json
          tax_country_code?: string | null
          tax_minor?: number
          tax_rate_basis_points?: number
          tax_reason_code?: string
          title_snapshot: string
          unit_base_minor: number
          unit_resolved_minor: number
          variant_id?: string | null
          variant_title_snapshot: string
        }
        Update: {
          applied_promotions?: Json
          applied_rules?: Json
          created_at?: string
          gross_minor?: number
          id?: string
          line_discount_minor?: number
          line_subtotal_minor?: number
          line_total_minor?: number
          net_minor?: number
          order_id?: string
          organization_id?: string
          product_id?: string | null
          quantity?: number
          sku_snapshot?: string | null
          tax_class_snapshot?: Json
          tax_country_code?: string | null
          tax_minor?: number
          tax_rate_basis_points?: number
          tax_reason_code?: string
          title_snapshot?: string
          unit_base_minor?: number
          unit_resolved_minor?: number
          variant_id?: string | null
          variant_title_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_promotions: {
        Row: {
          code_snapshot: string | null
          created_at: string
          detail: Json
          discount_minor: number
          id: string
          name_snapshot: string
          order_id: string
          organization_id: string
          promotion_id: string | null
        }
        Insert: {
          code_snapshot?: string | null
          created_at?: string
          detail?: Json
          discount_minor?: number
          id?: string
          name_snapshot: string
          order_id: string
          organization_id: string
          promotion_id?: string | null
        }
        Update: {
          code_snapshot?: string | null
          created_at?: string
          detail?: Json
          discount_minor?: number
          id?: string
          name_snapshot?: string
          order_id?: string
          organization_id?: string
          promotion_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_promotions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_promotions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cart_id: string | null
          checkout_session_id: string
          checkout_snapshot_id: string
          created_at: string
          currency_code: string
          customer_id: string | null
          discount_minor: number
          email: string | null
          environment: Database["public"]["Enums"]["commerce_environment"]
          fulfillment_status: Database["public"]["Enums"]["order_fulfillment_status"]
          gross_total_minor: number
          id: string
          internal_note: string | null
          metadata: Json
          net_total_minor: number
          order_number: string
          order_status: Database["public"]["Enums"]["order_state"]
          organization_id: string
          payment_status: Database["public"]["Enums"]["order_payment_status"]
          placed_at: string
          refunded_minor: number
          shipping_method: Json
          shipping_minor: number
          shop_id: string
          subtotal_minor: number
          tax_breakdown: Json
          tax_engine_version: string
          tax_minor: number
          tax_snapshot_id: string | null
          tax_total_minor: number
          total_minor: number
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cart_id?: string | null
          checkout_session_id: string
          checkout_snapshot_id: string
          created_at?: string
          currency_code: string
          customer_id?: string | null
          discount_minor?: number
          email?: string | null
          environment?: Database["public"]["Enums"]["commerce_environment"]
          fulfillment_status?: Database["public"]["Enums"]["order_fulfillment_status"]
          gross_total_minor?: number
          id?: string
          internal_note?: string | null
          metadata?: Json
          net_total_minor?: number
          order_number: string
          order_status?: Database["public"]["Enums"]["order_state"]
          organization_id: string
          payment_status?: Database["public"]["Enums"]["order_payment_status"]
          placed_at?: string
          refunded_minor?: number
          shipping_method?: Json
          shipping_minor?: number
          shop_id: string
          subtotal_minor?: number
          tax_breakdown?: Json
          tax_engine_version?: string
          tax_minor?: number
          tax_snapshot_id?: string | null
          tax_total_minor?: number
          total_minor?: number
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cart_id?: string | null
          checkout_session_id?: string
          checkout_snapshot_id?: string
          created_at?: string
          currency_code?: string
          customer_id?: string | null
          discount_minor?: number
          email?: string | null
          environment?: Database["public"]["Enums"]["commerce_environment"]
          fulfillment_status?: Database["public"]["Enums"]["order_fulfillment_status"]
          gross_total_minor?: number
          id?: string
          internal_note?: string | null
          metadata?: Json
          net_total_minor?: number
          order_number?: string
          order_status?: Database["public"]["Enums"]["order_state"]
          organization_id?: string
          payment_status?: Database["public"]["Enums"]["order_payment_status"]
          placed_at?: string
          refunded_minor?: number
          shipping_method?: Json
          shipping_minor?: number
          shop_id?: string
          subtotal_minor?: number
          tax_breakdown?: Json
          tax_engine_version?: string
          tax_minor?: number
          tax_snapshot_id?: string | null
          tax_total_minor?: number
          total_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: true
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_checkout_snapshot_id_fkey"
            columns: ["checkout_snapshot_id"]
            isOneToOne: false
            referencedRelation: "checkout_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_fk"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tax_snapshot_id_fkey"
            columns: ["tax_snapshot_id"]
            isOneToOne: false
            referencedRelation: "tax_snapshots"
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
          causation_id: string | null
          chain_depth: number
          correlation_id: string | null
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          organization_id: string | null
          payload: Json
          processed_at: string | null
          shop_id: string | null
          status: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          causation_id?: string | null
          chain_depth?: number
          correlation_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          organization_id?: string | null
          payload?: Json
          processed_at?: string | null
          shop_id?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          causation_id?: string | null
          chain_depth?: number
          correlation_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          organization_id?: string | null
          payload?: Json
          processed_at?: string | null
          shop_id?: string | null
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
          {
            foreignKeyName: "outbox_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      outgoing_webhook_endpoints: {
        Row: {
          created_at: string
          id: string
          last_called_at: string | null
          last_error: string | null
          last_status_code: number | null
          name: string
          organization_id: string
          secret_reference: string | null
          shop_id: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_called_at?: string | null
          last_error?: string | null
          last_status_code?: number | null
          name: string
          organization_id: string
          secret_reference?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          last_called_at?: string | null
          last_error?: string | null
          last_status_code?: number | null
          name?: string
          organization_id?: string
          secret_reference?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "outgoing_webhook_endpoints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outgoing_webhook_endpoints_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      package_items: {
        Row: {
          created_at: string
          fulfillment_item_id: string
          id: string
          organization_id: string
          package_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          fulfillment_item_id: string
          id?: string
          organization_id: string
          package_id: string
          quantity: number
        }
        Update: {
          created_at?: string
          fulfillment_item_id?: string
          id?: string
          organization_id?: string
          package_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "package_items_fulfillment_item_id_fkey"
            columns: ["fulfillment_item_id"]
            isOneToOne: false
            referencedRelation: "fulfillment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      package_presets: {
        Row: {
          created_at: string
          height_mm: number | null
          id: string
          is_default: boolean
          length_mm: number | null
          name: string
          organization_id: string
          packaging_type: string | null
          shop_id: string | null
          updated_at: string
          weight_grams: number | null
          width_mm: number | null
        }
        Insert: {
          created_at?: string
          height_mm?: number | null
          id?: string
          is_default?: boolean
          length_mm?: number | null
          name: string
          organization_id: string
          packaging_type?: string | null
          shop_id?: string | null
          updated_at?: string
          weight_grams?: number | null
          width_mm?: number | null
        }
        Update: {
          created_at?: string
          height_mm?: number | null
          id?: string
          is_default?: boolean
          length_mm?: number | null
          name?: string
          organization_id?: string
          packaging_type?: string | null
          shop_id?: string | null
          updated_at?: string
          weight_grams?: number | null
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "package_presets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_presets_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          created_at: string
          fulfillment_id: string
          height_mm: number | null
          id: string
          length_mm: number | null
          metadata: Json
          organization_id: string
          package_number: number
          packaging_type: string | null
          shop_id: string
          status: Database["public"]["Enums"]["package_status"]
          updated_at: string
          weight_grams: number | null
          width_mm: number | null
        }
        Insert: {
          created_at?: string
          fulfillment_id: string
          height_mm?: number | null
          id?: string
          length_mm?: number | null
          metadata?: Json
          organization_id: string
          package_number: number
          packaging_type?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["package_status"]
          updated_at?: string
          weight_grams?: number | null
          width_mm?: number | null
        }
        Update: {
          created_at?: string
          fulfillment_id?: string
          height_mm?: number | null
          id?: string
          length_mm?: number | null
          metadata?: Json
          organization_id?: string
          package_number?: number
          packaging_type?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["package_status"]
          updated_at?: string
          weight_grams?: number | null
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "packages_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "fulfillments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          attempt_number: number
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          organization_id: string
          payment_session_id: string
          provider_payment_id: string | null
          provider_response: Json
          status: Database["public"]["Enums"]["payment_attempt_status"]
          updated_at: string
        }
        Insert: {
          attempt_number: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          organization_id: string
          payment_session_id: string
          provider_payment_id?: string | null
          provider_response?: Json
          status?: Database["public"]["Enums"]["payment_attempt_status"]
          updated_at?: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          organization_id?: string
          payment_session_id?: string
          provider_payment_id?: string | null
          provider_response?: Json
          status?: Database["public"]["Enums"]["payment_attempt_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_payment_session_id_fkey"
            columns: ["payment_session_id"]
            isOneToOne: false
            referencedRelation: "payment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          organization_id: string | null
          payload: Json
          process_error: string | null
          processed: boolean
          processed_at: string | null
          provider: string
          provider_event_id: string
          signature_verified: boolean
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          organization_id?: string | null
          payload: Json
          process_error?: string | null
          processed?: boolean
          processed_at?: string | null
          provider: string
          provider_event_id: string
          signature_verified?: boolean
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          organization_id?: string | null
          payload?: Json
          process_error?: string | null
          processed?: boolean
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          signature_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_provider_configs: {
        Row: {
          created_at: string
          display_name: string
          environment: Database["public"]["Enums"]["commerce_environment"]
          id: string
          organization_id: string
          priority: number
          provider: string
          secret_ref: string | null
          settings: Json
          shop_id: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          environment?: Database["public"]["Enums"]["commerce_environment"]
          id?: string
          organization_id: string
          priority?: number
          provider: string
          secret_ref?: string | null
          settings?: Json
          shop_id: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          environment?: Database["public"]["Enums"]["commerce_environment"]
          id?: string
          organization_id?: string
          priority?: number
          provider?: string
          secret_ref?: string | null
          settings?: Json
          shop_id?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_provider_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_provider_configs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_sessions: {
        Row: {
          amount_minor: number
          checkout_session_id: string
          checkout_snapshot_id: string
          created_at: string
          currency_code: string
          environment: Database["public"]["Enums"]["commerce_environment"]
          expires_at: string | null
          id: string
          idempotency_key: string | null
          last_error: string | null
          metadata: Json
          organization_id: string
          provider: string
          provider_payment_id: string | null
          provider_session_id: string | null
          redirect_url: string | null
          shop_id: string
          status: Database["public"]["Enums"]["payment_session_status"]
          updated_at: string
        }
        Insert: {
          amount_minor: number
          checkout_session_id: string
          checkout_snapshot_id: string
          created_at?: string
          currency_code: string
          environment?: Database["public"]["Enums"]["commerce_environment"]
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          metadata?: Json
          organization_id: string
          provider: string
          provider_payment_id?: string | null
          provider_session_id?: string | null
          redirect_url?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["payment_session_status"]
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          checkout_session_id?: string
          checkout_snapshot_id?: string
          created_at?: string
          currency_code?: string
          environment?: Database["public"]["Enums"]["commerce_environment"]
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          metadata?: Json
          organization_id?: string
          provider?: string
          provider_payment_id?: string | null
          provider_session_id?: string | null
          redirect_url?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["payment_session_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_sessions_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_sessions_checkout_snapshot_id_fkey"
            columns: ["checkout_snapshot_id"]
            isOneToOne: false
            referencedRelation: "checkout_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_sessions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount_minor: number
          created_at: string
          currency_code: string
          id: string
          metadata: Json
          order_id: string | null
          organization_id: string
          payment_session_id: string | null
          provider: string
          provider_transaction_id: string | null
          type: Database["public"]["Enums"]["payment_transaction_type"]
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency_code: string
          id?: string
          metadata?: Json
          order_id?: string | null
          organization_id: string
          payment_session_id?: string | null
          provider: string
          provider_transaction_id?: string | null
          type: Database["public"]["Enums"]["payment_transaction_type"]
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency_code?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          organization_id?: string
          payment_session_id?: string | null
          provider?: string
          provider_transaction_id?: string | null
          type?: Database["public"]["Enums"]["payment_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_payment_session_id_fkey"
            columns: ["payment_session_id"]
            isOneToOne: false
            referencedRelation: "payment_sessions"
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
          tax_class_id: string | null
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
          tax_class_id?: string | null
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
          tax_class_id?: string | null
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
          {
            foreignKeyName: "product_variants_tax_class_id_fkey"
            columns: ["tax_class_id"]
            isOneToOne: false
            referencedRelation: "tax_classes"
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
          return_policy_note: string | null
          return_policy_type: Database["public"]["Enums"]["return_policy_type"]
          seo_description: string | null
          seo_title: string | null
          shop_id: string
          status: Database["public"]["Enums"]["product_status"]
          subtitle: string | null
          tax_class_id: string | null
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
          return_policy_note?: string | null
          return_policy_type?: Database["public"]["Enums"]["return_policy_type"]
          seo_description?: string | null
          seo_title?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["product_status"]
          subtitle?: string | null
          tax_class_id?: string | null
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
          return_policy_note?: string | null
          return_policy_type?: Database["public"]["Enums"]["return_policy_type"]
          seo_description?: string | null
          seo_title?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["product_status"]
          subtitle?: string | null
          tax_class_id?: string | null
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
          {
            foreignKeyName: "products_tax_class_id_fkey"
            columns: ["tax_class_id"]
            isOneToOne: false
            referencedRelation: "tax_classes"
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
      provider_credentials: {
        Row: {
          category: Database["public"]["Enums"]["integration_category"]
          ciphertext: string
          created_at: string
          environment: string
          hints: Json
          id: string
          iv: string
          key_version: number
          organization_id: string
          provider: string
          reference: string
          shop_id: string
          status: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["integration_category"]
          ciphertext: string
          created_at?: string
          environment?: string
          hints?: Json
          id?: string
          iv: string
          key_version?: number
          organization_id: string
          provider: string
          reference: string
          shop_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["integration_category"]
          ciphertext?: string
          created_at?: string
          environment?: string
          hints?: Json
          id?: string
          iv?: string
          key_version?: number
          organization_id?: string
          provider?: string
          reference?: string
          shop_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_credentials_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_fixtures: {
        Row: {
          created_at: string
          destroyed_at: string | null
          id: string
          manifest: Json
          organization_id: string
          residual_notes: string | null
          run_ref: string
          scenario: string
          shop_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          destroyed_at?: string | null
          id?: string
          manifest?: Json
          organization_id: string
          residual_notes?: string | null
          run_ref: string
          scenario: string
          shop_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          destroyed_at?: string | null
          id?: string
          manifest?: Json
          organization_id?: string
          residual_notes?: string | null
          run_ref?: string
          scenario?: string
          shop_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_fixtures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_fixtures_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount_minor: number
          created_at: string
          currency_code: string
          error_message: string | null
          id: string
          idempotency_key: string | null
          order_id: string
          organization_id: string
          provider: string | null
          provider_refund_id: string | null
          reason: string | null
          requested_by: string | null
          status: Database["public"]["Enums"]["refund_status"]
          updated_at: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency_code: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          order_id: string
          organization_id: string
          provider?: string | null
          provider_refund_id?: string | null
          reason?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency_code?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          order_id?: string
          organization_id?: string
          provider?: string | null
          provider_refund_id?: string | null
          reason?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          condition: Database["public"]["Enums"]["return_item_condition"]
          created_at: string
          id: string
          inspection_note: string | null
          metadata: Json
          order_item_id: string
          organization_id: string
          quantity_approved: number
          quantity_received: number
          quantity_requested: number
          reason_code: Database["public"]["Enums"]["return_reason_code"]
          refund_amount_minor: number | null
          resolution: Database["public"]["Enums"]["return_resolution"]
          restock_decision: Database["public"]["Enums"]["restock_decision"]
          restock_location_id: string | null
          restocked_at: string | null
          return_id: string
          updated_at: string
        }
        Insert: {
          condition?: Database["public"]["Enums"]["return_item_condition"]
          created_at?: string
          id?: string
          inspection_note?: string | null
          metadata?: Json
          order_item_id: string
          organization_id: string
          quantity_approved?: number
          quantity_received?: number
          quantity_requested: number
          reason_code?: Database["public"]["Enums"]["return_reason_code"]
          refund_amount_minor?: number | null
          resolution?: Database["public"]["Enums"]["return_resolution"]
          restock_decision?: Database["public"]["Enums"]["restock_decision"]
          restock_location_id?: string | null
          restocked_at?: string | null
          return_id: string
          updated_at?: string
        }
        Update: {
          condition?: Database["public"]["Enums"]["return_item_condition"]
          created_at?: string
          id?: string
          inspection_note?: string | null
          metadata?: Json
          order_item_id?: string
          organization_id?: string
          quantity_approved?: number
          quantity_received?: number
          quantity_requested?: number
          reason_code?: Database["public"]["Enums"]["return_reason_code"]
          refund_amount_minor?: number | null
          resolution?: Database["public"]["Enums"]["return_resolution"]
          restock_decision?: Database["public"]["Enums"]["restock_decision"]
          restock_location_id?: string | null
          restocked_at?: string | null
          return_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_restock_location_id_fkey"
            columns: ["restock_location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
        ]
      }
      return_media: {
        Row: {
          created_at: string
          id: string
          media_asset_id: string
          organization_id: string
          return_id: string
          return_item_id: string | null
          uploaded_by_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_asset_id: string
          organization_id: string
          return_id: string
          return_item_id?: string | null
          uploaded_by_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          media_asset_id?: string
          organization_id?: string
          return_id?: string
          return_item_id?: string | null
          uploaded_by_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_media_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_media_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_media_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_media_return_item_id_fkey"
            columns: ["return_item_id"]
            isOneToOne: false
            referencedRelation: "return_items"
            referencedColumns: ["id"]
          },
        ]
      }
      return_sequences: {
        Row: {
          next_value: number
          organization_id: string
          padding: number
          prefix: string
          shop_id: string
          year: number
        }
        Insert: {
          next_value?: number
          organization_id: string
          padding?: number
          prefix?: string
          shop_id: string
          year?: number
        }
        Update: {
          next_value?: number
          organization_id?: string
          padding?: number
          prefix?: string
          shop_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "return_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_sequences_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      return_settings: {
        Row: {
          approval_strategy: Database["public"]["Enums"]["return_approval_strategy"]
          auto_refund_on_approval: boolean
          auto_restock: boolean
          created_at: string
          customer_pays_return_shipping: boolean
          default_return_window_days: number
          id: string
          instructions: string | null
          metadata: Json
          organization_id: string
          returns_enabled: boolean
          shop_id: string
          updated_at: string
          window_start: Database["public"]["Enums"]["return_window_start"]
        }
        Insert: {
          approval_strategy?: Database["public"]["Enums"]["return_approval_strategy"]
          auto_refund_on_approval?: boolean
          auto_restock?: boolean
          created_at?: string
          customer_pays_return_shipping?: boolean
          default_return_window_days?: number
          id?: string
          instructions?: string | null
          metadata?: Json
          organization_id: string
          returns_enabled?: boolean
          shop_id: string
          updated_at?: string
          window_start?: Database["public"]["Enums"]["return_window_start"]
        }
        Update: {
          approval_strategy?: Database["public"]["Enums"]["return_approval_strategy"]
          auto_refund_on_approval?: boolean
          auto_restock?: boolean
          created_at?: string
          customer_pays_return_shipping?: boolean
          default_return_window_days?: number
          id?: string
          instructions?: string | null
          metadata?: Json
          organization_id?: string
          returns_enabled?: boolean
          shop_id?: string
          updated_at?: string
          window_start?: Database["public"]["Enums"]["return_window_start"]
        }
        Relationships: [
          {
            foreignKeyName: "return_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          authorized_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          credit_note_id: string | null
          currency_code: string
          customer_id: string | null
          customer_note: string | null
          id: string
          idempotency_key: string
          inspected_at: string | null
          internal_note: string | null
          metadata: Json
          order_id: string
          organization_id: string
          reason_category: Database["public"]["Enums"]["return_reason_code"]
          received_at: string | null
          refund_id: string | null
          refund_total_minor: number
          rejection_reason: string | null
          requested_at: string
          return_number: string
          return_shipment_id: string | null
          shipping_refund_minor: number
          shipping_refund_mode: Database["public"]["Enums"]["shipping_refund_mode"]
          shop_id: string
          status: Database["public"]["Enums"]["return_status"]
          updated_at: string
        }
        Insert: {
          authorized_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          credit_note_id?: string | null
          currency_code?: string
          customer_id?: string | null
          customer_note?: string | null
          id?: string
          idempotency_key: string
          inspected_at?: string | null
          internal_note?: string | null
          metadata?: Json
          order_id: string
          organization_id: string
          reason_category?: Database["public"]["Enums"]["return_reason_code"]
          received_at?: string | null
          refund_id?: string | null
          refund_total_minor?: number
          rejection_reason?: string | null
          requested_at?: string
          return_number: string
          return_shipment_id?: string | null
          shipping_refund_minor?: number
          shipping_refund_mode?: Database["public"]["Enums"]["shipping_refund_mode"]
          shop_id: string
          status?: Database["public"]["Enums"]["return_status"]
          updated_at?: string
        }
        Update: {
          authorized_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          credit_note_id?: string | null
          currency_code?: string
          customer_id?: string | null
          customer_note?: string | null
          id?: string
          idempotency_key?: string
          inspected_at?: string | null
          internal_note?: string | null
          metadata?: Json
          order_id?: string
          organization_id?: string
          reason_category?: Database["public"]["Enums"]["return_reason_code"]
          received_at?: string | null
          refund_id?: string | null
          refund_total_minor?: number
          rejection_reason?: string | null
          requested_at?: string
          return_number?: string
          return_shipment_id?: string | null
          shipping_refund_minor?: number
          shipping_refund_mode?: Database["public"]["Enums"]["shipping_refund_mode"]
          shop_id?: string
          status?: Database["public"]["Enums"]["return_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "refunds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_return_shipment_id_fkey"
            columns: ["return_shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_shop_id_fkey"
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
      sender_domains: {
        Row: {
          created_at: string
          dns_records: Json
          domain: string
          id: string
          organization_id: string
          provider: string | null
          provider_reference: string | null
          shop_id: string
          status: Database["public"]["Enums"]["sender_domain_status"]
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          dns_records?: Json
          domain: string
          id?: string
          organization_id: string
          provider?: string | null
          provider_reference?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["sender_domain_status"]
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          dns_records?: Json
          domain?: string
          id?: string
          organization_id?: string
          provider?: string | null
          provider_reference?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["sender_domain_status"]
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sender_domains_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sender_domains_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sender_identities: {
        Row: {
          channel: Database["public"]["Enums"]["communication_channel"]
          created_at: string
          display_name: string
          id: string
          is_default: boolean
          metadata: Json
          organization_id: string
          provider_reference: string | null
          reply_to: string | null
          sender_address: string
          sender_domain_id: string | null
          sender_name: string
          shop_id: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          verification_status: Database["public"]["Enums"]["sender_verification_status"]
        }
        Insert: {
          channel?: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          display_name: string
          id?: string
          is_default?: boolean
          metadata?: Json
          organization_id: string
          provider_reference?: string | null
          reply_to?: string | null
          sender_address: string
          sender_domain_id?: string | null
          sender_name: string
          shop_id: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["sender_verification_status"]
        }
        Update: {
          channel?: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          display_name?: string
          id?: string
          is_default?: boolean
          metadata?: Json
          organization_id?: string
          provider_reference?: string | null
          reply_to?: string | null
          sender_address?: string
          sender_domain_id?: string | null
          sender_name?: string
          shop_id?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["sender_verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "sender_identities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sender_identities_sender_domain_id_fkey"
            columns: ["sender_domain_id"]
            isOneToOne: false
            referencedRelation: "sender_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sender_identities_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          cancelled_at: string | null
          carrier_cost_minor: number | null
          carrier_provider: string
          carrier_service: string | null
          created_at: string
          currency_code: string | null
          delivered_at: string | null
          direction: Database["public"]["Enums"]["shipment_direction"]
          fulfillment_id: string
          id: string
          idempotency_key: string | null
          label_id: string | null
          last_error: Json | null
          metadata: Json
          normalized_tracking_status: Database["public"]["Enums"]["tracking_status"]
          organization_id: string
          package_id: string | null
          provider_shipment_id: string | null
          shipped_at: string | null
          shop_id: string
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          carrier_cost_minor?: number | null
          carrier_provider: string
          carrier_service?: string | null
          created_at?: string
          currency_code?: string | null
          delivered_at?: string | null
          direction?: Database["public"]["Enums"]["shipment_direction"]
          fulfillment_id: string
          id?: string
          idempotency_key?: string | null
          label_id?: string | null
          last_error?: Json | null
          metadata?: Json
          normalized_tracking_status?: Database["public"]["Enums"]["tracking_status"]
          organization_id: string
          package_id?: string | null
          provider_shipment_id?: string | null
          shipped_at?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          carrier_cost_minor?: number | null
          carrier_provider?: string
          carrier_service?: string | null
          created_at?: string
          currency_code?: string | null
          delivered_at?: string | null
          direction?: Database["public"]["Enums"]["shipment_direction"]
          fulfillment_id?: string
          id?: string
          idempotency_key?: string | null
          label_id?: string | null
          last_error?: Json | null
          metadata?: Json
          normalized_tracking_status?: Database["public"]["Enums"]["tracking_status"]
          organization_id?: string
          package_id?: string | null
          provider_shipment_id?: string | null
          shipped_at?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "fulfillments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_labels: {
        Row: {
          created_at: string
          format: string
          id: string
          metadata: Json
          mime_type: string
          organization_id: string
          provider: string
          shipment_id: string
          shop_id: string
          storage_path: string
          voided_at: string | null
        }
        Insert: {
          created_at?: string
          format?: string
          id?: string
          metadata?: Json
          mime_type?: string
          organization_id: string
          provider: string
          shipment_id: string
          shop_id: string
          storage_path: string
          voided_at?: string | null
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          metadata?: Json
          mime_type?: string
          organization_id?: string
          provider?: string
          shipment_id?: string
          shop_id?: string
          storage_path?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_labels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_labels_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_labels_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
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
      shipping_provider_configs: {
        Row: {
          configuration_reference: Json
          created_at: string
          display_name: string
          id: string
          metadata: Json
          organization_id: string
          priority: number
          provider: string
          shop_id: string
          status: Database["public"]["Enums"]["entity_status"]
          test_mode: boolean
          updated_at: string
        }
        Insert: {
          configuration_reference?: Json
          created_at?: string
          display_name: string
          id?: string
          metadata?: Json
          organization_id: string
          priority?: number
          provider: string
          shop_id: string
          status?: Database["public"]["Enums"]["entity_status"]
          test_mode?: boolean
          updated_at?: string
        }
        Update: {
          configuration_reference?: Json
          created_at?: string
          display_name?: string
          id?: string
          metadata?: Json
          organization_id?: string
          priority?: number
          provider?: string
          shop_id?: string
          status?: Database["public"]["Enums"]["entity_status"]
          test_mode?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_provider_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_provider_configs_shop_id_fkey"
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
      shop_order_sequences: {
        Row: {
          next_value: number
          organization_id: string
          padding: number
          prefix: string
          shop_id: string
        }
        Insert: {
          next_value?: number
          organization_id: string
          padding?: number
          prefix?: string
          shop_id: string
        }
        Update: {
          next_value?: number
          organization_id?: string
          padding?: number
          prefix?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_order_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_order_sequences_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
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
      store_api_keys: {
        Row: {
          allowed_origins: string[]
          created_at: string
          created_by: string | null
          environment: Database["public"]["Enums"]["commerce_environment"]
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
          rate_limit_profile: string
          revoked_at: string | null
          shop_id: string
          status: string
          updated_at: string
        }
        Insert: {
          allowed_origins?: string[]
          created_at?: string
          created_by?: string | null
          environment?: Database["public"]["Enums"]["commerce_environment"]
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id: string
          rate_limit_profile?: string
          revoked_at?: string | null
          shop_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          allowed_origins?: string[]
          created_at?: string
          created_by?: string | null
          environment?: Database["public"]["Enums"]["commerce_environment"]
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          rate_limit_profile?: string
          revoked_at?: string | null
          shop_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_api_keys_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      store_api_rate_counters: {
        Row: {
          bucket: string
          hits: number
          key_id: string
          profile: string
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          key_id: string
          profile: string
          window_start: string
        }
        Update: {
          bucket?: string
          hits?: number
          key_id?: string
          profile?: string
          window_start?: string
        }
        Relationships: []
      }
      store_api_request_logs: {
        Row: {
          created_at: string
          duration_ms: number
          error_code: string | null
          id: string
          ip_hash: string | null
          key_id: string | null
          method: string
          organization_id: string | null
          request_id: string
          route: string
          shop_id: string | null
          status_code: number
          user_agent_summary: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number
          error_code?: string | null
          id?: string
          ip_hash?: string | null
          key_id?: string | null
          method: string
          organization_id?: string | null
          request_id: string
          route: string
          shop_id?: string | null
          status_code: number
          user_agent_summary?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number
          error_code?: string | null
          id?: string
          ip_hash?: string | null
          key_id?: string | null
          method?: string
          organization_id?: string | null
          request_id?: string
          route?: string
          shop_id?: string | null
          status_code?: number
          user_agent_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_api_request_logs_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "store_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_api_request_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_api_request_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      store_confirmation_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          order_id: string
          organization_id: string
          shop_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          order_id: string
          organization_id: string
          shop_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          order_id?: string
          organization_id?: string
          shop_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_confirmation_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_confirmation_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_confirmation_tokens_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      store_privacy_salts: {
        Row: {
          created_at: string
          salt: string
          salt_date: string
        }
        Insert: {
          created_at?: string
          salt: string
          salt_date: string
        }
        Update: {
          created_at?: string
          salt?: string
          salt_date?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          dedupe_key: string | null
          description: string | null
          due_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          organization_id: string
          priority: Database["public"]["Enums"]["task_priority"]
          shop_id: string
          source: Database["public"]["Enums"]["task_source"]
          source_automation_execution_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          description?: string | null
          due_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          organization_id: string
          priority?: Database["public"]["Enums"]["task_priority"]
          shop_id: string
          source?: Database["public"]["Enums"]["task_source"]
          source_automation_execution_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          description?: string | null
          due_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          organization_id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          shop_id?: string
          source?: Database["public"]["Enums"]["task_source"]
          source_automation_execution_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_source_automation_execution_id_fkey"
            columns: ["source_automation_execution_id"]
            isOneToOne: false
            referencedRelation: "automation_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_classes: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          metadata: Json
          name: string
          organization_id: string | null
          shop_id: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          metadata?: Json
          name: string
          organization_id?: string | null
          shop_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          metadata?: Json
          name?: string
          organization_id?: string | null
          shop_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_classes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_classes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          country_code: string
          created_at: string
          customer_type: Database["public"]["Enums"]["tax_customer_type"]
          id: string
          metadata: Json
          organization_id: string | null
          priority: number
          rate_basis_points: number
          region_code: string | null
          shop_id: string | null
          source: string
          status: Database["public"]["Enums"]["entity_status"]
          tax_class_id: string
          transaction_type: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          country_code: string
          created_at?: string
          customer_type?: Database["public"]["Enums"]["tax_customer_type"]
          id?: string
          metadata?: Json
          organization_id?: string | null
          priority?: number
          rate_basis_points: number
          region_code?: string | null
          shop_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["entity_status"]
          tax_class_id: string
          transaction_type?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          country_code?: string
          created_at?: string
          customer_type?: Database["public"]["Enums"]["tax_customer_type"]
          id?: string
          metadata?: Json
          organization_id?: string | null
          priority?: number
          rate_basis_points?: number
          region_code?: string | null
          shop_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["entity_status"]
          tax_class_id?: string
          transaction_type?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_rates_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_rates_tax_class_id_fkey"
            columns: ["tax_class_id"]
            isOneToOne: false
            referencedRelation: "tax_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_settings: {
        Row: {
          b2b_enabled: boolean
          calculation_mode: Database["public"]["Enums"]["tax_calculation_mode"]
          created_at: string
          default_tax_class_id: string | null
          display_prices_including_tax: boolean
          eu_oss_enabled: boolean
          home_country_code: string
          id: string
          metadata: Json
          organization_id: string
          prices_include_tax: boolean
          shipping_tax_class_id: string | null
          shipping_tax_strategy: Database["public"]["Enums"]["shipping_tax_strategy"]
          shop_id: string
          small_business_exemption_enabled: boolean
          tax_number: string | null
          updated_at: string
          vat_id: string | null
        }
        Insert: {
          b2b_enabled?: boolean
          calculation_mode?: Database["public"]["Enums"]["tax_calculation_mode"]
          created_at?: string
          default_tax_class_id?: string | null
          display_prices_including_tax?: boolean
          eu_oss_enabled?: boolean
          home_country_code?: string
          id?: string
          metadata?: Json
          organization_id: string
          prices_include_tax?: boolean
          shipping_tax_class_id?: string | null
          shipping_tax_strategy?: Database["public"]["Enums"]["shipping_tax_strategy"]
          shop_id: string
          small_business_exemption_enabled?: boolean
          tax_number?: string | null
          updated_at?: string
          vat_id?: string | null
        }
        Update: {
          b2b_enabled?: boolean
          calculation_mode?: Database["public"]["Enums"]["tax_calculation_mode"]
          created_at?: string
          default_tax_class_id?: string | null
          display_prices_including_tax?: boolean
          eu_oss_enabled?: boolean
          home_country_code?: string
          id?: string
          metadata?: Json
          organization_id?: string
          prices_include_tax?: boolean
          shipping_tax_class_id?: string | null
          shipping_tax_strategy?: Database["public"]["Enums"]["shipping_tax_strategy"]
          shop_id?: string
          small_business_exemption_enabled?: boolean
          tax_number?: string | null
          updated_at?: string
          vat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_settings_default_tax_class_id_fkey"
            columns: ["default_tax_class_id"]
            isOneToOne: false
            referencedRelation: "tax_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_settings_shipping_tax_class_id_fkey"
            columns: ["shipping_tax_class_id"]
            isOneToOne: false
            referencedRelation: "tax_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_settings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_snapshots: {
        Row: {
          calculation_mode: Database["public"]["Enums"]["tax_calculation_mode"]
          cart_id: string | null
          checkout_session_id: string | null
          created_at: string
          customer_type: Database["public"]["Enums"]["tax_customer_type"]
          engine_version: string
          id: string
          jurisdiction: string
          order_id: string | null
          organization_id: string
          result: Json
          shop_id: string
        }
        Insert: {
          calculation_mode: Database["public"]["Enums"]["tax_calculation_mode"]
          cart_id?: string | null
          checkout_session_id?: string | null
          created_at?: string
          customer_type?: Database["public"]["Enums"]["tax_customer_type"]
          engine_version: string
          id?: string
          jurisdiction: string
          order_id?: string | null
          organization_id: string
          result: Json
          shop_id: string
        }
        Update: {
          calculation_mode?: Database["public"]["Enums"]["tax_calculation_mode"]
          cart_id?: string | null
          checkout_session_id?: string | null
          created_at?: string
          customer_type?: Database["public"]["Enums"]["tax_customer_type"]
          engine_version?: string
          id?: string
          jurisdiction?: string
          order_id?: string | null
          organization_id?: string
          result?: Json
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_snapshots_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_snapshots_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_snapshots_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_events: {
        Row: {
          carrier_provider: string
          created_at: string
          dedupe_hash: string
          description: string | null
          event_code: string
          id: string
          location: string | null
          normalized_status: Database["public"]["Enums"]["tracking_status"]
          occurred_at: string
          organization_id: string
          provider_event_id: string | null
          raw_payload: Json
          shipment_id: string
          shop_id: string
        }
        Insert: {
          carrier_provider: string
          created_at?: string
          dedupe_hash: string
          description?: string | null
          event_code: string
          id?: string
          location?: string | null
          normalized_status?: Database["public"]["Enums"]["tracking_status"]
          occurred_at?: string
          organization_id: string
          provider_event_id?: string | null
          raw_payload?: Json
          shipment_id: string
          shop_id: string
        }
        Update: {
          carrier_provider?: string
          created_at?: string
          dedupe_hash?: string
          description?: string | null
          event_code?: string
          id?: string
          location?: string | null
          normalized_status?: Database["public"]["Enums"]["tracking_status"]
          occurred_at?: string
          organization_id?: string
          provider_event_id?: string | null
          raw_payload?: Json
          shipment_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      update_run_steps: {
        Row: {
          completed_at: string | null
          created_at: string
          error_code: string | null
          id: string
          output_summary: string | null
          position: number
          started_at: string | null
          status: string
          step: string
          update_run_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          output_summary?: string | null
          position: number
          started_at?: string | null
          status?: string
          step: string
          update_run_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          output_summary?: string | null
          position?: number
          started_at?: string | null
          status?: string
          step?: string
          update_run_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "update_run_steps_update_run_id_fkey"
            columns: ["update_run_id"]
            isOneToOne: false
            referencedRelation: "update_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      update_runs: {
        Row: {
          backup_reference: string | null
          channel: string
          completed_at: string | null
          created_at: string
          current_step: string | null
          deployment_provider: string | null
          deployment_reference: string | null
          error_code: string | null
          from_version: string
          id: string
          initiated_by: string | null
          initiated_by_email: string | null
          installation_id: string
          metadata: Json
          migration_from: string | null
          migration_provider: string | null
          migration_to: string | null
          release_id: string
          rollback_status: string
          safe_error_message: string | null
          started_at: string
          status: string
          to_version: string
          updated_at: string
        }
        Insert: {
          backup_reference?: string | null
          channel?: string
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          deployment_provider?: string | null
          deployment_reference?: string | null
          error_code?: string | null
          from_version: string
          id?: string
          initiated_by?: string | null
          initiated_by_email?: string | null
          installation_id: string
          metadata?: Json
          migration_from?: string | null
          migration_provider?: string | null
          migration_to?: string | null
          release_id: string
          rollback_status?: string
          safe_error_message?: string | null
          started_at?: string
          status?: string
          to_version: string
          updated_at?: string
        }
        Update: {
          backup_reference?: string | null
          channel?: string
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          deployment_provider?: string | null
          deployment_reference?: string | null
          error_code?: string | null
          from_version?: string
          id?: string
          initiated_by?: string | null
          initiated_by_email?: string | null
          installation_id?: string
          metadata?: Json
          migration_from?: string | null
          migration_provider?: string | null
          migration_to?: string | null
          release_id?: string
          rollback_status?: string
          safe_error_message?: string | null
          started_at?: string
          status?: string
          to_version?: string
          updated_at?: string
        }
        Relationships: []
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
      vat_validations: {
        Row: {
          checked_at: string | null
          country_code: string
          created_at: string
          customer_id: string | null
          expires_at: string | null
          id: string
          normalized_vat_id: string
          organization_id: string
          provider: string
          provider_reference: string | null
          response_snapshot: Json
          status: Database["public"]["Enums"]["vat_validation_status"]
          vat_id: string
        }
        Insert: {
          checked_at?: string | null
          country_code: string
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          normalized_vat_id: string
          organization_id: string
          provider?: string
          provider_reference?: string | null
          response_snapshot?: Json
          status?: Database["public"]["Enums"]["vat_validation_status"]
          vat_id: string
        }
        Update: {
          checked_at?: string | null
          country_code?: string
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          normalized_vat_id?: string
          organization_id?: string
          provider?: string
          provider_reference?: string | null
          response_snapshot?: Json
          status?: Database["public"]["Enums"]["vat_validation_status"]
          vat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vat_validations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      automation_check_limits: {
        Args: { _entity_key?: string; _rule_id: string }
        Returns: string
      }
      automation_claim_jobs: {
        Args: { _limit: number; _worker: string }
        Returns: {
          attempts: number
          available_at: string
          created_at: string
          dedupe_key: string | null
          execution_id: string | null
          id: string
          job_type: string
          last_error: string | null
          last_error_code: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          organization_id: string
          payload: Json
          rule_id: string | null
          shop_id: string
          status: Database["public"]["Enums"]["automation_job_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "automation_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      automation_record_error: { Args: { _rule_id: string }; Returns: string }
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
      can_view_profile: { Args: { _other_user: string }; Returns: boolean }
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
      claim_installation_owner: {
        Args: {
          _claim_hash: string
          _org_name: string
          _org_slug: string
          _shop_name: string
          _shop_slug: string
          _user_id: string
        }
        Returns: Json
      }
      comm_ensure_shop_defaults: {
        Args: { _org: string; _shop: string }
        Returns: undefined
      }
      credit_note_create: {
        Args: {
          _actor: string
          _amount_minor: number
          _idem?: string
          _invoice: string
          _org: string
          _reason?: string
          _refund?: string
        }
        Returns: Json
      }
      credit_note_issue: {
        Args: {
          _actor: string
          _credit_note: string
          _idem?: string
          _org: string
        }
        Returns: Json
      }
      current_org_ids: { Args: never; Returns: string[] }
      delivery_note_create: {
        Args: {
          _actor: string
          _fulfillment: string
          _idem?: string
          _notes?: string
          _org: string
        }
        Returns: Json
      }
      demo_purge_organization: { Args: { _org: string }; Returns: undefined }
      doc_assert: {
        Args: { _actor: string; _org: string; _perm: string }
        Returns: undefined
      }
      doc_branding_snapshot: { Args: { _shop: string }; Returns: Json }
      doc_next_number: {
        Args: {
          _org: string
          _shop: string
          _type: Database["public"]["Enums"]["document_type"]
        }
        Returns: string
      }
      doc_seller_snapshot: { Args: { _shop: string }; Returns: Json }
      doc_setup_missing: { Args: { _shop: string }; Returns: string[] }
      ful_cancel: {
        Args: {
          _actor: string
          _ful: string
          _idem?: string
          _org: string
          _reason?: string
        }
        Returns: Json
      }
      ful_complete_picking: {
        Args: {
          _actor: string
          _ful: string
          _idem?: string
          _org: string
          _picked: Json
        }
        Returns: Json
      }
      ful_create: {
        Args: {
          _actor: string
          _idem?: string
          _items: Json
          _location: string
          _notes?: string
          _order: string
          _org: string
          _shop: string
        }
        Returns: Json
      }
      ful_pack: {
        Args: {
          _actor: string
          _ful: string
          _idem?: string
          _org: string
          _packages: Json
        }
        Returns: Json
      }
      ful_recompute_order_status: {
        Args: { _order: string }
        Returns: Database["public"]["Enums"]["order_fulfillment_status"]
      }
      ful_start_picking: {
        Args: { _actor: string; _ful: string; _idem?: string; _org: string }
        Returns: Json
      }
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
      health_run_checks: { Args: { _org_id: string }; Returns: Json }
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
      invoice_create_from_order: {
        Args: { _actor: string; _idem?: string; _order: string; _org: string }
        Returns: Json
      }
      invoice_issue: {
        Args: { _actor: string; _idem?: string; _invoice: string; _org: string }
        Returns: Json
      }
      invoice_void: {
        Args: {
          _actor: string
          _invoice: string
          _org: string
          _reason?: string
        }
        Returns: Json
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      ops_expire_due: { Args: never; Returns: Json }
      order_cancel: {
        Args: {
          _actor: string
          _idem?: string
          _order: string
          _org: string
          _reason: string
        }
        Returns: Json
      }
      order_finalize_from_payment: {
        Args: {
          _actor?: string
          _amount_minor: number
          _currency: string
          _idem?: string
          _org: string
          _payment_session: string
          _provider_payment_id: string
        }
        Returns: Json
      }
      order_next_number: {
        Args: { _org: string; _shop: string }
        Returns: string
      }
      purge_mode: { Args: never; Returns: boolean }
      refund_create: {
        Args: {
          _actor: string
          _amount_minor: number
          _idem?: string
          _order: string
          _org: string
          _reason?: string
        }
        Returns: Json
      }
      refund_settle: {
        Args: {
          _error?: string
          _org: string
          _provider?: string
          _provider_refund_id?: string
          _refund: string
          _status: Database["public"]["Enums"]["refund_status"]
        }
        Returns: Json
      }
      ret_assert: {
        Args: { _actor: string; _org: string; _perm: string }
        Returns: undefined
      }
      ret_authorize: {
        Args: {
          _actor: string
          _instructions?: string
          _org: string
          _return: string
        }
        Returns: Json
      }
      ret_cancel: {
        Args: {
          _actor: string
          _by_customer?: boolean
          _org: string
          _return: string
        }
        Returns: Json
      }
      ret_complete: {
        Args: { _actor: string; _org: string; _return: string }
        Returns: Json
      }
      ret_inspect: {
        Args: {
          _actor: string
          _idem?: string
          _items: Json
          _org: string
          _return: string
          _shipping_minor: number
          _shipping_mode: Database["public"]["Enums"]["shipping_refund_mode"]
        }
        Returns: Json
      }
      ret_link_settlement: {
        Args: {
          _actor: string
          _credit_note: string
          _org: string
          _refund: string
          _return: string
        }
        Returns: Json
      }
      ret_mark_in_transit: {
        Args: {
          _actor: string
          _org: string
          _return: string
          _shipment?: string
        }
        Returns: Json
      }
      ret_next_number: {
        Args: { _org: string; _shop: string }
        Returns: string
      }
      ret_receive: {
        Args: {
          _actor: string
          _idem?: string
          _items: Json
          _org: string
          _return: string
        }
        Returns: Json
      }
      ret_reject: {
        Args: {
          _actor: string
          _internal?: string
          _org: string
          _reason: string
          _return: string
        }
        Returns: Json
      }
      ret_request: {
        Args: {
          _actor: string
          _customer: string
          _idem: string
          _items: Json
          _note: string
          _order: string
          _org: string
          _reason: Database["public"]["Enums"]["return_reason_code"]
          _shop: string
        }
        Returns: Json
      }
      ret_restock: {
        Args: {
          _actor: string
          _location: string
          _org: string
          _return_item: string
        }
        Returns: Json
      }
      ret_returned_qty: { Args: { _order_item: string }; Returns: number }
      ret_start_inspection: {
        Args: { _actor: string; _org: string; _return: string }
        Returns: Json
      }
      shares_org_with: { Args: { _other_user: string }; Returns: boolean }
      ship_cancel: {
        Args: {
          _actor: string
          _idem?: string
          _org: string
          _reason?: string
          _shipment: string
        }
        Returns: Json
      }
      ship_create: {
        Args: {
          _actor: string
          _ful: string
          _idem?: string
          _org: string
          _package: string
          _provider: string
          _service: string
        }
        Returns: Json
      }
      ship_mark_shipped: {
        Args: {
          _actor: string
          _idem?: string
          _org: string
          _shipment: string
        }
        Returns: Json
      }
      ship_record_label: {
        Args: {
          _actor: string
          _cost_minor?: number
          _currency?: string
          _format: string
          _idem?: string
          _mime: string
          _org: string
          _provider: string
          _provider_shipment_id: string
          _shipment: string
          _storage_path: string
          _tracking_number: string
          _tracking_url: string
        }
        Returns: Json
      }
      shop_in_org: {
        Args: { _org_id: string; _shop_id: string }
        Returns: boolean
      }
      store_current_ip_salt: { Args: never; Returns: string }
      store_rate_hit: {
        Args: {
          p_bucket: string
          p_key_id: string
          p_limit: number
          p_profile: string
          p_window_seconds: number
        }
        Returns: Json
      }
      track_record_event: {
        Args: {
          _code: string
          _description: string
          _location: string
          _normalized: Database["public"]["Enums"]["tracking_status"]
          _occurred_at: string
          _org: string
          _provider: string
          _provider_event_id: string
          _raw?: Json
          _shipment: string
        }
        Returns: Json
      }
      track_status_rank: {
        Args: { _status: Database["public"]["Enums"]["tracking_status"] }
        Returns: number
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
      automation_action_status:
        | "pending"
        | "running"
        | "succeeded"
        | "failed"
        | "skipped"
      automation_execution_status:
        | "queued"
        | "running"
        | "completed"
        | "partially_completed"
        | "failed"
        | "cancelled"
      automation_job_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
      automation_status: "draft" | "active" | "paused" | "archived"
      automation_trigger_type: "domain_event" | "schedule" | "manual"
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
      commerce_environment: "test" | "live"
      communication_channel: "email" | "sms" | "push" | "whatsapp"
      communication_delivery_status:
        | "accepted"
        | "sent"
        | "delivered"
        | "soft_bounce"
        | "hard_bounce"
        | "complained"
        | "rejected"
        | "unknown"
      communication_provider_status: "inactive" | "active" | "error"
      communication_recipient_type: "customer" | "guest" | "admin" | "test"
      communication_status:
        | "draft"
        | "queued"
        | "sending"
        | "sent"
        | "delivered"
        | "failed"
        | "cancelled"
        | "suppressed"
      communication_suppression_reason:
        | "hard_bounce"
        | "complaint"
        | "manual"
        | "invalid_recipient"
      communication_template_status: "draft" | "active" | "disabled"
      credit_note_status: "draft" | "issued" | "voided"
      customer_address_type: "shipping" | "billing" | "both"
      customer_kind: "b2c" | "b2b"
      customer_status: "active" | "blocked" | "guest" | "archived"
      delivery_note_status: "draft" | "issued" | "voided"
      document_format: "pdf" | "zugferd" | "xrechnung" | "ubl"
      document_format_status:
        | "not_generated"
        | "generated"
        | "validation_failed"
      document_type:
        | "invoice"
        | "credit_note"
        | "delivery_note"
        | "proforma_invoice"
        | "quote"
        | "return_document"
        | "payment_receipt"
        | "cancellation_document"
      entity_status: "active" | "inactive" | "archived"
      fulfillment_state:
        | "draft"
        | "ready"
        | "picking"
        | "packed"
        | "shipped"
        | "delivered"
        | "cancelled"
      integration_category: "payment" | "email" | "carrier"
      integration_health_status: "healthy" | "warning" | "error" | "unknown"
      integration_status:
        | "not_connected"
        | "setup_required"
        | "verification_required"
        | "connected"
        | "error"
        | "disabled"
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
      invoice_creation_strategy: "manual" | "on_order_paid" | "on_order_created"
      invoice_item_type: "product" | "shipping" | "discount" | "custom"
      invoice_status:
        | "draft"
        | "issued"
        | "partially_credited"
        | "credited"
        | "voided"
      location_type: "warehouse" | "store" | "fulfillment_center" | "virtual"
      order_fulfillment_status:
        | "unfulfilled"
        | "partially_fulfilled"
        | "fulfilled"
        | "returned"
      order_payment_status:
        | "unpaid"
        | "authorized"
        | "paid"
        | "partially_refunded"
        | "refunded"
        | "failed"
      order_state:
        | "pending"
        | "confirmed"
        | "processing"
        | "completed"
        | "cancelled"
      package_status: "draft" | "packed" | "shipped" | "delivered" | "cancelled"
      payment_attempt_status:
        | "started"
        | "pending"
        | "succeeded"
        | "failed"
        | "cancelled"
      payment_session_status:
        | "created"
        | "pending"
        | "paid"
        | "failed"
        | "cancelled"
        | "expired"
      payment_transaction_type:
        | "authorization"
        | "capture"
        | "charge"
        | "refund"
        | "partial_refund"
        | "void"
      price_type: "base" | "sale" | "tier" | "customer_group" | "override"
      product_status: "draft" | "active" | "archived"
      promotion_type:
        | "percentage"
        | "fixed_amount"
        | "fixed_price"
        | "buy_x_get_y"
        | "free_shipping"
      refund_status:
        | "requested"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      reservation_status: "active" | "released" | "committed" | "expired"
      restock_decision:
        | "pending"
        | "restock"
        | "do_not_restock"
        | "manual_review"
      return_approval_strategy: "manual" | "automatic_rules"
      return_item_condition:
        | "new"
        | "opened"
        | "used"
        | "damaged"
        | "defective"
        | "missing_parts"
        | "unknown"
      return_policy_type: "standard" | "non_returnable" | "custom"
      return_reason_code:
        | "wrong_size"
        | "wrong_item"
        | "damaged"
        | "defective"
        | "not_as_expected"
        | "changed_mind"
        | "late_delivery"
        | "other"
      return_resolution: "refund" | "store_credit" | "replacement" | "none"
      return_status:
        | "requested"
        | "authorized"
        | "rejected"
        | "in_transit"
        | "received"
        | "inspection"
        | "approved"
        | "partially_approved"
        | "refunded"
        | "completed"
        | "cancelled"
      return_window_start: "order_date" | "shipping_date" | "delivery_date"
      sender_domain_status:
        | "not_configured"
        | "dns_required"
        | "verifying"
        | "verified"
        | "error"
      sender_verification_status:
        | "unverified"
        | "pending"
        | "verified"
        | "failed"
      sequence_reset_policy: "never" | "yearly" | "monthly"
      shipment_direction: "outbound" | "return"
      shipment_status:
        | "created"
        | "label_created"
        | "in_transit"
        | "out_for_delivery"
        | "delivered"
        | "exception"
        | "cancelled"
      shipping_pricing_type: "fixed" | "free"
      shipping_refund_mode: "none" | "full" | "partial" | "manual"
      shipping_tax_strategy: "fixed_class" | "proportional" | "highest_rate"
      task_priority: "low" | "normal" | "high" | "urgent"
      task_source: "manual" | "automation" | "system"
      task_status: "open" | "in_progress" | "completed" | "cancelled"
      tax_calculation_mode: "gross" | "net"
      tax_customer_type: "consumer" | "business" | "any"
      tracking_status:
        | "pre_transit"
        | "in_transit"
        | "out_for_delivery"
        | "delivered"
        | "exception"
        | "returned"
        | "cancelled"
        | "unknown"
      transfer_status: "draft" | "in_transit" | "completed" | "cancelled"
      vat_validation_status:
        | "pending"
        | "valid"
        | "invalid"
        | "unavailable"
        | "manual_review"
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
      automation_action_status: [
        "pending",
        "running",
        "succeeded",
        "failed",
        "skipped",
      ],
      automation_execution_status: [
        "queued",
        "running",
        "completed",
        "partially_completed",
        "failed",
        "cancelled",
      ],
      automation_job_status: [
        "pending",
        "running",
        "completed",
        "failed",
        "cancelled",
      ],
      automation_status: ["draft", "active", "paused", "archived"],
      automation_trigger_type: ["domain_event", "schedule", "manual"],
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
      commerce_environment: ["test", "live"],
      communication_channel: ["email", "sms", "push", "whatsapp"],
      communication_delivery_status: [
        "accepted",
        "sent",
        "delivered",
        "soft_bounce",
        "hard_bounce",
        "complained",
        "rejected",
        "unknown",
      ],
      communication_provider_status: ["inactive", "active", "error"],
      communication_recipient_type: ["customer", "guest", "admin", "test"],
      communication_status: [
        "draft",
        "queued",
        "sending",
        "sent",
        "delivered",
        "failed",
        "cancelled",
        "suppressed",
      ],
      communication_suppression_reason: [
        "hard_bounce",
        "complaint",
        "manual",
        "invalid_recipient",
      ],
      communication_template_status: ["draft", "active", "disabled"],
      credit_note_status: ["draft", "issued", "voided"],
      customer_address_type: ["shipping", "billing", "both"],
      customer_kind: ["b2c", "b2b"],
      customer_status: ["active", "blocked", "guest", "archived"],
      delivery_note_status: ["draft", "issued", "voided"],
      document_format: ["pdf", "zugferd", "xrechnung", "ubl"],
      document_format_status: [
        "not_generated",
        "generated",
        "validation_failed",
      ],
      document_type: [
        "invoice",
        "credit_note",
        "delivery_note",
        "proforma_invoice",
        "quote",
        "return_document",
        "payment_receipt",
        "cancellation_document",
      ],
      entity_status: ["active", "inactive", "archived"],
      fulfillment_state: [
        "draft",
        "ready",
        "picking",
        "packed",
        "shipped",
        "delivered",
        "cancelled",
      ],
      integration_category: ["payment", "email", "carrier"],
      integration_health_status: ["healthy", "warning", "error", "unknown"],
      integration_status: [
        "not_connected",
        "setup_required",
        "verification_required",
        "connected",
        "error",
        "disabled",
      ],
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
      invoice_creation_strategy: [
        "manual",
        "on_order_paid",
        "on_order_created",
      ],
      invoice_item_type: ["product", "shipping", "discount", "custom"],
      invoice_status: [
        "draft",
        "issued",
        "partially_credited",
        "credited",
        "voided",
      ],
      location_type: ["warehouse", "store", "fulfillment_center", "virtual"],
      order_fulfillment_status: [
        "unfulfilled",
        "partially_fulfilled",
        "fulfilled",
        "returned",
      ],
      order_payment_status: [
        "unpaid",
        "authorized",
        "paid",
        "partially_refunded",
        "refunded",
        "failed",
      ],
      order_state: [
        "pending",
        "confirmed",
        "processing",
        "completed",
        "cancelled",
      ],
      package_status: ["draft", "packed", "shipped", "delivered", "cancelled"],
      payment_attempt_status: [
        "started",
        "pending",
        "succeeded",
        "failed",
        "cancelled",
      ],
      payment_session_status: [
        "created",
        "pending",
        "paid",
        "failed",
        "cancelled",
        "expired",
      ],
      payment_transaction_type: [
        "authorization",
        "capture",
        "charge",
        "refund",
        "partial_refund",
        "void",
      ],
      price_type: ["base", "sale", "tier", "customer_group", "override"],
      product_status: ["draft", "active", "archived"],
      promotion_type: [
        "percentage",
        "fixed_amount",
        "fixed_price",
        "buy_x_get_y",
        "free_shipping",
      ],
      refund_status: [
        "requested",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      reservation_status: ["active", "released", "committed", "expired"],
      restock_decision: [
        "pending",
        "restock",
        "do_not_restock",
        "manual_review",
      ],
      return_approval_strategy: ["manual", "automatic_rules"],
      return_item_condition: [
        "new",
        "opened",
        "used",
        "damaged",
        "defective",
        "missing_parts",
        "unknown",
      ],
      return_policy_type: ["standard", "non_returnable", "custom"],
      return_reason_code: [
        "wrong_size",
        "wrong_item",
        "damaged",
        "defective",
        "not_as_expected",
        "changed_mind",
        "late_delivery",
        "other",
      ],
      return_resolution: ["refund", "store_credit", "replacement", "none"],
      return_status: [
        "requested",
        "authorized",
        "rejected",
        "in_transit",
        "received",
        "inspection",
        "approved",
        "partially_approved",
        "refunded",
        "completed",
        "cancelled",
      ],
      return_window_start: ["order_date", "shipping_date", "delivery_date"],
      sender_domain_status: [
        "not_configured",
        "dns_required",
        "verifying",
        "verified",
        "error",
      ],
      sender_verification_status: [
        "unverified",
        "pending",
        "verified",
        "failed",
      ],
      sequence_reset_policy: ["never", "yearly", "monthly"],
      shipment_direction: ["outbound", "return"],
      shipment_status: [
        "created",
        "label_created",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "exception",
        "cancelled",
      ],
      shipping_pricing_type: ["fixed", "free"],
      shipping_refund_mode: ["none", "full", "partial", "manual"],
      shipping_tax_strategy: ["fixed_class", "proportional", "highest_rate"],
      task_priority: ["low", "normal", "high", "urgent"],
      task_source: ["manual", "automation", "system"],
      task_status: ["open", "in_progress", "completed", "cancelled"],
      tax_calculation_mode: ["gross", "net"],
      tax_customer_type: ["consumer", "business", "any"],
      tracking_status: [
        "pre_transit",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "exception",
        "returned",
        "cancelled",
        "unknown",
      ],
      transfer_status: ["draft", "in_transit", "completed", "cancelled"],
      vat_validation_status: [
        "pending",
        "valid",
        "invalid",
        "unavailable",
        "manual_review",
      ],
    },
  },
} as const
