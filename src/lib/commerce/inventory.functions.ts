/** Thin server-function wrappers around the inventory engine. No logic here. */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AvailabilityResult, InventoryRow, MovementRow, MovementType } from "./inventory.types";

type Base = { organizationId: string; shopId: string };

export const listInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Base & {
        locationId?: string | null;
        search?: string | null;
        productId?: string | null;
        categoryId?: string | null;
        status?: "low" | "out" | "backorder" | "untracked" | null;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("./core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "inventory.read");
    const inv = await import("./inventory.server");
    const result = await inv.getInventory(
      { supabase: context.supabase as never, userId: context.userId },
      {
        organizationId: data.organizationId,
        shopId: data.shopId,
        filters: {
          locationId: data.locationId ?? null,
          search: data.search ?? null,
          productId: data.productId ?? null,
          categoryId: data.categoryId ?? null,
          status: data.status ?? null,
        },
      },
    );
    return result as { rows: InventoryRow[]; locations: { id: string; name: string }[] };
  });

export const listLocations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Base) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("./core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "inventory.read");
    const inv = await import("./inventory.server");
    await inv.ensureDefaultLocation(data.organizationId, data.shopId);
    const { data: rows, error } = await context.supabase
      .from("inventory_locations")
      .select("id, name, code, type, status, priority, address")
      .eq("organization_id", data.organizationId)
      .eq("shop_id", data.shopId)
      .order("priority", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Base & {
        id?: string | null;
        name: string;
        code: string;
        type: "warehouse" | "store" | "fulfillment_center" | "virtual";
        status?: "active" | "inactive" | "archived";
        priority?: number;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission, writeAudit } = await import("./core.server");
    const { requiredText } = await import("./inventory.validation");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "inventory.manage_locations",
    );
    const name = requiredText(data.name, "Name");
    const code = requiredText(data.code, "Code").toUpperCase();

    if (data.id) {
      const { error } = await context.supabase
        .from("inventory_locations")
        .update({
          name,
          code,
          type: data.type,
          status: data.status ?? "active",
          priority: data.priority ?? 100,
        } as never)
        .eq("id", data.id)
        .eq("organization_id", data.organizationId);
      if (error) throw new Error(error.message);
      await writeAudit({
        organizationId: data.organizationId,
        actorId: context.userId,
        action: "inventory.location.updated",
        entityType: "inventory_location",
        entityId: data.id,
        metadata: { name, code },
      });
      return { id: data.id };
    }

    const { data: created, error } = await context.supabase
      .from("inventory_locations")
      .insert({
        organization_id: data.organizationId,
        shop_id: data.shopId,
        name,
        code,
        type: data.type,
        priority: data.priority ?? 100,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await writeAudit({
      organizationId: data.organizationId,
      actorId: context.userId,
      action: "inventory.location.created",
      entityType: "inventory_location",
      entityId: created.id,
      metadata: { name, code },
    });
    return { id: created.id as string };
  });

/** Creates inventory items (and a default variant when a product has none). */
export const setupInventoryForProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Base & { productId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("./core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "inventory.read");
    const inv = await import("./inventory.server");

    await inv.ensureDefaultLocation(data.organizationId, data.shopId);
    const { data: variants } = await context.supabase
      .from("product_variants")
      .select("id, sku")
      .eq("product_id", data.productId)
      .eq("organization_id", data.organizationId);

    let list = (variants ?? []) as { id: string; sku: string | null }[];
    if (!list.length) {
      const variantId = await inv.ensureDefaultVariant(data.organizationId, data.productId);
      list = [{ id: variantId, sku: null }];
    }
    for (const v of list) {
      await inv.ensureInventoryItem(data.organizationId, v.id, { sku: v.sku });
    }
    return { variants: list.length };
  });

export const getVariantAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Base & { variantId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("./core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "inventory.read");
    const inv = await import("./inventory.server");
    return (await inv.getAvailability(
      { supabase: context.supabase as never, userId: context.userId },
      data,
    )) as AvailabilityResult;
  });

export const listMovements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Base & {
        inventoryItemId?: string | null;
        locationId?: string | null;
        movementType?: MovementType | null;
        from?: string | null;
        to?: string | null;
        reference?: string | null;
        search?: string | null;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("./core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "inventory.read");
    const inv = await import("./inventory.server");
    return (await inv.getMovementHistory(
      { supabase: context.supabase as never, userId: context.userId },
      data,
    )) as MovementRow[];
  });

export const receiveStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Base & {
        locationId: string;
        lines: { inventoryItemId: string; quantity: number }[];
        reference?: string | null;
        note?: string | null;
        idempotencyKey: string;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const inv = await import("./inventory.server");
    const { positiveInt } = await import("./inventory.validation");
    const ctx = { supabase: context.supabase as never, userId: context.userId };
    const results = [];
    for (const [index, line] of data.lines.entries()) {
      const quantity = positiveInt(line.quantity, "Menge");
      results.push(
        await inv.receiveStock(ctx, {
          organizationId: data.organizationId,
          shopId: data.shopId,
          inventoryItemId: line.inventoryItemId,
          locationId: data.locationId,
          quantity,
          reference: data.reference ?? null,
          note: data.note ?? null,
          idempotencyKey: `${data.idempotencyKey}:${index}:${line.inventoryItemId}`,
        }),
      );
    }
    return { lines: results.length };
  });

