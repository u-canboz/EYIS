/**
 * Public catalog reads for the Store API.
 * Only active, non-archived products of the key's shop are visible, and every
 * returned field passes through an explicit allowlist mapper.
 */
import { getAdmin } from "../core.server";
import { loadSnapshotsForProducts, resolveFromDatabase } from "../pricing.server";
import { resolvePricing } from "../pricing-engine";
import { getAvailability } from "../cart.server";
import { availabilityFrom } from "./mappers.server";
import { notFound } from "./gateway.server";
import type {
  StoreCategory,
  StoreCollection,
  StoreImage,
  StoreList,
  StorePrice,
  StoreProduct,
  StoreProductSummary,
} from "@/lib/store-sdk/types";

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return map;
  const admin = await getAdmin();
  const { data } = await admin.storage.from("media").createSignedUrls(unique, 3600);
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) map.set(entry.path, entry.signedUrl);
  }
  return map;
}

async function priceFor(args: {
  organizationId: string;
  shopId: string;
  productId: string;
  variantId: string | null;
  taxIncluded: boolean;
}): Promise<StorePrice | null> {
  const admin = await getAdmin();
  try {
    const result = await resolveFromDatabase(admin as never, args.organizationId, {
      shopId: args.shopId,
      productId: args.productId,
      variantId: args.variantId,
      quantity: 1,
      currencyCode: undefined,
      customerGroupId: null,
      promotionCodes: [],
    } as never);
    if (!result || typeof result.resolvedUnitAmount !== "number") return null;
    return {
      currencyCode: result.currencyCode,
      unitAmountMinor: result.resolvedUnitAmount,
      compareAtAmountMinor:
        result.compareAtAmount && result.compareAtAmount > result.resolvedUnitAmount
          ? result.compareAtAmount
          : null,
      taxIncluded: args.taxIncluded,
    };
  } catch {
    return null;
  }
}

async function shopTaxIncluded(shopId: string): Promise<boolean> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("tax_settings")
    .select("calculation_mode")
    .eq("shop_id", shopId)
    .maybeSingle();
  return ((data as Row | null)?.["calculation_mode"] ?? "gross") === "gross";
}

export async function listProducts(input: {
  organizationId: string;
  shopId: string;
  page: number;
  pageSize: number;
  categoryHandle?: string | null;
  collectionHandle?: string | null;
  sort?: string | null;
}): Promise<StoreList<StoreProductSummary>> {
  const admin = await getAdmin();
  const from = (input.page - 1) * input.pageSize;

  let productIdFilter: string[] | null = null;
  if (input.categoryHandle) {
    const { data: cat } = await admin
      .from("categories")
      .select("id")
      .eq("shop_id", input.shopId)
      .eq("handle", input.categoryHandle)
      .maybeSingle();
    if (!cat)
      return {
        data: [],
        pagination: { page: input.page, pageSize: input.pageSize, total: 0, hasMore: false },
      };
    const { data: links } = await admin
      .from("product_categories")
      .select("product_id")
      .eq("category_id", (cat as Row)["id"] as string);
    productIdFilter = ((links ?? []) as Row[]).map((l) => l["product_id"] as string);
  }
  if (input.collectionHandle) {
    const { data: col } = await admin
      .from("collections")
      .select("id")
      .eq("shop_id", input.shopId)
      .eq("handle", input.collectionHandle)
      .maybeSingle();
    if (!col)
      return {
        data: [],
        pagination: { page: input.page, pageSize: input.pageSize, total: 0, hasMore: false },
      };
    const { data: links } = await admin
      .from("product_collections")
      .select("product_id")
      .eq("collection_id", (col as Row)["id"] as string);
    const ids = ((links ?? []) as Row[]).map((l) => l["product_id"] as string);
    productIdFilter = productIdFilter ? productIdFilter.filter((id) => ids.includes(id)) : ids;
  }
  if (productIdFilter && productIdFilter.length === 0)
    return {
      data: [],
      pagination: { page: input.page, pageSize: input.pageSize, total: 0, hasMore: false },
    };

  let query = admin
    .from("products")
    .select("id, handle, name, subtitle, status, archived_at, created_at, featured", {
      count: "exact",
    })
    .eq("shop_id", input.shopId)
    .eq("organization_id", input.organizationId)
    .eq("status", "active")
    .is("archived_at", null);
  if (productIdFilter) query = query.in("id", productIdFilter);
  query =
    input.sort === "title_asc"
      ? query.order("name", { ascending: true })
      : input.sort === "newest"
        ? query.order("created_at", { ascending: false })
        : query.order("featured", { ascending: false }).order("name", { ascending: true });

  const { data, count, error } = await query.range(from, from + input.pageSize - 1);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  const summaries = await summarizeProducts(rows, input.organizationId, input.shopId);
  const total = count ?? summaries.length;
  return {
    data: summaries,
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total,
      hasMore: from + summaries.length < total,
    },
  };
}

