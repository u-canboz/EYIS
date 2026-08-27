/**
 * Mollie-Adapter (Payments API v2). Server-only.
 *
 * Zugangsdaten kommen ausschließlich pro Shop aus dem verschlüsselten Tresor.
 * Kein plattformweiter Rückfall auf Umgebungsvariablen.
 *
 * Mollie signiert Webhooks nicht. Deshalb wird jeder Webhook grundsätzlich als
 * bloßer Hinweis behandelt: der tatsächliche Zahlungsstatus wird immer frisch
 * über die API nachgeladen (Re-Fetch-Verifikation).
 */
import type {
  CreateSessionInput,
  CreateSessionResult,
  PaymentProvider,
  ProviderPaymentState,
  RefundResult,
  WebhookEvent,
} from "./provider.server";
import { decimalStringToMinor, minorToDecimalString } from "./money-format";

const BASE = "https://api.mollie.com/v2";

export type MollieCredentials = {
  apiKey: string;
  /** Öffentliche Rückrufadresse für Statusmeldungen. */
  webhookUrl?: string | null;
};

type Json = Record<string, unknown>;

/** Der Schlüsselpräfix bestimmt bei Mollie die Umgebung. */
export function mollieEnvironment(apiKey: string): "test" | "live" {
  return apiKey.trim().startsWith("live_") ? "live" : "test";
}

function safeRaw(source: Json, keys: string[]): Json {
  const out: Json = {};
  for (const key of keys) if (source[key] !== undefined) out[key] = source[key];
  return out;
}

async function call(
  apiKey: string,
  path: string,
  init: { method: "GET" | "POST" | "DELETE"; body?: Json; idempotencyKey?: string },
): Promise<Json> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey.slice(0, 255);

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: init.method,
      headers,
      body: init.body ? JSON.stringify(init.body) : null,
    });
  } catch (error) {
    throw new Error(
      `Mollie ist nicht erreichbar: ${error instanceof Error ? error.message : "Netzwerkfehler"}`,
    );
  }
  const text = await response.text();
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { detail?: string; title?: string };
      detail = parsed.detail ?? parsed.title ?? detail;
    } catch {
      /* Rohtext */
    }
    console.error(`Mollie request failed [${response.status}] ${path}`);
    throw new Error(
      response.status === 401
        ? "Mollie hat den API-Schlüssel abgelehnt."
        : `Mollie: ${detail}`,
    );
  }
  return text ? (JSON.parse(text) as Json) : {};
}