export const registerIncoming = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Base & {
        locationId: string;
        inventoryItemId: string;
        quantity: number;
        note?: string | null;
        idempotencyKey: string;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const inv = await import("./inventory.server");
    const { nonZeroInt } = await import("./inventory.validation");
    return inv.receiveStock(
      { supabase: context.supabase as never, userId: context.userId },
      {
        organizationId: data.organizationId,
        shopId: data.shopId,
        inventoryItemId: data.inventoryItemId,
        locationId: data.locationId,
        quantity: 0,
        incomingDelta: nonZeroInt(data.quantity, "Erwartete Menge"),
        note: data.note ?? null,
        idempotencyKey: data.idempotencyKey,
      },
    );
  });

export const adjustStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Base & {
        inventoryItemId: string;
        locationId: string;
        countedQuantity: number;
        reason: string;
        note?: string | null;
        idempotencyKey: string;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const inv = await import("./inventory.server");
    const { nonNegativeInt, requiredText } = await import("./inventory.validation");
    return inv.adjustStock(
      { supabase: context.supabase as never, userId: context.userId },
      {
        ...data,
        countedQuantity: nonNegativeInt(data.countedQuantity, "Gezählter Bestand"),
        reason: requiredText(data.reason, "Grund"),
      },
    );
  });

export const markDamaged = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Base & {
        inventoryItemId: string;
        locationId: string;
        quantity: number;
        reason?: string | null;
        note?: string | null;
        idempotencyKey: string;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const inv = await import("./inventory.server");
    const { nonZeroInt } = await import("./inventory.validation");
    return inv.markDamaged(
      { supabase: context.supabase as never, userId: context.userId },
      { ...data, quantity: nonZeroInt(data.quantity, "Menge") },
    );
  });

export const reserveStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Base & {
        inventoryItemId: string;
        locationId: string;
        quantity: number;
        referenceType?: string | null;
        referenceId?: string | null;
        expiresAt?: string | null;
        idempotencyKey: string;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const inv = await import("./inventory.server");
    const { positiveInt } = await import("./inventory.validation");
    return inv.reserveStock(
      { supabase: context.supabase as never, userId: context.userId },
      { ...data, quantity: positiveInt(data.quantity, "Menge") },
    );
  });

export const releaseReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { organizationId: string; reservationId: string; idempotencyKey?: string | null }) => data,
  )
  .handler(async ({ data, context }) => {
    const inv = await import("./inventory.server");
    return inv.releaseReservation(
      { supabase: context.supabase as never, userId: context.userId },
      data,
    );
  });

export const commitReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { organizationId: string; reservationId: string; idempotencyKey?: string | null }) => data,
  )
  .handler(async ({ data, context }) => {
    const inv = await import("./inventory.server");
    return inv.commitReservation(
      { supabase: context.supabase as never, userId: context.userId },
      data,
    );
  });

export const expireReservations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data, context }) => {
    const inv = await import("./inventory.server");
    return inv.expireReservations(
      { supabase: context.supabase as never, userId: context.userId },
      data,
    );
  });

