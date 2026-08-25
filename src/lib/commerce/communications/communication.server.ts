/**
 * Communication engine. Domain modules only emit events; this module decides
 * whether a message is sent, renders an immutable snapshot, dispatches it via
 * the configured provider and records every attempt.
 */
import { getAdmin, writeAudit } from "../core.server";
import { buildContext, type ContextRequest } from "./context.server";
import { renderEmail } from "./renderer";
import { resolveProvider, resolveSenderIdentity } from "./registry.server";
import { CommunicationError } from "./provider";
import {
  DEFAULT_BRANDING,
  type Block,
  type CommunicationBranding,
  type CommunicationDetail,
  type CommunicationListItem,
  type CommunicationStatus,
  type DeliveryStatus,
} from "./communication.types";

type Row = Record<string, unknown>;

const MAX_ATTEMPTS = 5;
const BACKOFF_MINUTES = [1, 5, 20, 60, 180];

/* ------------------------------- branding -------------------------------- */

export async function loadBranding(
  organizationId: string,
  shopId: string,
): Promise<CommunicationBranding> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("communication_branding")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .maybeSingle();
  const row = data as Row | null;
  if (!row) return { ...DEFAULT_BRANDING };

  let logoUrl: string | null = null;
  if (row["logo_media_id"]) {
    const { data: media } = await admin
      .from("media_assets")
      .select("storage_path")
      .eq("id", row["logo_media_id"] as string)
      .maybeSingle();
    const path = (media as Row | null)?.["storage_path"] as string | undefined;
    if (path) {
      const { data: signed } = await admin.storage
        .from("media")
        .createSignedUrl(path, 60 * 60 * 24 * 30);
      logoUrl = signed?.signedUrl ?? null;
    }
  }

  return {
    logoUrl,
    primaryColor: (row["primary_color"] as string) ?? DEFAULT_BRANDING.primaryColor,
    backgroundColor: (row["background_color"] as string) ?? DEFAULT_BRANDING.backgroundColor,
    contentBackgroundColor:
      (row["content_background_color"] as string) ?? DEFAULT_BRANDING.contentBackgroundColor,
    textColor: (row["text_color"] as string) ?? DEFAULT_BRANDING.textColor,
    mutedTextColor: (row["muted_text_color"] as string) ?? DEFAULT_BRANDING.mutedTextColor,
    buttonStyle: (row["button_style"] as string) ?? DEFAULT_BRANDING.buttonStyle,
    borderRadius: Number(row["border_radius"] ?? DEFAULT_BRANDING.borderRadius),
    fontFamily: (row["font_family"] as string) ?? DEFAULT_BRANDING.fontFamily,
    footerText: (row["footer_text"] as string) ?? "",
    supportEmail: (row["support_email"] as string) ?? null,
    websiteUrl: (row["website_url"] as string) ?? null,
    socialLinks: Array.isArray(row["social_links"])
      ? (row["social_links"] as { label: string; url: string }[])
      : [],
  };
}

/* ------------------------------- templates ------------------------------- */

export type ResolvedTemplate = {
  templateId: string;
  templateKey: string;
  versionId: string;
  version: number;
  locale: string;
  subject: string;
  preheader: string | null;
  blocks: Block[];
  status: string;
};

/** Shop override beats organization override beats system template. */
export async function resolveTemplate(
  organizationId: string,
  shopId: string,
  key: string,
  locale = "de-DE",
): Promise<ResolvedTemplate | null> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("communication_templates")
    .select("*")
    .eq("key", key)
    .eq("channel", "email")
    .or(`organization_id.eq.${organizationId},organization_id.is.null`);

  const rows = ((data ?? []) as Row[]).filter((r) => !r["shop_id"] || r["shop_id"] === shopId);
  if (!rows.length) return null;
  const score = (r: Row) => (r["shop_id"] ? 3 : r["organization_id"] ? 2 : 1);
  rows.sort((a, b) => score(b) - score(a));
  const template = rows[0]!;

  const { data: versions } = await admin
    .from("communication_template_versions")
    .select("*")
    .eq("template_id", template["id"] as string)
    .not("published_at", "is", null)
    .order("version", { ascending: false });

  const list = (versions ?? []) as Row[];
  const version = list.find((v) => v["locale"] === locale) ?? list[0];
  if (!version) return null;

  return {
    templateId: template["id"] as string,
    templateKey: template["key"] as string,
    versionId: version["id"] as string,
    version: Number(version["version"] ?? 1),
    locale: (version["locale"] as string) ?? locale,
    subject: (version["subject"] as string) ?? "",
    preheader: (version["preheader"] as string) ?? null,
    blocks: Array.isArray(version["body_schema"]) ? (version["body_schema"] as Block[]) : [],
    status: String(template["status"] ?? "active"),
  };
}

