import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BlueprintData } from "./blueprint-types";

export type ProductListItem = {
  id: string;
  name: string;
  handle: string;
  status: "draft" | "active" | "archived";
  blueprint_key: string;
  updated_at: string;
  variant_count: number;
  categories: string[];
  cover_url: string | null;
};

export type ProductListInput = {
  organizationId: string;
  shopId?: string | null;
  search?: string;
  status?: "draft" | "active" | "archived" | "all";
  blueprintKey?: string | "all";
  categoryId?: string | "all";
  collectionId?: string | "all";
  sort?: "updated_desc" | "updated_asc" | "name_asc" | "name_desc";
  page?: number;
  pageSize?: number;
};

/** Product list with everything the table needs in a single round trip. */
export const listProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ProductListInput) => data)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const pageSize = data.pageSize ?? 25;
    const page = data.page ?? 1;

    let query = supabase
      .from("products")
      .select(
        `id, name, handle, status, blueprint_key, updated_at,
         product_variants(count),
         product_categories(categories(id, name)),
         product_collections(collection_id),
         product_media(position, media_assets(storage_path))`,
        { count: "exact" },
      )
      .eq("organization_id", data.organizationId);

    if (data.shopId) query = query.eq("shop_id", data.shopId);
    if (data.status && data.status !== "all") query = query.eq("status", data.status);
    if (data.blueprintKey && data.blueprintKey !== "all") query = query.eq("blueprint_key", data.blueprintKey);
    if (data.search?.trim()) {
      const term = `%${data.search.trim()}%`;
      query = query.or(`name.ilike.${term},handle.ilike.${term}`);
    }

    const sort = data.sort ?? "updated_desc";
    if (sort === "name_asc") query = query.order("name", { ascending: true });
    else if (sort === "name_desc") query = query.order("name", { ascending: false });
    else query = query.order("updated_at", { ascending: sort === "updated_asc" });

    const { data: rows, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw new Error(error.message);

    type Row = {
      id: string;
      name: string;
      handle: string;
      status: ProductListItem["status"];
      blueprint_key: string;
      updated_at: string;
      product_variants: { count: number }[];
      product_categories: { categories: { id: string; name: string } | null }[];
      product_collections: { collection_id: string }[];
      product_media: { position: number; media_assets: { storage_path: string } | null }[];
    };

    let list = ((rows ?? []) as unknown as Row[]).filter((row) => {
      if (data.categoryId && data.categoryId !== "all") {
        if (!row.product_categories.some((c) => c.categories?.id === data.categoryId)) return false;
      }
      if (data.collectionId && data.collectionId !== "all") {
        if (!row.product_collections.some((c) => c.collection_id === data.collectionId)) return false;
      }
      return true;
    });

    const paths = list
      .map((row) => [...row.product_media].sort((a, b) => a.position - b.position)[0]?.media_assets?.storage_path)
      .filter((p): p is string => Boolean(p));

    const signed = new Map<string, string>();
    if (paths.length) {
      const { data: urls } = await supabase.storage.from("media").createSignedUrls(paths, 3600);
      for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    }

    const items: ProductListItem[] = list.map((row) => {
      const cover = [...row.product_media].sort((a, b) => a.position - b.position)[0]?.media_assets?.storage_path;
      return {
        id: row.id,
        name: row.name,
        handle: row.handle,
        status: row.status,
        blueprint_key: row.blueprint_key,
        updated_at: row.updated_at,
        variant_count: row.product_variants?.[0]?.count ?? 0,
        categories: row.product_categories.map((c) => c.categories?.name).filter((n): n is string => Boolean(n)),
        cover_url: cover ? (signed.get(cover) ?? null) : null,
      };
    });

    return { items, total: count ?? items.length, page, pageSize };
  });

