/**
 * Produktdatenfeed für Google Shopping (Merchant Center).
 *
 * Ausgabe ist ein RSS-2.0-Dokument mit dem Namensraum
 * `http://base.google.com/ns/1.0` bzw. alternativ ein CSV/TSV-Export mit
 * denselben Spalten. Google lädt die Datei per URL — deshalb hängt der Zugang
 * an einem widerrufbaren Feed-Schlüssel (`product_feeds.token_hash`) und nicht
 * an einer Session.
 *
 * Grenzen dieses Moduls:
 *  - Nur Lesezugriff. Der Feed verändert niemals Katalog-, Preis- oder
 *    Bestandsdaten.
 *  - Mandantenfilter über `organization_id` und `shop_id` in jeder Abfrage.
 *  - Beträge bleiben Minor Units bis zur Formatierung; keine Fließkommarechnung
 *    auf Beträgen.
 */

import { getAdmin, generateToken, hashToken } from "../core.server";

type Row = Record<string, unknown>;

export type FeedFormat = "google_shopping_xml" | "google_shopping_csv";

export type FeedRecord = {
  id: string;
  organizationId: string;
  shopId: string;
  format: FeedFormat;
  name: string;
  status: "active" | "revoked";
  baseUrl: string | null;
  defaultBrand: string | null;
  includeOutOfStock: boolean;
};

export type FeedSummary = FeedRecord & {
  tokenPrefix: string;
  lastDownloadedAt: string | null;
  lastItemCount: number | null;
  createdAt: string;
};

export type FeedItem = {
  id: string;
  itemGroupId: string;
  title: string;
  description: string;
  link: string;
  imageLink: string | null;
  additionalImageLinks: string[];
  availability: "in_stock" | "out_of_stock" | "backorder";
  quantity: number | null;
  price: string | null;
  salePrice: string | null;
  brand: string | null;
  gtin: string | null;
  mpn: string | null;
  condition: "new";
  productType: string | null;
  googleProductCategory: string | null;
};

const MAX_ITEMS = 20000;

/* ------------------------------------------------------------------ Zugang */

function rowToFeed(row: Row): FeedSummary {
  return {
    id: row["id"] as string,
    organizationId: row["organization_id"] as string,
    shopId: row["shop_id"] as string,
    format: row["format"] as FeedFormat,
    name: row["name"] as string,
    status: row["status"] as "active" | "revoked",
    baseUrl: (row["base_url"] as string | null) ?? null,
    defaultBrand: (row["default_brand"] as string | null) ?? null,
    includeOutOfStock: Boolean(row["include_out_of_stock"]),
    tokenPrefix: row["token_prefix"] as string,
    lastDownloadedAt: (row["last_downloaded_at"] as string | null) ?? null,
    lastItemCount: (row["last_item_count"] as number | null) ?? null,
    createdAt: row["created_at"] as string,
  };
}

const SELECT =
  "id, organization_id, shop_id, format, name, status, base_url, default_brand, include_out_of_stock, token_prefix, last_downloaded_at, last_item_count, created_at";

export async function listFeeds(organizationId: string, shopId: string): Promise<FeedSummary[]> {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("product_feeds")
    .select(SELECT)
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(rowToFeed);
}

