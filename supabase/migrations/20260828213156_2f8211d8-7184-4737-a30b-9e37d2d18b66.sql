ALTER TABLE public.commerce_installation
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS shop_id uuid,
  ADD COLUMN IF NOT EXISTS storefront_key_id uuid,
  ADD COLUMN IF NOT EXISTS storefront_publishable_key text;

COMMENT ON COLUMN public.commerce_installation.storefront_publishable_key IS
  'Publishable Store-API-Key der Dedicated-Storefront. Kein Geheimnis (Shop-Identifikator), nur serverseitig lesbar und ueber /api/public/store/v1/runtime-config ausgeliefert.';