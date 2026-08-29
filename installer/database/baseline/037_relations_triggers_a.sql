-- EYIS Database Install Pack — Trigger (relations-triggers-a)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON public.audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON public.audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

CREATE TRIGGER automation_action_executions_updated_at BEFORE UPDATE ON public.automation_action_executions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER automation_actions_updated_at BEFORE UPDATE ON public.automation_actions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER automation_executions_updated_at BEFORE UPDATE ON public.automation_executions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER automation_jobs_updated_at BEFORE UPDATE ON public.automation_jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER automation_rule_versions_updated_at BEFORE UPDATE ON public.automation_rule_versions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER automation_version_guard_trg BEFORE DELETE OR UPDATE ON public.automation_rule_versions FOR EACH ROW EXECUTE FUNCTION automation_version_guard();

CREATE TRIGGER automation_rules_updated_at BEFORE UPDATE ON public.automation_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER cart_item_price_snapshots_immutable BEFORE DELETE OR UPDATE ON public.cart_item_price_snapshots FOR EACH ROW EXECUTE FUNCTION snapshot_immutable();

CREATE TRIGGER cart_items_updated_at BEFORE UPDATE ON public.cart_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER cart_price_snapshots_immutable BEFORE DELETE OR UPDATE ON public.cart_price_snapshots FOR EACH ROW EXECUTE FUNCTION snapshot_immutable();

CREATE TRIGGER carts_updated_at BEFORE UPDATE ON public.carts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER checkout_addresses_updated_at BEFORE UPDATE ON public.checkout_addresses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER checkout_sessions_updated_at BEFORE UPDATE ON public.checkout_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER checkout_snapshots_immutable BEFORE DELETE OR UPDATE ON public.checkout_snapshots FOR EACH ROW EXECUTE FUNCTION snapshot_immutable();

CREATE TRIGGER collections_updated_at BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER commerce_installation_updated BEFORE UPDATE ON public.commerce_installation FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER cbr_updated BEFORE UPDATE ON public.communication_branding FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER cpc_updated BEFORE UPDATE ON public.communication_provider_configs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER cpe_guard BEFORE DELETE OR UPDATE ON public.communication_provider_events FOR EACH ROW EXECUTE FUNCTION communication_provider_event_guard();

CREATE TRIGGER crl_updated BEFORE UPDATE ON public.communication_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER ctv_guard BEFORE DELETE OR UPDATE ON public.communication_template_versions FOR EACH ROW EXECUTE FUNCTION comm_template_version_guard();

CREATE TRIGGER ctpl_updated BEFORE UPDATE ON public.communication_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER comm_snapshot_guard BEFORE UPDATE ON public.communications FOR EACH ROW EXECUTE FUNCTION communication_snapshot_guard();

CREATE TRIGGER comm_updated BEFORE UPDATE ON public.communications FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER credit_notes_guard BEFORE DELETE OR UPDATE ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION credit_note_guard();

CREATE TRIGGER credit_notes_touch BEFORE UPDATE ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER customer_addresses_updated_at BEFORE UPDATE ON public.customer_addresses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER customer_groups_updated_at BEFORE UPDATE ON public.customer_groups FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER delivery_notes_touch BEFORE UPDATE ON public.delivery_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_demo_environments_updated_at BEFORE UPDATE ON public.demo_environments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER document_branding_touch BEFORE UPDATE ON public.document_branding FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER document_files_guard BEFORE UPDATE ON public.document_files FOR EACH ROW EXECUTE FUNCTION document_files_guard();

CREATE TRIGGER document_sequences_touch BEFORE UPDATE ON public.document_sequences FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER fulfillment_items_guard_trg BEFORE INSERT OR UPDATE ON public.fulfillment_items FOR EACH ROW EXECUTE FUNCTION fulfillment_items_guard();

CREATE TRIGGER fulfillment_items_updated_at BEFORE UPDATE ON public.fulfillment_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER fulfillments_updated_at BEFORE UPDATE ON public.fulfillments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER ic_updated BEFORE UPDATE ON public.integration_connections FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER ih_updated BEFORE UPDATE ON public.integration_health FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER inventory_levels_updated_at BEFORE UPDATE ON public.inventory_levels FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER inventory_locations_updated_at BEFORE UPDATE ON public.inventory_locations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER inventory_movements_no_delete BEFORE DELETE ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION inventory_movements_immutable();

CREATE TRIGGER inventory_movements_no_update BEFORE UPDATE ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION inventory_movements_immutable();

