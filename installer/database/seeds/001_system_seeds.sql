-- EYIS Database Install Pack — System Seeds (idempotent, wiederholbar)
--
-- Enthält ausschließlich Systemdaten, die jede EYIS-Installation braucht.
-- Keine Kundendaten, keine Produkte, keine Demo-Daten, keine Secrets.

-- 1. Rollen-/Rechtematrix (Grundlage für has_permission)
INSERT INTO public.role_permissions (role, permission)
SELECT v.role::public.app_role, v.permission
FROM (VALUES
  ('owner', '*'),
  ('administrator', '*')
) AS v(role, permission)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role = v.role::public.app_role AND rp.permission = v.permission
);

-- 2. Installations-Singleton anlegen, falls noch nicht vorhanden.
INSERT INTO public.commerce_installation (singleton, mode)
SELECT true, 'dedicated'
WHERE NOT EXISTS (SELECT 1 FROM public.commerce_installation);

-- 3. Seed-Version im Journal festhalten.
UPDATE public.eyis_installation_state
SET system_seed_version = '1.0.0', updated_at = now();
