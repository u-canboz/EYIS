/**
 * Action adapters. Every action is a thin, permission-checked wrapper around an
 * existing engine SDK — the automation engine never writes domain tables itself.
 *
 * The internal `system_automation` actor may only perform capabilities listed in
 * SYSTEM_AUTOMATION_CAPABILITIES. It is not a membership role and never
 * bypasses the invariants of the underlying engines.
 */
import { getAdmin, writeAudit } from "../core.server";
import { SYSTEM_AUTOMATION_CAPABILITIES, findAction } from "./action-registry";
import { createTask } from "./tasks.server";
import { WebhookError, sendWebhook } from "./webhook.server";

export type ActionContext = {
  organizationId: string;
  shopId: string;
  executionId: string;
  ruleId: string;
  eventType: string;
  eventId: string | null;
  correlationId: string;
  payload: Record<string, unknown>;
  dryRun: boolean;
};

export type ActionOutcome = {
  status: "succeeded" | "skipped" | "failed";
  output?: Record<string, unknown>;
  reason?: string;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
};

const ok = (output: Record<string, unknown> = {}): ActionOutcome => ({ status: "succeeded", output });
const skip = (reason: string): ActionOutcome => ({ status: "skipped", reason });
const fail = (errorCode: string, errorMessage: string, retryable = false): ActionOutcome => ({
  status: "failed",
  errorCode,
  errorMessage,
  retryable,
});

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Deterministic idempotency key so re-runs never duplicate domain records. */
function idem(ctx: ActionContext, position: number, suffix = "") {
  return `automation:${ctx.executionId}:${position}${suffix ? `:${suffix}` : ""}`;
}

async function loadOrder(organizationId: string, orderId: string) {
  const admin = await getAdmin();
  const { data } = await admin
    .from("orders")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", orderId)
    .maybeSingle();
  return (data as Record<string, unknown>) ?? null;
}

async function invoiceStrategy(organizationId: string, shopId: string) {
  const admin = await getAdmin();
  const { data } = await admin
    .from("invoice_settings")
    .select("invoice_creation_strategy, auto_issue")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .maybeSingle();
  const row = (data as Record<string, unknown>) ?? {};
  return {
    strategy: (row["invoice_creation_strategy"] as string) ?? "manual",
    autoIssue: Boolean(row["auto_issue"]),
  };
}

