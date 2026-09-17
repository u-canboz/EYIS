import { getAdmin } from "../core.server";
import type { Block, CommunicationContext } from "./communication.types";
import type { MailAttachment } from "./provider";

type Scope = { organizationId: string; shopId: string };
export async function assertCommunicationShop(scope: Scope) {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("shops")
    .select("id")
    .eq("organization_id", scope.organizationId)
    .eq("id", scope.shopId)
    .maybeSingle();
  if (error || !data) throw new Error("Shop nicht gefunden oder kein Zugriff.");
}
export async function getMailAsset(scope: Scope, id: string) {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("media_assets")
    .select("id,filename,mime_type,size_bytes,storage_path,shop_id")
    .eq("organization_id", scope.organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error || !data || (data.shop_id && data.shop_id !== scope.shopId))
    throw new Error("Datei nicht gefunden oder gehört zu einem anderen Shop.");
  return { ...data, mime_type: data.mime_type ?? "", size_bytes: data.size_bytes ?? 0 };
}
export async function snapshotMailAssets(
  scope: Scope,
  blocks: Block[],
  includeLogo = true,
): Promise<MailAttachment[]> {
  const admin = await getAdmin();
  const { data: branding } = await admin
    .from("communication_branding")
    .select("*")
    .eq("organization_id", scope.organizationId)
    .eq("shop_id", scope.shopId)
    .maybeSingle();
  const row = branding as unknown as {
    attachment_media_ids?: string[];
    logo_media_id?: string;
  } | null;
  const ids = [
    ...new Set([
      ...(row?.attachment_media_ids ?? []),
      ...blocks
        .filter((b) => b.type === "attachment")
        .map((b) => b.mediaId)
        .filter((id): id is string => !!id),
    ]),
  ];
  if (ids.length > 5) throw new Error("Höchstens fünf PDF-Anhänge pro E-Mail.");
  const entries = ids.map((id) => ({ id, inline: false }));
  if (includeLogo && row?.logo_media_id) entries.push({ id: row.logo_media_id, inline: true });
  let total = 0;
  const attachments: MailAttachment[] = [];
  for (const entry of entries) {
    const asset = await getMailAsset(scope, entry.id);
    if (
      entry.inline
        ? !["image/png", "image/jpeg", "image/gif"].includes(asset.mime_type)
        : asset.mime_type !== "application/pdf"
    )
      throw new Error("Als Logo sind PNG, JPEG und GIF erlaubt; Anhänge müssen PDF-Dateien sein.");
    if (asset.size_bytes > 5_000_000)
      throw new Error("Eine Mail-Datei darf höchstens 5 MB groß sein.");
    const { data, error } = await admin.storage.from("media").download(asset.storage_path);
    if (error || !data) throw new Error("Mail-Datei konnte nicht geladen werden.");
    const bytes = new Uint8Array(await data.arrayBuffer());
    total += bytes.length;
    if (total > 5_000_000)
      throw new Error("Logo und Anhänge dürfen zusammen höchstens 5 MB groß sein.");
    if (!entry.inline && new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
      throw new Error("Der Anhang ist keine gültige PDF-Datei.");
    const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const gif = new TextDecoder().decode(bytes.slice(0, 3)) === "GIF";
    if (entry.inline && !(png || jpeg || gif))
      throw new Error("Die Logo-Datei ist kein gültiges Bild.");
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    attachments.push({
      filename: asset.filename.replace(/[\r\n"\\]/g, "_"),
      contentType: asset.mime_type,
      content: btoa(binary),
      ...(entry.inline ? { contentId: "eyis-shop-logo" } : {}),
    });
  }
  return attachments;
}

export async function resolveMailContent(
  scope: Scope,
  blocks: Block[],
  context: CommunicationContext,
) {
  const admin = await getAdmin();
  context.media = {};
  for (const id of [
    ...new Set(
      blocks
        .filter((b) => b.type === "image")
        .map((b) => b.mediaId)
        .filter((v): v is string => !!v),
    ),
  ]) {
    const asset = await getMailAsset(scope, id);
    if (!asset.mime_type.startsWith("image/"))
      throw new Error("Ein Bildblock benötigt eine Bilddatei.");
    const { data } = await admin.storage
      .from("media")
      .createSignedUrl(asset.storage_path, 31536000);
    if (data) context.media[id] = { url: data.signedUrl, filename: asset.filename };
  }
  const ids = [
    ...new Set(blocks.flatMap((b) => (b.type === "products" ? (b.productIds ?? []) : []))),
  ];
  context.products = [];
  if (!ids.length) return;
  // Use the same server-side catalog/pricing source as the Store API.
  const { getProduct } = await import("../store/catalog-public.server");
  const { data: branding } = await admin
    .from("communication_branding")
    .select("*")
    .eq("organization_id", scope.organizationId)
    .eq("shop_id", scope.shopId)
    .maybeSingle();
  const template = String(
    (branding as Record<string, unknown> | null)?.["product_url_template"] ?? "/produkt/{handle}",
  );
  for (const id of ids) {
    const product = await getProduct({ ...scope, handleOrId: id });
    if (!product) continue;
    const base = context.shop.website_url;
    context.products.push({
      id: product.id,
      name: product.title,
      price: product.price
        ? new Intl.NumberFormat("de-DE", {
            style: "currency",
            currency: product.price.currencyCode,
          }).format(product.price.unitAmountMinor / 100)
        : "Preis auf Anfrage",
      url: /^https?:\/\//i.test(base)
        ? `${base.replace(/\/$/, "")}${template.replace("{handle}", encodeURIComponent(product.handle))}`
        : "",
      imageUrl: product.image?.url ?? null,
    });
  }
}