/* ------------------------------ suppression ------------------------------ */

export async function isSuppressed(organizationId: string, shopId: string, address: string) {
  const admin = await getAdmin();
  const { data } = await admin
    .from("communication_suppressions")
    .select("id, reason, expires_at, shop_id")
    .eq("organization_id", organizationId)
    .eq("channel", "email")
    .eq("address", address.trim().toLowerCase());
  const now = Date.now();
  const hit = ((data ?? []) as Row[]).find(
    (r) =>
      (!r["shop_id"] || r["shop_id"] === shopId) &&
      (!r["expires_at"] || new Date(r["expires_at"] as string).getTime() > now),
  );
  return hit ? { reason: String(hit["reason"]) } : null;
}

/* -------------------------------- queueing -------------------------------- */

export type QueueInput = ContextRequest & {
  templateKey: string;
  eventType?: string | null;
  eventId?: string | null;
  ruleId?: string | null;
  locale?: string;
  delaySeconds?: number;
  isTestSend?: boolean;
  resendOf?: string | null;
  recipientType?: "customer" | "guest" | "internal" | "test";
};

export type QueueResult =
  | { queued: true; communicationId: string }
  | { queued: false; reason: string; communicationId?: string };

/** Renders the message and stores it as an immutable snapshot. */
export async function queueCommunication(input: QueueInput): Promise<QueueResult> {
  const admin = await getAdmin();
  const template = await resolveTemplate(
    input.organizationId,
    input.shopId,
    input.templateKey,
    input.locale ?? "de-DE",
  );
  if (!template) return { queued: false, reason: "template_missing" };
  if (template.status !== "active" && !input.isTestSend)
    return { queued: false, reason: "template_disabled" };

  const built = await buildContext(input);
  if (!built.recipient || !built.recipient.includes("@"))
    return { queued: false, reason: "no_recipient" };

  const branding = await loadBranding(input.organizationId, input.shopId);
  branding.footerText = branding.footerText || `${built.context.shop.name}`;
  built.context.shop.support_email = branding.supportEmail ?? built.context.shop.support_email;
  built.context.shop.website_url = branding.websiteUrl ?? built.context.shop.website_url;

  const rendered = renderEmail({
    subject: template.subject,
    preheader: template.preheader,
    blocks: template.blocks,
    context: built.context,
    branding,
  });

  const suppression = input.isTestSend
    ? null
    : await isSuppressed(input.organizationId, input.shopId, built.recipient);

  const sender = await resolveSenderIdentity(input.organizationId, input.shopId);
  const scheduledAt = new Date(Date.now() + (input.delaySeconds ?? 0) * 1000).toISOString();

  const { data, error } = await admin
    .from("communications")
    .insert({
      organization_id: input.organizationId,
      shop_id: input.shopId,
      channel: "email",
      status: suppression ? "suppressed" : "queued",
      template_key: template.templateKey,
      template_version_id: template.versionId,
      locale: template.locale,
      subject_snapshot: rendered.subject,
      html_snapshot: rendered.html,
      text_snapshot: rendered.text,
      recipient_address: built.recipient,
      recipient_type: input.recipientType ?? (built.customerId ? "customer" : "guest"),
      recipient_reference_id: built.customerId,
      customer_id: built.customerId,
      order_id: built.orderId,
      sender_identity_id: sender?.id ?? null,
      sender_name: sender?.senderName ?? built.context.shop.name,
      sender_address: sender?.senderAddress ?? null,
      source_event_type: input.eventType ?? null,
      source_event_id: input.eventId ?? null,
      communication_rule_id: input.ruleId ?? null,
      resend_of_communication_id: input.resendOf ?? null,
      is_test_send: input.isTestSend ?? false,
      queued_at: suppression ? null : new Date().toISOString(),
      scheduled_at: scheduledAt,
      next_attempt_at: suppression ? null : scheduledAt,
      last_error: suppression ? `suppressed:${suppression.reason}` : null,
      metadata: { context_keys: Object.keys(built.context) } as never,
    } as never)
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  const id = (data as Row)["id"] as string;
  if (suppression)
    return { queued: false, reason: `suppressed_${suppression.reason}`, communicationId: id };
  return { queued: true, communicationId: id };
}

