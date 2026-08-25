/** Server functions for the fulfillment workspace. Thin wrappers, no logic. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  AllocationSuggestion,
  FulfillmentQueueItem,
  FulfillmentState,
  FulfillmentView,
  NextAction,
} from "./fulfillment.types";

type Org = { organizationId: string };

export const listFulfillments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Org & {
        shopId?: string | null;
        statuses?: FulfillmentState[] | null;
        locationId?: string | null;
        carrierProvider?: string | null;
        search?: string | null;
        from?: string | null;
        to?: string | null;
      },
    ) => data,
  )
  .handler(async ({ data, context }): Promise<FulfillmentQueueItem[]> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "fulfillment.read",
    );
    const { listFulfillmentQueue } = await import("./fulfillment.server");
    return await listFulfillmentQueue(data);
  });

export const getFulfillment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { fulfillmentId: string }) => data)
  .handler(
    async ({
      data,
      context,
    }): Promise<{ fulfillment: FulfillmentView; nextAction: NextAction }> => {
      const { assertPermission } = await import("../core.server");
      await assertPermission(
        context.supabase,
        context.userId,
        data.organizationId,
        "fulfillment.read",
      );
      const { loadFulfillment, nextAction } = await import("./fulfillment.server");
      const fulfillment = await loadFulfillment(data.organizationId, data.fulfillmentId);
      return { fulfillment, nextAction: nextAction(fulfillment) };
    },
  );

export const getOrderFulfillments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { orderId: string }) => data)
  .handler(async ({ data, context }): Promise<FulfillmentView[]> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "fulfillment.read",
    );
    const { loadOrderFulfillments } = await import("./fulfillment.server");
    return await loadOrderFulfillments(data.organizationId, data.orderId);
  });

export const getAllocationSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { orderId: string }) => data)
  .handler(async ({ data, context }): Promise<AllocationSuggestion> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "fulfillment.manage",
    );
    const { suggestAllocation } = await import("./fulfillment.server");
    return await suggestAllocation(data.organizationId, data.orderId);
  });

export const createFulfillmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Org & {
        shopId: string;
        orderId: string;
        locationId: string | null;
        items: { orderItemId: string; quantity: number }[];
        notes?: string | null;
        idempotencyKey?: string | null;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "fulfillment.manage",
    );
    const { createFulfillment } = await import("./fulfillment.server");
    return await createFulfillment({ ...data, actorId: context.userId });
  });

export const startPickingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { fulfillmentId: string; idempotencyKey?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "fulfillment.pick",
    );
    const { startPicking } = await import("./fulfillment.server");
    return await startPicking({ ...data, actorId: context.userId });
  });

export const completePickingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Org & {
        fulfillmentId: string;
        picked: { fulfillmentItemId: string; pickedQuantity: number }[];
        idempotencyKey?: string | null;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "fulfillment.pick",
    );
    const { completePicking } = await import("./fulfillment.server");
    return await completePicking({ ...data, actorId: context.userId });
  });

export const packFulfillmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Org & {
        fulfillmentId: string;
        packages: {
          weightGrams?: number | null;
          lengthMm?: number | null;
          widthMm?: number | null;
          heightMm?: number | null;
          packagingType?: string | null;
          items: { fulfillmentItemId: string; quantity: number }[];
        }[];
        idempotencyKey?: string | null;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "fulfillment.pack",
    );
    const { packFulfillment } = await import("./fulfillment.server");
    return await packFulfillment({ ...data, actorId: context.userId });
  });

export const cancelFulfillmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Org & { fulfillmentId: string; reason?: string | null; idempotencyKey?: string | null },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "fulfillment.manage",
    );
    const { cancelFulfillment } = await import("./fulfillment.server");
    return await cancelFulfillment({ ...data, actorId: context.userId });
  });
