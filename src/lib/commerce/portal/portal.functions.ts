/**
 * Customer portal API.
 * Signed-in customers are resolved through customers.auth_user_id.
 * Guests prove access with a 256-bit token that is bound to exactly one order.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PortalOrderDetail, PortalOrderSummary } from "./portal.server";
import type { ReturnEligibility, ReturnReasonCode } from "../returns/return.types";

/* --------------------------- signed-in customer -------------------------- */

export const getPortalOrdersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortalOrderSummary[]> => {
    const { listPortalOrders } = await import("./portal.server");
    return await listPortalOrders(context.userId);
  });

/** Links guest orders with the same e-mail; each claim is audited separately. */
export const linkMyOrdersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: string } | null)?.email;
    if (!email) return { claimed: 0 };
    const { claimOrdersForUser } = await import("../customers/customer.server");
    return await claimOrdersForUser({ userId: context.userId, email });
  });

async function assertOwnedOrder(userId: string, orderId: string) {
  const { ownedOrderIds } = await import("./portal.server");
  const { orderIds } = await ownedOrderIds(userId);
  if (!orderIds.includes(orderId))
    throw new Error("Diese Bestellung gehört nicht zu deinem Konto.");
}

export const getPortalOrderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string }) => data)
  .handler(async ({ data, context }): Promise<PortalOrderDetail> => {
    await assertOwnedOrder(context.userId, data.orderId);
    const { loadPortalOrder } = await import("./portal.server");
    return await loadPortalOrder(data.orderId);
  });

export const getPortalDocumentUrlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      orderId: string;
      documentId: string;
      kind: "invoice" | "credit_note" | "delivery_note";
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertOwnedOrder(context.userId, data.orderId);
    const { loadPortalOrder, signPortalDocument } = await import("./portal.server");
    const order = await loadPortalOrder(data.orderId);
    if (!order.documents.some((d) => d.id === data.documentId && d.kind === data.kind)) {
      throw new Error("Dokument gehört nicht zu dieser Bestellung.");
    }
    return await signPortalDocument(data.kind, data.documentId);
  });

export const getPortalEligibilityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string }) => data)
  .handler(async ({ data, context }): Promise<ReturnEligibility> => {
    await assertOwnedOrder(context.userId, data.orderId);
    const { loadPortalOrder } = await import("./portal.server");
    const order = await loadPortalOrder(data.orderId);
    const { getEligibility } = await import("../returns/return.server");
    return await getEligibility(order.organizationId, data.orderId);
  });

export const createPortalReturnFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      orderId: string;
      items: { orderItemId: string; quantity: number; reasonCode?: ReturnReasonCode }[];
      reason: ReturnReasonCode;
      note?: string | null;
      idempotencyKey: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertOwnedOrder(context.userId, data.orderId);
    const { getAdmin } = await import("../core.server");
    const { loadPortalOrder } = await import("./portal.server");
    const order = await loadPortalOrder(data.orderId);
    const admin = await getAdmin();
    const { data: customer } = await admin
      .from("customers")
      .select("id, status")
      .eq("shop_id", order.shopId)
      .eq("auth_user_id", context.userId)
      .maybeSingle();
    const status = (customer as { status?: string } | null)?.status;
    if (status === "blocked") {
      throw new Error(
        "Für dieses Konto sind neue Retouren gesperrt. Bitte wende dich an den Support.",
      );
    }
    const { requestReturn } = await import("../returns/return.server");
    return await requestReturn({
      organizationId: order.organizationId,
      shopId: order.shopId,
      orderId: data.orderId,
      customerId: (customer as { id?: string } | null)?.id ?? null,
      items: data.items,
      reason: data.reason,
      note: data.note ?? null,
      idempotencyKey: data.idempotencyKey,
    });
  });

export const cancelPortalReturnFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string; returnId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertOwnedOrder(context.userId, data.orderId);
    const { loadPortalOrder } = await import("./portal.server");
    const order = await loadPortalOrder(data.orderId);
    if (!order.returns.some((r) => r.id === data.returnId)) {
      throw new Error("Retoure gehört nicht zu dieser Bestellung.");
    }
    const { cancelReturn } = await import("../returns/return.server");
    return await cancelReturn({
      organizationId: order.organizationId,
      returnId: data.returnId,
      actorId: context.userId,
      byCustomer: true,
    });
  });

/* -------------------------------- guests -------------------------------- */

/**
 * Guest lookup with order number + e-mail. Issues a short-lived single-order
 * token. Answers uniformly to avoid order-number enumeration.
 */
export const requestGuestAccessFn = createServerFn({ method: "POST" })
  .inputValidator((data: { orderNumber: string; email: string }) => data)
  .handler(async ({ data }) => {
    const { enforcePublicLimit } = await import("../security/limit.server");
    await enforcePublicLimit("guest_access_request");
    await enforcePublicLimit("guest_access_request", data.email.trim().toLowerCase().slice(0, 40));
    const { getAdmin } = await import("../core.server");
    const admin = await getAdmin();
    const { data: order } = await admin
      .from("orders")
      .select("id, organization_id, shop_id, email")
      .eq("order_number", data.orderNumber.trim())
      .maybeSingle();
    const row = order as {
      id: string;
      organization_id: string;
      shop_id: string;
      email: string | null;
    } | null;
    if (!row || (row.email ?? "").toLowerCase() !== data.email.trim().toLowerCase()) {
      return { token: null as string | null };
    }
    const { issueGuestToken } = await import("../customers/customer.server");
    const { token } = await issueGuestToken({
      organizationId: row.organization_id,
      shopId: row.shop_id,
      orderId: row.id,
      ttlHours: 2,
    });
    return { token };
  });

async function resolveGuest(token: string) {
  const { resolveGuestToken } = await import("../customers/customer.server");
  const access = await resolveGuestToken(token);
  if (!access) throw new Error("Dieser Zugangslink ist ungültig oder abgelaufen.");
  return access;
}

export const getGuestOrderFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<PortalOrderDetail> => {
    const access = await resolveGuest(data.token);
    const { loadPortalOrder } = await import("./portal.server");
    return await loadPortalOrder(access.orderId);
  });

export const getGuestDocumentUrlFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      token: string;
      documentId: string;
      kind: "invoice" | "credit_note" | "delivery_note";
    }) => data,
  )
  .handler(async ({ data }) => {
    const access = await resolveGuest(data.token);
    const { loadPortalOrder, signPortalDocument } = await import("./portal.server");
    const order = await loadPortalOrder(access.orderId);
    if (!order.documents.some((d) => d.id === data.documentId && d.kind === data.kind)) {
      throw new Error("Dokument gehört nicht zu dieser Bestellung.");
    }
    return await signPortalDocument(data.kind, data.documentId);
  });

export const getGuestEligibilityFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<ReturnEligibility> => {
    const access = await resolveGuest(data.token);
    const { getEligibility } = await import("../returns/return.server");
    return await getEligibility(access.organizationId, access.orderId);
  });

export const createGuestReturnFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      token: string;
      items: { orderItemId: string; quantity: number; reasonCode?: ReturnReasonCode }[];
      reason: ReturnReasonCode;
      note?: string | null;
      idempotencyKey: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const access = await resolveGuest(data.token);
    const { requestReturn } = await import("../returns/return.server");
    return await requestReturn({
      organizationId: access.organizationId,
      shopId: access.shopId,
      orderId: access.orderId,
      items: data.items,
      reason: data.reason,
      note: data.note ?? null,
      idempotencyKey: data.idempotencyKey,
    });
  });