/* ------------------------------- dispatching ------------------------------ */

export async function dispatchCommunication(communicationId: string) {
  const admin = await getAdmin();
  const { data } = await admin
    .from("communications")
    .select("*")
    .eq("id", communicationId)
    .maybeSingle();
  const comm = data as Row | null;
  if (!comm) throw new Error("Kommunikation nicht gefunden.");
  if (!["queued", "sending", "failed"].includes(String(comm["status"])))
    return { skipped: true as const, status: String(comm["status"]) };

  const organizationId = comm["organization_id"] as string;
  const shopId = comm["shop_id"] as string;
  const attemptNumber = Number(comm["attempts"] ?? 0) + 1;

  const { provider, testMode } = await resolveProvider(organizationId, shopId);
  const sender = await resolveSenderIdentity(organizationId, shopId);

  await admin
    .from("communications")
    .update({ status: "sending", provider: provider.key, test_mode: testMode } as never)
    .eq("id", communicationId);

  const started = new Date().toISOString();
  try {
    const result = await provider.send({
      to: comm["recipient_address"] as string,
      senderName: (comm["sender_name"] as string) ?? sender?.senderName ?? null,
      senderAddress: (comm["sender_address"] as string) ?? sender?.senderAddress ?? null,
      replyTo: sender?.replyTo ?? null,
      subject: comm["subject_snapshot"] as string,
      html: comm["html_snapshot"] as string,
      text: comm["text_snapshot"] as string,
      tags: {
        template: String(comm["template_key"]),
        communication_id: communicationId,
      },
      idempotencyKey: communicationId,
    });

    await admin.from("communication_attempts").insert({
      organization_id: organizationId,
      communication_id: communicationId,
      attempt_number: attemptNumber,
      provider: provider.key,
      status: result.status === "rejected" ? "rejected" : "accepted",
      provider_message_id: result.providerMessageId,
      started_at: started,
      completed_at: new Date().toISOString(),
      metadata: result.raw as never,
    } as never);

    await admin
      .from("communications")
      .update({
        status: "sent",
        delivery_status: "accepted",
        provider: provider.key,
        provider_status_raw: result.status,
        attempts: attemptNumber,
        sent_at: new Date().toISOString(),
        next_attempt_at: null,
        last_error: null,
      } as never)
      .eq("id", communicationId);

    return { sent: true as const, provider: provider.key, sandbox: provider.isSandbox };
  } catch (error) {
    const err =
      error instanceof CommunicationError
        ? error
        : new CommunicationError("unknown", error instanceof Error ? error.message : "Fehler");
    const retryable = err.retryable && attemptNumber < MAX_ATTEMPTS;
    const delay = BACKOFF_MINUTES[Math.min(attemptNumber - 1, BACKOFF_MINUTES.length - 1)]!;

    await admin.from("communication_attempts").insert({
      organization_id: organizationId,
      communication_id: communicationId,
      attempt_number: attemptNumber,
      provider: provider.key,
      status: "rejected",
      error_code: err.code,
      error_message: err.message,
      started_at: started,
      completed_at: new Date().toISOString(),
    } as never);

    await admin
      .from("communications")
      .update({
        status: retryable ? "queued" : "failed",
        attempts: attemptNumber,
        last_error: `${err.code}: ${err.message}`,
        failed_at: retryable ? null : new Date().toISOString(),
        next_attempt_at: retryable ? new Date(Date.now() + delay * 60_000).toISOString() : null,
      } as never)
      .eq("id", communicationId);

    return { sent: false as const, error: err.code, message: err.message, willRetry: retryable };
  }
}

