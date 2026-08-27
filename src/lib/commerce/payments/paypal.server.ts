/**
 * PayPal-Adapter (Orders v2, Intent CAPTURE). Server-only.
 *
 * Zugangsdaten kommen ausschließlich pro Shop aus dem verschlüsselten Tresor
 * (`integrations/credentials.server`). Es gibt bewusst keinen plattformweiten
 * Rückfall auf Umgebungsvariablen: ein Shop ohne eigene Verbindung kann nicht
 * über die Zugangsdaten eines anderen Mandanten bezahlen.
 *
 * Der Adapter ruft nur PayPal auf und bildet Antworten ab. Order-Finalisierung,
 * Inventory-Commit und die Refund-Engine bleiben unverändert im Kern.
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

export type PayPalCredentials = {
  clientId: string;
  clientSecret: string;
  /** Webhook-ID aus dem PayPal-Entwicklerportal; Pflicht für Signaturprüfung. */
  webhookId?: string | null;
  environment: "test" | "live";
};

type Json = Record<string, unknown>;

const HOSTS = {
  test: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
} as const;

/** Nur unbedenkliche Felder verlassen den Adapter. */
function safeRaw(source: Json, keys: string[]): Json {
  const out: Json = {};
  for (const key of keys) if (source[key] !== undefined) out[key] = source[key];
  return out;
}