export const listReservations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Base & { status?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("./core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "inventory.read");
    let query = context.supabase
      .from("inventory_reservations")
      .select(
        "id, quantity, backordered_quantity, status, reference_type, reference_id, expires_at, created_at, location_id, inventory_item_id, inventory_items(sku, product_variants(title, products(name)))",
      )
      .eq("organization_id", data.organizationId)
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.status) query = query.eq("status", data.status as never);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as {
      id: string;
      quantity: number;
      backordered_quantity: number;
      status: string;
      reference_type: string | null;
      reference_id: string | null;
      expires_at: string | null;
      created_at: string;
      location_id: string | null;
      inventory_item_id: string;
      inventory_items: {
        sku: string | null;
        product_variants: { title: string; products: { name: string } | null } | null;
      } | null;
    }[];
  });

export const listTransfers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Base) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("./core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "inventory.read");
    const { data: rows, error } = await context.supabase
      .from("inventory_transfers")
      .select(
        "id, status, reference, note, created_at, completed_at, from_location_id, to_location_id, inventory_transfer_items(quantity, inventory_item_id, inventory_items(sku, product_variants(title, products(name))))",
      )
      .eq("organization_id", data.organizationId)
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as {
      id: string;
      status: "draft" | "in_transit" | "completed" | "cancelled";
      reference: string | null;
      note: string | null;
      created_at: string;
      completed_at: string | null;
      from_location_id: string;
      to_location_id: string;
      inventory_transfer_items: {
        quantity: number;
        inventory_item_id: string;
        inventory_items: {
          sku: string | null;
          product_variants: { title: string; products: { name: string } | null } | null;
        } | null;
      }[];
    }[];
  });

export const startTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Base & {
        fromLocationId: string;
        toLocationId: string;
        items: { inventoryItemId: string; quantity: number }[];
        reference?: string | null;
        note?: string | null;
        idempotencyKey: string;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const inv = await import("./inventory.server");
    const { positiveInt } = await import("./inventory.validation");
    return inv.transferStock(
      { supabase: context.supabase as never, userId: context.userId },
      {
        ...data,
        items: data.items.map((i) => ({
          inventoryItemId: i.inventoryItemId,
          quantity: positiveInt(i.quantity, "Menge"),
        })),
      },
    );
  });

export const completeTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; transferId: string; idempotencyKey: string }) => data)
  .handler(async ({ data, context }) => {
    const inv = await import("./inventory.server");
    return inv.completeTransfer({ supabase: context.supabase as never, userId: context.userId }, data);
  });

export const cancelTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; transferId: string; idempotencyKey: string }) => data)
  .handler(async ({ data, context }) => {
    const inv = await import("./inventory.server");
    return inv.cancelTransfer({ supabase: context.supabase as never, userId: context.userId }, data);
  });

export const updateItemSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: {
        organizationId: string;
        inventoryItemId: string;
        trackInventory?: boolean;
        allowBackorder?: boolean;
        sku?: string | null;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission, writeAudit } = await import("./core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "inventory.manage_settings",
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.trackInventory !== undefined) patch['track_inventory'] = data.trackInventory;
    if (data.allowBackorder !== undefined) patch['allow_backorder'] = data.allowBackorder;
    if (data.sku !== undefined) patch['sku'] = data.sku?.trim() || null;
    if (!Object.keys(patch).length) return { ok: true };

    const { error } = await supabaseAdmin
      .from("inventory_items")
      .update(patch as never)
      .eq("id", data.inventoryItemId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);

    await writeAudit({
      organizationId: data.organizationId,
      actorId: context.userId,
      action: "inventory.settings.updated",
      entityType: "inventory_item",
      entityId: data.inventoryItemId,
      metadata: patch,
    });
    return { ok: true };
  });

export const inventoryHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data, context }) => {
    const inv = await import("./inventory.server");
    return inv.inventoryHealth({ supabase: context.supabase as never, userId: context.userId }, data);
  });

export const lowStockSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Base) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("./core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "inventory.read");
    const inv = await import("./inventory.server");
    const { rows } = await inv.getInventory(
      { supabase: context.supabase as never, userId: context.userId },
      { organizationId: data.organizationId, shopId: data.shopId },
    );
    return {
      low: rows.filter((r) => r.status === "low_stock").length,
      out: rows.filter((r) => r.status === "out_of_stock").length,
      tracked: rows.filter((r) => r.track_inventory).length,
    };
  });
