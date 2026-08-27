/**
 * Payment provider contract. The order core never knows a provider name:
 * everything goes through this interface, so PayPal, Mollie, Klarna or Adyen
 * can be added later without touching order finalisation.
 */
import type { CommerceEnvironment, PaymentSessionStatus } from "./payment-types";

export type CreateSessionInput = {
  paymentSessionId: string;
  amountMinor: number;
  currencyCode: string;
  email: string | null;
  description: string;
  successUrl: string;
  cancelUrl: string;
  environment: CommerceEnvironment;
  idempotencyKey: string;
};

export type CreateSessionResult = {
  providerSessionId: string;
  redirectUrl: string | null;
  status: PaymentSessionStatus;
  raw: Record<string, unknown>;
};

export type ProviderPaymentState = {
  status: PaymentSessionStatus;
  providerPaymentId: string | null;
  amountMinor: number | null;
  currencyCode: string | null;
  raw: Record<string, unknown>;
};

export type WebhookEvent = {
  providerEventId: string;
  eventType: string;
  paymentSessionId: string | null;
  providerPaymentId: string | null;
  amountMinor: number | null;
  currencyCode: string | null;
  outcome: "paid" | "failed" | "cancelled" | "refunded" | "ignore";
  payload: Record<string, unknown>;
};

export type RefundResult = {
  providerRefundId: string;
  status: "completed" | "processing" | "failed";
  raw: Record<string, unknown>;
};

export interface PaymentProvider {
  readonly id: string;
  createSession(input: CreateSessionInput): Promise<CreateSessionResult>;
  getSession(providerSessionId: string): Promise<ProviderPaymentState>;
  cancelSession(providerSessionId: string): Promise<void>;
  refundPayment(
    providerPaymentId: string,
    amountMinor: number,
    reason: string | null,
  ): Promise<RefundResult>;
  /** Verifies the signature and maps the payload. Throws when the signature is invalid. */
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent>;
}

export async function getProvider(id: string): Promise<PaymentProvider> {
  if (id === "stripe") return (await import("./stripe.server")).stripeProvider;
  if (id === "mock") return (await import("./mock.server")).mockProvider;
  throw new Error(`Unbekannter Zahlungsanbieter: ${id}`);
}

/**
 * Shop-gebundener Anbieter: verwendet die im verschlüsselten Tresor
 * hinterlegten Zugangsdaten dieses Shops. Nur wenn dort nichts liegt, greift
 * der plattformweite Rückfall aus getProvider().
 */
export async function getProviderForShop(
  organizationId: string,
  shopId: string,
  id: string,
  environment: CommerceEnvironment,
): Promise<PaymentProvider> {
  if (id === "stripe") {
    const { loadCredentials } = await import("../integrations/credentials.server");
    const creds = await loadCredentials({
      organizationId,
      shopId,
      category: "payment",
      provider: "stripe",
      environment,
    });
    if (creds?.["secretKey"]) {
      const { createStripeProvider } = await import("./stripe.server");
      return createStripeProvider({
        secretKey: creds["secretKey"],
        webhookSecret: creds["webhookSecret"] ?? null,
      });
    }
  }
  return getProvider(id);
}
