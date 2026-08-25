/**
 * Mock provider for internal tests only. It never talks to a network and is
 * refused for shops running in the live environment.
 */
import type {
  CreateSessionInput,
  CreateSessionResult,
  PaymentProvider,
  ProviderPaymentState,
  RefundResult,
  WebhookEvent,
} from "./provider.server";

export const mockProvider: PaymentProvider = {
  id: "mock",

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    if (input.environment === "live")
      throw new Error("Der Test-Anbieter ist im Live-Betrieb nicht zulässig.");
    const url = new URL(input.successUrl);
    url.searchParams.set("mock", "1");
    return {
      providerSessionId: `mock_${input.paymentSessionId}`,
      redirectUrl: url.toString(),
      status: "pending",
      raw: { amount_minor: input.amountMinor, currency: input.currencyCode },
    };
  },

  async getSession(providerSessionId: string): Promise<ProviderPaymentState> {
    return {
      status: "pending",
      providerPaymentId: providerSessionId.replace("mock_", "mock_pi_"),
      amountMinor: null,
      currencyCode: null,
      raw: {},
    };
  },

  async cancelSession() {
    /* nothing to cancel */
  },

  async refundPayment(providerPaymentId: string, amountMinor: number): Promise<RefundResult> {
    return {
      providerRefundId: `mock_re_${providerPaymentId}_${amountMinor}`,
      status: "completed",
      raw: {},
    };
  },

  async parseWebhook(): Promise<WebhookEvent> {
    throw new Error("Der Test-Anbieter verarbeitet keine Webhooks.");
  },
};