/** Sends due messages. Called by the scheduler route and after queueing. */
export async function processQueue(limit = 25) {
  const admin = await getAdmin();
  const now = new Date().toISOString();
  const { data } = await admin
    .from("communications")
    .select("id")
    .eq("status", "queued")
    .lte("next_attempt_at", now)
    .order("next_attempt_at", { ascending: true })
    .limit(limit);

  const ids = ((data ?? []) as Row[]).map((r) => r["id"] as string);
  let sent = 0;
  let failed = 0;
  for (const id of ids) {
    const result = await dispatchCommunication(id);
    if ("sent" in result && result.sent) sent += 1;
    else if ("sent" in result) failed += 1;
  }
  return { processed: ids.length, sent, failed };
}

/* --------------------------------- events --------------------------------- */

function conditionsMatch(conditions: Row, payload: Row) {
  return Object.entries(conditions ?? {}).every(([key, expected]) => {
    const actual = key
      .split(".")
      .reduce<unknown>(
        (acc, k) => (acc && typeof acc === "object" ? (acc as Row)[k] : undefined),
        payload,
      );
    if (Array.isArray(expected)) return expected.includes(actual as never);
    return actual === expected;
  });
}

export type DomainEvent = {
  organizationId: string;
  shopId: string;
  eventType: string;
  eventId?: string | null;
  payload: Record<string, unknown>;
};

/** Maps a domain event to all matching rules and queues the messages. */
export async function handleDomainEvent(event: DomainEvent) {
  const admin = await getAdmin();
  const { data } = await admin
    .from("communication_rules")
    .select("*")
    .eq("organization_id", event.organizationId)
    .eq("shop_id", event.shopId)
    .eq("channel", "email")
    .eq("event_type", event.eventType)
    .eq("enabled", true)
    .order("priority", { ascending: true });

  const rules = (data ?? []) as Row[];
  const results: { templateKey: string; result: QueueResult }[] = [];
  const p = event.payload;

  for (const rule of rules) {
    if (!conditionsMatch((rule["conditions"] as Row) ?? {}, p as Row)) continue;
    const templateKey = rule["template_key"] as string;
    const result = await queueCommunication({
      organizationId: event.organizationId,
      shopId: event.shopId,
      templateKey,
      eventType: event.eventType,
      eventId: event.eventId ?? null,
      ruleId: rule["id"] as string,
      delaySeconds: Number(rule["delay_seconds"] ?? 0),
      orderId: (p["order_id"] as string) ?? null,
      shipmentId: (p["shipment_id"] as string) ?? null,
      returnId: (p["return_id"] as string) ?? null,
      invoiceId: (p["invoice_id"] as string) ?? null,
      creditNoteId: (p["credit_note_id"] as string) ?? null,
      refundId: (p["refund_id"] as string) ?? null,
      customerId: (p["customer_id"] as string) ?? null,
      recipientEmail: (p["email"] as string) ?? null,
      guestAccess: templateKey === "guest_order_access" || Boolean(p["guest_access"]),
    });
    results.push({ templateKey, result });
    if (result.queued && !Number(rule["delay_seconds"] ?? 0)) {
      await dispatchCommunication(result.communicationId);
    }
  }
  return results;
}

/**
 * Fire-and-forget notification helper for domain modules.
 * Never throws: a failing mail must not roll back a commercial transaction.
 */
export async function notify(event: DomainEvent) {
  try {
    return await handleDomainEvent(event);
  } catch (error) {
    console.error("[communications] event failed", event.eventType, error);
    return [];
  }
}

/* --------------------------------- resend --------------------------------- */

/** Always creates a NEW communication; the original snapshot stays untouched. */
export async function resendCommunication(input: {
  communicationId: string;
  actorId: string | null;
  recipientOverride?: string | null;
}) {
  const admin = await getAdmin();
  const { data } = await admin
    .from("communications")
    .select("*")
    .eq("id", input.communicationId)
    .maybeSingle();
  const comm = data as Row | null;
  if (!comm) throw new Error("Kommunikation nicht gefunden.");

  const result = await queueCommunication({
    organizationId: comm["organization_id"] as string,
    shopId: comm["shop_id"] as string,
    templateKey: comm["template_key"] as string,
    locale: (comm["locale"] as string) ?? "de-DE",
    orderId: (comm["order_id"] as string) ?? null,
    customerId: (comm["customer_id"] as string) ?? null,
    recipientEmail: input.recipientOverride ?? (comm["recipient_address"] as string),
    eventType: comm["source_event_type"] as string,
    resendOf: input.communicationId,
    recipientType: (comm["recipient_type"] as QueueInput["recipientType"]) ?? "customer",
  });

  await writeAudit({
    organizationId: comm["organization_id"] as string,
    actorId: input.actorId,
    action: "communication.resent",
    entityType: "communication",
    entityId: input.communicationId,
    metadata: { new_communication_id: "communicationId" in result ? result.communicationId : null },
  });

  if (result.queued) await dispatchCommunication(result.communicationId);
  return result;
}

