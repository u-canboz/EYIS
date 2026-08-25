import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MediaItem = {
  id: string;
  filename: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  title: string | null;
  created_at: string;
  usage_count: number;
  url: string | null;
};

/** Media library for an organization, with signed preview URLs and usage counts. */
export const listMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; search?: string; limit?: number }) => data)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    let query = supabase
      .from("media_assets")
      .select(
        "id, filename, storage_path, mime_type, size_bytes, width, height, alt_text, title, created_at, product_media(count)",
      )
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);

    if (data.search?.trim()) {
      const term = `%${data.search.trim()}%`;
      query = query.or(`filename.ilike.${term},title.ilike.${term},alt_text.ilike.${term}`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    type Row = Omit<MediaItem, "usage_count" | "url"> & { product_media: { count: number }[] };
    const list = (rows ?? []) as unknown as Row[];
    const signed = new Map<string, string>();
    if (list.length) {
      const { data: urls } = await supabase.storage
        .from("media")
        .createSignedUrls(list.map((r) => r.storage_path), 3600);
      for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    }

    return list.map<MediaItem>((row) => ({
      id: row.id,
      filename: row.filename,
      storage_path: row.storage_path,
      mime_type: row.mime_type,
      size_bytes: row.size_bytes,
      width: row.width,
      height: row.height,
      alt_text: row.alt_text,
      title: row.title,
      created_at: row.created_at,
      usage_count: row.product_media?.[0]?.count ?? 0,
      url: signed.get(row.storage_path) ?? null,
    }));
  });

/** Registers a file that the browser already uploaded to the media bucket. */
export const registerMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      organizationId: string;
      shopId?: string | null;
      storagePath: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      width?: number | null;
      height?: number | null;
      altText?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "media.upload");

    if (!data.storagePath.startsWith(`${data.organizationId}/`)) {
      throw new Error("Ungültiger Speicherpfad für diese Organisation.");
    }

    const { data: asset, error } = await supabase
      .from("media_assets")
      .insert({
        organization_id: data.organizationId,
        shop_id: data.shopId ?? null,
        storage_path: data.storagePath,
        filename: data.filename,
        mime_type: data.mimeType,
        size_bytes: data.sizeBytes,
        width: data.width ?? null,
        height: data.height ?? null,
        alt_text: data.altText ?? null,
        uploaded_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "media.uploaded",
      entityType: "media_asset",
      entityId: asset.id,
      metadata: { filename: data.filename },
    });
    return { id: asset.id };
  });

export const updateMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { mediaId: string; organizationId: string; altText?: string | null; title?: string | null }) =>
      data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "media.upload");

    const patch: Record<string, unknown> = {};
    if (data.altText !== undefined) patch['alt_text'] = data.altText;
    if (data.title !== undefined) patch['title'] = data.title;

    const { error } = await supabase
      .from("media_assets")
      .update(patch)
      .eq("id", data.mediaId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Deletes an asset only when it is not attached to any product. */
export const deleteMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { mediaId: string; organizationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "media.delete");

    const { data: asset, error: readErr } = await supabase
      .from("media_assets")
      .select("id, storage_path, product_media(count)")
      .eq("id", data.mediaId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!asset) throw new Error("Datei nicht gefunden.");

    const usage = (asset as unknown as { product_media: { count: number }[] }).product_media?.[0]?.count ?? 0;
    if (usage > 0) throw new Error("Diese Datei wird noch von Produkten verwendet.");

    await supabase.storage.from("media").remove([asset.storage_path]);
    const { error } = await supabase.from("media_assets").delete().eq("id", data.mediaId);
    if (error) throw new Error(error.message);

    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "media.deleted",
      entityType: "media_asset",
      entityId: data.mediaId,
    });
    return { ok: true };
  });

/** Attaches assets to a product (optionally to a single variant). */
export const attachMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      organizationId: string;
      productId: string;
      mediaIds: string[];
      variantId?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "products.update");

    const { data: existing } = await supabase
      .from("product_media")
      .select("position")
      .eq("product_id", data.productId)
      .order("position", { ascending: false })
      .limit(1);
    let position = (existing?.[0]?.position ?? -1) + 1;

    const rows = data.mediaIds.map((mediaId) => ({
      product_id: data.productId,
      media_asset_id: mediaId,
      variant_id: data.variantId ?? null,
      position: position++,
    }));
    if (!rows.length) return { ok: true };

    const { error } = await supabase.from("product_media").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const detachMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; productMediaId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "products.update");
    const { error } = await supabase.from("product_media").delete().eq("id", data.productMediaId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** New order of the product gallery; the first entry is the cover image. */
export const reorderProductMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; productMediaIds: string[] }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "products.update");

    for (const [position, id] of data.productMediaIds.entries()) {
      const { error } = await supabase.from("product_media").update({ position }).eq("id", id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