/**
 * Zusammenfassungen für eine Produktliste. Gebündelte Zusatzdaten: eine Abfrage
 * je Domäne für die ganze Seite statt je Produkt (N+1). Ergebnis ist identisch.
 */
async function summarizeProducts(
  rows: Row[],
  organizationId: string,
  shopId: string,
): Promise<StoreProductSummary[]> {
  const productIds = rows.map((r) => r["id"] as string);
  const admin = await getAdmin();
  const { data: shop } = await admin
    .from("shops")
    .select("currency")
    .eq("id", shopId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  const currency = ((shop as Row | null)?.["currency"] as string) ?? "EUR";
  const [taxIncluded, imageMap, availabilityMap, snapshots, variantFloor] = await Promise.all([
    shopTaxIncluded(shopId),
    primaryImages(productIds),
    productAvailabilities(organizationId, shopId, productIds),
    loadSnapshotsForProducts(admin as never, { organizationId, shopId, productIds }, currency),
    lowestVariantPrices(organizationId, productIds),
  ]);
  const now = new Date().toISOString();
  return rows.map((row) => {
    const productId = row["id"] as string;
    let price: StorePrice | null = null;
    const snapshot = snapshots.get(productId);
    if (snapshot) {
      try {
        const result = resolvePricing(snapshot, {
          shopId,
          productId,
          variantId: null,
          quantity: 1,
          currencyCode: currency,
          customerGroupId: null,
          promotionCodes: [],
          now,
        } as never);
        if (result && typeof result.resolvedUnitAmount === "number") {
          price = {
            currencyCode: result.currencyCode,
            unitAmountMinor: result.resolvedUnitAmount,
            compareAtAmountMinor:
              result.compareAtAmount && result.compareAtAmount > result.resolvedUnitAmount
                ? result.compareAtAmount
                : null,
            taxIncluded,
          };
        }
      } catch {
        price = null;
      }
    }
    // Preise liegen in diesem Datenmodell in der Regel an der Variante. Ohne
    // Produktpreis zeigt die Liste den günstigsten aktiven Variantenpreis.
    const floor = variantFloor.get(productId);
    if ((!price || price.unitAmountMinor <= 0) && floor) {
      price = {
        currencyCode: floor.currencyCode,
        unitAmountMinor: floor.amountMinor,
        compareAtAmountMinor: null,
        taxIncluded,
      };
    }

    return {
      id: productId,
      handle: row["handle"] as string,
      title: row["name"] as string,
      subtitle: str(row["subtitle"]),
      image: imageMap.get(productId) ?? null,
      price,
      availability: availabilityMap.get(productId) ?? availabilityFrom(0),
    } satisfies StoreProductSummary;
  });
}

/** Günstigster aktiver Basispreis je Produkt über dessen Varianten (drei Abfragen). */
async function lowestVariantPrices(
  organizationId: string,
  productIds: string[],
): Promise<Map<string, { amountMinor: number; currencyCode: string }>> {
  const out = new Map<string, { amountMinor: number; currencyCode: string }>();
  if (!productIds.length) return out;
  const admin = await getAdmin();
  const { data: variants } = await admin
    .from("product_variants")
    .select("id, product_id")
    .in("product_id", productIds)
    .eq("status", "active");
  const variantRows = (variants ?? []) as Row[];
  if (!variantRows.length) return out;
  const { data: sets } = await admin
    .from("price_sets")
    .select("id, variant_id")
    .eq("organization_id", organizationId)
    .in(
      "variant_id",
      variantRows.map((v) => v["id"] as string),
    );
  const setRows = (sets ?? []) as Row[];
  if (!setRows.length) return out;
  const { data: prices } = await admin
    .from("prices")
    .select("price_set_id, amount_minor, currency_code, type")
    .in(
      "price_set_id",
      setRows.map((s) => s["id"] as string),
    )
    .eq("type", "base");
  const productByVariant = new Map<string, string>();
  for (const v of variantRows) productByVariant.set(v["id"] as string, v["product_id"] as string);
  const productBySet = new Map<string, string>();
  for (const s of setRows) {
    const productId = productByVariant.get(s["variant_id"] as string);
    if (productId) productBySet.set(s["id"] as string, productId);
  }
  for (const row of (prices ?? []) as Row[]) {
    const productId = productBySet.get(row["price_set_id"] as string);
    if (!productId) continue;
    const amountMinor = Number(row["amount_minor"]);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) continue;
    const currencyCode = String(row["currency_code"] ?? "EUR");
    const current = out.get(productId);
    if (!current || amountMinor < current.amountMinor)
      out.set(productId, { amountMinor, currencyCode });
  }
  return out;
}

