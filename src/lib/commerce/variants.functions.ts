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

    type OptRow = { id: string; key: string; product_option_values: { id: string; value: string }[] };
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
    const { supabase, userId } = context;
    const { assertPermission, writeAudit, emitEvent } = await import("./core.server");
    const { optionSignature, cartesian } = await import("./catalog.server");
    await assertPermission(supabase, userId, data.organizationId, "products.update");

    const { data: options } = await supabase
      .from("product_options")
      .select("id, key, name, position, product_option_values(id, value, position)")
      .eq("product_id", data.productId)
      .order("position", { ascending: true });

    type OptRow = {
      id: string;
      key: string;
      name: string;
      product_option_values: { id: string; value: string; position: number }[];
    };
    const axes = ((options ?? []) as unknown as OptRow[]).filter(
      (o) => o.product_option_values.length > 0,
    );
    if (axes.length === 0) return { created: 0, skipped: 0 };

    const combos = cartesian(
      axes.map((axis) =>
        [...axis.product_option_values]
          .sort((a, b) => a.position - b.position)
          .map((value) => ({ optionId: axis.id, optionKey: axis.key, valueId: value.id, value: value.value })),
      ),
    );

    const { data: existing } = await supabase
      .from("product_variants")
      .select("option_signature")
      .eq("product_id", data.productId);
    const known = new Set((existing ?? []).map((v) => v.option_signature));

    let created = 0;
    let position = existing?.length ?? 0;
    for (const combo of combos) {
      const signature = optionSignature(combo.map((c) => ({ optionKey: c.optionKey, value: c.value })));
      if (known.has(signature)) continue;

      const { data: variant, error } = await supabase
        .from("product_variants")
        .insert({
          organization_id: data.organizationId,
          product_id: data.productId,
          title: combo.map((c) => c.value).join(" / "),
          option_signature: signature,
          position: position++,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      const { error: linkErr } = await supabase.from("variant_option_values").insert(
        combo.map((c) => ({
          variant_id: variant.id,
          option_id: c.optionId,
          option_value_id: c.valueId,
        })),
      );
      if (linkErr) throw new Error(linkErr.message);
      known.add(signature);
      created += 1;
    }

    if (created > 0) {
      await writeAudit({
        organizationId: data.organizationId,
        actorId: userId,
        action: "variant.created",
        entityType: "product",
        entityId: data.productId,
        metadata: { count: created },
      });
      await emitEvent(data.organizationId, "catalog.variant.created", {
        product_id: data.productId,
        count: created,
      });
    }

    return { created, skipped: combos.length - created };
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
    if (data.title !== undefined) patch['title'] = data.title;
    if (data.sku !== undefined) patch['sku'] = data.sku?.trim() ? data.sku.trim() : null;
    if (data.barcode !== undefined) patch['barcode'] = data.barcode?.trim() ? data.barcode.trim() : null;
    if (data.status !== undefined) patch['status'] = data.status;

    const { error } = await supabase
      .from("product_variants")
      .update(patch)
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
