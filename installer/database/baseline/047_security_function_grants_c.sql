-- EYIS Database Install Pack — Ausführungsrechte Funktionen (security-function-grants-c)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

REVOKE ALL ON FUNCTION public.ret_complete(_org uuid, _return uuid, _actor uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ret_complete(_org uuid, _return uuid, _actor uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ret_complete(_org uuid, _return uuid, _actor uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ret_complete(_org uuid, _return uuid, _actor uuid) TO service_role;

REVOKE ALL ON FUNCTION public.ret_inspect(_org uuid, _return uuid, _actor uuid, _items jsonb, _shipping_mode shipping_refund_mode, _shipping_minor bigint, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ret_inspect(_org uuid, _return uuid, _actor uuid, _items jsonb, _shipping_mode shipping_refund_mode, _shipping_minor bigint, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.ret_inspect(_org uuid, _return uuid, _actor uuid, _items jsonb, _shipping_mode shipping_refund_mode, _shipping_minor bigint, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ret_inspect(_org uuid, _return uuid, _actor uuid, _items jsonb, _shipping_mode shipping_refund_mode, _shipping_minor bigint, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.ret_link_settlement(_org uuid, _return uuid, _actor uuid, _refund uuid, _credit_note uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ret_link_settlement(_org uuid, _return uuid, _actor uuid, _refund uuid, _credit_note uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ret_link_settlement(_org uuid, _return uuid, _actor uuid, _refund uuid, _credit_note uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ret_link_settlement(_org uuid, _return uuid, _actor uuid, _refund uuid, _credit_note uuid) TO service_role;

REVOKE ALL ON FUNCTION public.ret_mark_in_transit(_org uuid, _return uuid, _actor uuid, _shipment uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ret_mark_in_transit(_org uuid, _return uuid, _actor uuid, _shipment uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ret_mark_in_transit(_org uuid, _return uuid, _actor uuid, _shipment uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ret_mark_in_transit(_org uuid, _return uuid, _actor uuid, _shipment uuid) TO service_role;

REVOKE ALL ON FUNCTION public.ret_next_number(_org uuid, _shop uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ret_next_number(_org uuid, _shop uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ret_next_number(_org uuid, _shop uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ret_next_number(_org uuid, _shop uuid) TO service_role;

REVOKE ALL ON FUNCTION public.ret_receive(_org uuid, _return uuid, _actor uuid, _items jsonb, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ret_receive(_org uuid, _return uuid, _actor uuid, _items jsonb, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.ret_receive(_org uuid, _return uuid, _actor uuid, _items jsonb, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ret_receive(_org uuid, _return uuid, _actor uuid, _items jsonb, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.ret_reject(_org uuid, _return uuid, _actor uuid, _reason text, _internal text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ret_reject(_org uuid, _return uuid, _actor uuid, _reason text, _internal text) FROM anon;
REVOKE ALL ON FUNCTION public.ret_reject(_org uuid, _return uuid, _actor uuid, _reason text, _internal text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ret_reject(_org uuid, _return uuid, _actor uuid, _reason text, _internal text) TO service_role;

REVOKE ALL ON FUNCTION public.ret_request(_org uuid, _shop uuid, _order uuid, _customer uuid, _actor uuid, _items jsonb, _reason return_reason_code, _note text, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ret_request(_org uuid, _shop uuid, _order uuid, _customer uuid, _actor uuid, _items jsonb, _reason return_reason_code, _note text, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.ret_request(_org uuid, _shop uuid, _order uuid, _customer uuid, _actor uuid, _items jsonb, _reason return_reason_code, _note text, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ret_request(_org uuid, _shop uuid, _order uuid, _customer uuid, _actor uuid, _items jsonb, _reason return_reason_code, _note text, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.ret_restock(_org uuid, _return_item uuid, _actor uuid, _location uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ret_restock(_org uuid, _return_item uuid, _actor uuid, _location uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ret_restock(_org uuid, _return_item uuid, _actor uuid, _location uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ret_restock(_org uuid, _return_item uuid, _actor uuid, _location uuid) TO service_role;

REVOKE ALL ON FUNCTION public.ret_returned_qty(_order_item uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ret_returned_qty(_order_item uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ret_returned_qty(_order_item uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ret_returned_qty(_order_item uuid) TO service_role;

REVOKE ALL ON FUNCTION public.ret_start_inspection(_org uuid, _return uuid, _actor uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ret_start_inspection(_org uuid, _return uuid, _actor uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ret_start_inspection(_org uuid, _return uuid, _actor uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ret_start_inspection(_org uuid, _return uuid, _actor uuid) TO service_role;

REVOKE ALL ON FUNCTION public.sender_domain_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sender_domain_guard() FROM anon;
REVOKE ALL ON FUNCTION public.sender_domain_guard() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sender_domain_guard() TO service_role;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;

REVOKE ALL ON FUNCTION public.shares_org_with(_other_user uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shares_org_with(_other_user uuid) FROM anon;
REVOKE ALL ON FUNCTION public.shares_org_with(_other_user uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.shares_org_with(_other_user uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.ship_cancel(_org uuid, _shipment uuid, _actor uuid, _reason text, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ship_cancel(_org uuid, _shipment uuid, _actor uuid, _reason text, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.ship_cancel(_org uuid, _shipment uuid, _actor uuid, _reason text, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ship_cancel(_org uuid, _shipment uuid, _actor uuid, _reason text, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.ship_create(_org uuid, _ful uuid, _package uuid, _provider text, _service text, _actor uuid, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ship_create(_org uuid, _ful uuid, _package uuid, _provider text, _service text, _actor uuid, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.ship_create(_org uuid, _ful uuid, _package uuid, _provider text, _service text, _actor uuid, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ship_create(_org uuid, _ful uuid, _package uuid, _provider text, _service text, _actor uuid, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.ship_mark_shipped(_org uuid, _shipment uuid, _actor uuid, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ship_mark_shipped(_org uuid, _shipment uuid, _actor uuid, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.ship_mark_shipped(_org uuid, _shipment uuid, _actor uuid, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ship_mark_shipped(_org uuid, _shipment uuid, _actor uuid, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.ship_record_label(_org uuid, _shipment uuid, _actor uuid, _provider text, _format text, _storage_path text, _mime text, _provider_shipment_id text, _tracking_number text, _tracking_url text, _cost_minor bigint, _currency text, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ship_record_label(_org uuid, _shipment uuid, _actor uuid, _provider text, _format text, _storage_path text, _mime text, _provider_shipment_id text, _tracking_number text, _tracking_url text, _cost_minor bigint, _currency text, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.ship_record_label(_org uuid, _shipment uuid, _actor uuid, _provider text, _format text, _storage_path text, _mime text, _provider_shipment_id text, _tracking_number text, _tracking_url text, _cost_minor bigint, _currency text, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ship_record_label(_org uuid, _shipment uuid, _actor uuid, _provider text, _format text, _storage_path text, _mime text, _provider_shipment_id text, _tracking_number text, _tracking_url text, _cost_minor bigint, _currency text, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.shop_in_org(_shop_id uuid, _org_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shop_in_org(_shop_id uuid, _org_id uuid) FROM anon;
REVOKE ALL ON FUNCTION public.shop_in_org(_shop_id uuid, _org_id uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.shop_in_org(_shop_id uuid, _org_id uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.snapshot_immutable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.snapshot_immutable() FROM anon;
REVOKE ALL ON FUNCTION public.snapshot_immutable() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_immutable() TO service_role;

REVOKE ALL ON FUNCTION public.store_current_ip_salt() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.store_current_ip_salt() FROM anon;
REVOKE ALL ON FUNCTION public.store_current_ip_salt() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.store_current_ip_salt() TO service_role;

REVOKE ALL ON FUNCTION public.store_rate_hit(p_key_id uuid, p_profile text, p_bucket text, p_limit integer, p_window_seconds integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.store_rate_hit(p_key_id uuid, p_profile text, p_bucket text, p_limit integer, p_window_seconds integer) FROM anon;
REVOKE ALL ON FUNCTION public.store_rate_hit(p_key_id uuid, p_profile text, p_bucket text, p_limit integer, p_window_seconds integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.store_rate_hit(p_key_id uuid, p_profile text, p_bucket text, p_limit integer, p_window_seconds integer) TO service_role;

REVOKE ALL ON FUNCTION public.tax_snapshot_immutable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tax_snapshot_immutable() FROM anon;
REVOKE ALL ON FUNCTION public.tax_snapshot_immutable() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.tax_snapshot_immutable() TO service_role;

REVOKE ALL ON FUNCTION public.track_record_event(_org uuid, _shipment uuid, _provider text, _provider_event_id text, _code text, _normalized tracking_status, _description text, _location text, _occurred_at timestamp with time zone, _raw jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.track_record_event(_org uuid, _shipment uuid, _provider text, _provider_event_id text, _code text, _normalized tracking_status, _description text, _location text, _occurred_at timestamp with time zone, _raw jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.track_record_event(_org uuid, _shipment uuid, _provider text, _provider_event_id text, _code text, _normalized tracking_status, _description text, _location text, _occurred_at timestamp with time zone, _raw jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.track_record_event(_org uuid, _shipment uuid, _provider text, _provider_event_id text, _code text, _normalized tracking_status, _description text, _location text, _occurred_at timestamp with time zone, _raw jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.track_status_rank(_status tracking_status) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.track_status_rank(_status tracking_status) FROM anon;
REVOKE ALL ON FUNCTION public.track_status_rank(_status tracking_status) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.track_status_rank(_status tracking_status) TO service_role;

REVOKE ALL ON FUNCTION public.tracking_events_immutable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tracking_events_immutable() FROM anon;
REVOKE ALL ON FUNCTION public.tracking_events_immutable() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.tracking_events_immutable() TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
