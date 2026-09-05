-- EYIS Database Install Pack — Ausführungsrechte Funktionen (security-function-grants-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

REVOKE ALL ON FUNCTION public.audit_log_immutable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_log_immutable() FROM anon;
REVOKE ALL ON FUNCTION public.audit_log_immutable() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.audit_log_immutable() TO service_role;

REVOKE ALL ON FUNCTION public.automation_check_limits(_rule_id uuid, _entity_key text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.automation_check_limits(_rule_id uuid, _entity_key text) FROM anon;
REVOKE ALL ON FUNCTION public.automation_check_limits(_rule_id uuid, _entity_key text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.automation_check_limits(_rule_id uuid, _entity_key text) TO service_role;

REVOKE ALL ON FUNCTION public.automation_claim_jobs(_limit integer, _worker text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.automation_claim_jobs(_limit integer, _worker text) FROM anon;
REVOKE ALL ON FUNCTION public.automation_claim_jobs(_limit integer, _worker text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.automation_claim_jobs(_limit integer, _worker text) TO service_role;

REVOKE ALL ON FUNCTION public.automation_record_error(_rule_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.automation_record_error(_rule_id uuid) FROM anon;
REVOKE ALL ON FUNCTION public.automation_record_error(_rule_id uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.automation_record_error(_rule_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.automation_version_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.automation_version_guard() FROM anon;
REVOKE ALL ON FUNCTION public.automation_version_guard() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.automation_version_guard() TO service_role;

REVOKE ALL ON FUNCTION public.bulk_update_prices(_org_id uuid, _price_ids uuid[], _mode text, _amount_minor bigint, _percent_bp integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bulk_update_prices(_org_id uuid, _price_ids uuid[], _mode text, _amount_minor bigint, _percent_bp integer) FROM anon;
REVOKE ALL ON FUNCTION public.bulk_update_prices(_org_id uuid, _price_ids uuid[], _mode text, _amount_minor bigint, _percent_bp integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_update_prices(_org_id uuid, _price_ids uuid[], _mode text, _amount_minor bigint, _percent_bp integer) TO service_role;

REVOKE ALL ON FUNCTION public.can_view_profile(_other_user uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_profile(_other_user uuid) FROM anon;
REVOKE ALL ON FUNCTION public.can_view_profile(_other_user uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_profile(_other_user uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.cart_cancel_checkout(_org uuid, _session uuid, _actor uuid, _status checkout_session_status, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cart_cancel_checkout(_org uuid, _session uuid, _actor uuid, _status checkout_session_status, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.cart_cancel_checkout(_org uuid, _session uuid, _actor uuid, _status checkout_session_status, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cart_cancel_checkout(_org uuid, _session uuid, _actor uuid, _status checkout_session_status, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.cart_expire_checkout_sessions(_org uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cart_expire_checkout_sessions(_org uuid) FROM anon;
REVOKE ALL ON FUNCTION public.cart_expire_checkout_sessions(_org uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cart_expire_checkout_sessions(_org uuid) TO service_role;

REVOKE ALL ON FUNCTION public.cart_pick_location(_org uuid, _shop uuid, _item uuid, _qty integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cart_pick_location(_org uuid, _shop uuid, _item uuid, _qty integer) FROM anon;
REVOKE ALL ON FUNCTION public.cart_pick_location(_org uuid, _shop uuid, _item uuid, _qty integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cart_pick_location(_org uuid, _shop uuid, _item uuid, _qty integer) TO service_role;

REVOKE ALL ON FUNCTION public.cart_release_session_reservations(_org uuid, _session uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cart_release_session_reservations(_org uuid, _session uuid) FROM anon;
REVOKE ALL ON FUNCTION public.cart_release_session_reservations(_org uuid, _session uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cart_release_session_reservations(_org uuid, _session uuid) TO service_role;

REVOKE ALL ON FUNCTION public.cart_start_checkout(_org uuid, _shop uuid, _cart uuid, _snapshot uuid, _actor uuid, _email text, _ttl_minutes integer, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cart_start_checkout(_org uuid, _shop uuid, _cart uuid, _snapshot uuid, _actor uuid, _email text, _ttl_minutes integer, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.cart_start_checkout(_org uuid, _shop uuid, _cart uuid, _snapshot uuid, _actor uuid, _email text, _ttl_minutes integer, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cart_start_checkout(_org uuid, _shop uuid, _cart uuid, _snapshot uuid, _actor uuid, _email text, _ttl_minutes integer, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.claim_installation_owner_verified(_user_id uuid, _verified_email text, _org_name text, _org_slug text, _shop_name text, _shop_slug text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_installation_owner_verified(_user_id uuid, _verified_email text, _org_name text, _org_slug text, _shop_name text, _shop_slug text) FROM anon;
REVOKE ALL ON FUNCTION public.claim_installation_owner_verified(_user_id uuid, _verified_email text, _org_name text, _org_slug text, _shop_name text, _shop_slug text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_installation_owner_verified(_user_id uuid, _verified_email text, _org_name text, _org_slug text, _shop_name text, _shop_slug text) TO service_role;

REVOKE ALL ON FUNCTION public.claim_installation_owner(_claim_hash text, _user_id uuid, _org_name text, _org_slug text, _shop_name text, _shop_slug text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_installation_owner(_claim_hash text, _user_id uuid, _org_name text, _org_slug text, _shop_name text, _shop_slug text) FROM anon;
REVOKE ALL ON FUNCTION public.claim_installation_owner(_claim_hash text, _user_id uuid, _org_name text, _org_slug text, _shop_name text, _shop_slug text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_installation_owner(_claim_hash text, _user_id uuid, _org_name text, _org_slug text, _shop_name text, _shop_slug text) TO service_role;

REVOKE ALL ON FUNCTION public.comm_ensure_shop_defaults(_org uuid, _shop uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.comm_ensure_shop_defaults(_org uuid, _shop uuid) FROM anon;
REVOKE ALL ON FUNCTION public.comm_ensure_shop_defaults(_org uuid, _shop uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.comm_ensure_shop_defaults(_org uuid, _shop uuid) TO service_role;

REVOKE ALL ON FUNCTION public.comm_template_version_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.comm_template_version_guard() FROM anon;
REVOKE ALL ON FUNCTION public.comm_template_version_guard() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.comm_template_version_guard() TO service_role;

REVOKE ALL ON FUNCTION public.communication_provider_event_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.communication_provider_event_guard() FROM anon;
REVOKE ALL ON FUNCTION public.communication_provider_event_guard() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.communication_provider_event_guard() TO service_role;

REVOKE ALL ON FUNCTION public.communication_snapshot_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.communication_snapshot_guard() FROM anon;
REVOKE ALL ON FUNCTION public.communication_snapshot_guard() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.communication_snapshot_guard() TO service_role;

REVOKE ALL ON FUNCTION public.credit_note_create(_org uuid, _invoice uuid, _actor uuid, _amount_minor bigint, _reason text, _refund uuid, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_note_create(_org uuid, _invoice uuid, _actor uuid, _amount_minor bigint, _reason text, _refund uuid, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.credit_note_create(_org uuid, _invoice uuid, _actor uuid, _amount_minor bigint, _reason text, _refund uuid, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.credit_note_create(_org uuid, _invoice uuid, _actor uuid, _amount_minor bigint, _reason text, _refund uuid, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.credit_note_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_note_guard() FROM anon;
REVOKE ALL ON FUNCTION public.credit_note_guard() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.credit_note_guard() TO service_role;

REVOKE ALL ON FUNCTION public.credit_note_issue(_org uuid, _credit_note uuid, _actor uuid, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_note_issue(_org uuid, _credit_note uuid, _actor uuid, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.credit_note_issue(_org uuid, _credit_note uuid, _actor uuid, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.credit_note_issue(_org uuid, _credit_note uuid, _actor uuid, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.current_org_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_org_ids() FROM anon;
REVOKE ALL ON FUNCTION public.current_org_ids() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_ids() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.delivery_note_create(_org uuid, _fulfillment uuid, _actor uuid, _notes text, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delivery_note_create(_org uuid, _fulfillment uuid, _actor uuid, _notes text, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.delivery_note_create(_org uuid, _fulfillment uuid, _actor uuid, _notes text, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_note_create(_org uuid, _fulfillment uuid, _actor uuid, _notes text, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.demo_purge_organization(_org uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.demo_purge_organization(_org uuid) FROM anon;
REVOKE ALL ON FUNCTION public.demo_purge_organization(_org uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.demo_purge_organization(_org uuid) TO service_role;

REVOKE ALL ON FUNCTION public.doc_assert(_actor uuid, _org uuid, _perm text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.doc_assert(_actor uuid, _org uuid, _perm text) FROM anon;
REVOKE ALL ON FUNCTION public.doc_assert(_actor uuid, _org uuid, _perm text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.doc_assert(_actor uuid, _org uuid, _perm text) TO service_role;

REVOKE ALL ON FUNCTION public.doc_branding_snapshot(_shop uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.doc_branding_snapshot(_shop uuid) FROM anon;
REVOKE ALL ON FUNCTION public.doc_branding_snapshot(_shop uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.doc_branding_snapshot(_shop uuid) TO service_role;

REVOKE ALL ON FUNCTION public.doc_next_number(_org uuid, _shop uuid, _type document_type) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.doc_next_number(_org uuid, _shop uuid, _type document_type) FROM anon;
REVOKE ALL ON FUNCTION public.doc_next_number(_org uuid, _shop uuid, _type document_type) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.doc_next_number(_org uuid, _shop uuid, _type document_type) TO service_role;

REVOKE ALL ON FUNCTION public.doc_seller_snapshot(_shop uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.doc_seller_snapshot(_shop uuid) FROM anon;
REVOKE ALL ON FUNCTION public.doc_seller_snapshot(_shop uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.doc_seller_snapshot(_shop uuid) TO service_role;

REVOKE ALL ON FUNCTION public.doc_setup_missing(_shop uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.doc_setup_missing(_shop uuid) FROM anon;
REVOKE ALL ON FUNCTION public.doc_setup_missing(_shop uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.doc_setup_missing(_shop uuid) TO service_role;

REVOKE ALL ON FUNCTION public.document_files_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.document_files_guard() FROM anon;
REVOKE ALL ON FUNCTION public.document_files_guard() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.document_files_guard() TO service_role;

REVOKE ALL ON FUNCTION public.eyis_cron_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eyis_cron_status() FROM anon;
REVOKE ALL ON FUNCTION public.eyis_cron_status() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.eyis_cron_status() TO service_role;

REVOKE ALL ON FUNCTION public.ful_cancel(_org uuid, _ful uuid, _actor uuid, _reason text, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ful_cancel(_org uuid, _ful uuid, _actor uuid, _reason text, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.ful_cancel(_org uuid, _ful uuid, _actor uuid, _reason text, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ful_cancel(_org uuid, _ful uuid, _actor uuid, _reason text, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.ful_complete_picking(_org uuid, _ful uuid, _actor uuid, _picked jsonb, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ful_complete_picking(_org uuid, _ful uuid, _actor uuid, _picked jsonb, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.ful_complete_picking(_org uuid, _ful uuid, _actor uuid, _picked jsonb, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ful_complete_picking(_org uuid, _ful uuid, _actor uuid, _picked jsonb, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.ful_create(_org uuid, _shop uuid, _order uuid, _location uuid, _actor uuid, _items jsonb, _notes text, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ful_create(_org uuid, _shop uuid, _order uuid, _location uuid, _actor uuid, _items jsonb, _notes text, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.ful_create(_org uuid, _shop uuid, _order uuid, _location uuid, _actor uuid, _items jsonb, _notes text, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ful_create(_org uuid, _shop uuid, _order uuid, _location uuid, _actor uuid, _items jsonb, _notes text, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.ful_pack(_org uuid, _ful uuid, _actor uuid, _packages jsonb, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ful_pack(_org uuid, _ful uuid, _actor uuid, _packages jsonb, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.ful_pack(_org uuid, _ful uuid, _actor uuid, _packages jsonb, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ful_pack(_org uuid, _ful uuid, _actor uuid, _packages jsonb, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.ful_recompute_order_status(_order uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ful_recompute_order_status(_order uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ful_recompute_order_status(_order uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ful_recompute_order_status(_order uuid) TO service_role;

REVOKE ALL ON FUNCTION public.ful_start_picking(_org uuid, _ful uuid, _actor uuid, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ful_start_picking(_org uuid, _ful uuid, _actor uuid, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.ful_start_picking(_org uuid, _ful uuid, _actor uuid, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ful_start_picking(_org uuid, _ful uuid, _actor uuid, _idem text) TO service_role;

REVOKE ALL ON FUNCTION public.fulfillment_items_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fulfillment_items_guard() FROM anon;
REVOKE ALL ON FUNCTION public.fulfillment_items_guard() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fulfillment_items_guard() TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE ALL ON FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _role app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _role app_role) FROM anon;
REVOKE ALL ON FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _role app_role) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _role app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_permission(_user_id uuid, _org_id uuid, _permission text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission(_user_id uuid, _org_id uuid, _permission text) FROM anon;
REVOKE ALL ON FUNCTION public.has_permission(_user_id uuid, _org_id uuid, _permission text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(_user_id uuid, _org_id uuid, _permission text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.health_run_checks(_org_id uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.health_run_checks(_org_id uuid) FROM anon;
REVOKE ALL ON FUNCTION public.health_run_checks(_org_id uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.health_run_checks(_org_id uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.inv_adjust_stock(_org uuid, _shop uuid, _actor uuid, _item uuid, _loc uuid, _counted integer, _reason text, _note text, _idem text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inv_adjust_stock(_org uuid, _shop uuid, _actor uuid, _item uuid, _loc uuid, _counted integer, _reason text, _note text, _idem text) FROM anon;
REVOKE ALL ON FUNCTION public.inv_adjust_stock(_org uuid, _shop uuid, _actor uuid, _item uuid, _loc uuid, _counted integer, _reason text, _note text, _idem text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.inv_adjust_stock(_org uuid, _shop uuid, _actor uuid, _item uuid, _loc uuid, _counted integer, _reason text, _note text, _idem text) TO service_role;
