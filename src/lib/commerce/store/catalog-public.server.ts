/**
 * Public catalog reads for the Store API.
 * Only active, non-archived products of the key's shop are visible, and every
 * returned field passes through an explicit allowlist mapper.
 */
import { getAdmin } from "../core.server";
import { resolveFromDatabase } from "../pricing.server";
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
    if (!cat) return { data: [], pagination: { page: input.page, pageSize: input.pageSize, total: 0, hasMore: false } };
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
    if (!col) return { data: [], pagination: { page: input.page, pageSize: input.pageSize, total: 0, hasMore: false } };
    const { data: links } = await admin
      .from("product_collections")
      .select("product_id")
      .eq("collection_id", (col as Row)["id"] as string);
    const ids = ((links ?? []) as Row[]).map((l) => l["product_id"] as string);
    productIdFilter = productIdFilter ? productIdFilter.filter((id) => ids.includes(id)) : ids;
  }
  if (productIdFilter && productIdFilter.length === 0)
    return { data: [], pagination: { page: input.page, pageSize: input.pageSize, total: 0, hasMore: false } };

  let query = admin
    .from("products")
    .select("id, handle, name, subtitle, status, archived_at, created_at, featured", { count: "exact" })
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
  const summaries = await Promise.all(
    rows.map((r) => summarizeProduct(r, input.organizationId, input.shopId)),
  );
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

async function primaryImage(productId: string): Promise<StoreImage | null> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("product_media")
    .select("position, media_assets(storage_path, alt_text)")
    .eq("product_id", productId)
    .order("position", { ascending: true })
    .limit(1);
  const first = ((data ?? []) as unknown as {
    position: number;
    media_assets: { storage_path: string; alt_text: string | null } | null;
  }[])[0];
  if (!first?.media_assets) return null;
  const signed = await signPaths([first.media_assets.storage_path]);
  const url = signed.get(first.media_assets.storage_path);
  return url ? { url, alt: first.media_assets.alt_text, position: first.position } : null;
}

async function summarizeProduct(
  row: Row,
  organizationId: string,
  shopId: string,
): Promise<StoreProductSummary> {
  const productId = row["id"] as string;
  const taxIncluded = await shopTaxIncluded(shopId);
  const [image, price, availability] = await Promise.all([
    primaryImage(productId),
    priceFor({ organizationId, shopId, productId, variantId: null, taxIncluded }),
    productAvailability(organizationId, shopId, productId),
  ]);
  return {
    id: productId,
    handle: row["handle"] as string,
    title: row["name"] as string,
    subtitle: str(row["subtitle"]),
    image,
    price,
    availability,
  };
}

async function productAvailability(organizationId: string, shopId: string, productId: string) {
  const admin = await getAdmin();
  const { data } = await admin
    .from("product_variants")
    .select("id")
    .eq("product_id", productId)
    .eq("status", "active");
  const variants = ((data ?? []) as Row[]).map((v) => v["id"] as string);
  let total = 0;
  for (const variantId of variants) {
    try {
      const availability = await getAvailability(organizationId, shopId, variantId);
      total += Number((availability as { available?: number }).available ?? 0);
    } catch {
      /* variant without inventory item counts as 0 */
    }
  }
  return availabilityFrom(total);
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

  const [{ data: mediaRows }, { data: optionRows }, { data: variantRows }, { data: catRows }, { data: colRows }] =
    await Promise.all([
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
      admin.from("product_categories").select("categories(id, handle, name)").eq("product_id", productId),
      admin.from("product_collections").select("collections(id, handle, name)").eq("product_id", productId),
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
    ((variantRows ?? []) as unknown as {
      id: string;
      title: string;
      sku: string | null;
      variant_option_values: { option_id: string; option_value_id: string }[];
    }[]).map(async (v) => {
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

  const cheapest = variants
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
  return Promise.all(((data ?? []) as Row[]).map((r) => summarizeProduct(r, input.organizationId, input.shopId)));
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