export async function runAction(
  action: { position: number; actionType: string; config: Record<string, unknown> },
  ctx: ActionContext,
): Promise<ActionOutcome> {
  const definition = findAction(action.actionType);
  if (!definition) return fail("invalid_configuration", `Unbekannte Aktion: ${action.actionType}`);
  if (!SYSTEM_AUTOMATION_CAPABILITIES.has(definition.capability))
    return fail("permission_denied", `Die Automation darf „${definition.label}" nicht ausführen.`);

  if (ctx.dryRun) {
    return { status: "skipped", reason: "dry_run", output: { would_run: action.actionType, config: action.config } };
  }

  const cfg = action.config ?? {};
  const p = ctx.payload;
  const orderId = str(p["order_id"]);
  const customerId = str(p["customer_id"]);

  try {
    switch (action.actionType) {
      case "communication.send": {
        const templateKey = str(cfg["templateKey"]);
        if (!templateKey) return fail("invalid_configuration", "Es ist keine Vorlage ausgewählt.");
        const { queueCommunication, dispatchCommunication } = await import(
          "../communications/communication.server"
        );
        const result = await queueCommunication({
          organizationId: ctx.organizationId,
          shopId: ctx.shopId,
          templateKey,
          locale: str(cfg["locale"]) ?? "de-DE",
          eventType: ctx.eventType,
          eventId: ctx.eventId,
          orderId,
          customerId,
          shipmentId: str(p["shipment_id"]),
          returnId: str(p["return_id"]),
          invoiceId: str(p["invoice_id"]),
          creditNoteId: str(p["credit_note_id"]),
          refundId: str(p["refund_id"]),
          recipientEmail: str(p["email"]),
        } as never);
        if (!result.queued) return skip(result.reason);
        await dispatchCommunication(result.communicationId);
        return ok({ communication_id: result.communicationId, template_key: templateKey });
      }

      case "invoice.create": {
        if (!orderId) return skip("no_order");
        const { strategy } = await invoiceStrategy(ctx.organizationId, ctx.shopId);
        if (strategy !== "manual")
          return skip(
            `invoice_strategy_${strategy}` /* Shop erzeugt Rechnungen bereits automatisch */,
          );
        const { createInvoiceFromOrder } = await import("../documents/document.server");
        const res = await createInvoiceFromOrder({
          organizationId: ctx.organizationId,
          orderId,
          actorId: ctx.ruleId,
          idempotencyKey: idem(ctx, action.position),
        });
        return res.created
          ? ok({ invoice_id: res.invoice_id })
          : skip("invoice_already_exists");
      }

      case "invoice.issue": {
        if (!orderId) return skip("no_order");
        const admin = await getAdmin();
        const { data } = await admin
          .from("invoices")
          .select("id, status")
          .eq("organization_id", ctx.organizationId)
          .eq("order_id", orderId)
          .eq("status", "draft")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const draft = data as { id: string } | null;
        if (!draft) return skip("no_draft_invoice");
        const { autoIssue, strategy } = await invoiceStrategy(ctx.organizationId, ctx.shopId);
        if (strategy !== "manual" && autoIssue) return skip("invoice_auto_issue_enabled");
        const { issueInvoice } = await import("../documents/document.server");
        const res = await issueInvoice({
          organizationId: ctx.organizationId,
          invoiceId: draft.id,
          actorId: ctx.ruleId,
          idempotencyKey: idem(ctx, action.position),
        });
        return ok({ invoice_id: res.invoice_id, invoice_number: res.invoice_number });
      }

      case "fulfillment.create": {
        if (!orderId) return skip("no_order");
        const order = await loadOrder(ctx.organizationId, orderId);
        if (!order) return fail("entity_not_found", "Bestellung nicht gefunden.");
        if (order["order_status"] === "cancelled") return skip("order_cancelled");
        if (order["fulfillment_status"] === "fulfilled") return skip("already_fulfilled");
        const { suggestAllocation, createFulfillment } = await import(
          "../fulfillment/fulfillment.server"
        );
        const suggestion = await suggestAllocation(ctx.organizationId, orderId);
        const items = (suggestion.lines ?? [])
          .map((i) => ({ orderItemId: i.orderItemId, quantity: i.openQuantity }))
          .filter((i) => i.quantity > 0);
        if (!items.length) return skip("nothing_to_fulfill");
        const locationId =
          suggestion.lines.find((l) => l.suggestedLocationId)?.suggestedLocationId ?? null;
        const res = await createFulfillment({
          organizationId: ctx.organizationId,
          shopId: ctx.shopId,
          orderId,
          locationId,
          actorId: ctx.ruleId,
          items,
          notes: "Automatisch angelegt",
          idempotencyKey: idem(ctx, action.position),
        });
        return ok({ fulfillment_id: res.fulfillment_id, items: res.items });
      }

      case "customer.add_to_group":
      case "customer.remove_from_group": {
        if (!customerId) return skip("no_customer");
        const groupId = str(cfg["groupId"]);
        if (!groupId) return fail("invalid_configuration", "Es ist keine Kundengruppe ausgewählt.");
        const admin = await getAdmin();
        if (action.actionType === "customer.add_to_group") {
          const { error } = await admin
            .from("customer_group_members")
            .upsert(
              {
                organization_id: ctx.organizationId,
                customer_id: customerId,
                customer_group_id: groupId,
              } as never,
              { onConflict: "customer_id,customer_group_id", ignoreDuplicates: true },
            );
          if (error) return fail("engine_error", error.message);
        } else {
          const { error } = await admin
            .from("customer_group_members")
            .delete()
            .eq("organization_id", ctx.organizationId)
            .eq("customer_id", customerId)
            .eq("customer_group_id", groupId);
          if (error) return fail("engine_error", error.message);
        }
        return ok({ customer_id: customerId, group_id: groupId });
      }

      case "order.add_note": {
        if (!orderId) return skip("no_order");
        const note = str(cfg["note"]);
        if (!note) return fail("invalid_configuration", "Die Notiz ist leer.");
        const order = await loadOrder(ctx.organizationId, orderId);
        if (!order) return fail("entity_not_found", "Bestellung nicht gefunden.");
        const stamp = new Date().toLocaleString("de-DE");
        const existing = (order["internal_note"] as string | null) ?? "";
        const admin = await getAdmin();
        const { error } = await admin
          .from("orders")
          .update({ internal_note: `${existing}${existing ? "\n" : ""}[Automation ${stamp}] ${note}` } as never)
          .eq("id", orderId)
          .eq("organization_id", ctx.organizationId);
        if (error) return fail("engine_error", error.message);
        return ok({ order_id: orderId });
      }

      case "inventory.create_alert":
      case "return.notify_internal":
      case "task.create": {
        const preset =
          action.actionType === "inventory.create_alert"
            ? {
                title: `Bestand niedrig: ${str(p["sku"]) ?? str(p["variant_id"]) ?? "Artikel"}`,
                description: `Verfügbar: ${p["available"] ?? "?"} (Schwelle: ${p["threshold"] ?? "?"})`,
                entityType: "inventory_item",
                entityId: str(p["inventory_item_id"]) ?? str(p["variant_id"]),
                priority: "high" as const,
                dedupe: `low_stock:${str(p["inventory_item_id"]) ?? str(p["variant_id"]) ?? "x"}`,
              }
            : action.actionType === "return.notify_internal"
              ? {
                  title: `Retoure ${str(p["return_number"]) ?? ""} prüfen`,
                  description: `Grund: ${str(p["reason"]) ?? "unbekannt"}`,
                  entityType: "return",
                  entityId: str(p["return_id"]),
                  priority: "normal" as const,
                  dedupe: `return:${str(p["return_id"]) ?? "x"}`,
                }
              : {
                  title: str(cfg["title"]) ?? "Aufgabe",
                  description: str(cfg["description"]),
                  entityType: orderId ? "order" : null,
                  entityId: orderId,
                  priority: (str(cfg["priority"]) as "low" | "normal" | "high" | "urgent") ?? "normal",
                  dedupe: null as string | null,
                };
        const dueInHours = Number(cfg["dueInHours"] ?? 0);
        const res = await createTask({
          organizationId: ctx.organizationId,
          shopId: ctx.shopId,
          title: preset.title,
          description: preset.description ?? null,
          priority: preset.priority,
          entityType: preset.entityType,
          entityId: preset.entityId,
          assignedTo: str(cfg["assignedTo"]),
          dueAt: dueInHours > 0 ? new Date(Date.now() + dueInHours * 3_600_000).toISOString() : null,
          source: "automation",
          executionId: ctx.executionId,
          dedupeKey: preset.dedupe,
        });
        return res.created ? ok({ task_id: res.taskId }) : skip("task_already_open");
      }

      case "webhook.send": {
        const endpointId = str(cfg["endpointId"]);
        if (!endpointId) return fail("invalid_configuration", "Es ist kein Webhook-Ziel ausgewählt.");
        const res = await sendWebhook({
          endpointId,
          organizationId: ctx.organizationId,
          payload: {
            event: ctx.eventType,
            id: ctx.executionId,
            created_at: new Date().toISOString(),
            shop_id: ctx.shopId,
            data: ctx.payload,
          },
        });
        return ok({ status: res.status });
      }

      default:
        return fail("invalid_configuration", `Aktion ${action.actionType} ist nicht implementiert.`);
    }
  } catch (error) {
    if (error instanceof WebhookError) return fail(error.code, error.message, error.retryable);
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    const retryable = /timeout|network|fetch failed|temporar/i.test(message);
    await writeAudit({
      organizationId: ctx.organizationId,
      actorId: null,
      action: "automation.action_failed",
      entityType: "automation_execution",
      entityId: ctx.executionId,
      metadata: { action_type: action.actionType, message },
    });
    return fail(retryable ? "temporary_unavailable" : "engine_error", message, retryable);
  }
}
