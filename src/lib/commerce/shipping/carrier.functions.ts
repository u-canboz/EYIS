/** Server functions for carrier configuration, labels, shipments and tracking. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CarrierRate } from "./provider";
import type { PackagePresetView, ProviderConfigView } from "./shipping.server";
import type { ShipmentView } from "../fulfillment/fulfillment.types";
import type { OrderTrackingView, TrackingEventView } from "../tracking/tracking.types";

type Org = { organizationId: string };

export const listCarrierConfigs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { shopId?: string | null }) => data)
  .handler(async ({ data, context }): Promise<ProviderConfigView[]> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "shipping_settings.read");
    const { listProviderConfigs } = await import("./shipping.server");
    return await listProviderConfigs(data.organizationId, data.shopId ?? null);
  });

export const saveCarrierConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Org & {
        shopId: string;
        id?: string | null;
        provider: string;
        displayName: string;
        status: "active" | "inactive" | "archived";
        testMode: boolean;
        priority: number;
        webhookSecretName?: string | null;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "shipping_settings.manage");
    const { saveProviderConfig } = await import("./shipping.server");
    return await saveProviderConfig({ ...data, actorId: context.userId });
  });

export const listPackagePresetsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { shopId?: string | null }) => data)
  .handler(async ({ data, context }): Promise<PackagePresetView[]> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "shipping_settings.read");
    const { listPackagePresets } = await import("./shipping.server");
    return await listPackagePresets(data.organizationId, data.shopId ?? null);
  });

export const savePackagePresetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Org & {
        shopId: string | null;
        id?: string | null;
        name: string;
        weightGrams: number | null;
        lengthMm: number | null;
        widthMm: number | null;
        heightMm: number | null;
        packagingType: string | null;
        isDefault: boolean;
      },
    ) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "shipping_settings.manage");
    const { savePackagePreset } = await import("./shipping.server");
    return await savePackagePreset(data);
  });

export const deletePackagePresetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "shipping_settings.manage");
    const { deletePackagePreset } = await import("./shipping.server");
    return await deletePackagePreset(data.organizationId, data.id);
  });

export const getCarrierRates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { fulfillmentId: string; packageId: string; provider: string }) => data)
  .handler(async ({ data, context }): Promise<CarrierRate[]> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "shipping.manage");
    const { getRates } = await import("./shipping.server");
    return await getRates(data);
  });

export const createLabelFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      data: Org & {
        fulfillmentId: string;
        packageId: string;
        provider: string;
        service: string | null;
        scenario?: string | null;
        idempotencyKey?: string | null;
      },
    ) => data,
  )
  .handler(async ({ data, context }): Promise<ShipmentView> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "shipping.create_label");
    const { createShipmentWithLabel } = await import("./shipping.server");
    return await createShipmentWithLabel({ ...data, actorId: context.userId });
  });

export const getLabelUrlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { shipmentId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "shipping.read");
    const { getLabelUrl } = await import("./shipping.server");
    return await getLabelUrl(data.organizationId, data.shipmentId);
  });

export const markShippedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { shipmentId: string; idempotencyKey?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "shipping.manage");
    const { markShipped } = await import("./shipping.server");
    return await markShipped({ ...data, actorId: context.userId });
  });

export const cancelShipmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { shipmentId: string; reason?: string | null; idempotencyKey?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "shipping.cancel");
    const { cancelShipment } = await import("./shipping.server");
    return await cancelShipment({ ...data, actorId: context.userId });
  });

export const refreshTrackingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { shipmentId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "tracking.read");
    const { refreshTracking } = await import("./shipping.server");
    return await refreshTracking(data.organizationId, data.shipmentId);
  });

export const listTrackingEventsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { shipmentId: string }) => data)
  .handler(async ({ data, context }): Promise<TrackingEventView[]> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "tracking.read");
    const { listTrackingEvents } = await import("../tracking/tracking.server");
    return await listTrackingEvents(data.organizationId, data.shipmentId);
  });

export const getOrderTrackingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Org & { orderId: string }) => data)
  .handler(async ({ data, context }): Promise<OrderTrackingView> => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "tracking.read");
    const { getOrderTracking } = await import("../tracking/tracking.server");
    return await getOrderTracking(data.organizationId, data.orderId);
  });
