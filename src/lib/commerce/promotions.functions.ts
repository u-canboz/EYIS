import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  PromotionAction,
  PromotionCondition,
  PromotionType,
  SerializableAction,
  SerializableCondition,
} from "./pricing-types";

export type PromotionInput = {
  id?: string;
  name: string;
  description?: string | null;
  code?: string | null;
  type: PromotionType;
  value: number;
  currencyCode?: string | null;
  status?: "active" | "inactive" | "archived";
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  usageLimitPerCustomer?: number | null;
  priority?: number;
  stackable?: boolean;
  conditions?: PromotionCondition[];
  actions?: PromotionAction[];
};

const KNOWN_CONDITIONS = new Set([
  "product",
  "variant",
  "category",
  "collection",
  "minimum_quantity",
  "minimum_subtotal",
  "customer_group",
  "date_range",
]);

export const listPromotions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; shopId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("promotions")
      .select("*")
      .eq("organization_id", data.organizationId)
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return {
      promotions: ((rows ?? []) as any[]).map((p) => ({
        id: p.id as string,
        name: p.name as string,
        description: p.description as string | null,
        code: p.code as string | null,
        type: p.type as PromotionType,
        value: Number(p.value),
        status: p.status as string,
        starts_at: p.starts_at as string | null,
        ends_at: p.ends_at as string | null,
        usage_limit: p.usage_limit as number | null,
        usage_limit_per_customer: p.usage_limit_per_customer as number | null,
        priority: p.priority as number,
        stackable: p.stackable as boolean,
        conditions: (Array.isArray(p.conditions) ? p.conditions : []) as SerializableCondition[],
        actions: (Array.isArray(p.actions) ? p.actions : []) as SerializableAction[],
      })),
    };
  });

export const savePromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      organizationId: string;
      shopId: string;
      promotion: PromotionInput;
      idempotencyKey?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit, emitEvent } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "promotions.manage");

    const p = data.promotion;
    if (!p.name.trim()) throw new Error("Bitte gib einen Namen an.");
    if (!Number.isInteger(p.value) || p.value < 0)
      throw new Error("Der Wert muss eine ganze Zahl ≥ 0 sein.");
    if (p.type === "percentage" && p.value > 10000)
      throw new Error("Ein Prozentwert über 100 % ist nicht erlaubt.");
    if (p.startsAt && p.endsAt && Date.parse(p.startsAt) >= Date.parse(p.endsAt))
      throw new Error("Der Startzeitpunkt muss vor dem Endzeitpunkt liegen.");
    if (p.usageLimit !== null && p.usageLimit !== undefined && p.usageLimit <= 0)
      throw new Error("Das Nutzungslimit muss größer als 0 sein.");

    const conditions = p.conditions ?? [];
    for (const c of conditions) {
      const kind = (c as { kind?: string }).kind;
      if (!kind || !KNOWN_CONDITIONS.has(kind))
        throw new Error(`Unbekannte Bedingung: ${kind ?? "—"}`);
      const ids = (c as { ids?: string[] }).ids;
      const value = (c as { value?: number }).value;
      if (
        ["product", "variant", "category", "collection", "customer_group"].includes(kind) &&
        !ids?.length
      )
        throw new Error("Bedingung ist unvollständig: Es fehlt eine Auswahl.");
      if (
        ["minimum_quantity", "minimum_subtotal"].includes(kind) &&
        (value === undefined || value <= 0)
      )
        throw new Error("Bedingung ist unvollständig: Es fehlt ein gültiger Wert.");
    }

    // Referenced ids must belong to the same organization.
    const groupIds = conditions.flatMap((c) =>
      (c as { kind: string; ids?: string[] }).kind === "customer_group"
        ? ((c as any).ids ?? [])
        : [],
    );
    if (groupIds.length) {
      const { data: groups } = await supabase
        .from("customer_groups")
        .select("id")
        .in("id", groupIds)
        .eq("organization_id", data.organizationId)
        .eq("shop_id", data.shopId);
      if ((groups ?? []).length !== new Set(groupIds).size)
        throw new Error("Eine Kundengruppe gehört nicht zu diesem Shop.");
    }
    const productIds = conditions.flatMap((c) =>
      (c as { kind: string }).kind === "product" ? ((c as any).ids ?? []) : [],
    );
    if (productIds.length) {
      const { data: prods } = await supabase
        .from("products")
        .select("id")
        .in("id", productIds)
        .eq("organization_id", data.organizationId)
        .eq("shop_id", data.shopId);
      if ((prods ?? []).length !== new Set(productIds).size)
        throw new Error("Ein Produkt gehört nicht zu diesem Shop.");
    }

    const payload = {
      name: p.name.trim(),
      description: p.description ?? null,
      code: p.code?.trim() ? p.code.trim().toUpperCase() : null,
      type: p.type,
      value: p.value,
      currency_code: p.currencyCode ?? null,
      status: p.status ?? "inactive",
      starts_at: p.startsAt ?? null,
      ends_at: p.endsAt ?? null,
      usage_limit: p.usageLimit ?? null,
      usage_limit_per_customer: p.usageLimitPerCustomer ?? null,
      priority: p.priority ?? 0,
      stackable: p.stackable ?? true,
      conditions: conditions as never,
      actions: (p.actions ?? []) as never,
    };

    if (p.id) {
      const { error } = await supabase
        .from("promotions")
        .update(payload as never)
        .eq("id", p.id)
        .eq("organization_id", data.organizationId);
      if (error) throw new Error(error.message);
      await writeAudit({
        organizationId: data.organizationId,
        actorId: userId,
        action: "promotion.updated",
        entityType: "promotion",
        entityId: p.id,
      });
      await emitEvent(data.organizationId, "promotion.updated", { promotionId: p.id });
      return { id: p.id };
    }

    const { data: created, error } = await supabase
      .from("promotions")
      .insert({ organization_id: data.organizationId, shop_id: data.shopId, ...payload } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "promotion.created",
      entityType: "promotion",
      entityId: created.id,
      metadata: { name: p.name, type: p.type },
    });
    await emitEvent(data.organizationId, "promotion.created", { promotionId: created.id });
    return { id: created.id };
  });

export const setPromotionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      organizationId: string;
      promotionId: string;
      status: "active" | "inactive" | "archived";
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit, emitEvent } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "promotions.manage");
    const { error } = await supabase
      .from("promotions")
      .update({ status: data.status } as never)
      .eq("id", data.promotionId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    const action = data.status === "active" ? "promotion.activated" : "promotion.deactivated";
    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action,
      entityType: "promotion",
      entityId: data.promotionId,
    });
    await emitEvent(data.organizationId, action, { promotionId: data.promotionId });
    return { ok: true };
  });

export const deletePromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; promotionId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "promotions.manage");
    const { error } = await supabase
      .from("promotions")
      .delete()
      .eq("id", data.promotionId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "promotion.deleted",
      entityType: "promotion",
      entityId: data.promotionId,
    });
    return { ok: true };
  });
