/**
 * Communication provider contract. The engine never talks to a concrete
 * mail service: queueing, rendering, logging and retries stay identical
 * whether the message goes out via the managed provider or the internal
 * test provider.
 */

export type ProviderCapabilities = {
  supportsAttachments: boolean;
  supportsTags: boolean;
  supportsTemplates: boolean;
  supportsDeliveryWebhooks: boolean;
  supportsBounceWebhooks: boolean;
  supportsOpenTracking: boolean;
};

export type SendMessage = {
  to: string;
  senderName: string | null;
  senderAddress: string | null;
  replyTo: string | null;
  subject: string;
  html: string;
  text: string;
  tags: Record<string, string>;
  idempotencyKey: string;
};

export type SendResult = {
  providerMessageId: string | null;
  status: "accepted" | "sent" | "rejected";
  raw: Record<string, unknown>;
};

export type CommunicationErrorCode =
  | "provider_unavailable"
  | "invalid_recipient"
  | "invalid_sender"
  | "rate_limited"
  | "rejected"
  | "not_configured"
  | "unknown";

export class CommunicationError extends Error {
  readonly code: CommunicationErrorCode;
  readonly retryable: boolean;
  constructor(code: CommunicationErrorCode, message: string, retryable = true) {
    super(message);
    this.name = "CommunicationError";
    this.code = code;
    this.retryable = retryable;
  }
}

export const ERROR_LABELS: Record<CommunicationErrorCode, string> = {
  provider_unavailable: "Anbieter nicht erreichbar",
  invalid_recipient: "Empfängeradresse ungültig",
  invalid_sender: "Absenderadresse nicht verifiziert",
  rate_limited: "Sendelimit erreicht",
  rejected: "Vom Anbieter abgewiesen",
  not_configured: "Kein Anbieter eingerichtet",
  unknown: "Unbekannter Fehler",
};

export type InboundEvent = {
  providerEventId: string;
  providerMessageId: string | null;
  eventType: string;
  deliveryStatus:
    | "sent"
    | "delivered"
    | "soft_bounce"
    | "hard_bounce"
    | "complained"
    | "rejected"
    | "unknown";
  recipient: string | null;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export interface CommunicationProvider {
  readonly key: string;
  readonly label: string;
  readonly capabilities: ProviderCapabilities;
  /** True when the provider can never reach the outside world. */
  readonly isSandbox: boolean;
  send(message: SendMessage): Promise<SendResult>;
  /** Verifies and normalises an inbound webhook. */
  parseWebhook?(input: {
    body: string;
    headers: Record<string, string>;
    secret: string | null;
  }): Promise<{ verified: boolean; events: InboundEvent[] }>;
}
