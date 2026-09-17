import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { CampaignDraft, NewsletterScope } from "./newsletter.types";
const scopeSchema = z.object({ organizationId: z.string().uuid(), shopId: z.string().uuid() });
export const newsletterOverviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: NewsletterScope & { search?: string; status?: string; page?: number }) =>
    scopeSchema
      .extend({
        search: z.string().max(120).optional(),
        status: z.enum(["all", "pending", "subscribed", "unsubscribed"]).optional(),
        page: z.number().int().min(1).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.read",
    );
    const { newsletterOverview } = await import("./newsletter.server");
    return newsletterOverview(data);
  });
export const saveNewsletterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: NewsletterScope & { draft: CampaignDraft }) => {
    scopeSchema.parse(data);
    return data;
  })
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.manage",
    );
    const { saveCampaign } = await import("./newsletter.server");
    return saveCampaign(data, data.draft, context.userId);
  });
export const newsletterStateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: NewsletterScope & { id: string; action: "activate" | "pause" }) =>
    scopeSchema
      .extend({ id: z.string().uuid(), action: z.enum(["activate", "pause"]) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.manage",
    );
    const { setCampaignState } = await import("./newsletter.server");
    return setCampaignState(data, data.id, data.action, context.userId);
  });
export const testNewsletterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: NewsletterScope & { draft: CampaignDraft; email: string }) => {
    scopeSchema.parse(data);
    return data;
  })
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.send_test",
    );
    const { testCampaign } = await import("./newsletter.server");
    return testCampaign(data, data.draft, data.email);
  });
export const processNewsletterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: NewsletterScope) => scopeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.manage",
    );
    const { processNewsletters } = await import("./newsletter.server");
    const newsletters = await processNewsletters(data);
    const { processQueue } = await import("./communication.server");
    const messages = await processQueue(50, data);
    return { newsletters, messages };
  });
export const unsubscribeNewsletterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: NewsletterScope & { id: string }) =>
    scopeSchema.extend({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertPermission, writeAudit } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.manage",
    );
    const { unsubscribeByAdmin } = await import("./newsletter.server");
    const result = await unsubscribeByAdmin(data, data.id);
    await writeAudit({
      organizationId: data.organizationId,
      actorId: context.userId,
      action: "newsletter.unsubscribed_by_admin",
      entityType: "newsletter_subscriber",
      entityId: data.id,
    });
    return result;
  });
