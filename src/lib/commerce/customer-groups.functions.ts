import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listCustomerGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; shopId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("customer_groups")
      .select("id, name, handle, description, status")
      .eq("organization_id", data.organizationId)
      .eq("shop_id", data.shopId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { groups: rows ?? [] };
  });

export const saveCustomerGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      organizationId: string;
      shopId: string;
      id?: string;
      name: string;
      description?: string | null;
      status?: "active" | "inactive" | "archived";
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit, slugify } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "customer_groups.manage");
    if (!data.name.trim()) throw new Error("Bitte gib einen Namen an.");

    if (data.id) {
      const { error } = await supabase
        .from("customer_groups")
        .update({
          name: data.name.trim(),
          description: data.description ?? null,
          status: data.status ?? "active",
        } as never)
        .eq("id", data.id)
        .eq("organization_id", data.organizationId);
      if (error) throw new Error(error.message);
      await writeAudit({
        organizationId: data.organizationId,
        actorId: userId,
        action: "customer_group.updated",
        entityType: "customer_group",
        entityId: data.id,
      });
      return { id: data.id };
    }

    const { data: created, error } = await supabase
      .from("customer_groups")
      .insert({
        organization_id: data.organizationId,
        shop_id: data.shopId,
        name: data.name.trim(),
        handle: `${slugify(data.name)}-${Math.random().toString(36).slice(2, 6)}`,
        description: data.description ?? null,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "customer_group.created",
      entityType: "customer_group",
      entityId: created.id,
      metadata: { name: data.name },
    });
    return { id: created.id };
  });

export const deleteCustomerGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; groupId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "customer_groups.manage");
    const { error } = await supabase
      .from("customer_groups")
      .delete()
      .eq("id", data.groupId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "customer_group.updated",
      entityType: "customer_group",
      entityId: data.groupId,
      metadata: { deleted: true },
    });
    return { ok: true };
  });