/** Erstes Bild je Produkt — eine Abfrage und ein Signieraufruf für alle Produkte. */
async function primaryImages(productIds: string[]): Promise<Map<string, StoreImage>> {
  const map = new Map<string, StoreImage>();
  if (!productIds.length) return map;
  const admin = await getAdmin();
  const { data } = await admin
    .from("product_media")
    .select("product_id, position, media_assets(storage_path, alt_text)")
    .in("product_id", productIds)
    .order("position", { ascending: true });
  const rows = (data ?? []) as unknown as {
    product_id: string;
    position: number;
    media_assets: { storage_path: string; alt_text: string | null } | null;
  }[];
  const first = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!row.media_assets) continue;
    if (!first.has(row.product_id)) first.set(row.product_id, row);
  }
  const signed = await signPaths([...first.values()].map((r) => r.media_assets!.storage_path));
  for (const [productId, row] of first) {
    const url = signed.get(row.media_assets!.storage_path);
    if (url) map.set(productId, { url, alt: row.media_assets!.alt_text, position: row.position });
  }
  return map;
}

/** Verfügbarkeit je Produkt — Varianten in einer Abfrage, Bestände parallel. */
async function productAvailabilities(organizationId: string, shopId: string, productIds: string[]) {
  const map = new Map<string, ReturnType<typeof availabilityFrom>>();
  if (!productIds.length) return map;
  const admin = await getAdmin();
  const { data } = await admin
    .from("product_variants")
    .select("id, product_id")
    .in("product_id", productIds)
    .eq("status", "active");
  const variants = (data ?? []) as Row[];
  const totals = new Map<string, number>(productIds.map((id) => [id, 0]));
  await Promise.all(
    variants.map(async (v) => {
      try {
        const availability = await getAvailability(organizationId, shopId, v["id"] as string);
        const productId = v["product_id"] as string;
        totals.set(
          productId,
          (totals.get(productId) ?? 0) +
            Number((availability as { available?: number }).available ?? 0),
        );
      } catch {
        /* Variante ohne Bestandsdatensatz zählt als 0 */
      }
    }),
  );
  for (const [productId, total] of totals) map.set(productId, availabilityFrom(total));
  return map;
}

