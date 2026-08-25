/**
 * Server-only shipment lifecycle: carrier configuration, rates, label creation,
 * cancellation and tracking refresh. Carrier specifics stay behind CarrierProvider.
 */
import { getAdmin, writeAudit } from "../core.server";
import { recordTrackingEvents } from "../tracking/tracking.server";
import { mapShipment } from "../fulfillment/fulfillment.server";
import { getCarrier } from "./registry.server";
import {
  CarrierError,
  type CarrierAddress,
  type CarrierParcel,
  type CarrierRate,
} from "./provider";
import type { ShipmentView } from "../fulfillment/fulfillment.types";
import { publishShipmentEvent } from "../event-payloads.server";

type Row = Record<string, unknown>;
const LABEL_BUCKET = "shipping-labels";

export type ProviderConfigView = {
  id: string;
  shopId: string;
  provider: string;
  displayName: string;
  status: "active" | "inactive" | "archived";
  testMode: boolean;
  priority: number;
  hasWebhookSecret: boolean;
};

export type PackagePresetView = {
  id: string;
  name: string;
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  packagingType: string | null;
  isDefault: boolean;
};

export async function listProviderConfigs(
  organizationId: string,
  shopId?: string | null,
): Promise<ProviderConfigView[]> {
  const admin = await getAdmin();
  let query = admin
    .from("shipping_provider_configs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("priority");
  if (shopId) query = query.eq("shop_id", shopId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((r) => ({
    id: r["id"] as string,
    shopId: r["shop_id"] as string,
    provider: r["provider"] as string,
    displayName: r["display_name"] as string,
    status: r["status"] as ProviderConfigView["status"],
    testMode: Boolean(r["test_mode"]),
    priority: Number(r["priority"] ?? 100),
    hasWebhookSecret: Boolean(
      (r["configuration_reference"] as Row | null)?.["webhook_secret_name"],
    ),
  }));
}

export async function saveProviderConfig(input: {
  organizationId: string;
  shopId: string;
  id?: string | null;
  provider: string;
  displayName: string;
  status: "active" | "inactive" | "archived";
  testMode: boolean;
  priority: number;
  webhookSecretName?: string | null;
  actorId: string;
}) {
  const admin = await getAdmin();
  const payload = {
    organization_id: input.organizationId,
    shop_id: input.shopId,
    provider: input.provider,
    display_name: input.displayName.trim(),
    status: input.status,
    test_mode: input.testMode,
    priority: input.priority,
    configuration_reference: input.webhookSecretName
      ? { webhook_secret_name: input.webhookSecretName }
      : {},
  };
  let id = input.id ?? null;
  if (id) {
    const { error } = await admin
      .from("shipping_provider_configs")
      .update(payload)
      .eq("id", id)
      .eq("organization_id", input.organizationId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await admin
      .from("shipping_provider_configs")
      .upsert(payload, { onConflict: "shop_id,provider" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    id = (data as Row)["id"] as string;
  }
  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: input.id ? "shipping.provider.updated" : "shipping.provider.created",
    entityType: "shipping_provider_config",
    entityId: id,
    metadata: { provider: input.provider, test_mode: input.testMode, status: input.status },
  });
  return { id: id as string };
}

export async function listPackagePresets(
  organizationId: string,
  shopId?: string | null,
): Promise<PackagePresetView[]> {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("package_presets")
    .select("*")
    .eq("organization_id", organizationId)
    .order("is_default", { ascending: false })
    .order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[])
    .filter((r) => !shopId || !r["shop_id"] || r["shop_id"] === shopId)
    .map((r) => ({
      id: r["id"] as string,
      name: r["name"] as string,
      weightGrams: r["weight_grams"] === null ? null : Number(r["weight_grams"]),
      lengthMm: r["length_mm"] === null ? null : Number(r["length_mm"]),
      widthMm: r["width_mm"] === null ? null : Number(r["width_mm"]),
      heightMm: r["height_mm"] === null ? null : Number(r["height_mm"]),
      packagingType: (r["packaging_type"] as string) ?? null,
      isDefault: Boolean(r["is_default"]),
    }));
}

export async function savePackagePreset(input: {
  organizationId: string;
  shopId: string | null;
  id?: string | null;
  name: string;
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  packagingType: string | null;
  isDefault: boolean;
}) {
  const admin = await getAdmin();
  const payload = {
    organization_id: input.organizationId,
    shop_id: input.shopId,
    name: input.name.trim(),
    weight_grams: input.weightGrams,
    length_mm: input.lengthMm,
    width_mm: input.widthMm,
    height_mm: input.heightMm,
    packaging_type: input.packagingType,
    is_default: input.isDefault,
  };
  if (input.id) {
    const { error } = await admin
      .from("package_presets")
      .update(payload)
      .eq("id", input.id)
      .eq("organization_id", input.organizationId);
    if (error) throw new Error(error.message);
    return { id: input.id };
  }
  const { data, error } = await admin.from("package_presets").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return { id: (data as Row)["id"] as string };
}

export async function deletePackagePreset(organizationId: string, id: string) {
  const admin = await getAdmin();
  const { error } = await admin
    .from("package_presets")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Shipping address snapshot of the order — never the live customer record. */
async function loadShipContext(organizationId: string, fulfillmentId: string, packageId: string) {
  const admin = await getAdmin();
  const { data: ful } = await admin
    .from("fulfillments")
    .select("id, shop_id, order_id")
    .eq("organization_id", organizationId)
    .eq("id", fulfillmentId)
    .maybeSingle();
  if (!ful) throw new Error("Fulfillment nicht gefunden.");
  const f = ful as Row;

  const [{ data: pkg }, { data: order }, { data: addressRow }] = await Promise.all([
    admin
      .from("packages")
      .select("*")
      .eq("id", packageId)
      .eq("fulfillment_id", fulfillmentId)
      .maybeSingle(),
    admin
      .from("orders")
      .select("order_number, email")
      .eq("id", f["order_id"] as string)
      .maybeSingle(),
    admin
      .from("order_addresses")
      .select("address")
      .eq("order_id", f["order_id"] as string)
      .eq("type", "shipping")
      .maybeSingle(),
  ]);
  if (!pkg) throw new Error("Paket nicht gefunden.");
  const p = pkg as Row;
  const raw = ((addressRow as Row | null)?.["address"] ?? {}) as Record<string, string | null>;

  const address: CarrierAddress = {
    name:
      [raw["firstName"], raw["lastName"]].filter(Boolean).join(" ").trim() || (raw["name"] ?? ""),
    company: raw["company"] ?? null,
    line1: raw["street"] ?? "",
    line2: raw["street2"] ?? null,
    postalCode: raw["postalCode"] ?? "",
    city: raw["city"] ?? "",
    countryCode: (raw["countryCode"] ?? "").toUpperCase(),
    email: ((order as Row | null)?.["email"] as string) ?? null,
    phone: raw["phone"] ?? null,
  };
  if (
    !address.name ||
    !address.line1 ||
    !address.postalCode ||
    !address.city ||
    !address.countryCode
  ) {
    throw new CarrierError(
      "invalid_address",
      "Die Lieferadresse der Bestellung ist unvollständig.",
      false,
    );
  }

  const parcel: CarrierParcel = {
    packageId: p["id"] as string,
    packageNumber: Number(p["package_number"]),
    weightGrams: p["weight_grams"] === null ? null : Number(p["weight_grams"]),
    lengthMm: p["length_mm"] === null ? null : Number(p["length_mm"]),
    widthMm: p["width_mm"] === null ? null : Number(p["width_mm"]),
    heightMm: p["height_mm"] === null ? null : Number(p["height_mm"]),
    packagingType: (p["packaging_type"] as string) ?? null,
  };

  return {
    shopId: f["shop_id"] as string,
    orderId: f["order_id"] as string,
    orderNumber: ((order as Row | null)?.["order_number"] as string) ?? fulfillmentId,
    address,
    parcel,
  };
}

async function loadActiveConfig(organizationId: string, shopId: string, provider: string) {
  const admin = await getAdmin();
  const { data } = await admin
    .from("shipping_provider_configs")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .eq("provider", provider)
    .eq("status", "active")
    .maybeSingle();
  if (!data)
    throw new CarrierError(
      "not_supported",
      `Versanddienstleister ${provider} ist nicht aktiv.`,
      false,
    );
  return data as Row;
}

export async function getRates(input: {
  organizationId: string;
  fulfillmentId: string;
  packageId: string;
  provider: string;
}): Promise<CarrierRate[]> {
  const ctx = await loadShipContext(input.organizationId, input.fulfillmentId, input.packageId);
  const config = await loadActiveConfig(input.organizationId, ctx.shopId, input.provider);
  const carrier = await getCarrier(input.provider);
  if (!carrier.capabilities.supportsRates || !carrier.getRates) return [];
  return await carrier.getRates({
    address: ctx.address,
    parcel: ctx.parcel,
    testMode: Boolean(config["test_mode"]),
  });
}

async function recordError(shipmentId: string, code: string, message: string) {
  const admin = await getAdmin();
  await admin
    .from("shipments")
    .update({
      last_error: { code, message, at: new Date().toISOString() } as never,
      status: "exception",
    })
    .eq("id", shipmentId);
}

/**
 * Creates the shipment row, calls the carrier, uploads the label and records it.
 * Idempotent per package: a second call returns the existing shipment.
 */
export async function createShipmentWithLabel(input: {
  organizationId: string;
  fulfillmentId: string;
  packageId: string;
  provider: string;
  service: string | null;
  actorId: string;
  scenario?: string | null;
  idempotencyKey?: string | null;
}): Promise<ShipmentView> {
  const admin = await getAdmin();
  const ctx = await loadShipContext(input.organizationId, input.fulfillmentId, input.packageId);
  const config = await loadActiveConfig(input.organizationId, ctx.shopId, input.provider);
  const carrier = await getCarrier(input.provider);
  const idem = input.idempotencyKey ?? `label:${input.packageId}`;

  const { data: created, error: createError } = await admin.rpc(
    "ship_create" as never,
    {
      _org: input.organizationId,
      _ful: input.fulfillmentId,
      _package: input.packageId,
      _provider: input.provider,
      _service: input.service,
      _actor: input.actorId,
      _idem: idem,
    } as never,
  );
  if (createError) throw new Error(createError.message);
  const shipmentId = (created as unknown as { shipment_id: string }).shipment_id;

  const { data: existingLabel } = await admin
    .from("shipping_labels")
    .select("id")
    .eq("shipment_id", shipmentId)
    .is("voided_at", null)
    .maybeSingle();

  if (!existingLabel) {
    const carrierInput = {
      shipmentId,
      service: input.service,
      reference: ctx.orderNumber,
      address: ctx.address,
      parcel: ctx.parcel,
      testMode: Boolean(config["test_mode"]),
      idempotencyKey: idem,
      scenario: input.scenario ?? null,
    };
    try {
      const shipment = await carrier.createShipment(carrierInput);
      const label = await carrier.createLabel({
        ...carrierInput,
        providerShipmentId: shipment.providerShipmentId,
      });

      const storagePath = `${input.organizationId}/${shipmentId}.${label.format}`;
      const bytes = Uint8Array.from(atob(label.contentBase64), (c) => c.charCodeAt(0));
      const upload = await admin.storage
        .from(LABEL_BUCKET)
        .upload(storagePath, bytes, { contentType: label.mimeType, upsert: true });
      if (upload.error) throw new CarrierError("label_generation_failed", upload.error.message);

      const { error: recordError2 } = await admin.rpc(
        "ship_record_label" as never,
        {
          _org: input.organizationId,
          _shipment: shipmentId,
          _actor: input.actorId,
          _provider: input.provider,
          _format: label.format,
          _storage_path: storagePath,
          _mime: label.mimeType,
          _provider_shipment_id: shipment.providerShipmentId,
          _tracking_number: shipment.trackingNumber,
          _tracking_url: shipment.trackingUrl,
          _cost_minor: shipment.costMinor,
          _currency: shipment.currencyCode,
          _idem: `${idem}:record`,
        } as never,
      );
      if (recordError2) throw new Error(recordError2.message);
    } catch (e) {
      const code = e instanceof CarrierError ? e.code : "label_generation_failed";
      const message =
        e instanceof Error ? e.message : "Unbekannter Fehler beim Versanddienstleister.";
      await recordError(shipmentId, code, message);
      throw new Error(message);
    }
  }

  return await loadShipment(input.organizationId, shipmentId);
}

export async function loadShipment(
  organizationId: string,
  shipmentId: string,
): Promise<ShipmentView> {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("shipments")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", shipmentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sendung nicht gefunden.");
  const { data: label } = await admin
    .from("shipping_labels")
    .select("storage_path")
    .eq("shipment_id", shipmentId)
    .is("voided_at", null)
    .maybeSingle();
  return mapShipment(data as Row, ((label as Row | null)?.["storage_path"] as string) ?? null);
}

/** Short-lived signed URL — labels are never public. */
export async function getLabelUrl(organizationId: string, shipmentId: string) {
  const admin = await getAdmin();
  const { data: label } = await admin
    .from("shipping_labels")
    .select("storage_path")
    .eq("organization_id", organizationId)
    .eq("shipment_id", shipmentId)
    .is("voided_at", null)
    .maybeSingle();
  if (!label) throw new Error("Für diese Sendung existiert kein Label.");
  const { data, error } = await admin.storage
    .from(LABEL_BUCKET)
    .createSignedUrl((label as Row)["storage_path"] as string, 300);
  if (error) throw new Error(error.message);
  return { url: data.signedUrl };
}

export async function markShipped(input: {
  organizationId: string;
  shipmentId: string;
  actorId: string;
  idempotencyKey?: string | null;
}) {
  const admin = await getAdmin();
  const { data, error } = await admin.rpc(
    "ship_mark_shipped" as never,
    {
      _org: input.organizationId,
      _shipment: input.shipmentId,
      _actor: input.actorId,
      _idem: input.idempotencyKey ?? null,
    } as never,
  );
  if (error) throw new Error(error.message);
  await publishShipmentEvent(input.shipmentId, "shipment.shipped");
  return data as unknown as {
    shipment_id: string;
    status: string;
    order_fulfillment_status: string | null;
  };
}

export async function cancelShipment(input: {
  organizationId: string;
  shipmentId: string;
  actorId: string;
  reason?: string | null;
  idempotencyKey?: string | null;
}) {
  const admin = await getAdmin();
  const shipment = await loadShipment(input.organizationId, input.shipmentId);
  if (shipment.providerShipmentId) {
    const carrier = await getCarrier(shipment.carrierProvider);
    if (carrier.capabilities.supportsCancellation && carrier.cancelShipment) {
      try {
        await carrier.cancelShipment(shipment.providerShipmentId);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Stornierung beim Dienstleister fehlgeschlagen.";
        throw new Error(message);
      }
    }
  }
  const { data, error } = await admin.rpc(
    "ship_cancel" as never,
    {
      _org: input.organizationId,
      _shipment: input.shipmentId,
      _actor: input.actorId,
      _reason: input.reason ?? null,
      _idem: input.idempotencyKey ?? null,
    } as never,
  );
  if (error) throw new Error(error.message);
  return data as unknown as { shipment_id: string; status: string; changed: boolean };
}

/** Pull-based tracking refresh for carriers without webhooks. */
export async function refreshTracking(organizationId: string, shipmentId: string) {
  const shipment = await loadShipment(organizationId, shipmentId);
  const carrier = await getCarrier(shipment.carrierProvider);
  if (!carrier.capabilities.supportsTracking || !carrier.getTracking) {
    return { stored: 0, duplicates: 0, advanced: false, supported: false };
  }
  const snapshot = await carrier.getTracking({
    providerShipmentId: shipment.providerShipmentId,
    trackingNumber: shipment.trackingNumber,
  });
  const result = await recordTrackingEvents(
    organizationId,
    shipmentId,
    shipment.carrierProvider,
    snapshot.events,
  );
  return { ...result, supported: true };
}