function mapStatus(status: string | undefined): ProviderPaymentState["status"] {
  switch (status) {
    case "paid":
      return "paid";
    case "canceled":
      return "cancelled";
    case "expired":
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}

function amountOf(payment: Json, key = "amount"): { minor: number | null; currency: string | null } {
  const amount = payment[key] as Json | undefined;
  if (!amount) return { minor: null, currency: null };
  const currency = String(amount["currency"] ?? "").toUpperCase() || null;
  const value = amount["value"];
  if (!currency || typeof value !== "string") return { minor: null, currency };
  return { minor: decimalStringToMinor(value, currency), currency };
}

/** Echter Verbindungstest: fragt die aktivierten Zahlungsarten des Kontos ab. */
export async function verifyMollieCredentials(apiKey: string): Promise<{
  environment: "test" | "live";
  methods: { id: string; description: string }[];
}> {
  const result = await call(apiKey, "/methods?includeWallets=applepay", { method: "GET" });
  const embedded = (result["_embedded"] as Json | undefined) ?? {};
  const methods = ((embedded["methods"] as Json[] | undefined) ?? []).map((m) => ({
    id: String(m["id"]),
    description: String(m["description"] ?? m["id"]),
  }));
  return { environment: mollieEnvironment(apiKey), methods };
}

export function createMollieProvider(credentials: MollieCredentials): PaymentProvider {
  const apiKey = credentials.apiKey?.trim();
  if (!apiKey) throw new Error("Für Mollie ist kein API-Schlüssel hinterlegt.");
  const environment = mollieEnvironment(apiKey);

  async function loadPayment(id: string): Promise<Json> {
    return call(apiKey!, `/payments/${id}`, { method: "GET" });
  }

  return {
    id: "mollie",

    async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
      if (input.environment !== environment)
        throw new Error(
          "Der Mollie-Schlüssel passt nicht zur Umgebung dieser Zahlung (Test/Live getrennt).",
        );
      const payment = await call(apiKey!, "/payments", {
        method: "POST",
        idempotencyKey: input.idempotencyKey,
        body: {
          amount: {
            currency: input.currencyCode.toUpperCase(),
            value: minorToDecimalString(input.amountMinor, input.currencyCode),
          },
          description: input.description.slice(0, 255),
          redirectUrl: input.successUrl,
          cancelUrl: input.cancelUrl,
          ...(credentials.webhookUrl ? { webhookUrl: credentials.webhookUrl } : {}),
          metadata: { paymentSessionId: input.paymentSessionId },
        },
      });
      const links = (payment["_links"] as Json | undefined) ?? {};
      const checkout = links["checkout"] as Json | undefined;
      return {
        providerSessionId: String(payment["id"]),
        redirectUrl: checkout ? String(checkout["href"]) : null,
        status: mapStatus(payment["status"] as string | undefined),
        raw: safeRaw(payment, ["id", "status", "mode", "method"]),
      };
    },

    async getSession(providerSessionId: string): Promise<ProviderPaymentState> {
      const payment = await loadPayment(providerSessionId);
      const amount = amountOf(payment);
      return {
        status: mapStatus(payment["status"] as string | undefined),
        providerPaymentId: String(payment["id"]),
        amountMinor: amount.minor,
        currencyCode: amount.currency,
        raw: safeRaw(payment, ["id", "status", "mode", "method"]),
      };
    },

    async cancelSession(providerSessionId: string): Promise<void> {
      const payment = await loadPayment(providerSessionId);
      if (payment["isCancelable"] !== true) return;
      await call(apiKey!, `/payments/${providerSessionId}`, { method: "DELETE" });
    },

    async refundPayment(
      providerPaymentId: string,
      amountMinor: number,
      reason: string | null,
    ): Promise<RefundResult> {
      const payment = await loadPayment(providerPaymentId);
      const currency = amountOf(payment).currency ?? "EUR";
      const refund = await call(apiKey!, `/payments/${providerPaymentId}/refunds`, {
        method: "POST",
        idempotencyKey: `refund:${providerPaymentId}:${amountMinor}`,
        body: {
          amount: { currency, value: minorToDecimalString(amountMinor, currency) },
          ...(reason ? { description: reason.slice(0, 140) } : {}),
        },
      });
      const status = String(refund["status"] ?? "");
      return {
        providerRefundId: String(refund["id"]),
        status: status === "refunded" ? "completed" : status === "failed" ? "failed" : "processing",
        raw: safeRaw(refund, ["id", "status"]),
      };
    },

    /**
     * Mollie schickt nur `id=tr_…`. Der Inhalt des Requests ist damit ohne
     * Beweiskraft; verbindlich ist allein die frisch geladene Zahlung.
     */
    async parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent> {
      const contentType = headers.get("content-type") ?? "";
      let id: string | null = null;
      if (contentType.includes("application/json")) {
        try {
          id = (JSON.parse(rawBody) as { id?: string }).id ?? null;
        } catch {
          id = null;
        }
      } else {
        id = new URLSearchParams(rawBody).get("id");
      }
      if (!id || !/^(tr|re)_[A-Za-z0-9]+$/.test(id))
        throw new Error("Mollie-Webhook ohne gültige Zahlungs-ID.");

      const paymentId = id.startsWith("re_") ? null : id;
      if (!paymentId) {
        // Erstattungs-Hinweis ohne Zahlungsbezug: nichts zu tun.
        return {
          providerEventId: `mollie:${id}`,
          eventType: "refund.notification",
          paymentSessionId: null,
          providerPaymentId: null,
          amountMinor: null,
          currencyCode: null,
          outcome: "ignore",
          payload: { id },
        };
      }

      const payment = await loadPayment(paymentId);
      const status = String(payment["status"] ?? "");
      const amount = amountOf(payment);
      const refunded = amountOf(payment, "amountRefunded");
      const metadata = (payment["metadata"] as Json | undefined) ?? {};

      let outcome: WebhookEvent["outcome"] = "ignore";
      if (status === "paid") outcome = (refunded.minor ?? 0) > 0 ? "refunded" : "paid";
      else if (status === "canceled") outcome = "cancelled";
      else if (status === "failed" || status === "expired") outcome = "failed";

      return {
        // Status im Event-Schlüssel: derselbe Status wird nur einmal verarbeitet.
        providerEventId: `mollie:${paymentId}:${status}:${refunded.minor ?? 0}`,
        eventType: `payment.${status}`,
        paymentSessionId: (metadata["paymentSessionId"] as string | undefined) ?? null,
        providerPaymentId: paymentId,
        amountMinor: amount.minor,
        currencyCode: amount.currency,
        outcome,
        payload: safeRaw(payment, ["id", "status", "mode", "method", "amount", "amountRefunded"]),
      };
    },
  };
}
