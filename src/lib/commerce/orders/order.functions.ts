/** Admin order & refund API. Every call is permission-checked server-side. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { OrderDetailView, OrderListItem } from "../payments/payment-types";

export const listOrdersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      organizationId: string;
      shopId?: string | null;
      search?: string | null;
      orderStatus?: string | null;
      paymentStatus?: string | null;
      from?: string | null;
      to?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }): Promise<OrderListItem[]> => {
    const { assertPermission } = await import("../core.server");
    const orders = await import("./order.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "orders.read");
    return await orders.listOrders(data);
  });

export const getOrderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; orderId: string }) => data)
  .handler(async ({ data, context }): Promise<OrderDetailView> => {
    const { assertPermission } = await import("../core.server");
    const orders = await import("./order.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "orders.read");
    return await orders.loadOrderDetail(data.organizationId, data.orderId);
  });

export const setOrderNoteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; orderId: string; note: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission, getAdmin, writeAudit } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "orders.manage");
    const admin = await getAdmin();
    const { error } = await admin
      .from("orders")
      .update({ internal_note: data.note } as never)
      .eq("organization_id", data.organizationId)
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);
    await writeAudit({
      organizationId: data.organizationId,
      actorId: context.userId,
      action: "order.note_updated",
      entityType: "order",
      entityId: data.orderId,
      metadata: {},
    });
    return { ok: true };
  });

export const cancelOrderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; orderId: string; reason: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission, getAdmin } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "orders.cancel");
    const admin = await getAdmin();
    const { data: result, error } = await admin.rpc("order_cancel" as never, {
      _org: data.organizationId,
      _order: data.orderId,
      _actor: context.userId,
      _reason: data.reason,
      _idem: null,
    } as never);
    if (error) throw new Error(error.message);
    const cancelled = result as unknown as { order_id: string; status: string; changed: boolean };
    if (cancelled.changed) {
      const { publishOrderEvent } = await import("../event-payloads.server");
      await publishOrderEvent(data.orderId, "order.cancelled", { reason: data.reason });
    }
    return cancelled;
  });

export const createRefundFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      organizationId: string;
      orderId: string;
      amountMinor: number;
      reason: string;
      idempotencyKey?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission, getAdmin } = await import("../core.server");
    const { getProvider } = await import("../payments/provider.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "payments.refund");
    const admin = await getAdmin();

    const { data: created, error } = await admin.rpc("refund_create" as never, {
      _org: data.organizationId,
      _order: data.orderId,
      _actor: context.userId,
      _amount_minor: Math.floor(data.amountMinor),
      _reason: data.reason,
      _idem: data.idempotencyKey ?? null,
    } as never);
    if (error) throw new Error(error.message);
    const refund = created as unknown as { refund_id: string; amount_minor: number };

    // Charge transaction carries the provider payment id used for the refund.
    const { data: tx } = await admin
      .from("payment_transactions")
      .select("provider, provider_transaction_id")
      .eq("order_id", data.orderId)
      .eq("type", "charge")
      .order("created_at", { ascending: false })
      .limit(1);
    const charge = ((tx ?? [])[0] ?? null) as { provider: string; provider_transaction_id: string | null } | null;

    let status: "completed" | "processing" | "failed" = "processing";
    let providerRefundId: string | null = null;
    let errorMessage: string | null = null;

    if (charge?.provider_transaction_id) {
      try {
        const provider = await getProvider(charge.provider);
        const result = await provider.refundPayment(
          charge.provider_transaction_id,
          Number(refund.amount_minor),
          data.reason,
        );
        status = result.status;
        providerRefundId = result.providerRefundId;
      } catch (e) {
        status = "failed";
        errorMessage = e instanceof Error ? e.message : "Erstattung beim Anbieter fehlgeschlagen.";
      }
    } else {
      status = "failed";
      errorMessage = "Keine Zahlungsbuchung mit Anbieter-Referenz gefunden.";
    }

    const { error: settleError } = await admin.rpc("refund_settle" as never, {
      _org: data.organizationId,
      _refund: refund.refund_id,
      _status: status,
      _provider: charge?.provider ?? null,
      _provider_refund_id: providerRefundId,
      _error: errorMessage,
    } as never);
    if (settleError) throw new Error(settleError.message);
    if (status === "completed") {
      const { publishOrderEvent } = await import("../event-payloads.server");
      await publishOrderEvent(data.orderId, "refund.completed", {
        refund_id: refund.refund_id,
        amount_minor: Number(refund.amount_minor),
        reason: data.reason,
      });
    }
    if (errorMessage) throw new Error(errorMessage);

    return { refundId: refund.refund_id, status };
  });
