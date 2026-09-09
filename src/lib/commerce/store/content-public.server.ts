/**
 * Öffentliche Storefront-Inhalte: pflegbare Startseiten-Blöcke und Rechtstexte.
 * Nur veröffentlichte Datensätze des Shops verlassen den Server, jedes Feld
 * geht über eine ausdrückliche Allowlist.
 */
import { getAdmin } from "../core.server";
import { notFound } from "./gateway.server";

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

export type StoreContentBlock = {
  id: string;
  section: string;
  position: number;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
};

export type StoreContentPage = {
  handle: string;
  title: string;
  excerpt: string | null;
  body: string;
  updatedAt: string | null;
};

export async function listContentBlocks(input: {
  organizationId: string;
  shopId: string;
  section?: string | null;
}): Promise<StoreContentBlock[]> {
  const admin = await getAdmin();
  let query = admin
    .from("storefront_blocks")
    .select("id, section, position, title, subtitle, body, image_url, link_url, link_label")
    .eq("organization_id", input.organizationId)
    .eq("shop_id", input.shopId)
    .eq("published", true)
    .order("section", { ascending: true })
    .order("position", { ascending: true });
  if (input.section) query = query.eq("section", input.section.slice(0, 60));
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((row) => ({
    id: row["id"] as string,
    section: row["section"] as string,
    position: Number(row["position"] ?? 0),
    title: str(row["title"]),
    subtitle: str(row["subtitle"]),
    body: str(row["body"]),
    imageUrl: str(row["image_url"]),
    linkUrl: str(row["link_url"]),
    linkLabel: str(row["link_label"]),
  }));
}

export async function getContentPage(input: {
  organizationId: string;
  shopId: string;
  handle: string;
}): Promise<StoreContentPage> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("storefront_pages")
    .select("handle, title, excerpt, body, updated_at")
    .eq("organization_id", input.organizationId)
    .eq("shop_id", input.shopId)
    .eq("published", true)
    .eq("handle", input.handle.slice(0, 80))
    .maybeSingle();
  const row = data as Row | null;
  if (!row) throw notFound("Seite nicht gefunden.");
  return {
    handle: row["handle"] as string,
    title: row["title"] as string,
    excerpt: str(row["excerpt"]),
    body: String(row["body"] ?? ""),
    updatedAt: str(row["updated_at"]),
  };
}

export async function listContentPages(input: {
  organizationId: string;
  shopId: string;
}): Promise<{ handle: string; title: string; excerpt: string | null }[]> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("storefront_pages")
    .select("handle, title, excerpt")
    .eq("organization_id", input.organizationId)
    .eq("shop_id", input.shopId)
    .eq("published", true)
    .order("title", { ascending: true });
  return ((data ?? []) as Row[]).map((row) => ({
    handle: row["handle"] as string,
    title: row["title"] as string,
    excerpt: str(row["excerpt"]),
  }));
}
