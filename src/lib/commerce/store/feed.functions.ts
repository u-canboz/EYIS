/** Backoffice-API für Produktdatenfeeds (Google Shopping). */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FeedFormat, FeedSummary } from "./feed.server";

type Scope = { organizationId: string; shopId: string };

export const listProductFeedsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope) => data)
  .handler(async ({ data, context }): Promise<FeedSummary[]> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "settings.manage",
    );
    const { listFeeds } = await import("./feed.server");
    return listFeeds(data.organizationId, data.shopId);
  });

export const createProductFeedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Scope & {
        name: string;
        format: FeedFormat;
        baseUrl: string | null;
        defaultBrand: string | null;
        includeOutOfStock: boolean;
      },
    ) => data,
  )
  .handler(async ({ data, context }): Promise<{ id: string; token: string }> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "settings.manage",
    );
    const { createFeed } = await import("./feed.server");
    return createFeed({ ...data, actorId: context.userId });
  });

export const updateProductFeedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      organizationId: string;
      feedId: string;
      name?: string;
      baseUrl?: string | null;
      defaultBrand?: string | null;
      includeOutOfStock?: boolean;
      status?: "active" | "revoked";
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "settings.manage",
    );
    const { updateFeed } = await import("./feed.server");
    return updateFeed(data);
  });

export const rotateProductFeedTokenFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; feedId: string }) => data)
  .handler(async ({ data, context }): Promise<{ token: string }> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "settings.manage",
    );
    const { rotateFeedToken } = await import("./feed.server");
    return rotateFeedToken(data);
  });
