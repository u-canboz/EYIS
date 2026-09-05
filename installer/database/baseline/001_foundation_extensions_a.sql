-- EYIS Database Install Pack — Extensions und Enums (foundation-extensions-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE TYPE public."app_role" AS ENUM (
  'owner',
  'administrator',
  'operations',
  'catalog_manager',
  'fulfillment',
  'customer_support',
  'finance',
  'marketing',
  'developer',
  'read_only'
);

CREATE TYPE public."automation_action_status" AS ENUM (
  'pending',
  'running',
  'succeeded',
  'failed',
  'skipped'
);

CREATE TYPE public."automation_execution_status" AS ENUM (
  'queued',
  'running',
  'completed',
  'partially_completed',
  'failed',
  'cancelled'
);

CREATE TYPE public."automation_job_status" AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE public."automation_status" AS ENUM (
  'draft',
  'active',
  'paused',
  'archived'
);

CREATE TYPE public."automation_trigger_type" AS ENUM (
  'domain_event',
  'schedule',
  'manual'
);

CREATE TYPE public."blueprint_status" AS ENUM (
  'draft',
  'active',
  'deprecated'
);

CREATE TYPE public."cart_status" AS ENUM (
  'active',
  'checkout',
  'completed',
  'abandoned',
  'expired'
);

CREATE TYPE public."checkout_address_type" AS ENUM (
  'shipping',
  'billing'
);

CREATE TYPE public."checkout_session_status" AS ENUM (
  'open',
  'validated',
  'awaiting_payment',
  'completed',
  'expired',
  'cancelled'
);

CREATE TYPE public."commerce_environment" AS ENUM (
  'test',
  'live'
);

CREATE TYPE public."communication_channel" AS ENUM (
  'email',
  'sms',
  'push',
  'whatsapp'
);

CREATE TYPE public."communication_delivery_status" AS ENUM (
  'accepted',
  'sent',
  'delivered',
  'soft_bounce',
  'hard_bounce',
  'complained',
  'rejected',
  'unknown'
);

CREATE TYPE public."communication_provider_status" AS ENUM (
  'inactive',
  'active',
  'error'
);

CREATE TYPE public."communication_recipient_type" AS ENUM (
  'customer',
  'guest',
  'admin',
  'test'
);

CREATE TYPE public."communication_status" AS ENUM (
  'draft',
  'queued',
  'sending',
  'sent',
  'delivered',
  'failed',
  'cancelled',
  'suppressed'
);

CREATE TYPE public."communication_suppression_reason" AS ENUM (
  'hard_bounce',
  'complaint',
  'manual',
  'invalid_recipient'
);

CREATE TYPE public."communication_template_status" AS ENUM (
  'draft',
  'active',
  'disabled'
);

CREATE TYPE public."credit_note_status" AS ENUM (
  'draft',
  'issued',
  'voided'
);

CREATE TYPE public."customer_address_type" AS ENUM (
  'shipping',
  'billing',
  'both'
);

CREATE TYPE public."customer_kind" AS ENUM (
  'b2c',
  'b2b'
);

CREATE TYPE public."customer_status" AS ENUM (
  'active',
  'blocked',
  'guest',
  'archived'
);

CREATE TYPE public."delivery_note_status" AS ENUM (
  'draft',
  'issued',
  'voided'
);

CREATE TYPE public."document_format" AS ENUM (
  'pdf',
  'zugferd',
  'xrechnung',
  'ubl'
);

CREATE TYPE public."document_format_status" AS ENUM (
  'not_generated',
  'generated',
  'validation_failed'
);

CREATE TYPE public."document_type" AS ENUM (
  'invoice',
  'credit_note',
  'delivery_note',
  'proforma_invoice',
  'quote',
  'return_document',
  'payment_receipt',
  'cancellation_document'
);

CREATE TYPE public."entity_status" AS ENUM (
  'active',
  'inactive',
  'archived'
);

CREATE TYPE public."fulfillment_state" AS ENUM (
  'draft',
  'ready',
  'picking',
  'packed',
  'shipped',
  'delivered',
  'cancelled'
);

CREATE TYPE public."integration_category" AS ENUM (
  'payment',
  'email',
  'carrier'
);

CREATE TYPE public."integration_health_status" AS ENUM (
  'healthy',
  'warning',
  'error',
  'unknown'
);

CREATE TYPE public."integration_status" AS ENUM (
  'not_connected',
  'setup_required',
  'verification_required',
  'connected',
  'error',
  'disabled'
);

CREATE TYPE public."inventory_movement_type" AS ENUM (
  'initial_stock',
  'receipt',
  'adjustment',
  'reservation',
  'reservation_release',
  'sale_commit',
  'return',
  'transfer_out',
  'transfer_in',
  'damage',
  'correction'
);

CREATE TYPE public."invitation_status" AS ENUM (
  'pending',
  'accepted',
  'revoked',
  'expired'
);

CREATE TYPE public."invoice_creation_strategy" AS ENUM (
  'manual',
  'on_order_paid',
  'on_order_created'
);

CREATE TYPE public."invoice_item_type" AS ENUM (
  'product',
  'shipping',
  'discount',
  'custom'
);

CREATE TYPE public."invoice_status" AS ENUM (
  'draft',
  'issued',
  'partially_credited',
  'credited',
  'voided'
);

CREATE TYPE public."location_type" AS ENUM (
  'warehouse',
  'store',
  'fulfillment_center',
  'virtual'
);

CREATE TYPE public."order_fulfillment_status" AS ENUM (
  'unfulfilled',
  'partially_fulfilled',
  'fulfilled',
  'returned'
);

CREATE TYPE public."order_payment_status" AS ENUM (
  'unpaid',
  'authorized',
  'paid',
  'partially_refunded',
  'refunded',
  'failed'
);

CREATE TYPE public."order_state" AS ENUM (
  'pending',
  'confirmed',
  'processing',
  'completed',
  'cancelled'
);

CREATE TYPE public."package_status" AS ENUM (
  'draft',
  'packed',
  'shipped',
  'delivered',
  'cancelled'
);

CREATE TYPE public."payment_attempt_status" AS ENUM (
  'started',
  'pending',
  'succeeded',
  'failed',
  'cancelled'
);

CREATE TYPE public."payment_session_status" AS ENUM (
  'created',
  'pending',
  'paid',
  'failed',
  'cancelled',
  'expired'
);

CREATE TYPE public."payment_transaction_type" AS ENUM (
  'authorization',
  'capture',
  'charge',
  'refund',
  'partial_refund',
  'void'
);

CREATE TYPE public."price_type" AS ENUM (
  'base',
  'sale',
  'tier',
  'customer_group',
  'override'
);

CREATE TYPE public."product_status" AS ENUM (
  'draft',
  'active',
  'archived'
);

CREATE TYPE public."promotion_type" AS ENUM (
  'percentage',
  'fixed_amount',
  'fixed_price',
  'buy_x_get_y',
  'free_shipping'
);

CREATE TYPE public."refund_status" AS ENUM (
  'requested',
  'processing',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE public."reservation_status" AS ENUM (
  'active',
  'released',
  'committed',
  'expired'
);

CREATE TYPE public."restock_decision" AS ENUM (
  'pending',
  'restock',
  'do_not_restock',
  'manual_review'
);

CREATE TYPE public."return_approval_strategy" AS ENUM (
  'manual',
  'automatic_rules'
);

CREATE TYPE public."return_item_condition" AS ENUM (
  'new',
  'opened',
  'used',
  'damaged',
  'defective',
  'missing_parts',
  'unknown'
);

CREATE TYPE public."return_policy_type" AS ENUM (
  'standard',
  'non_returnable',
  'custom'
);

CREATE TYPE public."return_reason_code" AS ENUM (
  'wrong_size',
  'wrong_item',
  'damaged',
  'defective',
  'not_as_expected',
  'changed_mind',
  'late_delivery',
  'other'
);

CREATE TYPE public."return_resolution" AS ENUM (
  'refund',
  'store_credit',
  'replacement',
  'none'
);

CREATE TYPE public."return_status" AS ENUM (
  'requested',
  'authorized',
  'rejected',
  'in_transit',
  'received',
  'inspection',
  'approved',
  'partially_approved',
  'refunded',
  'completed',
  'cancelled'
);

CREATE TYPE public."return_window_start" AS ENUM (
  'order_date',
  'shipping_date',
  'delivery_date'
);

CREATE TYPE public."sender_domain_status" AS ENUM (
  'not_configured',
  'dns_required',
  'verifying',
  'verified',
  'error'
);

CREATE TYPE public."sender_verification_status" AS ENUM (
  'unverified',
  'pending',
  'verified',
  'failed'
);

CREATE TYPE public."sequence_reset_policy" AS ENUM (
  'never',
  'yearly',
  'monthly'
);

CREATE TYPE public."shipment_direction" AS ENUM (
  'outbound',
  'return'
);

CREATE TYPE public."shipment_status" AS ENUM (
  'created',
  'label_created',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'exception',
  'cancelled'
);

CREATE TYPE public."shipping_pricing_type" AS ENUM (
  'fixed',
  'free'
);

CREATE TYPE public."shipping_refund_mode" AS ENUM (
  'none',
  'full',
  'partial',
  'manual'
);

CREATE TYPE public."shipping_tax_strategy" AS ENUM (
  'fixed_class',
  'proportional',
  'highest_rate'
);

CREATE TYPE public."task_priority" AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);

CREATE TYPE public."task_source" AS ENUM (
  'manual',
  'automation',
  'system'
);

CREATE TYPE public."task_status" AS ENUM (
  'open',
  'in_progress',
  'completed',
  'cancelled'
);

CREATE TYPE public."tax_calculation_mode" AS ENUM (
  'gross',
  'net'
);

CREATE TYPE public."tax_customer_type" AS ENUM (
  'consumer',
  'business',
  'any'
);

CREATE TYPE public."tracking_status" AS ENUM (
  'pre_transit',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'exception',
  'returned',
  'cancelled',
  'unknown'
);

CREATE TYPE public."transfer_status" AS ENUM (
  'draft',
  'in_transit',
  'completed',
  'cancelled'
);

CREATE TYPE public."vat_validation_status" AS ENUM (
  'pending',
  'valid',
  'invalid',
  'unavailable',
  'manual_review'
);
