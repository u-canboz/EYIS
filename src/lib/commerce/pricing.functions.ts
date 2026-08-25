import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PricingResult } from "./pricing-types";

export type PriceInput = {
  id?: string;
  productId?: string | null;
  variantId?: string | null;
  type: "base" | "sale" | "tier" | "customer_group" | "override";
  currencyCode: string;
  amountMinor: number;
  startsAt?: string | null;
  endsAt?: string | null;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  customerGroupId?: string | null;
  priority?: number;
  status?: "active" | "inactive" | "archived";
};

/** All prices of a product and its variants, for the editor and the price list. */
export const listProductPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; shopId: string; productId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "pricing.read");

    const { data: variants, error: varErr } = await supabase
      .from("product_variants")
      .select("id, title, sku, position")
      .eq("product_id", data.productId)
      .eq("organization_id", data.organizationId)
      .order("position", { ascending: true });
    if (varErr) throw new Error(varErr.message);

    const variantIds = (variants ?? []).map((v) => v.id);
    const { data: sets, error: setErr } = await supabase
      .from("price_sets")
      .select("id, product_id, variant_id")
      .eq("organization_id", data.organizationId)
      .eq("shop_id", data.shopId);
    if (setErr) throw new Error(setErr.message);

    const relevant = (sets ?? []).filter(
      (s) => s.product_id === data.productId || (s.variant_id && variantIds.includes(s.variant_id)),
    );
    let prices: any[] = [];
    if (relevant.length) {
      const { data: rows, error } = await supabase
        .from("prices")
        .select("*")
        .in(
          "price_set_id",
          relevant.map((s) => s.id),
        )
        .order("type", { ascending: true });
      if (error) throw new Error(error.message);
      prices = rows ?? [];
    }

    const setById = new Map(relevant.map((s) => [s.id, s]));
    return {
      variants: (variants ?? []).map((v) => ({ id: v.id, title: v.title, sku: v.sku })),
      prices: prices.map((p) => {
        const set = setById.get(p.price_set_id);
        return {
          id: p.id as string,
          price_set_id: p.price_set_id as string,
          product_id: (set?.product_id ?? null) as string | null,
          variant_id: (set?.variant_id ?? null) as string | null,
          type: p.type as string,
          currency_code: p.currency_code as string,
          amount_minor: Number(p.amount_minor),
          starts_at: p.starts_at as string | null,
          ends_at: p.ends_at as string | null,
          min_quantity: p.min_quantity as number | null,
          max_quantity: p.max_quantity as number | null,
          customer_group_id: p.customer_group_id as string | null,
          priority: p.priority as number,
          status: p.status as string,
        };
      }),
    };
  });

