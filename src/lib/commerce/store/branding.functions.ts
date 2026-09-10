/** Backoffice-API für das Storefront-Branding. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StorefrontBranding } from "./branding-admin.server";

type Scope = { organizationId: string; shopId: string };

async function guard(context: { supabase: unknown; userId: string }, organizationId: string) {
  const { assertPermission } = await import("../core.server");
  await assertPermission(context.supabase, context.userId, organizationId, "settings.manage");
}

export const getStorefrontBrandingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope) => data)
  .handler(async ({ data, context }): Promise<StorefrontBranding> => {
    await guard(context, data.organizationId);
    const { getBranding } = await import("./branding-admin.server");
    return getBranding(data.organizationId, data.shopId);
  });

export const saveStorefrontBrandingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope & StorefrontBranding) => data)
  .handler(async ({ data, context }) => {
    await guard(context, data.organizationId);
    const { saveBranding } = await import("./branding-admin.server");
    return saveBranding(data);
  });
