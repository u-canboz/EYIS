import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Blueprint } from "./blueprint-types";

/** All blueprints the organization may use: system templates plus its own. */
export const listBlueprints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("product_blueprints")
      .select(
        "id, organization_id, key, name, description, icon, version, is_system, schema, variant_schema",
      )
      .or(`is_system.eq.true,organization_id.eq.${data.organizationId}`)
      .eq("status", "active")
      .order("version", { ascending: false });
    if (error) throw new Error(error.message);

    // Keep only the newest version per key.
    const byKey = new Map<string, Blueprint>();
    for (const row of (rows ?? []) as unknown as Blueprint[]) {
      if (!byKey.has(row.key)) byKey.set(row.key, row);
    }
    return Array.from(byKey.values());
  });

/** A specific blueprint version, used to render an existing product unchanged. */
export const getBlueprintVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { key: string; version: number; organizationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("product_blueprints")
      .select(
        "id, organization_id, key, name, description, icon, version, is_system, schema, variant_schema",
      )
      .eq("key", data.key)
      .eq("version", data.version)
      .or(`is_system.eq.true,organization_id.eq.${data.organizationId}`)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row ?? null) as unknown as Blueprint | null;
  });
