/** Admin return (RMA) API. Thin wrappers; every call is permission-checked. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  ReturnDetail,
  ReturnEligibility,
  ReturnItemCondition,
  ReturnListItem,
  ReturnReasonCode,
  ReturnSettings,
  ReturnStatus,
  RestockDecision,
  ShippingRefundMode,
} from "./return.types";

type Org = { organizationId: string };

export const listReturnsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Org & {
        shopId?: string | null;
        statuses?: ReturnStatus[] | null;
        search?: string | null;
        customerId?: string | null;
      },
    ) => data,
  )
  .handler(async ({ data, context }): Promise<ReturnListItem[]> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "returns.read");
    const { listReturns } = await import("./return.server");
    return await listReturns(data);
  });

export const getReturnFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { returnId: string }) => data)
  .handler(async ({ data, context }): Promise<ReturnDetail> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "returns.read");
    const { loadReturn } = await import("./return.server");
    return await loadReturn(data.organizationId, data.returnId);
  });

export const getOrderReturnsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { orderId: string }) => data)
  .handler(async ({ data, context }): Promise<ReturnListItem[]> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "returns.read");
    const { listReturns } = await import("./return.server");
    const all = await listReturns({ organizationId: data.organizationId, limit: 200 });
    return all.filter((r) => r.orderId === data.orderId);
  });

export const getReturnEligibilityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { orderId: string }) => data)
  .handler(async ({ data, context }): Promise<ReturnEligibility> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "returns.read");
    const { getEligibility } = await import("./return.server");
    return await getEligibility(data.organizationId, data.orderId);
  });

export const createReturnFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Org & {
        shopId: string;
        orderId: string;
        customerId?: string | null;
        items: { orderItemId: string; quantity: number; reasonCode?: ReturnReasonCode }[];
        reason: ReturnReasonCode;
        note?: string | null;
        idempotencyKey: string;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "returns.manage");
    const { requestReturn } = await import("./return.server");
    return await requestReturn({ ...data, actorId: context.userId });
  });

export const authorizeReturnFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { returnId: string; instructions?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { authorizeReturn } = await import("./return.server");
    return await authorizeReturn({ ...data, actorId: context.userId });
  });

export const rejectReturnFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: Org & { returnId: string; reason: string; internalNote?: string | null }) => data,
  )
  .handler(async ({ data, context }) => {
    const { rejectReturn } = await import("./return.server");
    return await rejectReturn({ ...data, actorId: context.userId });
  });

export const markReturnInTransitFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { returnId: string; shipmentId?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { markReturnInTransit } = await import("./return.server");
    return await markReturnInTransit({ ...data, actorId: context.userId });
  });

export const receiveReturnFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Org & {
        returnId: string;
        items: {
          returnItemId: string;
          quantityReceived: number;
          condition?: ReturnItemCondition;
        }[];
        idempotencyKey?: string | null;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { receiveReturn } = await import("./return.server");
    return await receiveReturn({ ...data, actorId: context.userId });
  });

export const startReturnInspectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { returnId: string }) => data)
  .handler(async ({ data, context }) => {
    const { startInspection } = await import("./return.server");
    return await startInspection({ ...data, actorId: context.userId });
  });

export const inspectReturnFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Org & {
        returnId: string;
        items: {
          returnItemId: string;
          quantityApproved: number;
          condition?: ReturnItemCondition;
          restockDecision?: RestockDecision;
          note?: string | null;
        }[];
        shippingRefundMode?: ShippingRefundMode;
        shippingRefundMinor?: number;
        idempotencyKey?: string | null;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { inspectReturn } = await import("./return.server");
    return await inspectReturn({ ...data, actorId: context.userId });
  });

export const restockReturnItemFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { returnItemId: string; locationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { restockReturnItem } = await import("./return.server");
    return await restockReturnItem({ ...data, actorId: context.userId });
  });

export const settleReturnFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: Org & { returnId: string; amountMinor?: number | null; createCreditNote?: boolean }) =>
      data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "payments.refund",
    );
    const { settleReturn } = await import("./return.server");
    return await settleReturn({ ...data, actorId: context.userId });
  });

export const completeReturnFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { returnId: string }) => data)
  .handler(async ({ data, context }) => {
    const { completeReturn } = await import("./return.server");
    return await completeReturn({ ...data, actorId: context.userId });
  });

export const cancelReturnFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { returnId: string }) => data)
  .handler(async ({ data, context }) => {
    const { cancelReturn } = await import("./return.server");
    return await cancelReturn({ ...data, actorId: context.userId });
  });

export const getReturnSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { shopId: string }) => data)
  .handler(async ({ data, context }): Promise<ReturnSettings> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "returns.read");
    const { loadReturnSettings } = await import("./return.server");
    return await loadReturnSettings(data.organizationId, data.shopId);
  });

export const saveReturnSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: Org & { shopId: string; settings: Omit<ReturnSettings, "shopId"> }) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "returns.manage");
    const { saveReturnSettings } = await import("./return.server");
    return await saveReturnSettings(data);
  });