/** Full product for the editor: blueprint data, options, variants, media, organisation. */
export const getProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { productId: string }) => data)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", data.productId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!product) throw new Error("Produkt nicht gefunden.");

    const [{ data: options }, { data: variants }, { data: media }, { data: cats }, { data: cols }] =
      await Promise.all([
        supabase
          .from("product_options")
          .select("id, name, key, position, display_type, product_option_values(id, value, label, position)")
          .eq("product_id", data.productId)
          .order("position", { ascending: true }),
        supabase
          .from("product_variants")
          .select("id, title, sku, barcode, status, position, option_signature, variant_option_values(option_id, option_value_id)")
          .eq("product_id", data.productId)
          .order("position", { ascending: true }),
        supabase
          .from("product_media")
          .select("id, position, role, variant_id, media_asset_id, media_assets(id, storage_path, filename, alt_text, title)")
          .eq("product_id", data.productId)
          .order("position", { ascending: true }),
        supabase.from("product_categories").select("category_id").eq("product_id", data.productId),
        supabase.from("product_collections").select("collection_id").eq("product_id", data.productId),
      ]);

    type MediaRow = {
      id: string;
      position: number;
      role: string;
      variant_id: string | null;
      media_asset_id: string;
      media_assets: { id: string; storage_path: string; filename: string; alt_text: string | null; title: string | null } | null;
    };
    const mediaRows = (media ?? []) as unknown as MediaRow[];
    const paths = mediaRows.map((m) => m.media_assets?.storage_path).filter((p): p is string => Boolean(p));
    const signed = new Map<string, string>();
    if (paths.length) {
      const { data: urls } = await supabase.storage.from("media").createSignedUrls(paths, 3600);
      for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    }

    return {
      product,
      options: options ?? [],
      variants: variants ?? [],
      media: mediaRows.map((m) => ({
        id: m.id,
        position: m.position,
        role: m.role,
        variant_id: m.variant_id,
        media_asset_id: m.media_asset_id,
        filename: m.media_assets?.filename ?? "",
        alt_text: m.media_assets?.alt_text ?? null,
        url: m.media_assets ? (signed.get(m.media_assets.storage_path) ?? null) : null,
      })),
      categoryIds: (cats ?? []).map((c) => c.category_id),
      collectionIds: (cols ?? []).map((c) => c.collection_id),
    };
  });

export type CreateProductInput = {
  organizationId: string;
  shopId: string;
  blueprintKey: string;
  blueprintId: string;
  blueprintVersion: number;
  name: string;
  subtitle?: string;
  description?: string;
  vendor?: string;
  productType?: string;
  blueprintData: BlueprintData;
  seoTitle?: string;
  seoDescription?: string;
  categoryIds?: string[];
  collectionIds?: string[];
};

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CreateProductInput) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit, emitEvent } = await import("./core.server");
    const { uniqueHandle, validateBlueprintData } = await import("./catalog.server");
    await assertPermission(supabase, userId, data.organizationId, "products.create");

    if (!data.name.trim()) throw new Error("Bitte gib einen Produktnamen an.");

    const { data: blueprint, error: bpError } = await supabase
      .from("product_blueprints")
      .select("id, key, version, schema")
      .eq("id", data.blueprintId)
      .maybeSingle();
    if (bpError) throw new Error(bpError.message);
    if (!blueprint) throw new Error("Produktvorlage nicht gefunden.");

    const cleanData = validateBlueprintData(blueprint.schema as never, data.blueprintData ?? {});
    const handle = await uniqueHandle(supabase as never, "products", data.shopId, data.name);

    const { data: product, error } = await supabase
      .from("products")
      .insert({
        organization_id: data.organizationId,
        shop_id: data.shopId,
        blueprint_id: blueprint.id,
        blueprint_key: blueprint.key,
        blueprint_version: blueprint.version,
        name: data.name.trim(),
        handle,
        subtitle: data.subtitle?.trim() || null,
        description: data.description ?? null,
        vendor: data.vendor?.trim() || null,
        product_type: data.productType?.trim() || null,
        seo_title: data.seoTitle?.trim() || null,
        seo_description: data.seoDescription?.trim() || null,
        blueprint_data: cleanData as never,
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.categoryIds?.length) {
      await supabase
        .from("product_categories")
        .insert(data.categoryIds.map((id) => ({ product_id: product.id, category_id: id })));
    }
    if (data.collectionIds?.length) {
      await supabase
        .from("product_collections")
        .insert(data.collectionIds.map((id) => ({ product_id: product.id, collection_id: id })));
    }

    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      actorEmail: (context.claims as { email?: string } | undefined)?.email ?? null,
      action: "product.created",
      entityType: "product",
      entityId: product.id,
      metadata: { name: data.name, blueprint: blueprint.key },
    });
    await emitEvent(data.organizationId, "catalog.product.created", { product_id: product.id });

    return { id: product.id, handle };
  });