CREATE TRIGGER invitations_updated_at BEFORE UPDATE ON public.invitations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER invoice_items_guard BEFORE INSERT OR DELETE OR UPDATE ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION invoice_items_guard();

CREATE TRIGGER invoice_settings_touch BEFORE UPDATE ON public.invoice_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER invoices_guard BEFORE DELETE OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION invoice_guard();

CREATE TRIGGER invoices_touch BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER media_assets_updated_at BEFORE UPDATE ON public.media_assets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER memberships_protect_last_owner BEFORE DELETE OR UPDATE ON public.memberships FOR EACH ROW EXECUTE FUNCTION protect_last_owner();

CREATE TRIGGER memberships_updated_at BEFORE UPDATE ON public.memberships FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER order_addresses_immutable BEFORE DELETE OR UPDATE ON public.order_addresses FOR EACH ROW EXECUTE FUNCTION snapshot_immutable();

CREATE TRIGGER order_items_immutable BEFORE DELETE OR UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION snapshot_immutable();

CREATE TRIGGER order_promotions_immutable BEFORE DELETE OR UPDATE ON public.order_promotions FOR EACH ROW EXECUTE FUNCTION snapshot_immutable();

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER owe_updated_at BEFORE UPDATE ON public.outgoing_webhook_endpoints FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER package_presets_updated_at BEFORE UPDATE ON public.package_presets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER packages_updated_at BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER payment_attempts_updated_at BEFORE UPDATE ON public.payment_attempts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER payment_events_guard BEFORE UPDATE ON public.payment_events FOR EACH ROW EXECUTE FUNCTION payment_events_immutable();

CREATE TRIGGER payment_events_no_delete BEFORE DELETE ON public.payment_events FOR EACH ROW EXECUTE FUNCTION payment_events_immutable();

CREATE TRIGGER ppc_updated_at BEFORE UPDATE ON public.payment_provider_configs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER payment_sessions_updated_at BEFORE UPDATE ON public.payment_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER price_sets_updated_at BEFORE UPDATE ON public.price_sets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER prices_updated_at BEFORE UPDATE ON public.prices FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER prices_validate_trg BEFORE INSERT OR UPDATE ON public.prices FOR EACH ROW EXECUTE FUNCTION prices_validate();

CREATE TRIGGER product_blueprints_updated_at BEFORE UPDATE ON public.product_blueprints FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER product_options_updated_at BEFORE UPDATE ON public.product_options FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER product_variants_updated_at BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER promotions_updated_at BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER pc_updated BEFORE UPDATE ON public.provider_credentials FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_qa_fixtures_updated_at BEFORE UPDATE ON public.qa_fixtures FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER refunds_updated_at BEFORE UPDATE ON public.refunds FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER return_items_updated_at BEFORE UPDATE ON public.return_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER return_settings_updated_at BEFORE UPDATE ON public.return_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER returns_updated_at BEFORE UPDATE ON public.returns FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER sd_updated BEFORE UPDATE ON public.sender_domains FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER sd_verify_guard BEFORE UPDATE ON public.sender_domains FOR EACH ROW EXECUTE FUNCTION sender_domain_guard();

CREATE TRIGGER sid_updated BEFORE UPDATE ON public.sender_identities FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER shipments_updated_at BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER shipping_methods_updated_at BEFORE UPDATE ON public.shipping_methods FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER shipping_provider_configs_updated_at BEFORE UPDATE ON public.shipping_provider_configs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER shop_domains_updated_at BEFORE UPDATE ON public.shop_domains FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER shops_updated_at BEFORE UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER stock_alert_rules_updated_at BEFORE UPDATE ON public.stock_alert_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER store_api_keys_updated_at BEFORE UPDATE ON public.store_api_keys FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tax_classes_updated_at BEFORE UPDATE ON public.tax_classes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tax_rates_updated_at BEFORE UPDATE ON public.tax_rates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tax_settings_updated_at BEFORE UPDATE ON public.tax_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tax_snapshots_immutable BEFORE DELETE OR UPDATE ON public.tax_snapshots FOR EACH ROW EXECUTE FUNCTION tax_snapshot_immutable();

CREATE TRIGGER tracking_events_no_update BEFORE DELETE OR UPDATE ON public.tracking_events FOR EACH ROW EXECUTE FUNCTION tracking_events_immutable();

CREATE TRIGGER update_run_steps_set_updated_at BEFORE UPDATE ON public.update_run_steps FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_runs_set_updated_at BEFORE UPDATE ON public.update_runs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
