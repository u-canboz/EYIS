/** Backoffice-API für die direkte Google-Merchant-Center-Anbindung. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  MerchantConnection,
  MerchantSyncError,
  MerchantSyncRun,
} from "./merchant.server";

type Scope = { organizationId: string; shopId: string };

async function guard(context: { supabase: unknown; userId: string }, organizationId: string) {
  const { assertPermission } = await import("../core.server");
  await assertPermission(context.supabase, context.userId, organizationId, "settings.manage");
}

export const getMerchantConnectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope) => data)
  .handler(
    async ({
      data,
      context,
    }): Promise<{ connection: MerchantConnection | null; runs: MerchantSyncRun[] }> => {
      await guard(context, data.organizationId);
      const api = await import("./merchant.server");
      const [connection, runs] = await Promise.all([
        api.getConnection(data.organizationId, data.shopId),
        api.listSyncRuns(data.organizationId, data.shopId),
      ]);
      return { connection, runs };
    },
  );

export const saveMerchantSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Scope & {
        merchantId: string | null;
        accountLabel: string | null;
        autoSync: boolean;
      },
    ) => data,
  )
  .handler(async ({ data, context }): Promise<MerchantConnection> => {
    await guard(context, data.organizationId);
    const { upsertConnection } = await import("./merchant.server");
    return upsertConnection(data);
  });

export const startMerchantAuthorizationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope & { redirectUri: string }) => data)
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    await guard(context, data.organizationId);
    const { authorizationUrl } = await import("./merchant.server");
    const state = `${data.organizationId}:${data.shopId}:${crypto.randomUUID()}`;
    const { getAdmin } = await import("../core.server");
    const admin = await getAdmin();
    await admin.from("oauth_states").insert({
      state,
      organization_id: data.organizationId,
      shop_id: data.shopId,
      provider: "google_merchant",
      redirect_uri: data.redirectUri,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    } as never);
    return { url: authorizationUrl({ redirectUri: data.redirectUri, state }) };
  });

export const disconnectMerchantFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope) => data)
  .handler(async ({ data, context }) => {
    await guard(context, data.organizationId);
    const { disconnect } = await import("./merchant.server");
    return disconnect(data);
  });

export const syncMerchantNowFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope & { requestOrigin: string }) => data)
  .handler(async ({ data, context }) => {
    await guard(context, data.organizationId);
    const { syncNow } = await import("./merchant.server");
    return syncNow({ ...data, triggerSource: "manual" });
  });

export const listMerchantErrorsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; runId: string }) => data)
  .handler(async ({ data, context }): Promise<MerchantSyncError[]> => {
    await guard(context, data.organizationId);
    const { listSyncErrors } = await import("./merchant.server");
    return listSyncErrors(data.organizationId, data.runId);
  });
