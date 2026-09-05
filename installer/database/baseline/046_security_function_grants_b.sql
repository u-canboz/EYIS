-- EYIS Database Install Pack — Ausführungsrechte Funktionen (security-function-grants-b)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

REVOKE ALL ON FUNCTION public.inv_assert(_actor uuid, _org uuid, _perm text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inv_assert(_actor uuid, _org uuid, _perm text) FROM anon;
REVOKE ALL ON FUNCTION public.inv_assert(_actor uuid, _org uuid, _perm text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inv_assert(_actor uuid, _org uuid, _perm text) TO service_role;

REVOKE ALL ON FUNCTION public.inv_audit(_org uuid, _actor uuid, _action text, _entity text, _entity_id text, _meta jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inv_audit(_org uuid, _actor uuid, _action text, _entity text, _entity_id text, _meta jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.inv_audit(_org uuid, _actor uuid, _action text, _entity text, _entity_id text, _meta jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inv_audit(_org uuid, _actor uuid, _action text, _entity text, _entity_id text, _meta jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.inv_available(_lvl inventory_levels) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inv_available(_lvl inventory_levels) FROM anon;
REVOKE ALL ON FUNCTION public.inv_available(_lvl inventory_levels) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inv_available(_lvl inventory_levels) TO service_role;

REVOKE ALL ON FUNCTION public.inv_commit_reservation(_org uuid, _actor uuid, _reservation uuid, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inv_commit_reservation(_org uuid, _actor uuid, _reservation uuid, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.inv_commit_reservation(_org uuid, _actor uuid, _reservation uuid, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inv_commit_reservation(_org uuid, _actor uuid, _reservation uuid, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.inv_event(_org uuid, _type text, _payload jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inv_event(_org uuid, _type text, _payload jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.inv_event(_org uuid, _type text, _payload jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inv_event(_org uuid, _type text, _payload jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.inv_expire_reservations(_org uuid, _actor uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inv_expire_reservations(_org uuid, _actor uuid) FROM anon;
REVOKE ALL ON FUNCTION public.inv_expire_reservations(_org uuid, _actor uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inv_expire_reservations(_org uuid, _actor uuid) TO service_role;

REVOKE ALL ON FUNCTION public.inv_health_check(_org uuid, _actor uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inv_health_check(_org uuid, _actor uuid) FROM anon;
REVOKE ALL ON FUNCTION public.inv_health_check(_org uuid, _actor uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inv_health_check(_org uuid, _actor uuid) TO service_role;

REVOKE ALL ON FUNCTION public.inv_idem_get(_org uuid, _endpoint text, _key text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inv_idem_get(_org uuid, _endpoint text, _key text) FROM anon;
REVOKE ALL ON FUNCTION public.inv_idem_get(_org uuid, _endpoint text, _key text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inv_idem_get(_org uuid, _endpoint text, _key text) TO service_role;

REVOKE ALL ON FUNCTION public.inv_idem_put(_org uuid, _endpoint text, _key text, _response jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inv_idem_put(_org uuid, _endpoint text, _key text, _response jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.inv_idem_put(_org uuid, _endpoint text, _key text, _response jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inv_idem_put(_org uuid, _endpoint text, _key text, _response jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.inv_lock_level(_org uuid, _shop uuid, _item uuid, _loc uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inv_lock_level(_org uuid, _shop uuid, _item uuid, _loc uuid) FROM anon;
REVOKE ALL ON FUNCTION public.inv_lock_level(_org uuid, _shop uuid, _item uuid, _loc uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inv_lock_level(_org uuid, _shop uuid, _item uuid, _loc uuid) TO service_role;

REVOKE ALL ON FUNCTION public.inv_mark_damaged(_org uuid, _shop uuid, _actor uuid, _item uuid, _loc uuid, _qty integer, _reason text, _note text, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inv_mark_damaged(_org uuid, _shop uuid, _actor uuid, _item uuid, _loc uuid, _qty integer, _reason text, _note text, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.inv_mark_damaged(_org uuid, _shop uuid, _actor uuid, _item uuid, _loc uuid, _qty integer, _reason text, _note text, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inv_mark_damaged(_org uuid, _shop uuid, _actor uuid, _item uuid, _loc uuid, _qty integer, _reason text, _note text, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.inv_movement(_org uuid, _shop uuid, _item uuid, _loc uuid, _type inventory_movement_type, _delta integer, _ref_type text, _ref_id text, _reason text, _note text, _actor uuid, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inv_movement(_org uuid, _shop uuid, _item uuid, _loc uuid, _type inventory_movement_type, _delta integer, _ref_type text, _ref_id text, _reason text, _note text, _actor uuid, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.inv_movement(_org uuid, _shop uuid, _item uuid, _loc uuid, _type inventory_movement_type, _delta integer, _ref_type text, _ref_id text, _reason text, _note text, _actor uuid, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inv_movement(_org uuid, _shop uuid, _item uuid, _loc uuid, _type inventory_movement_type, _delta integer, _ref_type text, _ref_id text, _reason text, _note text, _actor uuid, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.inv_receive_stock(_org uuid, _shop uuid, _actor uuid, _item uuid, _loc uuid, _qty integer, _reference text, _note text, _incoming_delta integer, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inv_receive_stock(_org uuid, _shop uuid, _actor uuid, _item uuid, _loc uuid, _qty integer, _reference text, _note text, _incoming_delta integer, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.inv_receive_stock(_org uuid, _shop uuid, _actor uuid, _item uuid, _loc uuid, _qty integer, _reference text, _note text, _incoming_delta integer, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inv_receive_stock(_org uuid, _shop uuid, _actor uuid, _item uuid, _loc uuid, _qty integer, _reference text, _note text, _incoming_delta integer, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.inv_release_reservation(_org uuid, _actor uuid, _reservation uuid, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inv_release_reservation(_org uuid, _actor uuid, _reservation uuid, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.inv_release_reservation(_org uuid, _actor uuid, _reservation uuid, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inv_release_reservation(_org uuid, _actor uuid, _reservation uuid, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.inv_reserve_stock(_org uuid, _shop uuid, _actor uuid, _item uuid, _loc uuid, _qty integer, _reference_type text, _reference_id text, _expires_at timestamp with time zone, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inv_reserve_stock(_org uuid, _shop uuid, _actor uuid, _item uuid, _loc uuid, _qty integer, _reference_type text, _reference_id text, _expires_at timestamp with time zone, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.inv_reserve_stock(_org uuid, _shop uuid, _actor uuid, _item uuid, _loc uuid, _qty integer, _reference_type text, _reference_id text, _expires_at timestamp with time zone, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inv_reserve_stock(_org uuid, _shop uuid, _actor uuid, _item uuid, _loc uuid, _qty integer, _reference_type text, _reference_id text, _expires_at timestamp with time zone, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.inv_status_events(_org uuid, _shop uuid, _item uuid, _loc uuid, _old integer, _new integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inv_status_events(_org uuid, _shop uuid, _item uuid, _loc uuid, _old integer, _new integer) FROM anon;
REVOKE ALL ON FUNCTION public.inv_status_events(_org uuid, _shop uuid, _item uuid, _loc uuid, _old integer, _new integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inv_status_events(_org uuid, _shop uuid, _item uuid, _loc uuid, _old integer, _new integer) TO service_role;

REVOKE ALL ON FUNCTION public.inv_transfer_cancel(_org uuid, _actor uuid, _transfer uuid, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inv_transfer_cancel(_org uuid, _actor uuid, _transfer uuid, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.inv_transfer_cancel(_org uuid, _actor uuid, _transfer uuid, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inv_transfer_cancel(_org uuid, _actor uuid, _transfer uuid, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.inv_transfer_complete(_org uuid, _actor uuid, _transfer uuid, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inv_transfer_complete(_org uuid, _actor uuid, _transfer uuid, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.inv_transfer_complete(_org uuid, _actor uuid, _transfer uuid, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inv_transfer_complete(_org uuid, _actor uuid, _transfer uuid, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.inv_transfer_start(_org uuid, _actor uuid, _transfer uuid, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inv_transfer_start(_org uuid, _actor uuid, _transfer uuid, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.inv_transfer_start(_org uuid, _actor uuid, _transfer uuid, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inv_transfer_start(_org uuid, _actor uuid, _transfer uuid, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.inventory_movements_immutable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inventory_movements_immutable() FROM anon;
REVOKE ALL ON FUNCTION public.inventory_movements_immutable() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_movements_immutable() TO service_role;

REVOKE ALL ON FUNCTION public.invoice_create_from_order(_org uuid, _order uuid, _actor uuid, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoice_create_from_order(_org uuid, _order uuid, _actor uuid, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.invoice_create_from_order(_org uuid, _order uuid, _actor uuid, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_create_from_order(_org uuid, _order uuid, _actor uuid, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.invoice_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoice_guard() FROM anon;
REVOKE ALL ON FUNCTION public.invoice_guard() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_guard() TO service_role;

REVOKE ALL ON FUNCTION public.invoice_issue(_org uuid, _invoice uuid, _actor uuid, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoice_issue(_org uuid, _invoice uuid, _actor uuid, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.invoice_issue(_org uuid, _invoice uuid, _actor uuid, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_issue(_org uuid, _invoice uuid, _actor uuid, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.invoice_items_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoice_items_guard() FROM anon;
REVOKE ALL ON FUNCTION public.invoice_items_guard() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_items_guard() TO service_role;

REVOKE ALL ON FUNCTION public.invoice_void(_org uuid, _invoice uuid, _actor uuid, _reason text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoice_void(_org uuid, _invoice uuid, _actor uuid, _reason text) FROM anon;
REVOKE ALL ON FUNCTION public.invoice_void(_org uuid, _invoice uuid, _actor uuid, _reason text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_void(_org uuid, _invoice uuid, _actor uuid, _reason text) TO service_role;

REVOKE ALL ON FUNCTION public.is_org_member(_user_id uuid, _org_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_org_member(_user_id uuid, _org_id uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_org_member(_user_id uuid, _org_id uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(_user_id uuid, _org_id uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.ops_expire_due() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ops_expire_due() FROM anon;
REVOKE ALL ON FUNCTION public.ops_expire_due() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ops_expire_due() TO service_role;

REVOKE ALL ON FUNCTION public.order_cancel(_org uuid, _order uuid, _actor uuid, _reason text, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.order_cancel(_org uuid, _order uuid, _actor uuid, _reason text, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.order_cancel(_org uuid, _order uuid, _actor uuid, _reason text, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.order_cancel(_org uuid, _order uuid, _actor uuid, _reason text, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.order_finalize_from_payment(_org uuid, _payment_session uuid, _provider_payment_id text, _amount_minor bigint, _currency text, _actor uuid, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.order_finalize_from_payment(_org uuid, _payment_session uuid, _provider_payment_id text, _amount_minor bigint, _currency text, _actor uuid, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.order_finalize_from_payment(_org uuid, _payment_session uuid, _provider_payment_id text, _amount_minor bigint, _currency text, _actor uuid, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.order_finalize_from_payment(_org uuid, _payment_session uuid, _provider_payment_id text, _amount_minor bigint, _currency text, _actor uuid, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.order_next_number(_org uuid, _shop uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.order_next_number(_org uuid, _shop uuid) FROM anon;
REVOKE ALL ON FUNCTION public.order_next_number(_org uuid, _shop uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.order_next_number(_org uuid, _shop uuid) TO service_role;

REVOKE ALL ON FUNCTION public.payment_events_immutable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.payment_events_immutable() FROM anon;
REVOKE ALL ON FUNCTION public.payment_events_immutable() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.payment_events_immutable() TO service_role;

REVOKE ALL ON FUNCTION public.prices_validate() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prices_validate() FROM anon;
REVOKE ALL ON FUNCTION public.prices_validate() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.prices_validate() TO service_role;

REVOKE ALL ON FUNCTION public.protect_last_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_last_owner() FROM anon;
REVOKE ALL ON FUNCTION public.protect_last_owner() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.protect_last_owner() TO service_role;

REVOKE ALL ON FUNCTION public.purge_mode() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_mode() FROM anon;
REVOKE ALL ON FUNCTION public.purge_mode() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purge_mode() TO service_role;

REVOKE ALL ON FUNCTION public.refund_create(_org uuid, _order uuid, _actor uuid, _amount_minor bigint, _reason text, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_create(_org uuid, _order uuid, _actor uuid, _amount_minor bigint, _reason text, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.refund_create(_org uuid, _order uuid, _actor uuid, _amount_minor bigint, _reason text, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refund_create(_org uuid, _order uuid, _actor uuid, _amount_minor bigint, _reason text, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.refund_settle(_org uuid, _refund uuid, _status refund_status, _provider text, _provider_refund_id text, _error text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_settle(_org uuid, _refund uuid, _status refund_status, _provider text, _provider_refund_id text, _error text) FROM anon;
REVOKE ALL ON FUNCTION public.refund_settle(_org uuid, _refund uuid, _status refund_status, _provider text, _provider_refund_id text, _error text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refund_settle(_org uuid, _refund uuid, _status refund_status, _provider text, _provider_refund_id text, _error text) TO service_role;

REVOKE ALL ON FUNCTION public.ret_assert(_actor uuid, _org uuid, _perm text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ret_assert(_actor uuid, _org uuid, _perm text) FROM anon;
REVOKE ALL ON FUNCTION public.ret_assert(_actor uuid, _org uuid, _perm text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ret_assert(_actor uuid, _org uuid, _perm text) TO service_role;

REVOKE ALL ON FUNCTION public.ret_authorize(_org uuid, _return uuid, _actor uuid, _instructions text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ret_authorize(_org uuid, _return uuid, _actor uuid, _instructions text) FROM anon;
REVOKE ALL ON FUNCTION public.ret_authorize(_org uuid, _return uuid, _actor uuid, _instructions text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ret_authorize(_org uuid, _return uuid, _actor uuid, _instructions text) TO service_role;

REVOKE ALL ON FUNCTION public.ret_cancel(_org uuid, _return uuid, _actor uuid, _by_customer boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ret_cancel(_org uuid, _return uuid, _actor uuid, _by_customer boolean) FROM anon;
REVOKE ALL ON FUNCTION public.ret_cancel(_org uuid, _return uuid, _actor uuid, _by_customer boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ret_cancel(_org uuid, _return uuid, _actor uuid, _by_customer boolean) TO service_role;