export type UpdateProductInput = {
  productId: string;
  organizationId: string;
  name?: string;
  handle?: string;
  subtitle?: string | null;
  description?: string | null;
  vendor?: string | null;
  productType?: string | null;
  status?: "draft" | "active" | "archived";
  featured?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  blueprintData?: BlueprintData;
  taxClassId?: string | null;
  categoryIds?: string[];
  collectionIds?: string[];
};

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: UpdateProductInput) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit, emitEvent } = await import("./core.server");
    const { uniqueHandle, validateBlueprintData } = await import("./catalog.server");
    await assertPermission(supabase, userId, data.organizationId, "products.update");

    const { data: existing, error: exErr } = await supabase
      .from("products")
      .select("id, shop_id, handle, blueprint_key, blueprint_version, blueprint_id, organization_id")
      .eq("id", data.productId)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!existing || existing.organization_id !== data.organizationId)
      throw new Error("Produkt nicht gefunden.");

    const patch: Record<string, unknown> = { updated_by: userId };
    if (data.name !== undefined) patch['name'] = data.name.trim();
    if (data.subtitle !== undefined) patch['subtitle'] = data.subtitle;
    if (data.description !== undefined) patch['description'] = data.description;
    if (data.vendor !== undefined) patch['vendor'] = data.vendor;
    if (data.productType !== undefined) patch['product_type'] = data.productType;
    if (data.status !== undefined) patch['status'] = data.status;
    if (data.featured !== undefined) patch['featured'] = data.featured;
    if (data.seoTitle !== undefined) patch['seo_title'] = data.seoTitle;
    if (data.seoDescription !== undefined) patch['seo_description'] = data.seoDescription;
    if (data.taxClassId !== undefined) patch['tax_class_id'] = data.taxClassId;

    if (data.handle !== undefined && data.handle !== existing.handle) {
      patch['handle'] = await uniqueHandle(
        supabase as never,
        "products",
        existing.shop_id,
        data.handle,
        existing.id,
      );
    }

    if (data.blueprintData) {
      const { data: bp } = await supabase
        .from("product_blueprints")
        .select("schema")
        .eq("id", existing.blueprint_id ?? "")
        .maybeSingle();
      patch['blueprint_data'] = validateBlueprintData(
        (bp?.schema ?? { groups: [] }) as never,
        data.blueprintData,
      );
    }

    const { error } = await supabase.from("products").update(patch as never).eq("id", data.productId);
    if (error) throw new Error(error.message);

    if (data.categoryIds) {
      await supabase.from("product_categories").delete().eq("product_id", data.productId);
      if (data.categoryIds.length)
        await supabase
          .from("product_categories")
          .insert(data.categoryIds.map((id) => ({ product_id: data.productId, category_id: id })));
    }
    if (data.collectionIds) {
      await supabase.from("product_collections").delete().eq("product_id", data.productId);
      if (data.collectionIds.length)
        await supabase
          .from("product_collections")
          .insert(data.collectionIds.map((id) => ({ product_id: data.productId, collection_id: id })));
    }

    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      actorEmail: (context.claims as { email?: string } | undefined)?.email ?? null,
      action: "product.updated",
      entityType: "product",
      entityId: data.productId,
      metadata: { fields: Object.keys(patch).filter((k) => k !== "updated_by") },
    });
    await emitEvent(data.organizationId, "catalog.product.updated", { product_id: data.productId });
    return { ok: true };
  });