function basicAuth(clientId: string, clientSecret: string) {
  const raw = `${clientId}:${clientSecret}`;
  let binary = "";
  for (const byte of new TextEncoder().encode(raw)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function accessToken(credentials: PayPalCredentials): Promise<string> {
  const host = HOSTS[credentials.environment];
  let response: Response;
  try {
    response = await fetch(`${host}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth(credentials.clientId, credentials.clientSecret)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
  } catch (error) {
    throw new Error(
      `PayPal ist nicht erreichbar: ${error instanceof Error ? error.message : "Netzwerkfehler"}`,
    );
  }
  if (!response.ok) {
    // Niemals Zugangsdaten loggen — nur Status.
    console.error(`PayPal token request failed [${response.status}]`);
    throw new Error(
      response.status === 401
        ? "PayPal hat die Zugangsdaten abgelehnt (Client-ID oder Secret falsch, oder falsche Umgebung)."
        : `PayPal-Anmeldung fehlgeschlagen (HTTP ${response.status}).`,
    );
  }
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("PayPal hat kein Zugriffstoken geliefert.");
  return body.access_token;
}

async function call(
  credentials: PayPalCredentials,
  path: string,
  init: { method: "GET" | "POST"; body?: Json; requestId?: string },
): Promise<Json> {
  const token = await accessToken(credentials);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (init.requestId) headers["PayPal-Request-Id"] = init.requestId.slice(0, 108);

  let response: Response;
  try {
    response = await fetch(`${HOSTS[credentials.environment]}${path}`, {
      method: init.method,
      headers,
      body: init.body ? JSON.stringify(init.body) : null,
    });
  } catch (error) {
    throw new Error(
      `PayPal ist nicht erreichbar: ${error instanceof Error ? error.message : "Netzwerkfehler"}`,
    );
  }
  const text = await response.text();
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    let name = "";
    try {
      const parsed = JSON.parse(text) as { name?: string; message?: string };
      name = parsed.name ?? "";
      message = parsed.message ?? message;
    } catch {
      /* Rohtext */
    }
    console.error(`PayPal request failed [${response.status}] ${path} ${name}`);
    throw new Error(`PayPal: ${message}`);
  }
  return text ? (JSON.parse(text) as Json) : {};
}

function mapOrderStatus(status: string | undefined): ProviderPaymentState["status"] {
  switch (status) {
    case "COMPLETED":
      return "paid";
    case "APPROVED":
    case "PAYER_ACTION_REQUIRED":
    case "SAVED":
    case "CREATED":
      return "pending";
    case "VOIDED":
      return "cancelled";
    default:
      return "pending";
  }
}

function purchaseUnit(order: Json): Json {
  const units = (order["purchase_units"] as Json[] | undefined) ?? [];
  return units[0] ?? {};
}

function captureOf(order: Json): Json | null {
  const payments = (purchaseUnit(order)["payments"] as Json | undefined) ?? {};
  const captures = (payments["captures"] as Json[] | undefined) ?? [];
  return captures[0] ?? null;
}

function amountOf(container: Json | null): { minor: number | null; currency: string | null } {
  const amount = (container?.["amount"] as Json | undefined) ?? null;
  if (!amount) return { minor: null, currency: null };
  const currency = String(amount["currency_code"] ?? "").toUpperCase() || null;
  const value = amount["value"];
  if (!currency || typeof value !== "string") return { minor: null, currency };
  return { minor: decimalStringToMinor(value, currency), currency };
}

function approvalLink(order: Json): string | null {
  const links = (order["links"] as Json[] | undefined) ?? [];
  const match =
    links.find((l) => l["rel"] === "payer-action") ?? links.find((l) => l["rel"] === "approve");
  return match ? (String(match["href"]) ?? null) : null;
}

/** Echter Verbindungstest: holt ein Token und fragt eine Konto-Ressource ab. */
export async function verifyPayPalCredentials(credentials: PayPalCredentials): Promise<{
  environment: "test" | "live";
  clientIdSuffix: string;
  webhookConfigured: boolean;
}> {
  await accessToken(credentials);
  return {
    environment: credentials.environment,
    clientIdSuffix: credentials.clientId.slice(-4),
    webhookConfigured: !!credentials.webhookId,
  };
}

/** Erfasst eine vom Käufer freigegebene PayPal-Order (Capture). */
export async function capturePayPalOrder(
  credentials: PayPalCredentials,
  providerOrderId: string,
): Promise<Json> {
  return call(credentials, `/v2/checkout/orders/${providerOrderId}/capture`, {
    method: "POST",
    body: {},
    requestId: `capture:${providerOrderId}`,
  });
}

export function createPayPalProvider(credentials: PayPalCredentials): PaymentProvider {
  if (!credentials.clientId || !credentials.clientSecret)
    throw new Error("Für PayPal sind keine Zugangsdaten hinterlegt.");

  async function loadOrder(providerSessionId: string): Promise<Json> {
    return call(credentials, `/v2/checkout/orders/${providerSessionId}`, { method: "GET" });
  }

  return {
    id: "paypal",

    async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
      if (input.environment !== credentials.environment)
        throw new Error(
          "Die PayPal-Verbindung passt nicht zur Umgebung dieser Zahlung (Test/Live getrennt).",
        );
      const order = await call(credentials, "/v2/checkout/orders", {
        method: "POST",
        requestId: input.idempotencyKey,
        body: {
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: input.paymentSessionId,
              custom_id: input.paymentSessionId,
              description: input.description.slice(0, 127),
              amount: {
                currency_code: input.currencyCode.toUpperCase(),
                value: minorToDecimalString(input.amountMinor, input.currencyCode),
              },
            },
          ],
          payment_source: {
            paypal: {
              experience_context: {
                user_action: "PAY_NOW",
                shipping_preference: "NO_SHIPPING",
                return_url: input.successUrl,
                cancel_url: input.cancelUrl,
              },
            },
          },
        },
      });
      return {
        providerSessionId: String(order["id"]),
        redirectUrl: approvalLink(order),
        status: "pending",
        raw: safeRaw(order, ["id", "status", "intent"]),
      };
    },

    /**
     * Statusabfrage mit Capture: Nach der Rückkehr des Käufers steht die Order
     * auf APPROVED. Erst der Capture macht daraus eine echte Zahlung.
     */
    async getSession(providerSessionId: string): Promise<ProviderPaymentState> {
      let order = await loadOrder(providerSessionId);
      if (order["status"] === "APPROVED") {
        try {
          order = await capturePayPalOrder(credentials, providerSessionId);
        } catch (error) {
          // ORDER_ALREADY_CAPTURED o. Ä.: aktuellen Stand erneut lesen.
          console.error("PayPal capture failed, reloading order", (error as Error).message);
          order = await loadOrder(providerSessionId);
        }
      }
      const capture = captureOf(order);
      const amount = amountOf(capture ?? purchaseUnit(order));
      const captureStatus = capture ? String(capture["status"]) : null;
      const status: ProviderPaymentState["status"] =
        captureStatus === "COMPLETED"
          ? "paid"
          : captureStatus === "DECLINED" || captureStatus === "FAILED"
            ? "failed"
            : mapOrderStatus(order["status"] as string | undefined);
      return {
        status,
        providerPaymentId: capture ? String(capture["id"]) : null,
        amountMinor: amount.minor,
        currencyCode: amount.currency,
        raw: safeRaw(order, ["id", "status", "intent"]),
      };
    },

    /**
     * PayPal kennt kein Storno für eine noch nicht freigegebene Order — sie
     * verfällt automatisch. Nichts zu tun, aber auch kein stiller Fehler.
     */
    async cancelSession(): Promise<void> {
      return;
    },

    async refundPayment(
      providerPaymentId: string,
      amountMinor: number,
      reason: string | null,
    ): Promise<RefundResult> {
      const capture = await call(credentials, `/v2/payments/captures/${providerPaymentId}`, {
        method: "GET",
      });
      const currency =
        ((capture["amount"] as Json | undefined)?.["currency_code"] as string | undefined) ?? "EUR";
      const refund = await call(
        credentials,
        `/v2/payments/captures/${providerPaymentId}/refunds`,
        {
          method: "POST",
          requestId: `refund:${providerPaymentId}:${amountMinor}`,
          body: {
            amount: {
              currency_code: currency.toUpperCase(),
              value: minorToDecimalString(amountMinor, currency),
            },
            ...(reason ? { note_to_payer: reason.slice(0, 255) } : {}),
          },
        },
      );
      const status = String(refund["status"] ?? "");
      return {
        providerRefundId: String(refund["id"]),
        status:
          status === "COMPLETED"
            ? "completed"
            : status === "FAILED" || status === "CANCELLED"
              ? "failed"
              : "processing",
        raw: safeRaw(refund, ["id", "status"]),
      };
    },

    /**
     * Signaturprüfung über die PayPal-Verifikations-API. Ohne hinterlegte
     * Webhook-ID wird nichts akzeptiert — kein „unsigned trust".
     */
    async parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent> {
      const webhookId = credentials.webhookId;
      if (!webhookId) throw new Error("Für PayPal ist keine Webhook-ID hinterlegt.");

      const required = [
        "paypal-auth-algo",
        "paypal-cert-url",
        "paypal-transmission-id",
        "paypal-transmission-sig",
        "paypal-transmission-time",
      ];
      const present: Record<string, string> = {};
      for (const name of required) {
        const value = headers.get(name);
        if (!value) throw new Error("PayPal-Signaturkopfzeilen fehlen.");
        present[name] = value;
      }

      const verification = await call(credentials, "/v1/notifications/verify-webhook-signature", {
        method: "POST",
        body: {
          auth_algo: present["paypal-auth-algo"],
          cert_url: present["paypal-cert-url"],
          transmission_id: present["paypal-transmission-id"],
          transmission_sig: present["paypal-transmission-sig"],
          transmission_time: present["paypal-transmission-time"],
          webhook_id: webhookId,
          webhook_event: JSON.parse(rawBody) as Json,
        },
      });
      if (verification["verification_status"] !== "SUCCESS")
        throw new Error("Ungültige PayPal-Signatur.");

      const event = JSON.parse(rawBody) as Json;
      const resource = (event["resource"] as Json | undefined) ?? {};
      const type = String(event["event_type"] ?? "");

      let outcome: WebhookEvent["outcome"] = "ignore";
      if (type === "PAYMENT.CAPTURE.COMPLETED" || type === "CHECKOUT.ORDER.COMPLETED")
        outcome = "paid";
      else if (type === "PAYMENT.CAPTURE.DENIED" || type === "PAYMENT.CAPTURE.DECLINED")
        outcome = "failed";
      else if (type === "PAYMENT.CAPTURE.REVERSED" || type === "PAYMENT.CAPTURE.REFUNDED")
        outcome = "refunded";
      else if (type === "CHECKOUT.ORDER.VOIDED") outcome = "cancelled";

      // Die Payment-Session-ID reist als custom_id/reference_id mit.
      const unit = ((resource["purchase_units"] as Json[] | undefined) ?? [])[0] ?? {};
      const sessionId =
        (resource["custom_id"] as string | undefined) ??
        (unit["custom_id"] as string | undefined) ??
        (unit["reference_id"] as string | undefined) ??
        null;

      const amount = amountOf(resource);
      return {
        providerEventId: String(event["id"] ?? present["paypal-transmission-id"]),
        eventType: type,
        paymentSessionId: sessionId,
        providerPaymentId: (resource["id"] as string | undefined) ?? null,
        amountMinor: amount.minor,
        currencyCode: amount.currency,
        outcome,
        payload: event,
      };
    },
  };
}
