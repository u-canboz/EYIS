/**
 * Payment orchestration. Money never comes from the browser: amount and
 * currency always come from the immutable checkout snapshot, and an order is
 * only created by order_finalize_from_payment after a server-verified payment.
 */
import { getAdmin, writeAudit, emitEvent } from "../core.server";
import { getProvider } from "./provider.server";
import type { PaymentStatusView } from "./payment-types";
import { publishOrderEvent } from "../event-payloads.server";

export type PaymentSessionRow = {
  id: string;
  organization_id: string;
  shop_id: string;
  checkout_session_id: string;
  checkout_snapshot_id: string;
  provider: string;
  environment: "test" | "live";
  status: "created" | "pending" | "paid" | "failed" | "cancelled" | "expired";
  amount_minor: number;
  currency_code: string;
  provider_session_id: string | null;
  provider_payment_id: string | null;
  redirect_url: string | null;
};

export async function loadPaymentSession(id: string) {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("payment_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Zahlungssitzung nicht gefunden.");
  return data as unknown as PaymentSessionRow;
}

/** Latest immutable checkout snapshot of a session — the single source of truth for the amount. */
export async function loadLatestSnapshot(checkoutSessionId: string) {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("checkout_snapshots")
    .select("id, currency_code, totals, email")
    .eq("checkout_session_id", checkoutSessionId)
    .order("version", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0] as
    | { id: string; currency_code: string; totals: Record<string, unknown>; email: string | null }
    | undefined;
  if (!row) throw new Error("Der Checkout ist noch nicht validiert.");
  return row;
}

export async function resolveProviderId(
  organizationId: string,
  shopId: string,
  requested?: string | null,
) {
  const admin = await getAdmin();
  const { data } = await admin
    .from("payment_provider_configs")
    .select("provider, environment, status, priority")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .eq("status", "active")
    .order("priority", { ascending: true });
  const rows = (data ?? []) as { provider: string; environment: "test" | "live" }[];
  if (requested) {
    const match = rows.find((r) => r.provider === requested);
    if (!match) throw new Error(`Zahlungsanbieter "${requested}" ist für diesen Shop nicht aktiv.`);
    return match;
  }
  const first = rows[0];
  if (!first) throw new Error("Für diesen Shop ist kein Zahlungsanbieter aktiv.");
  return first;
}

