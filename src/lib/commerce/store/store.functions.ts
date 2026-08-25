/** Developer dashboard API for publishable keys and request logs. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StoreKeySummary, StoreRequestLog } from "./keys.server";

type Scope = { organizationId: string; shopId: string };

export const listStoreKeysFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope) => data)
  .handler(async ({ data, context }): Promise<StoreKeySummary[]> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "settings.manage");
    const { listKeys } = await import("./keys.server");
    return listKeys(data.organizationId, data.shopId);
  });

export const createStoreKeyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: Scope & { name: string; environment: "test" | "live"; allowedOrigins: string[] }) => data,
  )
  .handler(async ({ data, context }): Promise<{ id: string; key: string; prefix: string }> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "settings.manage");
    const { createKey } = await import("./keys.server");
    return createKey({
      organizationId: data.organizationId,
      shopId: data.shopId,
      name: data.name,
      environment: data.environment,
      allowedOrigins: data.allowedOrigins,
      actorId: context.userId,
    });
  });

export const updateStoreKeyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      organizationId: string;
      keyId: string;
      name?: string;
      allowedOrigins?: string[];
      status?: "active" | "revoked";
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "settings.manage");
    const { updateKey } = await import("./keys.server");
    return updateKey(data);
  });

export const listStoreLogsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope & { keyId?: string | null; onlyErrors?: boolean }) => data)
  .handler(async ({ data, context }): Promise<StoreRequestLog[]> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "settings.manage");
    const { listRequestLogs } = await import("./keys.server");
    return listRequestLogs(data);
  });
