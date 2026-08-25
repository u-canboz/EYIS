/**
 * Internal test provider. Guaranteed zero network path: it contains no fetch
 * call at all, so it can never deliver to a real inbox even if a real address
 * is entered by mistake. Messages are only stored as communication snapshots.
 */
import type { CommunicationProvider, SendMessage, SendResult } from "../provider";

export const testProvider: CommunicationProvider = {
  key: "test",
  label: "Interner Testversand",
  isSandbox: true,
  capabilities: {
    supportsAttachments: false,
    supportsTags: true,
    supportsTemplates: false,
    supportsDeliveryWebhooks: false,
    supportsBounceWebhooks: false,
    supportsOpenTracking: false,
  },
  async send(message: SendMessage): Promise<SendResult> {
    // No IO on purpose. The rendered message stays inside the platform.
    return {
      providerMessageId: `test_${message.idempotencyKey}`,
      status: "accepted",
      raw: {
        sandbox: true,
        delivered_externally: false,
        to: message.to,
        subject: message.subject,
      },
    };
  },
};
