/**
 * Managed e-mail provider (Lovable Cloud email API).
 * Only used when a verified sending domain exists; otherwise the engine falls
 * back to the internal test provider.
 */
import {
  CommunicationError,
  type CommunicationProvider,
  type SendMessage,
  type SendResult,
} from "../provider";

const ENDPOINT = "https://api.lovable.dev/v1/email/send";

export const lovableProvider: CommunicationProvider = {
  key: "lovable",
  label: "Lovable Cloud E-Mail",
  isSandbox: false,
  capabilities: {
    supportsAttachments: false,
    supportsTags: true,
    supportsTemplates: false,
    supportsDeliveryWebhooks: true,
    supportsBounceWebhooks: true,
    supportsOpenTracking: false,
  },
  async send(message: SendMessage): Promise<SendResult> {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      throw new CommunicationError(
        "not_configured",
        "Kein API-Schlüssel für den Versand hinterlegt.",
        false,
      );
    }
    if (!message.senderAddress) {
      throw new CommunicationError(
        "invalid_sender",
        "Keine verifizierte Absenderadresse hinterlegt.",
        false,
      );
    }

    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
          "idempotency-key": message.idempotencyKey,
        },
        body: JSON.stringify({
          to: message.to,
          from: message.senderName
            ? `${message.senderName} <${message.senderAddress}>`
            : message.senderAddress,
          reply_to: message.replyTo ?? undefined,
          subject: message.subject,
          html: message.html,
          text: message.text,
          tags: message.tags,
        }),
      });
    } catch (error) {
      throw new CommunicationError(
        "provider_unavailable",
        error instanceof Error ? error.message : "Anbieter nicht erreichbar.",
      );
    }

    if (response.status === 429) {
      throw new CommunicationError("rate_limited", "Sendelimit erreicht. Erneuter Versuch später.");
    }
    if (!response.ok) {
      const body = await response.text();
      const retryable = response.status >= 500;
      throw new CommunicationError(
        retryable ? "provider_unavailable" : "rejected",
        `Anbieter antwortete mit ${response.status}: ${body.slice(0, 300)}`,
        retryable,
      );
    }

    const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      providerMessageId: (raw["id"] as string) ?? null,
      status: "accepted",
      raw,
    };
  },

  async parseWebhook({ body, headers, secret }) {
    const signature = headers["x-lovable-signature"] ?? headers["x-webhook-signature"] ?? "";
    let verified = false;
    if (secret && signature) {
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
      const expected = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join(
        "",
      );
      verified =
        expected.length === signature.length &&
        expected.split("").every((c, i) => c === signature[i]);
    }

    const payload = JSON.parse(body) as Record<string, unknown>;
    const type = String(payload["type"] ?? payload["event"] ?? "unknown");
    const map: Record<
      string,
      "delivered" | "hard_bounce" | "soft_bounce" | "complained" | "rejected" | "sent"
    > = {
      "email.sent": "sent",
      "email.delivered": "delivered",
      "email.bounced": "hard_bounce",
      "email.soft_bounced": "soft_bounce",
      "email.complaint": "complained",
      "email.rejected": "rejected",
    };
    const data = (payload["data"] as Record<string, unknown>) ?? payload;
    return {
      verified,
      events: [
        {
          providerEventId: String(payload["id"] ?? data["message_id"] ?? crypto.randomUUID()),
          providerMessageId: (data["message_id"] as string) ?? null,
          eventType: type,
          deliveryStatus: map[type] ?? "unknown",
          recipient: (data["recipient"] as string) ?? (data["to"] as string) ?? null,
          occurredAt: (payload["created_at"] as string) ?? new Date().toISOString(),
          payload,
        },
      ],
    };
  },
};