export const archiveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { productId: string; organizationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit, emitEvent } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "products.archive");

    const { error } = await supabase
      .from("products")
      .update({ status: "archived", archived_at: new Date().toISOString(), updated_by: userId })
      .eq("id", data.productId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);

    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "product.archived",
      entityType: "product",
      entityId: data.productId,
    });
    await emitEvent(data.organizationId, "catalog.product.archived", { product_id: data.productId });
    return { ok: true };
  });

export const duplicateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { productId: string; organizationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit, emitEvent } = await import("./core.server");
    const { uniqueHandle } = await import("./catalog.server");
    await assertPermission(supabase, userId, data.organizationId, "products.create");

    const { data: source, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", data.productId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!source) throw new Error("Produkt nicht gefunden.");

    const name = `${source.name} (Kopie)`;
    const handle = await uniqueHandle(supabase as never, "products", source.shop_id, name);

    const { data: copy, error: insErr } = await supabase
      .from("products")
      .insert({
        organization_id: source.organization_id,
        shop_id: source.shop_id,
        blueprint_id: source.blueprint_id,
        blueprint_key: source.blueprint_key,
        blueprint_version: source.blueprint_version,
        name,
        handle,
        subtitle: source.subtitle,
        description: source.description,
        status: "draft",
        product_type: source.product_type,
        vendor: source.vendor,
        seo_title: source.seo_title,
        seo_description: source.seo_description,
        metadata: source.metadata,
        blueprint_data: source.blueprint_data,
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    // Options + values + variants
    const { data: options } = await supabase
      .from("product_options")
      .select("id, name, key, position, display_type, product_option_values(id, value, label, position)")
      .eq("product_id", source.id);

    const valueMap = new Map<string, string>();
    const optionMap = new Map<string, string>();
    type OptRow = {
      id: string;
      name: string;
      key: string;
      position: number;
      display_type: string;
      product_option_values: { id: string; value: string; label: string | null; position: number }[];
    };
    for (const opt of (options ?? []) as unknown as OptRow[]) {
      const { data: newOpt } = await supabase
        .from("product_options")
        .insert({
          product_id: copy.id,
          name: opt.name,
          key: opt.key,
          position: opt.position,
          display_type: opt.display_type,
        })
        .select("id")
        .single();
      if (!newOpt) continue;
      optionMap.set(opt.id, newOpt.id);
      for (const val of opt.product_option_values) {
        const { data: newVal } = await supabase
          .from("product_option_values")
          .insert({ option_id: newOpt.id, value: val.value, label: val.label, position: val.position })
          .select("id")
          .single();
        if (newVal) valueMap.set(val.id, newVal.id);
      }
    }

    const { data: variants } = await supabase
      .from("product_variants")
      .select("id, title, barcode, status, position, option_signature, variant_option_values(option_id, option_value_id)")
      .eq("product_id", source.id);
    type VarRow = {
      id: string;
      title: string;
      barcode: string | null;
      status: "active" | "inactive" | "archived";
      position: number;
      option_signature: string;
      variant_option_values: { option_id: string; option_value_id: string }[];
    };
    for (const v of (variants ?? []) as unknown as VarRow[]) {
      const { data: newVariant } = await supabase
        .from("product_variants")
        .insert({
          organization_id: source.organization_id,
          product_id: copy.id,
          title: v.title,
          barcode: v.barcode,
          status: v.status,
          position: v.position,
          option_signature: v.option_signature,
        })
        .select("id")
        .single();
      if (!newVariant) continue;
      const links = v.variant_option_values
        .map((l) => ({
          variant_id: newVariant.id,
          option_id: optionMap.get(l.option_id),
          option_value_id: valueMap.get(l.option_value_id),
        }))
        .filter((l) => l.option_id && l.option_value_id);
      if (links.length) await supabase.from("variant_option_values").insert(links as never);
    }

    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "product.duplicated",
      entityType: "product",
      entityId: copy.id,
      metadata: { source_id: source.id },
    });
    await emitEvent(data.organizationId, "catalog.product.created", { product_id: copy.id });
    return { id: copy.id };
  });
