import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CategoryNode = {
  id: string;
  name: string;
  handle: string;
  parent_id: string | null;
  position: number;
  product_count: number;
  children: CategoryNode[];
};

/** Category tree plus flat collection list for one shop. */
export const listTaxonomy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; shopId: string }) => data)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const [{ data: categories, error }, { data: collections, error: colErr }] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, handle, parent_id, position, product_categories(count)")
        .eq("organization_id", data.organizationId)
        .eq("shop_id", data.shopId)
        .order("position", { ascending: true }),
      supabase
        .from("collections")
        .select("id, name, handle, description, product_collections(count)")
        .eq("organization_id", data.organizationId)
        .eq("shop_id", data.shopId)
        .order("name", { ascending: true }),
    ]);
    if (error) throw new Error(error.message);
    if (colErr) throw new Error(colErr.message);

    type CatRow = {
      id: string;
      name: string;
      handle: string;
      parent_id: string | null;
      position: number;
      product_categories: { count: number }[];
    };
    const rows = (categories ?? []) as unknown as CatRow[];
    const nodes = new Map<string, CategoryNode>();
    for (const row of rows) {
      nodes.set(row.id, {
        id: row.id,
        name: row.name,
        handle: row.handle,
        parent_id: row.parent_id,
        position: row.position,
        product_count: row.product_categories?.[0]?.count ?? 0,
        children: [],
      });
    }
    const tree: CategoryNode[] = [];
    for (const node of nodes.values()) {
      const parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
      if (parent) parent.children.push(node);
      else tree.push(node);
    }

    type ColRow = {
      id: string;
      name: string;
      handle: string;
      description: string | null;
      product_collections: { count: number }[];
    };
    return {
      categories: tree,
      flatCategories: Array.from(nodes.values()),
      collections: ((collections ?? []) as unknown as ColRow[]).map((c) => ({
        id: c.id,
        name: c.name,
        handle: c.handle,
        description: c.description,
        product_count: c.product_collections?.[0]?.count ?? 0,
      })),
    };
  });

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      organizationId: string;
      shopId: string;
      id?: string;
      name: string;
      parentId?: string | null;
      description?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit } = await import("./core.server");
    const { uniqueHandle } = await import("./catalog.server");
    await assertPermission(supabase, userId, data.organizationId, "categories.manage");
    if (!data.name.trim()) throw new Error("Bitte gib einen Namen an.");
    if (data.id && data.parentId === data.id) throw new Error("Eine Kategorie kann nicht ihr eigenes Elternteil sein.");

    if (data.id) {
      const { error } = await supabase
        .from("categories")
        .update({
          name: data.name.trim(),
          parent_id: data.parentId ?? null,
          description: data.description ?? null,
        })
        .eq("id", data.id)
        .eq("organization_id", data.organizationId);
      if (error) throw new Error(error.message);
      await writeAudit({
        organizationId: data.organizationId,
        actorId: userId,
        action: "category.updated",
        entityType: "category",
        entityId: data.id,
      });
      return { id: data.id };
    }

    const handle = await uniqueHandle(supabase as never, "categories", data.shopId, data.name);
    const { data: created, error } = await supabase
      .from("categories")
      .insert({
        organization_id: data.organizationId,
        shop_id: data.shopId,
        name: data.name.trim(),
        handle,
        parent_id: data.parentId ?? null,
        description: data.description ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "category.created",
      entityType: "category",
      entityId: created.id,
      metadata: { name: data.name },
    });
    return { id: created.id };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; categoryId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "categories.manage");

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", data.categoryId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "category.deleted",
      entityType: "category",
      entityId: data.categoryId,
    });
    return { ok: true };
  });

export const saveCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      organizationId: string;
      shopId: string;
      id?: string;
      name: string;
      description?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit } = await import("./core.server");
    const { uniqueHandle } = await import("./catalog.server");
    await assertPermission(supabase, userId, data.organizationId, "categories.manage");
    if (!data.name.trim()) throw new Error("Bitte gib einen Namen an.");

    if (data.id) {
      const { error } = await supabase
        .from("collections")
        .update({ name: data.name.trim(), description: data.description ?? null })
        .eq("id", data.id)
        .eq("organization_id", data.organizationId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const handle = await uniqueHandle(supabase as never, "collections", data.shopId, data.name);
    const { data: created, error } = await supabase
      .from("collections")
      .insert({
        organization_id: data.organizationId,
        shop_id: data.shopId,
        name: data.name.trim(),
        handle,
        description: data.description ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "collection.created",
      entityType: "collection",
      entityId: created.id,
      metadata: { name: data.name },
    });
    return { id: created.id };
  });

export const deleteCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; collectionId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "categories.manage");
    const { error } = await supabase
      .from("collections")
      .delete()
      .eq("id", data.collectionId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
