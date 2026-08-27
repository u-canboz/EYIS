/**
 * Storefront payment API (guest-authorised by cart token) plus admin provider
 * management. Amounts always come from the checkout snapshot, never from input.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PaymentStatusView, ProviderConfigView } from "./payment-types";

type SessionAuth = { sessionId: string; token: string };

export const createPaymentSessionFn = createServerFn({ method: "POST" })
  .inputValidator(
    (
      data: SessionAuth & {
        provider?: string | null;
        returnUrl: string;
        cancelUrl?: string | null;
      },
    ) => data,
  )
  .handler(async ({ data }) => {
    const checkout = await import("../checkout.server");
    const payments = await import("./payment.server");
    const { session, cart } = await checkout.loadSessionAuthorized(data.sessionId, data.token);

    if (!["validated", "awaiting_payment"].includes(session.status))
      throw new Error(`Checkout ist nicht zahlungsbereit (${session.status}).`);
    if (Date.parse(session.expires_at) <= Date.now())
      throw new Error("Die Checkout-Sitzung ist abgelaufen.");

    const view = await checkout.buildCheckoutView(session, cart);
    if (!view.ready) throw new Error(view.issues[0] ?? "Checkout ist unvollständig.");

    return await payments.createPaymentSession({
      organizationId: session.organization_id,
      shopId: session.shop_id,
      checkoutSessionId: session.id,
      email: session.email,
      provider: data.provider ?? null,
      returnUrl: data.returnUrl,
      cancelUrl: data.cancelUrl ?? data.returnUrl,
    });
  });

export const getPaymentStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: { paymentSessionId: string; token: string }) => data)
  .handler(async ({ data }): Promise<PaymentStatusView> => {
    const payments = await import("./payment.server");
    const cartApi = await import("../cart.server");
    const checkout = await import("../checkout.server");
    const ps = await payments.loadPaymentSession(data.paymentSessionId);
    const session = await checkout.loadSession(ps.checkout_session_id);
    // Authorisation: the caller must hold the cart token of this checkout.
    await cartApi.loadCartAuthorized(session.cart_id, data.token);
    return await payments.paymentStatus(data.paymentSessionId);
  });

export const cancelPaymentFn = createServerFn({ method: "POST" })
  .inputValidator((data: { paymentSessionId: string; token: string }) => data)
  .handler(async ({ data }) => {
    const payments = await import("./payment.server");
    const cartApi = await import("../cart.server");
    const checkout = await import("../checkout.server");
    const { getProviderForShop } = await import("./provider.server");
    const ps = await payments.loadPaymentSession(data.paymentSessionId);
    const session = await checkout.loadSession(ps.checkout_session_id);
    await cartApi.loadCartAuthorized(session.cart_id, data.token);

    if (ps.status === "paid") throw new Error("Diese Zahlung ist bereits abgeschlossen.");
    if (ps.provider_session_id) {
      try {
        await (
          await getProviderForShop(ps.organization_id, ps.shop_id, ps.provider, ps.environment)
        ).cancelSession(ps.provider_session_id);
      } catch (e) {
        console.error("cancel provider session failed", e);
      }
    }
    await payments.markPaymentFailed(ps.id, "Vom Kunden abgebrochen.", true);
    return { paymentSessionId: ps.id, status: "cancelled" as const };
  });

/** Test-only: simulates a verified provider callback for the mock provider. */
export const mockConfirmPaymentFn = createServerFn({ method: "POST" })
  .inputValidator((data: { paymentSessionId: string; token: string }) => data)
  .handler(async ({ data }) => {
    const payments = await import("./payment.server");
    const cartApi = await import("../cart.server");
    const checkout = await import("../checkout.server");
    const ps = await payments.loadPaymentSession(data.paymentSessionId);
    if (ps.provider !== "mock") throw new Error("Nur für den Test-Anbieter verfügbar.");
    if (ps.environment === "live") throw new Error("Im Live-Betrieb nicht zulässig.");
    const session = await checkout.loadSession(ps.checkout_session_id);
    await cartApi.loadCartAuthorized(session.cart_id, data.token);

    return await payments.finalizeFromPayment({
      organizationId: ps.organization_id,
      paymentSessionId: ps.id,
      providerPaymentId: `mock_pi_${ps.id}`,
      amountMinor: Number(ps.amount_minor),
      currencyCode: ps.currency_code,
    });
  });

// ---------- Admin: provider configuration ----------

export const listProviderConfigsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; shopId: string }) => data)
  .handler(async ({ data, context }): Promise<ProviderConfigView[]> => {
    const { assertPermission, getAdmin } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "payment_settings.read",
    );
    const admin = await getAdmin();
    const { data: rows, error } = await admin
      .from("payment_provider_configs")
      .select("*")
      .eq("organization_id", data.organizationId)
      .eq("shop_id", data.shopId)
      .order("priority", { ascending: true });
    if (error) throw new Error(error.message);
    return ((rows ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r["id"] as string,
      provider: r["provider"] as string,
      displayName: r["display_name"] as string,
      environment: r["environment"] as "test" | "live",
      status: r["status"] as "active" | "inactive" | "archived",
      priority: Number(r["priority"] ?? 100),
      secretRef: (r["secret_ref"] as string) ?? null,
    }));
  });

export const upsertProviderConfigFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      organizationId: string;
      shopId: string;
      provider: "stripe" | "mock";
      displayName: string;
      environment: "test" | "live";
      status: "active" | "inactive";
      priority: number;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertPermission, getAdmin, writeAudit } = await import("../core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "payment_settings.manage",
    );
    if (data.provider === "mock" && data.environment === "live")
      throw new Error("Der Test-Anbieter darf nicht im Live-Betrieb aktiviert werden.");

    const admin = await getAdmin();
    const { error } = await admin.from("payment_provider_configs").upsert(
      {
        organization_id: data.organizationId,
        shop_id: data.shopId,
        provider: data.provider,
        display_name: data.displayName,
        environment: data.environment,
        status: data.status,
        priority: data.priority,
        secret_ref: data.provider === "stripe" ? "STRIPE_SECRET_KEY" : null,
      } as never,
      { onConflict: "shop_id,provider,environment" },
    );
    if (error) throw new Error(error.message);

    await writeAudit({
      organizationId: data.organizationId,
      actorId: context.userId,
      action: "payment_provider.updated",
      entityType: "payment_provider_config",
      entityId: `${data.shopId}:${data.provider}`,
      metadata: { environment: data.environment, status: data.status },
    });
    return { ok: true };
  });
