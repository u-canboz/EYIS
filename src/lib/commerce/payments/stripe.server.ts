/** Stripe adapter (hosted Checkout, immediate capture). Server-only. */
import type {
  CreateSessionInput,
  CreateSessionResult,
  PaymentProvider,
  ProviderPaymentState,
  RefundResult,
  WebhookEvent,
} from "./provider.server";

const API = "https://api.stripe.com/v1";

function secret() {
  const key = process.env['STRIPE_SECRET_KEY'];
  if (!key) throw new Error("STRIPE_SECRET_KEY ist nicht konfiguriert.");
  return key;
}

async function call(
  path: string,
  init: { method: "GET" | "POST"; body?: URLSearchParams; idempotencyKey?: string },
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret()}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
  const response = await fetch(`${API}${path}`, {
    method: init.method,
    headers,
    body: init.body?.toString(),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`Stripe request failed [${response.status}]: ${text}`);
    let message = text;
    try {
      message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text;
    } catch {
      /* raw text */
    }
    throw new Error(`Stripe: ${message}`);
  }
  return JSON.parse(text) as Record<string, unknown>;
}

function mapStatus(session: Record<string, unknown>): ProviderPaymentState["status"] {
  const payment = session['payment_status'] as string | undefined;
  const status = session['status'] as string | undefined;
  if (payment === "paid" || payment === "no_payment_required") return "paid";
  if (status === "expired") return "expired";
  if (status === "complete") return "paid";
  return "pending";
}

function paymentIntentId(session: Record<string, unknown>) {
  const pi = session['payment_intent'];
  if (typeof pi === "string") return pi;
  if (pi && typeof pi === "object") return ((pi as Record<string, unknown>)['id'] as string) ?? null;
  return null;
}

/** Constant-time comparison of two hex strings. */
function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secretValue: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretValue),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    const body = new URLSearchParams();
    body.set("mode", "payment");
    body.set("success_url", input.successUrl);
    body.set("cancel_url", input.cancelUrl);
    body.set("client_reference_id", input.paymentSessionId);
    body.set("metadata[payment_session_id]", input.paymentSessionId);
    body.set("payment_intent_data[metadata][payment_session_id]", input.paymentSessionId);
    if (input.email) body.set("customer_email", input.email);
    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price_data][currency]", input.currencyCode.toLowerCase());
    body.set("line_items[0][price_data][unit_amount]", String(input.amountMinor));
    body.set("line_items[0][price_data][product_data][name]", input.description);

    const session = await call("/checkout/sessions", {
      method: "POST",
      body,
      idempotencyKey: input.idempotencyKey,
    });
    return {
      providerSessionId: session['id'] as string,
      redirectUrl: (session['url'] as string) ?? null,
      status: "pending",
      raw: session,
    };
  },

  async getSession(providerSessionId: string): Promise<ProviderPaymentState> {
    const session = await call(`/checkout/sessions/${providerSessionId}`, { method: "GET" });
    return {
      status: mapStatus(session),
      providerPaymentId: paymentIntentId(session),
      amountMinor: session['amount_total'] === null ? null : Number(session['amount_total']),
      currencyCode: session['currency'] ? String(session['currency']).toUpperCase() : null,
      raw: session,
    };
  },

  async cancelSession(providerSessionId: string) {
    await call(`/checkout/sessions/${providerSessionId}/expire`, { method: "POST" });
  },

  async refundPayment(providerPaymentId: string, amountMinor: number, reason: string | null): Promise<RefundResult> {
    const body = new URLSearchParams();
    body.set("payment_intent", providerPaymentId);
    body.set("amount", String(amountMinor));
    if (reason) body.set("metadata[reason]", reason.slice(0, 200));
    const refund = await call("/refunds", { method: "POST", body });
    const status = refund['status'] as string;
    return {
      providerRefundId: refund['id'] as string,
      status: status === "succeeded" ? "completed" : status === "failed" ? "failed" : "processing",
      raw: refund,
    };
  },

  async parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent> {
    const signingSecret = process.env['STRIPE_WEBHOOK_SECRET'];
    if (!signingSecret) throw new Error("STRIPE_WEBHOOK_SECRET ist nicht konfiguriert.");
    const header = headers.get("stripe-signature") ?? "";
    const parts = Object.fromEntries(
      header.split(",").map((p) => {
        const [k, ...rest] = p.split("=");
        return [k?.trim() ?? "", rest.join("=")];
      }),
    ) as Record<string, string>;
    const timestamp = parts['t'];
    const signature = parts['v1'];
    if (!timestamp || !signature) throw new Error("Signatur fehlt.");
    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > 300) throw new Error("Signatur ist abgelaufen.");
    const expected = await hmacHex(signingSecret, `${timestamp}.${rawBody}`);
    if (!timingSafeEqualHex(expected, signature)) throw new Error("Ungültige Signatur.");

    const event = JSON.parse(rawBody) as Record<string, unknown>;
    const object = ((event['data'] as Record<string, unknown>)?.['object'] ?? {}) as Record<string, unknown>;
    const metadata = (object['metadata'] ?? {}) as Record<string, string>;
    const type = event['type'] as string;

    let outcome: WebhookEvent["outcome"] = "ignore";
    if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
      outcome = mapStatus(object) === "paid" ? "paid" : "ignore";
    } else if (type === "checkout.session.async_payment_failed" || type === "payment_intent.payment_failed") {
      outcome = "failed";
    } else if (type === "checkout.session.expired") {
      outcome = "cancelled";
    } else if (type === "charge.refunded") {
      outcome = "refunded";
    }

    const amount =
      object['amount_total'] ?? object['amount_received'] ?? object['amount'] ?? null;

    return {
      providerEventId: event['id'] as string,
      eventType: type,
      paymentSessionId: metadata['payment_session_id'] ?? (object['client_reference_id'] as string) ?? null,
      providerPaymentId: paymentIntentId(object) ?? ((object['id'] as string) ?? null),
      amountMinor: amount === null ? null : Number(amount),
      currencyCode: object['currency'] ? String(object['currency']).toUpperCase() : null,
      outcome,
      payload: event,
    };
  },
};
