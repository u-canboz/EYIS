/**
 * System Seeds für den EYIS Database Install Pack.
 *
 * Systemdaten (Rollen-/Rechtematrix, Installations-Singleton) — niemals
 * Kunden-, Produkt-, Bestell- oder Demo-Daten.
 */

import { execFileSync } from "node:child_process";

export type SeedFile = { file: string; sql: string; version: string };

function rolePermissions(): { role: string; permission: string }[] {
  const out = execFileSync(
    "psql",
    [
      "-At",
      "-c",
      "select coalesce(json_agg(t order by t.role, t.permission), '[]'::json) from (select role::text, permission from public.role_permissions) t",
    ],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  return JSON.parse(out);
}

export function buildSeeds(): SeedFile[] {
  const rows = rolePermissions();
  const values = rows
    .map((r) => `  ('${r.role}'::public.app_role, '${r.permission.replace(/'/g, "''")}')`)
    .join(",\n");

  const permissions = `-- EYIS System Seeds — Rollen- und Rechtematrix (idempotent).
-- Automatisch erzeugt aus dem Stable Release. Keine Kundendaten.

INSERT INTO public.role_permissions (role, permission)
VALUES
${values}
ON CONFLICT DO NOTHING;
`;

  const installation = `-- EYIS System Seeds — Installations-Singleton und Seed-Version (idempotent).

INSERT INTO public.commerce_installation (singleton, mode)
SELECT true, 'dedicated'
WHERE NOT EXISTS (SELECT 1 FROM public.commerce_installation);

UPDATE public.eyis_installation_state
SET system_seed_version = '1.0.0', updated_at = now();
`;

  return [
    { file: "seeds/001_role_permissions.sql", sql: permissions, version: "1.0.0" },
    { file: "seeds/002_installation.sql", sql: installation, version: "1.0.0" },
  ];
}
