/** Admin API for shipping methods. Permission-checked, no logic here. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ShippingMethodView } from "./cart-types";

type Base = { organizationId: string; shopId: string };

export const listShippingMethodsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Base) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("./core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "shipping_methods.read",
    );
    const { mapShippingMethod } = await import("./checkout.server");
    const { data: rows, error } = await context.supabase
      .from("shipping_methods")
      .select("*")
      .eq("organization_id", data.organizationId)
      .eq("shop_id", data.shopId)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return ((rows ?? []) as Record<string, unknown>[]).map(
      mapShippingMethod,
    ) as ShippingMethodView[];
  });

export const saveShippingMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Base & {
        id?: string | null;
        name: string;
        code: string;
        description?: string | null;
        pricingType: "fixed" | "free";
        amountMinor: number;
        currencyCode: string;
        countries: string[];
        minSubtotalMinor?: number | null;
        maxSubtotalMinor?: number | null;
        freeAboveMinor?: number | null;
        position?: number;
        status?: "active" | "inactive" | "archived";
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission, writeAudit } = await import("./core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "shipping_methods.manage",
    );
    if (!data.name.trim()) throw new Error("Name ist erforderlich.");
    if (!/^[a-z0-9_-]+$/i.test(data.code))
      throw new Error("Der Code darf nur Buchstaben, Ziffern, - und _ enthalten.");
    if (!Number.isInteger(data.amountMinor) || data.amountMinor < 0)
      throw new Error("Der Betrag muss eine ganze Zahl ≥ 0 sein.");

    const payload = {
      organization_id: data.organizationId,
      shop_id: data.shopId,
      name: data.name.trim(),
      code: data.code.trim().toLowerCase(),
      description: data.description ?? null,
      pricing_type: data.pricingType,
      amount_minor: data.pricingType === "free" ? 0 : data.amountMinor,
      currency_code: data.currencyCode.toUpperCase(),
      countries: data.countries.map((c) => c.trim().toUpperCase()).filter(Boolean),
      min_subtotal_minor: data.minSubtotalMinor ?? null,
      max_subtotal_minor: data.maxSubtotalMinor ?? null,
      free_above_minor: data.freeAboveMinor ?? null,
      position: data.position ?? 0,
      status: data.status ?? "active",
    };

    const { getAdmin } = await import("./core.server");
    const admin = await getAdmin();
    let id = data.id ?? null;
    if (id) {
      const { error } = await admin
        .from("shipping_methods")
        .update(payload)
        .eq("id", id)
        .eq("organization_id", data.organizationId);
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await admin
        .from("shipping_methods")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = (created as { id: string }).id;
    }

    await writeAudit({
      organizationId: data.organizationId,
      actorId: context.userId,
      action: data.id ? "shipping_method.updated" : "shipping_method.created",
      entityType: "shipping_method",
      entityId: id,
      metadata: { code: payload.code, amount_minor: payload.amount_minor },
    });
    return { id };
  });

export const deleteShippingMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; id: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission, getAdmin, writeAudit } = await import("./core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "shipping_methods.manage",
    );
    const admin = await getAdmin();
    const { error } = await admin
      .from("shipping_methods")
      .update({ status: "archived" })
      .eq("id", data.id)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    await writeAudit({
      organizationId: data.organizationId,
      actorId: context.userId,
      action: "shipping_method.archived",
      entityType: "shipping_method",
      entityId: data.id,
    });
    return { ok: true };
  });
