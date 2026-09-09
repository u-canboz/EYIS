/** Verwaltung der pflegbaren Storefront-Inhalte, Rechtstexte und Suchbegriffe. */
import { getAdmin } from "../core.server";

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

export type AdminBlock = {
  id: string;
  section: string;
  position: number;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  published: boolean;
};

export type AdminPage = {
  id: string;
  handle: string;
  title: string;
  excerpt: string | null;
  body: string;
  published: boolean;
  updatedAt: string | null;
};

export type AdminSynonym = {
  id: string;
  term: string;
  synonyms: string[];
};

const clean = (value: string | null | undefined, max = 400) =>
  value === null || value === undefined || value.trim() === "" ? null : value.trim().slice(0, max);

export async function listBlocks(organizationId: string, shopId: string): Promise<AdminBlock[]> {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("storefront_blocks")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .order("section", { ascending: true })
    .order("position", { ascending: true });
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
    published: Boolean(row["published"]),
  }));
}

export async function saveBlock(input: {
  organizationId: string;
  shopId: string;
  id?: string | null;
  section: string;
  position: number;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  published: boolean;
}): Promise<{ id: string }> {
  const admin = await getAdmin();
  const payload = {
    organization_id: input.organizationId,
    shop_id: input.shopId,
    section: input.section.trim().slice(0, 60) || "home",
    position: Number.isFinite(input.position) ? Math.max(0, Math.floor(input.position)) : 0,
    title: clean(input.title, 160),
    subtitle: clean(input.subtitle, 240),
    body: clean(input.body, 4000),
    image_url: clean(input.imageUrl, 600),
    link_url: clean(input.linkUrl, 600),
    link_label: clean(input.linkLabel, 80),
    published: input.published,
  };
  if (input.id) {
    const { error } = await admin
      .from("storefront_blocks")
      .update(payload as never)
      .eq("id", input.id)
      .eq("organization_id", input.organizationId)
      .eq("shop_id", input.shopId);
    if (error) throw new Error(error.message);
    return { id: input.id };
  }
  const { data, error } = await admin
    .from("storefront_blocks")
    .insert(payload as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: (data as Row)["id"] as string };
}

export async function deleteBlock(input: {
  organizationId: string;
  shopId: string;
  id: string;
}): Promise<{ ok: true }> {
  const admin = await getAdmin();
  const { error } = await admin
    .from("storefront_blocks")
    .delete()
    .eq("id", input.id)
    .eq("organization_id", input.organizationId)
    .eq("shop_id", input.shopId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function listPages(organizationId: string, shopId: string): Promise<AdminPage[]> {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("storefront_pages")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .order("title", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((row) => ({
    id: row["id"] as string,
    handle: row["handle"] as string,
    title: row["title"] as string,
    excerpt: str(row["excerpt"]),
    body: String(row["body"] ?? ""),
    published: Boolean(row["published"]),
    updatedAt: str(row["updated_at"]),
  }));
}

export async function savePage(input: {
  organizationId: string;
  shopId: string;
  id?: string | null;
  handle: string;
  title: string;
  excerpt: string | null;
  body: string;
  published: boolean;
}): Promise<{ id: string }> {
  const admin = await getAdmin();
  const handle =
    input.handle
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "seite";
  const payload = {
    organization_id: input.organizationId,
    shop_id: input.shopId,
    handle,
    title: input.title.trim().slice(0, 160) || handle,
    excerpt: clean(input.excerpt, 400),
    body: (input.body ?? "").slice(0, 60000),
    published: input.published,
  };
  if (input.id) {
    const { error } = await admin
      .from("storefront_pages")
      .update(payload as never)
      .eq("id", input.id)
      .eq("organization_id", input.organizationId)
      .eq("shop_id", input.shopId);
    if (error) throw new Error(error.message);
    return { id: input.id };
  }
  const { data, error } = await admin
    .from("storefront_pages")
    .insert(payload as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: (data as Row)["id"] as string };
}

export async function deletePage(input: {
  organizationId: string;
  shopId: string;
  id: string;
}): Promise<{ ok: true }> {
  const admin = await getAdmin();
  const { error } = await admin
    .from("storefront_pages")
    .delete()
    .eq("id", input.id)
    .eq("organization_id", input.organizationId)
    .eq("shop_id", input.shopId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function listSynonyms(
  organizationId: string,
  shopId: string,
): Promise<AdminSynonym[]> {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("search_synonyms")
    .select("id, term, synonyms")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .order("term", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((row) => ({
    id: row["id"] as string,
    term: row["term"] as string,
    synonyms: ((row["synonyms"] as string[] | null) ?? []).map(String),
  }));
}

export async function saveSynonym(input: {
  organizationId: string;
  shopId: string;
  term: string;
  synonyms: string[];
}): Promise<{ ok: true }> {
  const admin = await getAdmin();
  const term = input.term.trim().toLowerCase().slice(0, 60);
  if (term.length < 2) throw new Error("Der Suchbegriff ist zu kurz.");
  const synonyms = [
    ...new Set(
      input.synonyms
        .map((s) => s.trim().toLowerCase().slice(0, 60))
        .filter((s) => s.length >= 2),
    ),
  ].slice(0, 25);
  const { error } = await admin.from("search_synonyms").upsert(
    {
      organization_id: input.organizationId,
      shop_id: input.shopId,
      term,
      synonyms,
    } as never,
    { onConflict: "shop_id,term" },
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteSynonym(input: {
  organizationId: string;
  shopId: string;
  id: string;
}): Promise<{ ok: true }> {
  const admin = await getAdmin();
  const { error } = await admin
    .from("search_synonyms")
    .delete()
    .eq("id", input.id)
    .eq("organization_id", input.organizationId)
    .eq("shop_id", input.shopId);
  if (error) throw new Error(error.message);
  return { ok: true };
}
