/**
 * Backoffice-Pflege der Storefront-Inhalte: Startseiten-Blöcke, Rechtstexte,
 * Suchbegriffe und Storefront-Branding. Alle Abfragen laufen über den
 * angemeldeten Nutzer (RLS) und filtern zusätzlich nach Organisation und Shop.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StorefrontBlock = {
  id: string;
  section: string;
  position: number;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
  link_label: string | null;
  published: boolean;
};

export type StorefrontPage = {
  id: string;
  handle: string;
  title: string;
  excerpt: string | null;
  body: string;
  published: boolean;
  updated_at: string | null;
};

export type SearchSynonym = {
  id: string;
  term: string;
  synonyms: string[];
};

export type StorefrontBranding = {
  shop_name: string | null;
  claim: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  color_background: string | null;
  color_foreground: string | null;
  color_surface: string | null;
  color_border: string | null;
  color_accent: string | null;
  color_accent_foreground: string | null;
  color_deep: string | null;
  font_display: string | null;
  font_body: string | null;
};

type Scope = { organizationId: string; shopId: string };

const handleOf = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

const text = (value: string | null | undefined) => {
  const trimmed = (value ?? "").trim();
  return trimmed.length ? trimmed : null;
};

/** Alle pflegbaren Storefront-Inhalte eines Shops in einem Aufruf. */
export const listStorefrontContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope) => data)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const [blocks, pages, synonyms, branding] = await Promise.all([
      supabase
        .from("storefront_blocks")
        .select("id, section, position, title, subtitle, body, image_url, link_url, link_label, published")
        .eq("organization_id", data.organizationId)
        .eq("shop_id", data.shopId)
        .order("section", { ascending: true })
        .order("position", { ascending: true }),
      supabase
        .from("storefront_pages")
        .select("id, handle, title, excerpt, body, published, updated_at")
        .eq("organization_id", data.organizationId)
        .eq("shop_id", data.shopId)
        .order("title", { ascending: true }),
      supabase
        .from("search_synonyms")
        .select("id, term, synonyms")
        .eq("organization_id", data.organizationId)
        .eq("shop_id", data.shopId)
        .order("term", { ascending: true }),
      supabase
        .from("storefront_branding")
        .select(
          "shop_name, claim, logo_url, favicon_url, color_background, color_foreground, color_surface, color_border, color_accent, color_accent_foreground, color_deep, font_display, font_body",
        )
        .eq("organization_id", data.organizationId)
        .eq("shop_id", data.shopId)
        .maybeSingle(),
    ]);
    for (const result of [blocks, pages, synonyms, branding]) {
      if (result.error) throw new Error(result.error.message);
    }
    return {
      blocks: (blocks.data ?? []) as StorefrontBlock[],
      pages: (pages.data ?? []) as StorefrontPage[],
      synonyms: (synonyms.data ?? []) as SearchSynonym[],
      branding: (branding.data ?? null) as StorefrontBranding | null,
    };
  });

/** Startseiten-Block anlegen oder ändern. */
export const saveStorefrontBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Scope & {
        id?: string | null;
        section: string;
        position: number;
        title?: string | null;
        subtitle?: string | null;
        body?: string | null;
        imageUrl?: string | null;
        linkUrl?: string | null;
        linkLabel?: string | null;
        published: boolean;
      },
    ) => {
      if (!data.section.trim()) throw new Error("Bitte einen Bereich angeben.");
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const row = {
      organization_id: data.organizationId,
      shop_id: data.shopId,
      section: data.section.trim().slice(0, 60),
      position: Number.isFinite(data.position) ? Math.max(0, Math.trunc(data.position)) : 0,
      title: text(data.title),
      subtitle: text(data.subtitle),
      body: text(data.body),
      image_url: text(data.imageUrl),
      link_url: text(data.linkUrl),
      link_label: text(data.linkLabel),
      published: data.published,
    };
    const query = data.id
      ? context.supabase
          .from("storefront_blocks")
          .update(row)
          .eq("id", data.id)
          .eq("organization_id", data.organizationId)
      : context.supabase.from("storefront_blocks").insert(row);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStorefrontBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("storefront_blocks")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Rechtstext oder Inhaltsseite anlegen bzw. ändern. */
export const saveStorefrontPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Scope & {
        id?: string | null;
        handle?: string | null;
        title: string;
        excerpt?: string | null;
        body: string;
        published: boolean;
      },
    ) => {
      if (!data.title.trim()) throw new Error("Bitte einen Titel angeben.");
      if (!data.body.trim()) throw new Error("Bitte einen Text angeben.");
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const handle = handleOf(text(data.handle) ?? data.title);
    if (!handle) throw new Error("Aus dem Titel lässt sich keine Adresse bilden.");
    const row = {
      organization_id: data.organizationId,
      shop_id: data.shopId,
      handle,
      title: data.title.trim(),
      excerpt: text(data.excerpt),
      body: data.body.trim(),
      published: data.published,
    };
    const query = data.id
      ? context.supabase
          .from("storefront_pages")
          .update(row)
          .eq("id", data.id)
          .eq("organization_id", data.organizationId)
      : context.supabase.from("storefront_pages").insert(row);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true, handle };
  });

export const deleteStorefrontPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("storefront_pages")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Suchbegriff mit Entsprechungen pflegen. */
export const saveSearchSynonym = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope & { id?: string | null; term: string; synonyms: string }) => {
    if (!data.term.trim()) throw new Error("Bitte einen Suchbegriff angeben.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const list = data.synonyms
      .split(/[,\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 50);
    if (!list.length) throw new Error("Bitte mindestens eine Entsprechung angeben.");
    const row = {
      organization_id: data.organizationId,
      shop_id: data.shopId,
      term: data.term.trim().toLowerCase().slice(0, 80),
      synonyms: list,
    };
    const query = data.id
      ? context.supabase
          .from("search_synonyms")
          .update(row)
          .eq("id", data.id)
          .eq("organization_id", data.organizationId)
      : context.supabase.from("search_synonyms").insert(row);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSearchSynonym = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("search_synonyms")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Storefront-Branding speichern (ein Datensatz je Shop). */
export const saveStorefrontBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope & StorefrontBranding) => data)
  .handler(async ({ data, context }) => {
    const row = {
      organization_id: data.organizationId,
      shop_id: data.shopId,
      shop_name: text(data.shop_name),
      claim: text(data.claim),
      logo_url: text(data.logo_url),
      favicon_url: text(data.favicon_url),
      color_background: text(data.color_background),
      color_foreground: text(data.color_foreground),
      color_surface: text(data.color_surface),
      color_border: text(data.color_border),
      color_accent: text(data.color_accent),
      color_accent_foreground: text(data.color_accent_foreground),
      color_deep: text(data.color_deep),
      font_display: text(data.font_display),
      font_body: text(data.font_body),
    };
    const { data: existing, error: readError } = await context.supabase
      .from("storefront_branding")
      .select("id")
      .eq("organization_id", data.organizationId)
      .eq("shop_id", data.shopId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    const query = existing
      ? context.supabase
          .from("storefront_branding")
          .update(row)
          .eq("id", (existing as { id: string }).id)
          .eq("organization_id", data.organizationId)
      : context.supabase.from("storefront_branding").insert(row);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });
