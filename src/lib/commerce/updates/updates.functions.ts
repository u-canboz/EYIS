/**
 * Update Center — Serverfunktionen (dünne Hülle, Logik in update-center.server.ts).
 *
 * Zugriffsmodell:
 *  - Lesen: `system_updates.read`
 *  - Prüfen/Kanal: `system_updates.manage`
 *  - Installieren/Abbrechen: `system_updates.install`
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgInput = z.object({ organizationId: z.string().uuid() });

export const getUpdateOverviewFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => orgInput.parse(data))
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "system_updates.read");
    const { getUpdateOverview } = await import("./update-center.server");
    return getUpdateOverview();
  });

export const checkForUpdatesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => orgInput.parse(data))
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "system_updates.manage");
    const { checkForUpdates } = await import("./update-center.server");
    return checkForUpdates();
  });

export const startUpdateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    orgInput.extend({ releaseId: z.string().min(1).max(120) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "system_updates.install");
    const { startUpdate } = await import("./update-center.server");
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    return startUpdate({
      userId: context.userId,
      userEmail: email,
      releaseId: data.releaseId,
      organizationId: data.organizationId,
    });
  });

export const pollUpdateRunFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => orgInput.extend({ runId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "system_updates.read");
    const { pollUpdate } = await import("./update-center.server");
    return pollUpdate(data.runId);
  });

export const abandonUpdateRunFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    orgInput.extend({ runId: z.string().uuid(), reason: z.string().min(3).max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "system_updates.install");
    const { abandonRun } = await import("./update-center.server");
    return abandonRun(data.runId, data.reason);
  });

export const setUpdateChannelFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    orgInput
      .extend({
        channel: z.enum(["stable", "beta", "development"]),
        policy: z.enum(["manual", "security_only", "patch"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "system_updates.channel");
    const { setUpdateChannel } = await import("./update-center.server");
    await setUpdateChannel(data.channel, data.policy);
    return { ok: true as const };
  });