export const savePrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; shopId: string; price: PriceInput }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit, emitEvent } = await import("./core.server");
    const { ensurePriceSet, validatePriceInput } = await import("./pricing.server");
    await assertPermission(supabase, userId, data.organizationId, "pricing.manage");

    const p = data.price;
    validatePriceInput({
      amountMinor: p.amountMinor,
      currencyCode: p.currencyCode,
      type: p.type,
      minQuantity: p.minQuantity ?? null,
      maxQuantity: p.maxQuantity ?? null,
      startsAt: p.startsAt ?? null,
      endsAt: p.endsAt ?? null,
      customerGroupId: p.customerGroupId ?? null,
    });

    const payload = {
      currency_code: p.currencyCode,
      amount_minor: p.amountMinor,
      type: p.type,
      starts_at: p.startsAt ?? null,
      ends_at: p.endsAt ?? null,
      min_quantity: p.minQuantity ?? null,
      max_quantity: p.maxQuantity ?? null,
      customer_group_id: p.customerGroupId ?? null,
      priority: p.priority ?? 0,
      status: p.status ?? "active",
    };

    if (p.id) {
      const { error } = await supabase
        .from("prices")
        .update(payload as never)
        .eq("id", p.id)
        .eq("organization_id", data.organizationId);
      if (error) throw new Error(error.message);
      await writeAudit({
        organizationId: data.organizationId,
        actorId: userId,
        action: "price.updated",
        entityType: "price",
        entityId: p.id,
        metadata: { amount_minor: p.amountMinor, type: p.type },
      });
      await emitEvent(data.organizationId, "pricing.price.updated", { priceId: p.id });
      await emitEvent(data.organizationId, "pricing.changed", { priceId: p.id });
      return { id: p.id };
    }

    const priceSetId = await ensurePriceSet(supabase as never, {
      organizationId: data.organizationId,
      shopId: data.shopId,
      productId: p.productId ?? null,
      variantId: p.variantId ?? null,
    });
    const { data: created, error } = await supabase
      .from("prices")
      .insert({
        organization_id: data.organizationId,
        shop_id: data.shopId,
        price_set_id: priceSetId,
        ...payload,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "price.created",
      entityType: "price",
      entityId: created.id,
      metadata: { amount_minor: p.amountMinor, type: p.type },
    });
    await emitEvent(data.organizationId, "pricing.price.created", { priceId: created.id });
    await emitEvent(data.organizationId, "pricing.changed", { priceId: created.id });
    return { id: created.id };
  });

export const deletePrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; priceId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit, emitEvent } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "pricing.manage");
    const { error } = await supabase
      .from("prices")
      .delete()
      .eq("id", data.priceId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "price.deleted",
      entityType: "price",
      entityId: data.priceId,
    });
    await emitEvent(data.organizationId, "pricing.changed", { priceId: data.priceId });
    return { ok: true };
  });

/**
 * Atomic bulk change over explicitly selected, stored price rows.
 * Relative modes always compute from the stored amount, never from a resolved price.
 */
export const bulkUpdatePrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      organizationId: string;
      priceIds: string[];
      mode: "set" | "increase_percent" | "decrease_percent" | "increase_amount" | "decrease_amount";
      amountMinor?: number;
      percentBp?: number;
      idempotencyKey: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit, emitEvent, getAdmin } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "pricing.manage");
    if (!data.priceIds.length) throw new Error("Bitte wähle mindestens eine Preiszeile aus.");
    if (data.mode === "set" && (data.amountMinor ?? -1) < 0) throw new Error("Ungültiger Betrag.");
    if (data.mode.endsWith("percent") && (data.percentBp ?? 0) <= 0)
      throw new Error("Ungültiger Prozentwert.");

    const admin = await getAdmin();

    // Idempotency: a browser retry must not run the bulk change twice.
    const { data: existing } = await admin
      .from("idempotency_keys")
      .select("id, response")
      .eq("organization_id", data.organizationId)
      .eq("endpoint", "pricing.bulk")
      .eq("key", data.idempotencyKey)
      .maybeSingle();
    if (existing)
      return (existing.response ?? { ok: true, replayed: true }) as { updated?: number };

    const { data: result, error } = await admin.rpc(
      "bulk_update_prices" as never,
      {
        _org_id: data.organizationId,
        _price_ids: data.priceIds,
        _mode: data.mode,
        _amount_minor: data.amountMinor ?? 0,
        _percent_bp: data.percentBp ?? 0,
      } as never,
    );
    if (error) throw new Error(error.message);

    const rows = (result ?? []) as { id: string; old_amount: number; new_amount: number }[];
    const response = { updated: rows.length, rows };
    await admin.from("idempotency_keys").insert({
      organization_id: data.organizationId,
      endpoint: "pricing.bulk",
      key: data.idempotencyKey,
      status: "completed",
      response: response as never,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    } as never);

    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "price.updated",
      entityType: "price_bulk",
      metadata: { mode: data.mode, count: rows.length },
    });
    await emitEvent(data.organizationId, "pricing.changed", { bulk: true, count: rows.length });
    return response;
  });