export async function createPaymentSession(input: {
  organizationId: string;
  shopId: string;
  checkoutSessionId: string;
  email: string | null;
  provider?: string | null;
  returnUrl: string;
  cancelUrl: string;
}) {
  const admin = await getAdmin();
  const snapshot = await loadLatestSnapshot(input.checkoutSessionId);
  const amountMinor = Number((snapshot.totals as Record<string, unknown>)["totalMinor"] ?? 0);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) throw new Error("Ungültiger Zahlbetrag.");

  const config = await resolveProviderId(
    input.organizationId,
    input.shopId,
    input.provider ?? null,
  );

  const { data: inserted, error } = await admin
    .from("payment_sessions")
    .insert({
      organization_id: input.organizationId,
      shop_id: input.shopId,
      checkout_session_id: input.checkoutSessionId,
      checkout_snapshot_id: snapshot.id,
      provider: config.provider,
      environment: config.environment,
      status: "created",
      amount_minor: amountMinor,
      currency_code: snapshot.currency_code,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const paymentSessionId = (inserted as { id: string }).id;

  const { count } = await admin
    .from("payment_attempts")
    .select("id", { count: "exact", head: true })
    .eq("payment_session_id", paymentSessionId);
  await admin.from("payment_attempts").insert({
    organization_id: input.organizationId,
    payment_session_id: paymentSessionId,
    attempt_number: (count ?? 0) + 1,
    status: "started",
  } as never);

  const provider = await getProvider(config.provider);
  const successUrl = `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}ps=${paymentSessionId}`;
  const cancelUrl = `${input.cancelUrl}${input.cancelUrl.includes("?") ? "&" : "?"}ps=${paymentSessionId}&cancelled=1`;

  try {
    const created = await provider.createSession({
      paymentSessionId,
      amountMinor,
      currencyCode: snapshot.currency_code,
      email: input.email ?? snapshot.email,
      description: `Bestellung ${input.checkoutSessionId.slice(0, 8)}`,
      successUrl,
      cancelUrl,
      environment: config.environment,
      idempotencyKey: `ps-${paymentSessionId}`,
    });
    await admin
      .from("payment_sessions")
      .update({
        status: "pending",
        provider_session_id: created.providerSessionId,
        redirect_url: created.redirectUrl,
      } as never)
      .eq("id", paymentSessionId);
    await admin
      .from("checkout_sessions")
      .update({ status: "awaiting_payment" } as never)
      .eq("id", input.checkoutSessionId);

    await writeAudit({
      organizationId: input.organizationId,
      actorId: null,
      action: "payment.session.created",
      entityType: "payment_session",
      entityId: paymentSessionId,
      metadata: { provider: config.provider, amount_minor: amountMinor },
    });

    return {
      paymentSessionId,
      provider: config.provider,
      environment: config.environment,
      amountMinor,
      currencyCode: snapshot.currency_code,
      redirectUrl: created.redirectUrl,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Zahlung konnte nicht gestartet werden.";
    await admin
      .from("payment_sessions")
      .update({ status: "failed", last_error: message } as never)
      .eq("id", paymentSessionId);
    throw new Error(message);
  }
}

/** Creates the order from a verified payment. Idempotent through the database. */
export async function finalizeFromPayment(args: {
  organizationId: string;
  paymentSessionId: string;
  providerPaymentId: string | null;
  amountMinor: number;
  currencyCode: string;
  actorId?: string | null;
  idempotencyKey?: string | null;
}) {
  const admin = await getAdmin();
  const { data, error } = await admin.rpc(
    "order_finalize_from_payment" as never,
    {
      _org: args.organizationId,
      _payment_session: args.paymentSessionId,
      _provider_payment_id: args.providerPaymentId,
      _amount_minor: args.amountMinor,
      _currency: args.currencyCode,
      _actor: args.actorId ?? null,
      _idem: args.idempotencyKey ?? `finalize:${args.paymentSessionId}`,
    } as never,
  );
  if (error) throw new Error(error.message);
  const result = data as unknown as { order_id: string; order_number: string; created: boolean };
  if (result.created) {
    await publishOrderEvent(result.order_id, "order.created");
  }
  await publishOrderEvent(result.order_id, "payment.succeeded", {
    amount_minor: args.amountMinor,
    payment_provider: (await loadPaymentSession(args.paymentSessionId)).provider,
  });
  return result;
}

export async function markPaymentFailed(
  paymentSessionId: string,
  message: string,
  cancelled = false,
) {
  const admin = await getAdmin();
  const ps = await loadPaymentSession(paymentSessionId);
  await admin
    .from("payment_sessions")
    .update({ status: cancelled ? "cancelled" : "failed", last_error: message } as never)
    .eq("id", paymentSessionId);
  await emitEvent(ps.organization_id, cancelled ? "payment.cancelled" : "payment.failed", {
    payment_session_id: paymentSessionId,
    message,
  });
}

/** Server-side truth for the return page: never trusts the browser. */
export async function paymentStatus(paymentSessionId: string): Promise<PaymentStatusView> {
  const admin = await getAdmin();
  const ps = await loadPaymentSession(paymentSessionId);

  // Fallback when the webhook has not arrived yet: ask the provider directly.
  if (ps.status === "pending" && ps.provider_session_id) {
    try {
      const provider = await getProvider(ps.provider);
      const state = await provider.getSession(ps.provider_session_id);
      if (state.status === "paid") {
        await finalizeFromPayment({
          organizationId: ps.organization_id,
          paymentSessionId: ps.id,
          providerPaymentId: state.providerPaymentId,
          amountMinor: state.amountMinor ?? ps.amount_minor,
          currencyCode: state.currencyCode ?? ps.currency_code,
        });
      } else if (state.status === "expired") {
        await markPaymentFailed(ps.id, "Die Zahlung ist abgelaufen.", true);
      }
    } catch (e) {
      console.error("payment sync failed", e);
    }
  }

  const fresh = await loadPaymentSession(paymentSessionId);
  const { data: order } = await admin
    .from("orders")
    .select("id, order_number, total_minor, currency_code, email")
    .eq("checkout_session_id", fresh.checkout_session_id)
    .maybeSingle();
  const o = order as {
    id: string;
    order_number: string;
    total_minor: number;
    currency_code: string;
    email: string | null;
  } | null;

  return {
    paymentSessionId: fresh.id,
    status: fresh.status,
    amountMinor: Number(fresh.amount_minor),
    currencyCode: fresh.currency_code,
    order: o
      ? {
          id: o.id,
          orderNumber: o.order_number,
          totalMinor: Number(o.total_minor),
          currencyCode: o.currency_code,
          email: o.email,
        }
      : null,
  };
}
