/**
 * Integration Center — thin RPC wrappers. All logic lives in
 * integration.server.ts; module scope holds only declarations.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { IntegrationCategory } from "./registry";

type OrgShop = { organizationId: string; shopId: string };

export const listIntegrationsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: OrgShop) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    const { listIntegrations, READ_PERMISSION } = await import("./integration.server");
    // Caller must hold at least one area read permission; the view filters below.
    const { hasAnyPermission } = await import("../core.server").catch(() => ({
      hasAnyPermission: null,
    }));
    void hasAnyPermission;
    // Verify membership via any of the three read permissions.
    const perms = Object.values(READ_PERMISSION);
    let allowed = false;
    for (const p of perms) {
      try {
        await assertPermission(context.supabase, context.userId, data.organizationId, p);
        allowed = true;
        break;
      } catch {
        /* try next area permission */
      }
    }
    if (!allowed) throw new Error("Keine Berechtigung für das Integration Center.");
    return listIntegrations(data.organizationId, data.shopId);
  });

export const testConnectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: OrgShop & { category: IntegrationCategory; provider: string }) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    const { testConnection, MANAGE_PERMISSION } = await import("./integration.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      MANAGE_PERMISSION[data.category],
    );
    return testConnection({ ...data, actorId: context.userId });
  });

export const disconnectIntegrationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: OrgShop & { category: IntegrationCategory; provider: string }) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    const { disconnectIntegration, MANAGE_PERMISSION } = await import("./integration.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      MANAGE_PERMISSION[data.category],
    );
    return disconnectIntegration({ ...data, actorId: context.userId });
  });

export const listSenderDomainsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: OrgShop) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.read",
    );
    const { listSenderDomains } = await import("./integration.server");
    return listSenderDomains(data.organizationId, data.shopId);
  });

export const addSenderDomainFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: OrgShop & { domain: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.settings",
    );
    const { addSenderDomain } = await import("./integration.server");
    return addSenderDomain({ ...data, actorId: context.userId });
  });

export const recheckSenderDomainFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: OrgShop & { domainId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.settings",
    );
    const { recheckSenderDomain } = await import("./integration.server");
    return recheckSenderDomain(data);
  });

export const getShopReadinessFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: OrgShop) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    // Any backoffice member with one read permission may see readiness.
    const perms = [
      "payment_settings.read",
      "communications.read",
      "shipping_settings.read",
    ];
    let allowed = false;
    for (const p of perms) {
      try {
        await assertPermission(context.supabase, context.userId, data.organizationId, p);
        allowed = true;
        break;
      } catch {
        /* next */
      }
    }
    if (!allowed) throw new Error("Keine Berechtigung für die Shop-Readiness.");
    const { getShopReadiness } = await import("./integration.server");
    return getShopReadiness(data.organizationId, data.shopId);
  });