export async function getProduct(input: {
  organizationId: string;
  shopId: string;
  handleOrId: string;
}): Promise<StoreProduct> {
  const admin = await getAdmin();
  const isUuid = /^[0-9a-f-]{36}$/i.test(input.handleOrId);
  const { data } = await admin
    .from("products")
    .select(
      "id, handle, name, subtitle, description, vendor, product_type, seo_title, seo_description, status, archived_at",
    )
    .eq("shop_id", input.shopId)
    .eq("organization_id", input.organizationId)
    .eq("status", "active")
    .is("archived_at", null)
    .eq(isUuid ? "id" : "handle", input.handleOrId)
    .maybeSingle();
  const product = data as Row | null;
  if (!product) throw notFound("Produkt nicht gefunden.");
  const productId = product["id"] as string;
  const taxIncluded = await shopTaxIncluded(input.shopId);

  const [
    { data: mediaRows },
    { data: optionRows },
    { data: variantRows },
    { data: catRows },
    { data: colRows },
  ] = await Promise.all([
    admin
      .from("product_media")
      .select("position, media_assets(storage_path, alt_text)")
      .eq("product_id", productId)
      .order("position", { ascending: true }),
    admin
      .from("product_options")
      .select("id, key, name, position, product_option_values(value, label, position)")
      .eq("product_id", productId)
      .order("position", { ascending: true }),
    admin
      .from("product_variants")
      .select("id, title, sku, position, status, variant_option_values(option_id, option_value_id)")
      .eq("product_id", productId)
      .eq("status", "active")
      .order("position", { ascending: true }),
    admin
      .from("product_categories")
      .select("categories(id, handle, name)")
      .eq("product_id", productId),
    admin
      .from("product_collections")
      .select("collections(id, handle, name)")
      .eq("product_id", productId),
  ]);

  const mediaList = (mediaRows ?? []) as unknown as {
    position: number;
    media_assets: { storage_path: string; alt_text: string | null } | null;
  }[];
  const signed = await signPaths(mediaList.map((m) => m.media_assets?.storage_path ?? ""));
  const images: StoreImage[] = mediaList
    .filter((m) => m.media_assets && signed.has(m.media_assets.storage_path))
    .map((m) => ({
      url: signed.get(m.media_assets!.storage_path)!,
      alt: m.media_assets!.alt_text,
      position: m.position,
    }));

  const optionList = (optionRows ?? []) as unknown as {
    id: string;
    key: string;
    name: string;
    product_option_values: { value: string; label: string; position: number }[];
  }[];
  const optionValueLabel = new Map<string, { key: string; value: string }>();

  const variants = await Promise.all(
    (
      (variantRows ?? []) as unknown as {
        id: string;
        title: string;
        sku: string | null;
        variant_option_values: { option_id: string; option_value_id: string }[];
      }[]
    ).map(async (v) => {
      const [price, availability] = await Promise.all([
        priceFor({
          organizationId: input.organizationId,
          shopId: input.shopId,
          productId,
          variantId: v.id,
          taxIncluded,
        }),
        getAvailability(input.organizationId, input.shopId, v.id).catch(() => ({ available: 0 })),
      ]);
      const available = Number((availability as { available?: number }).available ?? 0);
      return {
        id: v.id,
        title: v.title,
        sku: v.sku,
        options: v.variant_option_values
          .map((ov) => optionValueLabel.get(ov.option_value_id))
          .filter((o): o is { key: string; value: string } => !!o),
        price,
        availability: availabilityFrom(available),
        availableQuantity: available,
      };
    }),
  );

  const categories = ((catRows ?? []) as unknown as { categories: StoreCategoryRef | null }[])
    .map((c) => c.categories)
    .filter((c): c is StoreCategoryRef => !!c);
  const collections = ((colRows ?? []) as unknown as { collections: StoreCategoryRef | null }[])
    .map((c) => c.collections)
    .filter((c): c is StoreCategoryRef => !!c);

  const cheapest =
    variants
      .map((v) => v.price)
      .filter((p): p is StorePrice => !!p)
      .sort((a, b) => a.unitAmountMinor - b.unitAmountMinor)[0] ?? null;
  const bestAvailability = variants.some((v) => v.availability === "in_stock")
    ? "in_stock"
    : variants.some((v) => v.availability === "low_stock")
      ? "low_stock"
      : "out_of_stock";

  return {
    id: productId,
    handle: product["handle"] as string,
    title: product["name"] as string,
    subtitle: str(product["subtitle"]),
    description: str(product["description"]),
    vendor: str(product["vendor"]),
    productType: str(product["product_type"]),
    image: images[0] ?? null,
    images,
    price: cheapest,
    availability: bestAvailability,
    options: optionList.map((o) => ({
      key: o.key,
      name: o.name,
      values: (o.product_option_values ?? [])
        .sort((a, b) => a.position - b.position)
        .map((val) => val.label || val.value),
    })),
    variants,
    categories: categories.map((c) => ({ id: c.id, handle: c.handle, name: c.name })),
    collections: collections.map((c) => ({ id: c.id, handle: c.handle, name: c.name })),
    seo: { title: str(product["seo_title"]), description: str(product["seo_description"]) },
  };
}

type StoreCategoryRef = { id: string; handle: string; name: string };

export async function searchProducts(input: {
  organizationId: string;
  shopId: string;
  term: string;
  limit: number;
}): Promise<StoreProductSummary[]> {
  const admin = await getAdmin();
  const term = input.term.trim().slice(0, 80);
  if (term.length < 2) return [];
  const { data } = await admin
    .from("products")
    .select("id, handle, name, subtitle, featured")
    .eq("shop_id", input.shopId)
    .eq("organization_id", input.organizationId)
    .eq("status", "active")
    .is("archived_at", null)
    .or(`name.ilike.%${term.replace(/[%,]/g, "")}%,subtitle.ilike.%${term.replace(/[%,]/g, "")}%`)
    .limit(input.limit);
  return summarizeProducts((data ?? []) as Row[], input.organizationId, input.shopId);
}

export async function listCategories(shopId: string): Promise<StoreCategory[]> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("categories")
    .select("id, handle, name, description, parent_id, position")
    .eq("shop_id", shopId)
    .eq("status", "active")
    .order("position", { ascending: true });
  return ((data ?? []) as Row[]).map((r) => ({
    id: r["id"] as string,
    handle: r["handle"] as string,
    name: r["name"] as string,
    description: str(r["description"]),
    parentId: str(r["parent_id"]),
    position: Number(r["position"] ?? 0),
  }));
}

export async function listCollections(shopId: string): Promise<StoreCollection[]> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("collections")
    .select("id, handle, name, description")
    .eq("shop_id", shopId)
    .eq("status", "active")
    .order("name", { ascending: true });
  return ((data ?? []) as Row[]).map((r) => ({
    id: r["id"] as string,
    handle: r["handle"] as string,
    name: r["name"] as string,
    description: str(r["description"]),
  }));
}
