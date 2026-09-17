import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AxisInput = {
  key: string;
  name: string;
  display_type?: string;
  values: string[];
};

/** Stores the option axes and their values. Removing values is handled explicitly. */
export const saveOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { productId: string; organizationId: string; axes: AxisInput[] }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "products.update");

    const { data: existing } = await supabase
      .from("product_options")
      .select("id, key, product_option_values(id, value)")
      .eq("product_id", data.productId);

    type OptRow = {
      id: string;
      key: string;
      product_option_values: { id: string; value: string }[];
    };
    const rows = (existing ?? []) as unknown as OptRow[];
    const keepKeys = new Set(data.axes.map((a) => a.key));

    for (const row of rows) {
      if (!keepKeys.has(row.key)) {
        await supabase.from("product_options").delete().eq("id", row.id);
      }
    }

    for (const [index, axis] of data.axes.entries()) {
      let optionId = rows.find((r) => r.key === axis.key)?.id;
      if (!optionId) {
        const { data: created, error } = await supabase
          .from("product_options")
          .insert({
            product_id: data.productId,
            key: axis.key,
            name: axis.name,
            position: index,
            display_type: axis.display_type ?? "list",
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        optionId = created.id;
      } else {
        await supabase
          .from("product_options")
          .update({ name: axis.name, position: index, display_type: axis.display_type ?? "list" })
          .eq("id", optionId);
      }

      const current = rows.find((r) => r.key === axis.key)?.product_option_values ?? [];
      const currentValues = new Set(current.map((v) => v.value));
      const nextValues = new Set(axis.values);

      for (const value of current) {
        if (!nextValues.has(value.value)) {
          await supabase.from("product_option_values").delete().eq("id", value.id);
        }
      }
      const toInsert = axis.values
        .map((value, position) => ({ option_id: optionId!, value, label: value, position }))
        .filter((v) => !currentValues.has(v.value));
      if (toInsert.length) {
        const { error } = await supabase.from("product_option_values").insert(toInsert);
        if (error) throw new Error(error.message);
      }
    }

    return { ok: true };
  });

/** Which variants would disappear if this option value is removed. */
export const optionValueImpact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { productId: string; optionKey: string; value: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: variants } = await context.supabase
      .from("product_variants")
      .select("id, title, option_signature")
      .eq("product_id", data.productId);
    const token = `${data.optionKey}:${data.value}`;
    const affected = (variants ?? []).filter((v) =>
      (v.option_signature ?? "").split("|").includes(token),
    );
    return affected.map((v) => ({ id: v.id, title: v.title }));
  });

/** Creates all missing combinations; existing ones are never duplicated. */
export const generateVariants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { productId: string; organizationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { generateProductVariants } = await import("./variants.server");
    return generateProductVariants(context.supabase, context.userId, data);
  });

export const updateVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      variantId: string;
      organizationId: string;
      title?: string;
      sku?: string | null;
      barcode?: string | null;
      status?: "active" | "inactive" | "archived";
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit, emitEvent } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "products.update");

    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch["title"] = data.title;
    if (data.sku !== undefined) patch["sku"] = data.sku?.trim() ? data.sku.trim() : null;
    if (data.barcode !== undefined)
      patch["barcode"] = data.barcode?.trim() ? data.barcode.trim() : null;
    if (data.status !== undefined) patch["status"] = data.status;

    const { error } = await supabase
      .from("product_variants")
      .update(patch as never)
      .eq("id", data.variantId)
      .eq("organization_id", data.organizationId);
    if (error) {
      throw new Error(
        error.message.includes("product_variants_sku_unique")
          ? "Diese Artikelnummer wird bereits verwendet."
          : error.message,
      );
    }

    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "variant.updated",
      entityType: "variant",
      entityId: data.variantId,
    });
    await emitEvent(data.organizationId, "catalog.variant.updated", { variant_id: data.variantId });
    return { ok: true };
  });

export const removeVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { variantId: string; organizationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit, emitEvent } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "products.update");

    const { error } = await supabase
      .from("product_variants")
      .delete()
      .eq("id", data.variantId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);

    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "variant.removed",
      entityType: "variant",
      entityId: data.variantId,
    });
    await emitEvent(data.organizationId, "catalog.variant.removed", { variant_id: data.variantId });
    return { ok: true };
  });