/* ------------------------------- test sending ------------------------------ */

export async function sendTestCommunication(input: {
  organizationId: string;
  shopId: string;
  templateKey: string;
  recipient: string;
  orderId?: string | null;
  actorId: string | null;
}) {
  const result = await queueCommunication({
    organizationId: input.organizationId,
    shopId: input.shopId,
    templateKey: input.templateKey,
    recipientEmail: input.recipient,
    orderId: input.orderId ?? null,
    isTestSend: true,
    recipientType: "test",
  });
  if (result.queued) await dispatchCommunication(result.communicationId);
  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "communication.test_sent",
    entityType: "communication_template",
    entityId: input.templateKey,
    metadata: { recipient: input.recipient },
  });
  return result;
}

/** Renders a template with sample data without storing anything. */
export async function previewTemplate(input: {
  organizationId: string;
  shopId: string;
  templateKey?: string;
  subject?: string;
  preheader?: string | null;
  blocks?: Block[];
  orderId?: string | null;
}) {
  const branding = await loadBranding(input.organizationId, input.shopId);
  let subject = input.subject ?? "";
  let blocks = input.blocks ?? [];
  let preheader = input.preheader ?? null;
  if (!input.blocks && input.templateKey) {
    const template = await resolveTemplate(input.organizationId, input.shopId, input.templateKey);
    if (!template) throw new Error("Vorlage nicht gefunden.");
    subject = template.subject;
    blocks = template.blocks;
    preheader = template.preheader;
  }
  const built = await buildContext({
    organizationId: input.organizationId,
    shopId: input.shopId,
    orderId: input.orderId ?? null,
    recipientEmail: "vorschau@example.com",
  });
  if (!input.orderId) applySampleData(built.context);
  return renderEmail({ subject, preheader, blocks, context: built.context, branding });
}

function applySampleData(ctx: Awaited<ReturnType<typeof buildContext>>["context"]) {
  ctx.customer = {
    first_name: "Anna",
    last_name: "Muster",
    full_name: "Anna Muster",
    email: "anna.muster@example.com",
  };
  ctx.order ??= {
    number: "ORD-1042",
    date: "12. März 2026",
    subtotal: "89,90 €",
    discount: "",
    shipping: "4,90 €",
    tax: "15,12 €",
    total: "94,80 €",
    currency: "EUR",
    items: [
      { name: "Beispielartikel – Blau / M", quantity: 1, line_total: "59,90 €" },
      { name: "Beispielartikel – Zubehör", quantity: 2, line_total: "30,00 €" },
    ],
    shipping_address: ["Anna Muster", "Musterstraße 1", "10115 Berlin", "DE"],
  };
  ctx.shipment ??= {
    carrier: "MOCK",
    tracking_number: "MK123456789DE",
    tracking_url: "https://example.com/tracking/MK123456789DE",
    status: "in_transit",
    items: ctx.order.items,
  };
  ctx.invoice ??= { number: "RE-2026-000123", date: "12. März 2026", total: "94,80 €" };
  ctx.credit_note ??= { number: "GS-2026-000045", date: "18. März 2026", total: "59,90 €" };
  ctx.return ??= {
    number: "RMA-2026-000012",
    status: "authorized",
    items: [{ name: "Beispielartikel – Blau / M", quantity: 1, line_total: "59,90 €" }],
    instructions: "Bitte legen Sie den Retourenschein bei.",
  };
  ctx.refund ??= { amount: "59,90 €", reason: "Retoure" };
  ctx.payment ??= { method: "Kreditkarte", amount: "94,80 €", status: "paid" };
}

/* ------------------------------- webhooks --------------------------------- */

const STATUS_RANK: Record<DeliveryStatus, number> = {
  unknown: 0,
  accepted: 1,
  sent: 2,
  delivered: 5,
  soft_bounce: 3,
  hard_bounce: 4,
  complained: 4,
  rejected: 4,
};

