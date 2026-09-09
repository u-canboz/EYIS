/** Backoffice-API für Storefront-Inhalte, Rechtstexte und Suchbegriffe. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AdminBlock, AdminPage, AdminSynonym } from "./content-admin.server";

type Scope = { organizationId: string; shopId: string };

async function guard(context: { supabase: unknown; userId: string }, organizationId: string) {
  const { assertPermission } = await import("../core.server");
  await assertPermission(context.supabase, context.userId, organizationId, "settings.manage");
}

export const listStorefrontContentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope) => data)
  .handler(
    async ({
      data,
      context,
    }): Promise<{ blocks: AdminBlock[]; pages: AdminPage[]; synonyms: AdminSynonym[] }> => {
      await guard(context, data.organizationId);
      const api = await import("./content-admin.server");
      const [blocks, pages, synonyms] = await Promise.all([
        api.listBlocks(data.organizationId, data.shopId),
        api.listPages(data.organizationId, data.shopId),
        api.listSynonyms(data.organizationId, data.shopId),
      ]);
      return { blocks, pages, synonyms };
    },
  );

export const saveStorefrontBlockFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Scope & {
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
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    await guard(context, data.organizationId);
    const { saveBlock } = await import("./content-admin.server");
    return saveBlock(data);
  });

export const deleteStorefrontBlockFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope & { id: string }) => data)
  .handler(async ({ data, context }) => {
    await guard(context, data.organizationId);
    const { deleteBlock } = await import("./content-admin.server");
    return deleteBlock(data);
  });

export const saveStorefrontPageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Scope & {
        id?: string | null;
        handle: string;
        title: string;
        excerpt: string | null;
        body: string;
        published: boolean;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    await guard(context, data.organizationId);
    const { savePage } = await import("./content-admin.server");
    return savePage(data);
  });

export const deleteStorefrontPageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope & { id: string }) => data)
  .handler(async ({ data, context }) => {
    await guard(context, data.organizationId);
    const { deletePage } = await import("./content-admin.server");
    return deletePage(data);
  });

export const saveSearchSynonymFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope & { term: string; synonyms: string[] }) => data)
  .handler(async ({ data, context }) => {
    await guard(context, data.organizationId);
    const { saveSynonym } = await import("./content-admin.server");
    return saveSynonym(data);
  });

export const deleteSearchSynonymFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope & { id: string }) => data)
  .handler(async ({ data, context }) => {
    await guard(context, data.organizationId);
    const { deleteSynonym } = await import("./content-admin.server");
    return deleteSynonym(data);
  });
