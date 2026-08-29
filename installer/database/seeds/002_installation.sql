-- EYIS System Seeds — Installations-Singleton und Seed-Version (idempotent).

INSERT INTO public.commerce_installation (singleton, mode)
SELECT true, 'dedicated'
WHERE NOT EXISTS (SELECT 1 FROM public.commerce_installation);

UPDATE public.eyis_installation_state
SET system_seed_version = '1.0.0', updated_at = now();
