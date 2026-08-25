/** Communication Studio API. Thin wrappers; every call is permission-checked. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  Block,
  CommunicationDetail,
  CommunicationListItem,
  ProviderConfigRow,
  RuleRow,
  SenderIdentityRow,
  TemplateDetail,
  TemplateListItem,
} from "./communication.types";
import type { BrandingSettings } from "./studio.server";

type Scope = { organizationId: string; shopId: string };

/* -------------------------------- templates ------------------------------- */

export const listTemplatesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope) => data)
  .handler(async ({ data, context }): Promise<TemplateListItem[]> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.read",
    );
    const { listTemplates, ensureShopDefaults } = await import("./studio.server");
    await ensureShopDefaults(data.organizationId, data.shopId);
    return await listTemplates(data);
  });

export const getTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; templateId: string }) => data)
  .handler(async ({ data, context }): Promise<TemplateDetail> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.read",
    );
    const { loadTemplate } = await import("./studio.server");
    return await loadTemplate(data.organizationId, data.templateId);
  });

export const forkTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope & { templateId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.manage",
    );
    const { forkTemplate } = await import("./studio.server");
    return await forkTemplate({
      organizationId: data.organizationId,
      shopId: data.shopId,
      templateId: data.templateId,
      actorId: context.userId,
    });
  });

export const saveTemplateDraftFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      organizationId: string;
      templateId: string;
      locale: string;
      subject: string;
      preheader: string | null;
      blocks: Block[];
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.manage",
    );
    const { saveDraftVersion } = await import("./studio.server");
    return await saveDraftVersion({ ...data, actorId: context.userId });
  });

export const publishTemplateVersionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; templateId: string; versionId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.manage",
    );
    const { publishVersion } = await import("./studio.server");
    return await publishVersion({ ...data, actorId: context.userId });
  });

export const setTemplateStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { organizationId: string; templateId: string; status: "active" | "disabled" }) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.manage",
    );
    const { setTemplateStatus } = await import("./studio.server");
    return await setTemplateStatus({ ...data, actorId: context.userId });
  });

export const previewTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Scope & {
        templateKey?: string;
        subject?: string;
        preheader?: string | null;
        blocks?: Block[];
        orderId?: string | null;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.read",
    );
    const { previewTemplate } = await import("./communication.server");
    return await previewTemplate(data);
  });

export const sendTestCommunicationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: Scope & { templateKey: string; recipient: string; orderId?: string | null }) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.send_test",
    );
    const { sendTestCommunication } = await import("./communication.server");
    return await sendTestCommunication({ ...data, actorId: context.userId });
  });

/* ---------------------------------- logs ---------------------------------- */

export const listCommunicationsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Scope & {
        status?: string | null;
        templateKey?: string | null;
        search?: string | null;
        orderId?: string | null;
        customerId?: string | null;
        limit?: number;
      },
    ) => data,
  )
  .handler(async ({ data, context }): Promise<CommunicationListItem[]> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.read",
    );
    const { listCommunications } = await import("./communication.server");
    return await listCommunications(data);
  });

export const getCommunicationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; communicationId: string }) => data)
  .handler(async ({ data, context }): Promise<CommunicationDetail> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.read",
    );
    const { loadCommunication } = await import("./communication.server");
    return await loadCommunication(data.organizationId, data.communicationId);
  });

export const resendCommunicationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      organizationId: string;
      communicationId: string;
      recipientOverride?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.manage",
    );
    const { resendCommunication } = await import("./communication.server");
    return await resendCommunication({ ...data, actorId: context.userId });
  });

/* -------------------------------- settings -------------------------------- */

export const listRulesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope) => data)
  .handler(async ({ data, context }): Promise<RuleRow[]> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.read",
    );
    const { listRules, ensureShopDefaults } = await import("./studio.server");
    await ensureShopDefaults(data.organizationId, data.shopId);
    return await listRules(data.organizationId, data.shopId);
  });

export const updateRuleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { organizationId: string; ruleId: string; enabled?: boolean; delaySeconds?: number }) =>
      data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.settings",
    );
    const { updateRule } = await import("./studio.server");
    return await updateRule({ ...data, actorId: context.userId });
  });

export const getBrandingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope) => data)
  .handler(async ({ data, context }): Promise<BrandingSettings> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.read",
    );
    const { loadBrandingSettings, ensureShopDefaults } = await import("./studio.server");
    await ensureShopDefaults(data.organizationId, data.shopId);
    return await loadBrandingSettings(data.organizationId, data.shopId);
  });

export const saveBrandingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope & { settings: BrandingSettings }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.settings",
    );
    const { saveBrandingSettings } = await import("./studio.server");
    return await saveBrandingSettings({ ...data, actorId: context.userId });
  });

export const listProvidersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Scope) => data)
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      configs: ProviderConfigRow[];
      available: { key: string; label: string; isSandbox: boolean }[];
      senders: SenderIdentityRow[];
    }> => {
      const { assertPermission } = await import("../core.server");
      await assertPermission(
        context.supabase,
        context.userId,
        data.organizationId,
        "communications.read",
      );
      const { listProviderConfigs, listSenderIdentities, ensureShopDefaults } =
        await import("./studio.server");
      const { AVAILABLE_PROVIDERS } = await import("./registry.server");
      await ensureShopDefaults(data.organizationId, data.shopId);
      return {
        configs: await listProviderConfigs(data.organizationId, data.shopId),
        available: AVAILABLE_PROVIDERS.map((p) => ({
          key: p.key,
          label: p.label,
          isSandbox: p.isSandbox,
        })),
        senders: await listSenderIdentities(data.organizationId, data.shopId),
      };
    },
  );

export const saveProviderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Scope & {
        provider: string;
        displayName: string;
        status: "active" | "inactive";
        testMode: boolean;
        priority: number;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.settings",
    );
    const { upsertProviderConfig } = await import("./studio.server");
    return await upsertProviderConfig({ ...data, actorId: context.userId });
  });

export const saveSenderIdentityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Scope & {
        id?: string | null;
        displayName: string;
        senderName: string;
        senderAddress: string;
        replyTo: string | null;
        isDefault: boolean;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.settings",
    );
    const { saveSenderIdentity } = await import("./studio.server");
    return await saveSenderIdentity({ ...data, actorId: context.userId });
  });

export const listSuppressionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.read",
    );
    const { listSuppressions } = await import("./studio.server");
    return await listSuppressions(data.organizationId);
  });

export const removeSuppressionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; suppressionId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.settings",
    );
    const { removeSuppression } = await import("./studio.server");
    return await removeSuppression({ ...data, actorId: context.userId });
  });

export const processCommunicationQueueFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "communications.manage",
    );
    const { processQueue } = await import("./communication.server");
    return await processQueue(50);
  });