/** Legt einen Feed an und gibt den Zugangsschlüssel genau einmal zurück. */
export async function createFeed(input: {
  organizationId: string;
  shopId: string;
  name: string;
  format: FeedFormat;
  baseUrl: string | null;
  defaultBrand: string | null;
  includeOutOfStock: boolean;
  actorId: string | null;
}): Promise<{ id: string; token: string }> {
  const admin = await getAdmin();
  const token = `feed_${generateToken()}`;
  const { data, error } = await admin
    .from("product_feeds")
    .insert({
      organization_id: input.organizationId,
      shop_id: input.shopId,
      name: input.name || "Google Shopping",
      format: input.format,
      base_url: normalizeBase(input.baseUrl),
      default_brand: input.defaultBrand?.trim() || null,
      include_out_of_stock: input.includeOutOfStock,
      token_prefix: token.slice(0, 13),
      token_hash: await hashToken(token),
      created_by: input.actorId,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: (data as Row)["id"] as string, token };
}

/** Erzeugt einen neuen Schlüssel; der alte verliert sofort seine Gültigkeit. */
export async function rotateFeedToken(input: {
  organizationId: string;
  feedId: string;
}): Promise<{ token: string }> {
  const admin = await getAdmin();
  const token = `feed_${generateToken()}`;
  const { error } = await admin
    .from("product_feeds")
    .update({
      token_hash: await hashToken(token),
      token_prefix: token.slice(0, 13),
      status: "active",
      revoked_at: null,
    } as never)
    .eq("id", input.feedId)
    .eq("organization_id", input.organizationId);
  if (error) throw new Error(error.message);
  return { token };
}

export async function updateFeed(input: {
  organizationId: string;
  feedId: string;
  name?: string;
  baseUrl?: string | null;
  defaultBrand?: string | null;
  includeOutOfStock?: boolean;
  status?: "active" | "revoked";
}) {
  const admin = await getAdmin();
  const patch: Row = {};
  if (input.name !== undefined) patch["name"] = input.name;
  if (input.baseUrl !== undefined) patch["base_url"] = normalizeBase(input.baseUrl);
  if (input.defaultBrand !== undefined) patch["default_brand"] = input.defaultBrand?.trim() || null;
  if (input.includeOutOfStock !== undefined)
    patch["include_out_of_stock"] = input.includeOutOfStock;
  if (input.status !== undefined) {
    patch["status"] = input.status;
    patch["revoked_at"] = input.status === "revoked" ? new Date().toISOString() : null;
  }
  const { error } = await admin
    .from("product_feeds")
    .update(patch as never)
    .eq("id", input.feedId)
    .eq("organization_id", input.organizationId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Auflösung des öffentlichen Feed-Schlüssels. Nur aktive Feeds. */
export async function resolveFeedToken(rawToken: string | null): Promise<FeedSummary | null> {
  if (!rawToken || rawToken.length < 20 || rawToken.length > 200) return null;
  const admin = await getAdmin();
  const { data } = await admin
    .from("product_feeds")
    .select(SELECT)
    .eq("token_hash", await hashToken(rawToken))
    .maybeSingle();
  const row = data as Row | null;
  if (!row || row["status"] !== "active") return null;
  return rowToFeed(row);
}

async function markDownloaded(feedId: string, itemCount: number) {
  const admin = await getAdmin();
  await admin
    .from("product_feeds")
    .update({
      last_downloaded_at: new Date().toISOString(),
      last_item_count: itemCount,
    } as never)
    .eq("id", feedId);
}

function normalizeBase(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------- Datensammlung */

/** Basisadresse für Produktlinks: Feed-Einstellung, Shop-Domain, dann Anfrage. */
async function resolveBaseUrl(feed: FeedSummary, requestOrigin: string): Promise<string> {
  if (feed.baseUrl) return feed.baseUrl;
  const admin = await getAdmin();
  const { data } = await admin
    .from("shop_domains")
    .select("domain, is_primary")
    .eq("organization_id", feed.organizationId)
    .eq("shop_id", feed.shopId)
    .order("is_primary", { ascending: false })
    .limit(1);
  const domain = ((data ?? []) as Row[])[0]?.["domain"] as string | undefined;
  return domain ? `https://${domain}` : requestOrigin.replace(/\/$/, "");
}

function money(amountMinor: number, currency: string): string {
  const negative = amountMinor < 0;
  const abs = Math.abs(Math.round(amountMinor));
  const value = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return `${negative ? "-" : ""}${value} ${currency}`;
}

/** Baut die Artikelliste des Feeds. Eine Abfrage je Domäne, kein N+1. */
export async function collectFeedItems(
  feed: FeedSummary,
  requestOrigin: string,
): Promise<{ items: FeedItem[]; shopName: string; baseUrl: string }> {
  const admin = await getAdmin();

  const { data: shopRow } = await admin
    .from("shops")
    .select("name, currency")
    .eq("id", feed.shopId)
    .eq("organization_id", feed.organizationId)
    .maybeSingle();
  const shopName = ((shopRow as Row | null)?.["name"] as string) ?? "Shop";
  const currency = ((shopRow as Row | null)?.["currency"] as string) ?? "EUR";
  const baseUrl = await resolveBaseUrl(feed, requestOrigin);

  const { data: productRows, error } = await admin
    .from("products")
    .select(
      "id, handle, name, subtitle, description, seo_description, vendor, product_type, metadata",
    )
    .eq("organization_id", feed.organizationId)
    .eq("shop_id", feed.shopId)
    .eq("status", "active")
    .is("archived_at", null)
    .order("name", { ascending: true })
    .limit(MAX_ITEMS);
  if (error) throw new Error(error.message);
  const products = (productRows ?? []) as Row[];
  if (!products.length) return { items: [], shopName, baseUrl };
  const productIds = products.map((p) => p["id"] as string);

  const [variants, imagesByProduct, categoryByProduct] = await Promise.all([
    loadVariants(feed.organizationId, productIds),
    loadImages(productIds),
    loadCategories(productIds),
  ]);
  const variantIds = variants.map((v) => v["id"] as string);
  const [priceByVariant, stockByVariant] = await Promise.all([
    loadPrices(feed.organizationId, variantIds, currency),
    loadStock(feed.organizationId, feed.shopId, variantIds),
  ]);

  const variantsByProduct = new Map<string, Row[]>();
  for (const variant of variants) {
    const key = variant["product_id"] as string;
    const list = variantsByProduct.get(key) ?? [];
    list.push(variant);
    variantsByProduct.set(key, list);
  }

  const items: FeedItem[] = [];
  for (const product of products) {
    const productId = product["id"] as string;
    const list = variantsByProduct.get(productId) ?? [];
    if (!list.length) continue;
    const images = imagesByProduct.get(productId) ?? [];
    const meta = googleMeta(product["metadata"]);
    const handle = product["handle"] as string;
    const link = `${baseUrl}/produkt/${encodeURIComponent(handle)}`;
    const description = plainText(
      (product["description"] as string | null) ??
        (product["seo_description"] as string | null) ??
        (product["subtitle"] as string | null) ??
        (product["name"] as string),
    );

    for (const variant of list) {
      const variantId = variant["id"] as string;
      const price = priceByVariant.get(variantId);
      if (!price) continue;
      const stock = stockByVariant.get(variantId) ?? { tracked: false, available: null };
      const availability: FeedItem["availability"] = !stock.tracked
        ? "in_stock"
        : (stock.available ?? 0) > 0
          ? "in_stock"
          : stock.backorder
            ? "backorder"
            : "out_of_stock";
      if (availability === "out_of_stock" && !feed.includeOutOfStock) continue;

      const variantTitle = variant["title"] as string | null;
      const isSingle = list.length === 1;
      items.push({
        id: (variant["sku"] as string | null) || variantId,
        itemGroupId: handle,
        title:
          isSingle || !variantTitle || variantTitle === "Standard"
            ? (product["name"] as string)
            : `${product["name"] as string} – ${variantTitle}`,
        description,
        link: isSingle ? link : `${link}?variante=${encodeURIComponent(variantId)}`,
        imageLink: images[0] ?? null,
        additionalImageLinks: images.slice(1, 11),
        availability,
        quantity: stock.tracked ? (stock.available ?? 0) : null,
        price: money(price.base, price.currency),
        salePrice: price.sale !== null ? money(price.sale, price.currency) : null,
        brand: (product["vendor"] as string | null) || feed.defaultBrand,
        gtin: (variant["barcode"] as string | null) || null,
        mpn: (variant["sku"] as string | null) || null,
        condition: "new",
        productType:
          (product["product_type"] as string | null) || categoryByProduct.get(productId) || null,
        googleProductCategory: meta.googleProductCategory,
      });
    }
  }

  return { items, shopName, baseUrl };
}

function googleMeta(value: unknown): { googleProductCategory: string | null } {
  const meta = (value ?? {}) as Record<string, unknown>;
  const google = (meta["google"] ?? {}) as Record<string, unknown>;
  const category = google["product_category"] ?? meta["google_product_category"];
  return { googleProductCategory: category ? String(category) : null };
}

function plainText(value: string | null): string {
  if (!value) return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);
}

async function loadVariants(organizationId: string, productIds: string[]): Promise<Row[]> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("product_variants")
    .select("id, product_id, title, sku, barcode, position")
    .eq("organization_id", organizationId)
    .in("product_id", productIds)
    .eq("status", "active")
    .order("position", { ascending: true });
  return (data ?? []) as Row[];
}

/** Öffentliche URLs aus dem öffentlichen Medien-Bucket — stabil für Google. */
async function loadImages(productIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const admin = await getAdmin();
  const { data } = await admin
    .from("product_media")
    .select("product_id, position, media_assets(storage_path)")
    .in("product_id", productIds)
    .order("position", { ascending: true });
  const rows = (data ?? []) as unknown as {
    product_id: string;
    media_assets: { storage_path: string } | null;
  }[];
  for (const row of rows) {
    if (!row.media_assets?.storage_path) continue;
    const { data: pub } = admin.storage.from("media").getPublicUrl(row.media_assets.storage_path);
    if (!pub?.publicUrl) continue;
    const list = out.get(row.product_id) ?? [];
    list.push(pub.publicUrl);
    out.set(row.product_id, list);
  }
  return out;
}

async function loadCategories(productIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const admin = await getAdmin();
  const { data } = await admin
    .from("product_categories")
    .select("product_id, categories(name)")
    .in("product_id", productIds);
  const rows = (data ?? []) as unknown as {
    product_id: string;
    categories: { name: string } | null;
  }[];
  for (const row of rows) {
    if (!row.categories?.name || out.has(row.product_id)) continue;
    out.set(row.product_id, row.categories.name);
  }
  return out;
}

async function loadPrices(
  organizationId: string,
  variantIds: string[],
  fallbackCurrency: string,
): Promise<Map<string, { base: number; sale: number | null; currency: string }>> {
  const out = new Map<string, { base: number; sale: number | null; currency: string }>();
  if (!variantIds.length) return out;
  const admin = await getAdmin();
  const { data: sets } = await admin
    .from("price_sets")
    .select("id, variant_id")
    .eq("organization_id", organizationId)
    .in("variant_id", variantIds);
  const setRows = (sets ?? []) as Row[];
  if (!setRows.length) return out;
  const variantBySet = new Map<string, string>();
  for (const set of setRows) variantBySet.set(set["id"] as string, set["variant_id"] as string);

  const { data: prices } = await admin
    .from("prices")
    .select("price_set_id, amount_minor, currency_code, type, status")
    .in("price_set_id", [...variantBySet.keys()])
    .in("type", ["base", "sale"]);

  for (const row of (prices ?? []) as Row[]) {
    const variantId = variantBySet.get(row["price_set_id"] as string);
    if (!variantId) continue;
    if (row["status"] && row["status"] !== "active") continue;
    const amount = Number(row["amount_minor"]);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const currency = String(row["currency_code"] ?? fallbackCurrency);
    const current = out.get(variantId) ?? { base: 0, sale: null, currency };
    if (row["type"] === "base") {
      if (!current.base || amount < current.base) current.base = amount;
    } else if (current.sale === null || amount < current.sale) {
      current.sale = amount;
    }
    current.currency = currency;
    out.set(variantId, current);
  }
  for (const [variantId, entry] of [...out.entries()]) {
    if (!entry.base && entry.sale !== null) {
      out.set(variantId, { ...entry, base: entry.sale, sale: null });
    } else if (!entry.base) {
      out.delete(variantId);
    } else if (entry.sale !== null && entry.sale >= entry.base) {
      out.set(variantId, { ...entry, sale: null });
    }
  }
  return out;
}

async function loadStock(
  organizationId: string,
  shopId: string,
  variantIds: string[],
): Promise<Map<string, { tracked: boolean; available: number | null; backorder?: boolean }>> {
  const out = new Map<string, { tracked: boolean; available: number | null; backorder?: boolean }>();
  if (!variantIds.length) return out;
  const admin = await getAdmin();
  const { data: items } = await admin
    .from("inventory_items")
    .select("id, variant_id, track_inventory, allow_backorder")
    .eq("organization_id", organizationId)
    .in("variant_id", variantIds);
  const itemRows = (items ?? []) as Row[];
  if (!itemRows.length) return out;
  const { data: levels } = await admin
    .from("inventory_levels")
    .select("inventory_item_id, on_hand, reserved, damaged")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .in(
      "inventory_item_id",
      itemRows.map((i) => i["id"] as string),
    );
  const sumByItem = new Map<string, number>();
  for (const level of (levels ?? []) as Row[]) {
    const id = level["inventory_item_id"] as string;
    const value =
      Number(level["on_hand"] ?? 0) - Number(level["damaged"] ?? 0) - Number(level["reserved"] ?? 0);
    sumByItem.set(id, (sumByItem.get(id) ?? 0) + value);
  }
  for (const item of itemRows) {
    const tracked = Boolean(item["track_inventory"]);
    out.set(item["variant_id"] as string, {
      tracked,
      available: tracked ? Math.max(0, sumByItem.get(item["id"] as string) ?? 0) : null,
      backorder: Boolean(item["allow_backorder"]),
    });
  }
  return out;
}

/* -------------------------------------------------------------- Serialisierung */

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Steuerzeichen sind in XML 1.0 nicht erlaubt.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

export function renderGoogleXml(input: {
  shopName: string;
  baseUrl: string;
  items: FeedItem[];
}): string {
  const tag = (name: string, value: string | null) =>
    value === null || value === "" ? "" : `      <${name}>${escapeXml(value)}</${name}>\n`;

  const entries = input.items
    .map((item) => {
      let xml = "    <item>\n";
      xml += tag("g:id", item.id);
      xml += tag("g:item_group_id", item.itemGroupId);
      xml += tag("title", item.title.slice(0, 150));
      xml += tag("description", item.description || item.title);
      xml += tag("link", item.link);
      xml += tag("g:image_link", item.imageLink);
      for (const extra of item.additionalImageLinks) xml += tag("g:additional_image_link", extra);
      xml += tag("g:availability", item.availability);
      if (item.quantity !== null) xml += tag("g:quantity", String(item.quantity));
      xml += tag("g:price", item.price);
      xml += tag("g:sale_price", item.salePrice);
      xml += tag("g:brand", item.brand);
      xml += tag("g:gtin", item.gtin);
      xml += tag("g:mpn", item.mpn);
      xml += tag("g:condition", item.condition);
      xml += tag("g:product_type", item.productType);
      xml += tag("g:google_product_category", item.googleProductCategory);
      if (!item.gtin && !item.mpn) xml += tag("g:identifier_exists", "no");
      xml += "    </item>\n";
      return xml;
    })
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n` +
    `  <channel>\n` +
    `    <title>${escapeXml(input.shopName)}</title>\n` +
    `    <link>${escapeXml(input.baseUrl)}</link>\n` +
    `    <description>${escapeXml(`Produktdatenfeed ${input.shopName}`)}</description>\n` +
    entries +
    `  </channel>\n` +
    `</rss>\n`
  );
}

const CSV_COLUMNS: { header: string; value: (item: FeedItem) => string }[] = [
  { header: "id", value: (i) => i.id },
  { header: "item_group_id", value: (i) => i.itemGroupId },
  { header: "title", value: (i) => i.title },
  { header: "description", value: (i) => i.description },
  { header: "link", value: (i) => i.link },
  { header: "image_link", value: (i) => i.imageLink ?? "" },
  { header: "additional_image_link", value: (i) => i.additionalImageLinks.join(",") },
  { header: "availability", value: (i) => i.availability },
  { header: "quantity", value: (i) => (i.quantity === null ? "" : String(i.quantity)) },
  { header: "price", value: (i) => i.price ?? "" },
  { header: "sale_price", value: (i) => i.salePrice ?? "" },
  { header: "brand", value: (i) => i.brand ?? "" },
  { header: "gtin", value: (i) => i.gtin ?? "" },
  { header: "mpn", value: (i) => i.mpn ?? "" },
  { header: "condition", value: (i) => i.condition },
  { header: "product_type", value: (i) => i.productType ?? "" },
  { header: "google_product_category", value: (i) => i.googleProductCategory ?? "" },
  { header: "identifier_exists", value: (i) => (!i.gtin && !i.mpn ? "no" : "") },
];

const csvCell = (value: string) => {
  const clean = value.replace(/\r?\n/g, " ");
  return /[",;]/.test(clean) ? `"${clean.replace(/"/g, '""')}"` : clean;
};

export function renderGoogleCsv(items: FeedItem[]): string {
  const lines = [CSV_COLUMNS.map((c) => c.header).join(",")];
  for (const item of items) lines.push(CSV_COLUMNS.map((c) => csvCell(c.value(item))).join(","));
  return `${lines.join("\n")}\n`;
}

/** Vollständige Feed-Antwort für den öffentlichen Endpunkt. */
export async function renderFeedResponse(
  feed: FeedSummary,
  requestOrigin: string,
): Promise<Response> {
  const { items, shopName, baseUrl } = await collectFeedItems(feed, requestOrigin);
  await markDownloaded(feed.id, items.length);
  const isCsv = feed.format === "google_shopping_csv";
  const body = isCsv ? renderGoogleCsv(items) : renderGoogleXml({ shopName, baseUrl, items });
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": isCsv ? "text/csv; charset=utf-8" : "application/xml; charset=utf-8",
      "cache-control": "public, max-age=900",
      "x-feed-items": String(items.length),
      "content-disposition": `inline; filename="produkte.${isCsv ? "csv" : "xml"}"`,
    },
  });
}
