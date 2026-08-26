CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_org_idx ON public.order_items (organization_id);
CREATE INDEX IF NOT EXISTS order_promotions_order_idx ON public.order_promotions (order_id);
CREATE INDEX IF NOT EXISTS return_media_return_idx ON public.return_media (return_id);
CREATE INDEX IF NOT EXISTS return_sequences_org_idx ON public.return_sequences (organization_id);
CREATE INDEX IF NOT EXISTS shop_order_sequences_org_idx ON public.shop_order_sequences (organization_id);
CREATE INDEX IF NOT EXISTS outgoing_webhook_endpoints_org_idx ON public.outgoing_webhook_endpoints (organization_id);