/**
 * The one and only inventory engine.
 *
 * All stock mutations go through transactional Postgres functions (`inv_*`),
 * which lock the level row, write the movement journal, audit log, outbox event
 * and idempotency result in a single transaction. Nothing here computes stock in
 * JavaScript and nothing writes to inventory_levels directly.
 */

import {
  availableQuantity,
  stockStatus,
  sumLevels,
  type AvailabilityResult,
  type InventoryRow,
  type LevelNumbers,
  type MovementRow,
  type MovementType,
  type ReserveResult,
} from "./inventory.types";

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

type AnyClient = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: { message: string } | null }>;
};

export type Ctx = { supabase: AnyClient; userId: string };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyClient;
}

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const client = await admin();
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

/* ------------------------------------------------------------------ */
/* Setup helpers                                                       */
/* ------------------------------------------------------------------ */

/** Every sellable object needs exactly one variant; phase 1 products may have none. */
export async function ensureDefaultVariant(organizationId: string, productId: string) {
  const client = await admin();
  const { data: existing } = await client
    .from("product_variants")
    .select("id")
    .eq("product_id", productId)
    .order("position", { ascending: true })
    .limit(1);
  if (existing?.length) return existing[0].id as string;

  const { data, error } = await client
    .from("product_variants")
    .insert({
      organization_id: organizationId,
      product_id: productId,
      title: "Standard",
      position: 0,
      option_signature: "",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** One inventory item per variant, created on demand. */
export async function ensureInventoryItem(
  organizationId: string,
  variantId: string,
  defaults?: { sku?: string | null; trackInventory?: boolean; allowBackorder?: boolean },
) {
  const client = await admin();
  const { data: variant, error: vErr } = await client
    .from("product_variants")
    .select("id, sku, organization_id")
    .eq("id", variantId)
    .maybeSingle();
  if (vErr) throw new Error(vErr.message);
  if (!variant || variant.organization_id !== organizationId) {
    throw new Error("Variante gehört nicht zu dieser Organisation.");
  }

  const { data: existing } = await client
    .from("inventory_items")
    .select("id")
    .eq("variant_id", variantId)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await client
    .from("inventory_items")
    .insert({
      organization_id: organizationId,
      variant_id: variantId,
      sku: defaults?.sku ?? variant.sku ?? null,
      track_inventory: defaults?.trackInventory ?? true,
      allow_backorder: defaults?.allowBackorder ?? false,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** A workspace always has at least one location so receiving works out of the box. */
export async function ensureDefaultLocation(organizationId: string, shopId: string) {
  const client = await admin();
  const { data: existing } = await client
    .from("inventory_locations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .order("priority", { ascending: true })
    .limit(1);
  if (existing?.length) return existing[0].id as string;

  const { data, error } = await client
    .from("inventory_locations")
    .insert({
      organization_id: organizationId,
      shop_id: shopId,
      name: "Hauptlager",
      code: "MAIN",
      type: "warehouse",
      priority: 1,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

type ThresholdLookup = (itemId: string) => number;

async function loadThresholds(
  ctx: Ctx,
  organizationId: string,
  shopId: string,
): Promise<ThresholdLookup> {
  const { data } = await ctx.supabase
    .from("stock_alert_rules")
    .select("inventory_item_id, threshold, enabled")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .eq("enabled", true);
  const rules = (data ?? []) as { inventory_item_id: string | null; threshold: number }[];
  const globalRule = rules.find((r) => r.inventory_item_id === null);
  const byItem = new Map(
    rules.filter((r) => r.inventory_item_id).map((r) => [r.inventory_item_id as string, r.threshold]),
  );
  return (itemId: string) =>
    byItem.get(itemId) ?? globalRule?.threshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
}

export type InventoryFilters = {
  locationId?: string | null;
  search?: string | null;
  productId?: string | null;
  categoryId?: string | null;
  status?: "low" | "out" | "backorder" | "untracked" | null;
};

/** Aggregated stock overview. One query per table, never per row. */
export async function getInventory(
  ctx: Ctx,
  args: { organizationId: string; shopId: string; filters?: InventoryFilters },
): Promise<{ rows: InventoryRow[]; locations: { id: string; name: string }[] }> {
  const { organizationId, shopId } = args;
  const filters = args.filters ?? {};

  const [{ data: locationRows }, { data: itemRows }, { data: levelRows }, thresholdFor] =
    await Promise.all([
      ctx.supabase
        .from("inventory_locations")
        .select("id, name, priority")
        .eq("organization_id", organizationId)
        .eq("shop_id", shopId)
        .order("priority", { ascending: true }),
      ctx.supabase
        .from("inventory_items")
        .select(
          "id, sku, barcode, track_inventory, allow_backorder, variant_id, product_variants!inner(id, title, product_id, products!inner(id, name, shop_id))",
        )
        .eq("organization_id", organizationId),
      ctx.supabase
        .from("inventory_levels")
        .select("inventory_item_id, location_id, on_hand, reserved, incoming, damaged")
        .eq("organization_id", organizationId)
        .eq("shop_id", shopId),
      loadThresholds(ctx, organizationId, shopId),
    ]);

  const locations = ((locationRows ?? []) as { id: string; name: string }[]).map((l) => ({
    id: l.id,
    name: l.name,
  }));
  const locationName = new Map(locations.map((l) => [l.id, l.name]));

  let categoryProductIds: Set<string> | null = null;
  if (filters.categoryId) {
    const { data } = await ctx.supabase
      .from("product_categories")
      .select("product_id")
      .eq("category_id", filters.categoryId);
    categoryProductIds = new Set(((data ?? []) as { product_id: string }[]).map((r) => r.product_id));
  }

  const levelsByItem = new Map<string, { location_id: string; level: LevelNumbers }[]>();
  for (const raw of (levelRows ?? []) as (LevelNumbers & {
    inventory_item_id: string;
    location_id: string;
  })[]) {
    if (filters.locationId && raw.location_id !== filters.locationId) continue;
    const list = levelsByItem.get(raw.inventory_item_id) ?? [];
    list.push({
      location_id: raw.location_id,
      level: {
        on_hand: raw.on_hand,
        reserved: raw.reserved,
        incoming: raw.incoming,
        damaged: raw.damaged,
      },
    });
    levelsByItem.set(raw.inventory_item_id, list);
  }

  type ItemRow = {
    id: string;
    sku: string | null;
    barcode: string | null;
    track_inventory: boolean;
    allow_backorder: boolean;
    variant_id: string;
    product_variants: {
      id: string;
      title: string;
      product_id: string;
      products: { id: string; name: string; shop_id: string };
    };
  };

  const search = filters.search?.trim().toLowerCase() ?? "";
  const rows: InventoryRow[] = [];

  for (const item of (itemRows ?? []) as unknown as ItemRow[]) {
    const variant = item.product_variants;
    const product = variant?.products;
    if (!product || product.shop_id !== shopId) continue;
    if (filters.productId && product.id !== filters.productId) continue;
    if (categoryProductIds && !categoryProductIds.has(product.id)) continue;
    if (
      search &&
      !`${product.name} ${variant.title} ${item.sku ?? ""} ${item.barcode ?? ""}`
        .toLowerCase()
        .includes(search)
    ) {
      continue;
    }

    const levels = levelsByItem.get(item.id) ?? [];
    const totals = sumLevels(levels.map((l) => l.level));
    const available = availableQuantity(totals);
    const status = stockStatus({
      trackInventory: item.track_inventory,
      allowBackorder: item.allow_backorder,
      available,
      threshold: thresholdFor(item.id),
    });

    if (filters.status === "low" && status !== "low_stock") continue;
    if (filters.status === "out" && status !== "out_of_stock") continue;
    if (filters.status === "backorder" && !item.allow_backorder) continue;
    if (filters.status === "untracked" && item.track_inventory) continue;

    rows.push({
      inventory_item_id: item.id,
      variant_id: item.variant_id,
      variant_title: variant.title,
      product_id: product.id,
      product_name: product.name,
      sku: item.sku,
      barcode: item.barcode,
      track_inventory: item.track_inventory,
      allow_backorder: item.allow_backorder,
      totals,
      available,
      status,
      locations: levels.map((l) => ({
        location_id: l.location_id,
        location_name: locationName.get(l.location_id) ?? "Unbekannt",
        level: l.level,
        available: availableQuantity(l.level),
      })),
    });
  }

  rows.sort(
    (a, b) => a.product_name.localeCompare(b.product_name) || a.variant_title.localeCompare(b.variant_title),
  );
  return { rows, locations };
}

/** Inventory for one product, per variant, for the product editor. */
export async function getInventoryForProduct(
  ctx: Ctx,
  args: { organizationId: string; shopId: string; productId: string },
) {
  const { rows, locations } = await getInventory(ctx, {
    organizationId: args.organizationId,
    shopId: args.shopId,
    filters: { productId: args.productId },
  });
  return { rows, locations };
}

export async function getInventoryForVariant(
  ctx: Ctx,
  args: { organizationId: string; shopId: string; variantId: string },
) {
  const { rows } = await getInventory(ctx, {
    organizationId: args.organizationId,
    shopId: args.shopId,
  });
  return rows.find((r) => r.variant_id === args.variantId) ?? null;
}

/** Availability of a variant, aggregated and per location. */
export async function getAvailability(
  ctx: Ctx,
  args: { organizationId: string; shopId: string; variantId: string },
): Promise<AvailabilityResult> {
  const { data: item, error } = await ctx.supabase
    .from("inventory_items")
    .select("id, track_inventory, allow_backorder")
    .eq("organization_id", args.organizationId)
    .eq("variant_id", args.variantId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const empty: AvailabilityResult = {
    tracked: item?.track_inventory ?? true,
    allow_backorder: item?.allow_backorder ?? false,
    total_on_hand: 0,
    total_reserved: 0,
    total_damaged: 0,
    total_incoming: 0,
    total_available: 0,
    locations: [],
  };
  if (!item) return empty;

  const { data: levels } = await ctx.supabase
    .from("inventory_levels")
    .select("location_id, on_hand, reserved, incoming, damaged, inventory_locations(name)")
    .eq("organization_id", args.organizationId)
    .eq("shop_id", args.shopId)
    .eq("inventory_item_id", item.id);

  type Row = LevelNumbers & { location_id: string; inventory_locations: { name: string } | null };
  const rows = (levels ?? []) as unknown as Row[];
  const totals = sumLevels(rows);

  return {
    tracked: item.track_inventory,
    allow_backorder: item.allow_backorder,
    total_on_hand: totals.on_hand,
    total_reserved: totals.reserved,
    total_damaged: totals.damaged,
    total_incoming: totals.incoming,
    total_available: availableQuantity(totals),
    locations: rows.map((r) => ({
      location_id: r.location_id,
      location_name: r.inventory_locations?.name ?? "Unbekannt",
      on_hand: r.on_hand,
      reserved: r.reserved,
      damaged: r.damaged,
      incoming: r.incoming,
      available: availableQuantity(r),
    })),
  };
}

export async function getMovementHistory(
  ctx: Ctx,
  args: {
    organizationId: string;
    shopId: string;
    inventoryItemId?: string | null;
    locationId?: string | null;
    movementType?: MovementType | null;
    from?: string | null;
    to?: string | null;
    reference?: string | null;
    search?: string | null;
    limit?: number;
  },
): Promise<MovementRow[]> {
  let query = ctx.supabase
    .from("inventory_movements")
    .select(
      "id, created_at, movement_type, quantity_delta, reason, note, reference_type, reference_id, actor_user_id, location_id, inventory_item_id, inventory_locations(name), inventory_items(sku, product_variants(title, products(name)))",
    )
    .eq("organization_id", args.organizationId)
    .eq("shop_id", args.shopId)
    .order("created_at", { ascending: false })
    .limit(Math.min(args.limit ?? 200, 500));

  if (args.inventoryItemId) query = query.eq("inventory_item_id", args.inventoryItemId);
  if (args.locationId) query = query.eq("location_id", args.locationId);
  if (args.movementType) query = query.eq("movement_type", args.movementType);
  if (args.from) query = query.gte("created_at", args.from);
  if (args.to) query = query.lte("created_at", args.to);
  if (args.reference) query = query.eq("reference_id", args.reference);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    created_at: string;
    movement_type: MovementType;
    quantity_delta: number;
    reason: string | null;
    note: string | null;
    reference_type: string | null;
    reference_id: string | null;
    actor_user_id: string | null;
    location_id: string | null;
    inventory_item_id: string;
    inventory_locations: { name: string } | null;
    inventory_items: {
      sku: string | null;
      product_variants: { title: string; products: { name: string } | null } | null;
    } | null;
  };

  const rows = (data ?? []) as unknown as Row[];
  const actorIds = [...new Set(rows.map((r) => r.actor_user_id).filter(Boolean))] as string[];
  const emails = new Map<string, string>();
  if (actorIds.length) {
    const { data: profiles } = await ctx.supabase
      .from("profiles")
      .select("id, email")
      .in("id", actorIds);
    for (const p of (profiles ?? []) as { id: string; email: string | null }[]) {
      if (p.email) emails.set(p.id, p.email);
    }
  }

  const search = args.search?.trim().toLowerCase() ?? "";
  return rows
    .map((r) => ({
      id: r.id,
      created_at: r.created_at,
      movement_type: r.movement_type,
      quantity_delta: r.quantity_delta,
      reason: r.reason,
      note: r.note,
      reference_type: r.reference_type,
      reference_id: r.reference_id,
      actor_user_id: r.actor_user_id,
      actor_email: r.actor_user_id ? (emails.get(r.actor_user_id) ?? null) : null,
      location_id: r.location_id,
      location_name: r.inventory_locations?.name ?? null,
      inventory_item_id: r.inventory_item_id,
      variant_title: r.inventory_items?.product_variants?.title ?? null,
      product_name: r.inventory_items?.product_variants?.products?.name ?? null,
      sku: r.inventory_items?.sku ?? null,
    }))
    .filter((r) =>
      search
        ? `${r.product_name ?? ""} ${r.variant_title ?? ""} ${r.sku ?? ""}`.toLowerCase().includes(search)
        : true,
    );
}

/* ------------------------------------------------------------------ */
/* Mutations — thin wrappers around the transactional DB functions      */
/* ------------------------------------------------------------------ */

export type StockLevelResult = LevelNumbers & { available: number };

export async function receiveStock(
  ctx: Ctx,
  args: {
    organizationId: string;
    shopId: string;
    inventoryItemId: string;
    locationId: string;
    quantity: number;
    reference?: string | null;
    note?: string | null;
    incomingDelta?: number;
    idempotencyKey: string;
  },
) {
  return callRpc<StockLevelResult>("inv_receive_stock", {
    _org: args.organizationId,
    _shop: args.shopId,
    _actor: ctx.userId,
    _item: args.inventoryItemId,
    _loc: args.locationId,
    _qty: args.quantity,
    _reference: args.reference ?? null,
    _note: args.note ?? null,
    _incoming_delta: args.incomingDelta ?? 0,
    _idem: args.idempotencyKey,
  });
}

export async function adjustStock(
  ctx: Ctx,
  args: {
    organizationId: string;
    shopId: string;
    inventoryItemId: string;
    locationId: string;
    countedQuantity: number;
    reason: string;
    note?: string | null;
    idempotencyKey: string;
  },
) {
  return callRpc<StockLevelResult & { delta: number }>("inv_adjust_stock", {
    _org: args.organizationId,
    _shop: args.shopId,
    _actor: ctx.userId,
    _item: args.inventoryItemId,
    _loc: args.locationId,
    _counted: args.countedQuantity,
    _reason: args.reason,
    _note: args.note ?? null,
    _idem: args.idempotencyKey,
  });
}

export async function markDamaged(
  ctx: Ctx,
  args: {
    organizationId: string;
    shopId: string;
    inventoryItemId: string;
    locationId: string;
    quantity: number;
    reason?: string | null;
    note?: string | null;
    idempotencyKey: string;
  },
) {
  return callRpc<StockLevelResult>("inv_mark_damaged", {
    _org: args.organizationId,
    _shop: args.shopId,
    _actor: ctx.userId,
    _item: args.inventoryItemId,
    _loc: args.locationId,
    _qty: args.quantity,
    _reason: args.reason ?? null,
    _note: args.note ?? null,
    _idem: args.idempotencyKey,
  });
}

export async function reserveStock(
  ctx: Ctx,
  args: {
    organizationId: string;
    shopId: string;
    inventoryItemId: string;
    locationId: string;
    quantity: number;
    referenceType?: string | null;
    referenceId?: string | null;
    expiresAt?: string | null;
    idempotencyKey: string;
  },
) {
  return callRpc<ReserveResult>("inv_reserve_stock", {
    _org: args.organizationId,
    _shop: args.shopId,
    _actor: ctx.userId,
    _item: args.inventoryItemId,
    _loc: args.locationId,
    _qty: args.quantity,
    _reference_type: args.referenceType ?? "manual",
    _reference_id: args.referenceId ?? null,
    _expires_at: args.expiresAt ?? null,
    _idem: args.idempotencyKey,
  });
}

export async function releaseReservation(
  ctx: Ctx,
  args: { organizationId: string; reservationId: string; idempotencyKey?: string | null },
) {
  return callRpc<{ reservation_id: string; status: string; changed: boolean }>(
    "inv_release_reservation",
    {
      _org: args.organizationId,
      _actor: ctx.userId,
      _reservation: args.reservationId,
      _idem: args.idempotencyKey ?? null,
    },
  );
}

export async function commitReservation(
  ctx: Ctx,
  args: { organizationId: string; reservationId: string; idempotencyKey?: string | null },
) {
  return callRpc<{ reservation_id: string; status: string; changed: boolean }>(
    "inv_commit_reservation",
    {
      _org: args.organizationId,
      _actor: ctx.userId,
      _reservation: args.reservationId,
      _idem: args.idempotencyKey ?? null,
    },
  );
}

export async function expireReservations(ctx: Ctx, args: { organizationId: string }) {
  return callRpc<{ expired: number }>("inv_expire_reservations", {
    _org: args.organizationId,
    _actor: ctx.userId,
  });
}

/** Creates a draft transfer with its items and starts it atomically. */
export async function transferStock(
  ctx: Ctx,
  args: {
    organizationId: string;
    shopId: string;
    fromLocationId: string;
    toLocationId: string;
    items: { inventoryItemId: string; quantity: number }[];
    reference?: string | null;
    note?: string | null;
    idempotencyKey: string;
  },
) {
  if (args.fromLocationId === args.toLocationId) {
    throw new Error("Quell- und Ziellager müssen unterschiedlich sein.");
  }
  if (!args.items.length) throw new Error("Bitte mindestens eine Position angeben.");

  const client = await admin();
  const { data: locs, error: locErr } = await client
    .from("inventory_locations")
    .select("id")
    .eq("organization_id", args.organizationId)
    .eq("shop_id", args.shopId)
    .in("id", [args.fromLocationId, args.toLocationId]);
  if (locErr) throw new Error(locErr.message);
  if ((locs ?? []).length !== 2) {
    throw new Error("Lagerorte gehören nicht zu dieser Organisation oder diesem Shop.");
  }

  const { data: transfer, error } = await client
    .from("inventory_transfers")
    .insert({
      organization_id: args.organizationId,
      shop_id: args.shopId,
      from_location_id: args.fromLocationId,
      to_location_id: args.toLocationId,
      reference: args.reference ?? null,
      note: args.note ?? null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: itemErr } = await client.from("inventory_transfer_items").insert(
    args.items.map((i) => ({
      transfer_id: transfer.id,
      inventory_item_id: i.inventoryItemId,
      quantity: i.quantity,
    })),
  );
  if (itemErr) {
    await client.from("inventory_transfers").delete().eq("id", transfer.id);
    throw new Error(itemErr.message);
  }

  try {
    await callRpc("inv_transfer_start", {
      _org: args.organizationId,
      _actor: ctx.userId,
      _transfer: transfer.id,
      _idem: args.idempotencyKey,
    });
  } catch (err) {
    // the transfer never left draft, so removing it keeps no phantom stock
    await client.from("inventory_transfer_items").delete().eq("transfer_id", transfer.id);
    await client.from("inventory_transfers").delete().eq("id", transfer.id);
    throw err;
  }
  return { transferId: transfer.id as string };
}

export async function completeTransfer(
  ctx: Ctx,
  args: { organizationId: string; transferId: string; idempotencyKey: string },
) {
  return callRpc<{ transfer_id: string; status: string; changed: boolean }>("inv_transfer_complete", {
    _org: args.organizationId,
    _actor: ctx.userId,
    _transfer: args.transferId,
    _idem: args.idempotencyKey,
  });
}

export async function cancelTransfer(
  ctx: Ctx,
  args: { organizationId: string; transferId: string; idempotencyKey: string },
) {
  return callRpc<{ transfer_id: string; status: string; changed: boolean }>("inv_transfer_cancel", {
    _org: args.organizationId,
    _actor: ctx.userId,
    _transfer: args.transferId,
    _idem: args.idempotencyKey,
  });
}

export async function inventoryHealth(ctx: Ctx, args: { organizationId: string }) {
  return callRpc<{ healthy: boolean; problems: unknown[] }>("inv_health_check", {
    _org: args.organizationId,
    _actor: ctx.userId,
  });
}