/**
 * Stores the raw provider payload immutably and updates the communication.
 * The journal row itself is never rewritten; only processing_status changes.
 */
export async function ingestProviderEvent(input: {
  provider: string;
  providerEventId: string;
  providerMessageId: string | null;
  eventType: string;
  deliveryStatus: DeliveryStatus;
  recipient: string | null;
  signatureVerified: boolean;
  payload: Record<string, unknown>;
}) {
  const admin = await getAdmin();
  const { data: existing } = await admin
    .from("communication_provider_events")
    .select("id, processing_status")
    .eq("provider", input.provider)
    .eq("provider_event_id", input.providerEventId)
    .maybeSingle();
  if (existing) return { duplicate: true as const };

  let communication: Row | null = null;
  if (input.providerMessageId) {
    const { data } = await admin
      .from("communication_attempts")
      .select("communication_id, organization_id")
      .eq("provider_message_id", input.providerMessageId)
      .maybeSingle();
    const attempt = data as Row | null;
    if (attempt) {
      const { data: commRow } = await admin
        .from("communications")
        .select("*")
        .eq("id", attempt["communication_id"] as string)
        .maybeSingle();
      communication = commRow as Row | null;
    }
  }

  const { data: inserted } = await admin
    .from("communication_provider_events")
    .insert({
      provider: input.provider,
      provider_event_id: input.providerEventId,
      provider_message_id: input.providerMessageId,
      event_type: input.eventType,
      organization_id: (communication?.["organization_id"] as string) ?? null,
      shop_id: (communication?.["shop_id"] as string) ?? null,
      signature_verified: input.signatureVerified,
      payload: input.payload as never,
      processing_status: "pending",
    } as never)
    .select("id")
    .single();
  const eventId = (inserted as Row)["id"] as string;

  if (!communication) {
    await admin
      .from("communication_provider_events")
      .update({
        processing_status: "unmatched",
        processed_at: new Date().toISOString(),
        processing_error: "Keine passende Kommunikation gefunden.",
      } as never)
      .eq("id", eventId);
    return { matched: false as const };
  }

  const current = (communication["delivery_status"] as DeliveryStatus) ?? "unknown";
  const next = input.deliveryStatus;
  const patch: Row = {};
  if (STATUS_RANK[next] >= STATUS_RANK[current]) {
    patch["delivery_status"] = next;
    patch["provider_status_raw"] = input.eventType;
  }
  if (next === "delivered") {
    patch["status"] = "delivered";
    patch["delivered_at"] = new Date().toISOString();
  }
  if (next === "hard_bounce" || next === "rejected" || next === "complained") {
    patch["status"] = "failed";
    patch["failed_at"] = new Date().toISOString();
    patch["last_error"] = input.eventType;
  }
  if (Object.keys(patch).length) {
    await admin
      .from("communications")
      .update(patch as never)
      .eq("id", communication["id"] as string);
  }

  const address = input.recipient ?? (communication["recipient_address"] as string);
  if ((next === "hard_bounce" || next === "complained") && address) {
    await admin.from("communication_suppressions").upsert(
      {
        organization_id: communication["organization_id"] as string,
        shop_id: null,
        channel: "email",
        address: address.toLowerCase(),
        reason: next === "complained" ? "complaint" : "hard_bounce",
        source: input.provider,
        note: input.eventType,
      } as never,
      { onConflict: "organization_id,channel,address" },
    );
  }

  await admin
    .from("communication_provider_events")
    .update({ processing_status: "processed", processed_at: new Date().toISOString() } as never)
    .eq("id", eventId);

  return { matched: true as const, communicationId: communication["id"] as string };
}

/* --------------------------------- reads ---------------------------------- */

function mapListItem(r: Row): CommunicationListItem {
  return {
    id: r["id"] as string,
    createdAt: r["created_at"] as string,
    recipient: r["recipient_address"] as string,
    templateKey: r["template_key"] as string,
    status: r["status"] as CommunicationStatus,
    deliveryStatus: (r["delivery_status"] as DeliveryStatus) ?? null,
    provider: (r["provider"] as string) ?? null,
    subject: (r["subject_snapshot"] as string) ?? "",
    orderNumber: null,
    sourceEventType: (r["source_event_type"] as string) ?? null,
    isTestSend: Boolean(r["is_test_send"]),
  };
}