/** THE pricing entry point for the admin. Same engine as cart/checkout later. */
export const resolvePrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      organizationId: string;
      shopId: string;
      productId: string;
      variantId?: string | null;
      quantity: number;
      currencyCode: string;
      customerGroupId?: string | null;
      promotionCodes?: string[];
      now?: string;
    }) => data,
  )
  .handler(async ({ data, context }): Promise<PricingResult> => {
    const { supabase, userId } = context;
    const { assertPermission } = await import("./core.server");
    const { resolveFromDatabase } = await import("./pricing.server");
    await assertPermission(supabase, userId, data.organizationId, "pricing.read");

    return resolveFromDatabase(supabase as never, data.organizationId, {
      shopId: data.shopId,
      productId: data.productId,
      variantId: data.variantId ?? null,
      quantity: data.quantity,
      currencyCode: data.currencyCode,
      customerGroupId: data.customerGroupId ?? null,
      promotionCodes: data.promotionCodes ?? [],
      now: data.now ?? new Date().toISOString(),
    });
  });

/** Price list overview: products with their stored price rows. */
export const listPriceOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      organizationId: string;
      shopId: string;
      type?: string;
      search?: string;
      status?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "pricing.read");

    let query = supabase
      .from("prices")
      .select(
        "id, type, currency_code, amount_minor, starts_at, ends_at, min_quantity, max_quantity, customer_group_id, status, price_sets(product_id, variant_id)",
      )
      .eq("organization_id", data.organizationId)
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.type) query = query.eq("type", data.type as never);
    if (data.status) query = query.eq("status", data.status as never);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const productIds = new Set<string>();
    const variantIds = new Set<string>();
    for (const row of (rows ?? []) as any[]) {
      const set = row.price_sets;
      if (set?.product_id) productIds.add(set.product_id);
      if (set?.variant_id) variantIds.add(set.variant_id);
    }

    const [{ data: products }, { data: variants }] = await Promise.all([
      productIds.size
        ? supabase.from("products").select("id, name").in("id", Array.from(productIds))
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      variantIds.size
        ? supabase
            .from("product_variants")
            .select("id, title, product_id")
            .in("id", Array.from(variantIds))
        : Promise.resolve({ data: [] as { id: string; title: string; product_id: string }[] }),
    ]);

    const variantProductIds = (variants ?? []).map((v) => v.product_id).filter(Boolean);
    const { data: parents } = variantProductIds.length
      ? await supabase.from("products").select("id, name").in("id", variantProductIds)
      : { data: [] as { id: string; name: string }[] };

    const productName = new Map<string, string>();
    for (const p of [...(products ?? []), ...(parents ?? [])]) productName.set(p.id, p.name);
    const variantById = new Map((variants ?? []).map((v) => [v.id, v]));

    const search = (data.search ?? "").trim().toLowerCase();
    const items = ((rows ?? []) as any[])
      .map((row) => {
        const set = row.price_sets ?? {};
        const variant = set.variant_id ? variantById.get(set.variant_id) : undefined;
        const pid = set.product_id ?? variant?.product_id ?? "";
        return {
          id: row.id as string,
          productId: pid,
          productName: productName.get(pid) ?? "—",
          variantTitle: variant?.title ?? null,
          type: row.type as string,
          currency_code: row.currency_code as string,
          amount_minor: Number(row.amount_minor),
          starts_at: row.starts_at as string | null,
          ends_at: row.ends_at as string | null,
          min_quantity: row.min_quantity as number | null,
          max_quantity: row.max_quantity as number | null,
          customer_group_id: row.customer_group_id as string | null,
          status: row.status as string,
        };
      })
      .filter((item) =>
        search
          ? item.productName.toLowerCase().includes(search) ||
            (item.variantTitle ?? "").toLowerCase().includes(search)
          : true,
      );

    return { items };
  });
