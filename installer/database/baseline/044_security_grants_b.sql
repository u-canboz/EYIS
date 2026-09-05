-- EYIS Database Install Pack — Grants (security-grants-b)
-- Automatisch erzeugt. Nicht von Hand bearbeiten.

SET check_function_bodies = off;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."return_media" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."return_media" TO service_role;

GRANT SELECT ON public."return_sequences" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."return_sequences" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."return_settings" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."return_settings" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."returns" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."returns" TO service_role;

GRANT SELECT ON public."role_permissions" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."role_permissions" TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."sender_domains" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."sender_domains" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."sender_identities" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."sender_identities" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."shipments" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."shipments" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."shipping_labels" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."shipping_labels" TO service_role;

GRANT SELECT ON public."shipping_methods" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."shipping_methods" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."shipping_provider_configs" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."shipping_provider_configs" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."shop_domains" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."shop_domains" TO service_role;

GRANT SELECT ON public."shop_order_sequences" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."shop_order_sequences" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."shops" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."shops" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."stock_alert_rules" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."stock_alert_rules" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."store_api_keys" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."store_api_keys" TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."store_api_rate_counters" TO service_role;

GRANT SELECT ON public."store_api_request_logs" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."store_api_request_logs" TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."store_confirmation_tokens" TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."store_privacy_salts" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."tasks" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."tasks" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."tax_classes" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."tax_classes" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."tax_rates" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."tax_rates" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."tax_settings" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."tax_settings" TO service_role;

GRANT SELECT ON public."tax_snapshots" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."tax_snapshots" TO service_role;

GRANT SELECT ON public."tracking_events" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."tracking_events" TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."update_run_steps" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."update_run_steps" TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."update_runs" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."update_runs" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."variant_option_values" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."variant_option_values" TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON public."vat_validations" TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public."vat_validations" TO service_role;