export async function listCommunications(input: {
  organizationId: string;
  shopId: string;
  status?: string | null;
  templateKey?: string | null;
  search?: string | null;
  orderId?: string | null;
  customerId?: string | null;
  limit?: number;
}): Promise<CommunicationListItem[]> {
  const admin = await getAdmin();
  let query = admin
    .from("communications")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("shop_id", input.shopId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 100);

  if (input.status) query = query.eq("status", input.status as never);
  if (input.templateKey) query = query.eq("template_key", input.templateKey);
  if (input.orderId) query = query.eq("order_id", input.orderId);
  if (input.customerId) query = query.eq("customer_id", input.customerId);
  if (input.search) query = query.ilike("recipient_address", `%${input.search}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];

  const orderIds = [...new Set(rows.map((r) => r["order_id"]).filter(Boolean))] as string[];
  const numbers = new Map<string, string>();
  if (orderIds.length) {
    const { data: orders } = await admin
      .from("orders")
      .select("id, order_number")
      .in("id", orderIds);
    for (const o of (orders ?? []) as Row[])
      numbers.set(o["id"] as string, o["order_number"] as string);
  }
  return rows.map((r) => ({
    ...mapListItem(r),
    orderNumber: r["order_id"] ? (numbers.get(r["order_id"] as string) ?? null) : null,
  }));
}

export async function loadCommunication(
  organizationId: string,
  communicationId: string,
): Promise<CommunicationDetail> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("communications")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", communicationId)
    .maybeSingle();
  const row = data as Row | null;
  if (!row) throw new Error("Kommunikation nicht gefunden.");

  const { data: attemptRows } = await admin
    .from("communication_attempts")
    .select("*")
    .eq("communication_id", communicationId)
    .order("attempt_number", { ascending: true });

  const messageIds = ((attemptRows ?? []) as Row[])
    .map((a) => a["provider_message_id"])
    .filter(Boolean) as string[];
  const { data: eventRows } = messageIds.length
    ? await admin
        .from("communication_provider_events")
        .select("*")
        .in("provider_message_id", messageIds)
        .order("received_at", { ascending: true })
    : { data: [] };

  let orderNumber: string | null = null;
  if (row["order_id"]) {
    const { data: order } = await admin
      .from("orders")
      .select("order_number")
      .eq("id", row["order_id"] as string)
      .maybeSingle();
    orderNumber = ((order as Row | null)?.["order_number"] as string) ?? null;
  }

  const { data: versionRow } = row["template_version_id"]
    ? await admin
        .from("communication_template_versions")
        .select("version")
        .eq("id", row["template_version_id"] as string)
        .maybeSingle()
    : { data: null };

  return {
    ...mapListItem(row),
    orderNumber,
    html: (row["html_snapshot"] as string) ?? "",
    text: (row["text_snapshot"] as string) ?? "",
    locale: (row["locale"] as string) ?? "de-DE",
    senderName: (row["sender_name"] as string) ?? null,
    senderAddress: (row["sender_address"] as string) ?? null,
    templateVersion: ((versionRow as Row | null)?.["version"] as number) ?? null,
    lastError: (row["last_error"] as string) ?? null,
    resendOf: (row["resend_of_communication_id"] as string) ?? null,
    attempts: ((attemptRows ?? []) as Row[]).map((a) => ({
      id: a["id"] as string,
      attemptNumber: Number(a["attempt_number"] ?? 1),
      provider: a["provider"] as string,
      status: a["status"] as DeliveryStatus,
      errorCode: (a["error_code"] as string) ?? null,
      errorMessage: (a["error_message"] as string) ?? null,
      startedAt: a["started_at"] as string,
      completedAt: (a["completed_at"] as string) ?? null,
      providerMessageId: (a["provider_message_id"] as string) ?? null,
    })),
    providerEvents: ((eventRows ?? []) as Row[]).map((e) => ({
      id: e["id"] as string,
      eventType: e["event_type"] as string,
      provider: e["provider"] as string,
      receivedAt: e["received_at"] as string,
      signatureVerified: Boolean(e["signature_verified"]),
      processingStatus: String(e["processing_status"] ?? "pending"),
    })),
  };
}
