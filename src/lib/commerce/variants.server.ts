import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Generates missing variants, including the single standard option for simple products. */
export async function generateProductVariants(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: { productId: string; organizationId: string },
) {
  const { assertPermission, writeAudit, emitEvent } = await import("./core.server");
  const { optionSignature, cartesian } = await import("./catalog.server");
  await assertPermission(supabase, userId, data.organizationId, "products.update");

  // Bind the requested product to the authorized organization before reading
  // child tables (product_options inherits ownership through product_id).
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("id", data.productId)
    .eq("organization_id", data.organizationId)
    .maybeSingle();
  if (productError) throw new Error(productError.message);
  if (!product) throw new Error("Produkt nicht gefunden.");

  const { data: options, error: optionsError } = await supabase
    .from("product_options")
    .select("id, key, name, position, product_option_values(id, value, position)")
    .eq("product_id", data.productId)
    .order("position", { ascending: true });

  if (optionsError) throw new Error(optionsError.message);

  type OptRow = {
    id: string;
    key: string;
    name: string;
    product_option_values: { id: string; value: string; position: number }[];
  };
  const axes = ((options ?? []) as unknown as OptRow[]).filter(
    (o) => o.product_option_values.length > 0,
  );

  const combos = cartesian(
    axes.map((axis) =>
      [...axis.product_option_values]
        .sort((a, b) => a.position - b.position)
        .map((value) => ({
          optionId: axis.id,
          optionKey: axis.key,
          valueId: value.id,
          value: value.value,
        })),
    ),
  );

  const { data: existing, error: existingError } = await supabase
    .from("product_variants")
    .select("option_signature")
    .eq("product_id", data.productId)
    .eq("organization_id", data.organizationId);
  if (existingError) throw new Error(existingError.message);
  // A product without axes still needs one purchasable standard variant.
  // Never add another one when a prior variant already exists.
  if (!axes.length && existing?.length) return { created: 0, skipped: 1 };
  const known = new Set((existing ?? []).map((v) => v.option_signature));

  let created = 0;
  let position = existing?.length ?? 0;
  for (const combo of combos) {
    const signature = optionSignature(
      combo.map((c) => ({ optionKey: c.optionKey, value: c.value })),
    );
    if (known.has(signature)) continue;

    const { data: variant, error } = await supabase
      .from("product_variants")
      .insert({
        organization_id: data.organizationId,
        product_id: data.productId,
        title: combo.length ? combo.map((c) => c.value).join(" / ") : "Standard",
        option_signature: signature,
        position: position++,
      })
      .select("id")
      .single();
    if (error?.code === "23505") continue; // concurrent generation: existing signature wins
    if (error) throw new Error(error.message);

    if (combo.length) {
      const { error: linkErr } = await supabase.from("variant_option_values").insert(
        combo.map((c) => ({
          variant_id: variant.id,
          option_id: c.optionId,
          option_value_id: c.valueId,
        })),
      );
      if (linkErr) throw new Error(linkErr.message);
    }
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
}
