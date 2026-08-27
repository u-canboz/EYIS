/**
 * Resend-Adapter für transaktionale E-Mails (server-only).
 *
 * Der API-Schlüssel kommt pro Shop aus dem verschlüsselten Tresor und wird nur
 * für den einzelnen Aufruf verwendet — nie geloggt, nie zurückgegeben.
 * Domain-Verifizierung, DNS-Einträge und Zustellereignisse kommen ausschließlich
 * von Resend; es wird nichts simuliert.
 */
import {
  CommunicationError,
  type CommunicationProvider,
  type InboundEvent,
  type SendMessage,
  type SendResult,
} from "../provider";

const API = "https://api.resend.com";

type Json = Record<string, unknown>;

async function call(
  apiKey: string,
  path: string,
  init: { method: "GET" | "POST" | "DELETE"; body?: unknown; idempotencyKey?: string },
): Promise<Json> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  };
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      method: init.method,
      headers,
      body: init.body === undefined ? null : JSON.stringify(init.body),
    });
  } catch (error) {
    throw new CommunicationError(
      "provider_unavailable",
      `Resend ist nicht erreichbar: ${error instanceof Error ? error.message : "Netzwerkfehler"}`,
    );
  }

  const text = await response.text();
  const parsed = (() => {
    try {
      return JSON.parse(text) as Json;
    } catch {
      return {} as Json;
    }
  })();

  if (!response.ok) {
    // Nur Status und Resend-Fehlername protokollieren, niemals den Schlüssel.
    console.error(`Resend request failed [${response.status}] ${path} ${String(parsed["name"] ?? "")}`);
    const message = String(parsed["message"] ?? text.slice(0, 300) ?? "Unbekannter Fehler");
    if (response.status === 429)
      throw new CommunicationError("rate_limited", `Resend: ${message}`);
    if (response.status === 401 || response.status === 403)
      throw new CommunicationError("not_configured", `Resend: ${message}`, false);
    throw new CommunicationError(
      response.status >= 500 ? "provider_unavailable" : "rejected",
      `Resend: ${message}`,
      response.status >= 500,
    );
  }
  return parsed;
}

/* ------------------------------ Konto & Domains ----------------------------- */

/** Echter Verbindungstest: listet die Domains des Kontos. */
export async function resendVerifyKey(
  apiKey: string,
): Promise<{ domainCount: number; verifiedDomains: string[] }> {
  const result = await call(apiKey, "/domains", { method: "GET" });
  const rows = (result["data"] as Json[] | undefined) ?? [];
  return {
    domainCount: rows.length,
    verifiedDomains: rows
      .filter((row) => String(row["status"]).toLowerCase() === "verified")
      .map((row) => String(row["name"])),
  };
}

export type ResendDomain = {
  id: string;
  name: string;
  status: "not_started" | "pending" | "verified" | "failed" | "temporary_failure";
  records: { type: string; name: string; value: string; status: string }[];
};

function mapDomain(row: Json): ResendDomain {
  const records = ((row["records"] as Json[] | undefined) ?? []).map((record) => ({
    type: String(record["type"] ?? ""),
    name: String(record["name"] ?? ""),
    value: String(record["value"] ?? ""),
    status: String(record["status"] ?? "pending"),
  }));
  return {
    id: String(row["id"] ?? ""),
    name: String(row["name"] ?? ""),
    status: String(row["status"] ?? "not_started") as ResendDomain["status"],
    records,
  };
}

export async function resendCreateDomain(apiKey: string, domain: string): Promise<ResendDomain> {
  const created = await call(apiKey, "/domains", { method: "POST", body: { name: domain } });
  return mapDomain(created);
}

export async function resendGetDomain(apiKey: string, domainId: string): Promise<ResendDomain> {
  return mapDomain(await call(apiKey, `/domains/${domainId}`, { method: "GET" }));
}

export async function resendVerifyDomain(apiKey: string, domainId: string): Promise<void> {
  await call(apiKey, `/domains/${domainId}/verify`, { method: "POST", body: {} });
}

export async function resendFindDomain(
  apiKey: string,
  domain: string,
): Promise<ResendDomain | null> {
  const result = await call(apiKey, "/domains", { method: "GET" });
  const rows = (result["data"] as Json[] | undefined) ?? [];
  const match = rows.find((row) => String(row["name"]).toLowerCase() === domain.toLowerCase());
  return match ? mapDomain(match) : null;
}

/* --------------------------------- Webhooks -------------------------------- */

function base64ToBytes(value: string) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Svix-Signatur (Resend Webhooks): whsec_<base64>. */
export async function verifySvixSignature(input: {
  body: string;
  headers: Record<string, string>;
  secret: string;
}): Promise<boolean> {
  const id = input.headers["svix-id"] ?? input.headers["webhook-id"];
  const timestamp = input.headers["svix-timestamp"] ?? input.headers["webhook-timestamp"];
  const signatureHeader = input.headers["svix-signature"] ?? input.headers["webhook-signature"];
  if (!id || !timestamp || !signatureHeader) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const rawSecret = input.secret.startsWith("whsec_") ? input.secret.slice(6) : input.secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToBytes(rawSecret);
  } catch {
    keyBytes = new TextEncoder().encode(rawSecret);
  }
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${input.body}`),
  );
  let binary = "";
  for (const byte of new Uint8Array(signed)) binary += String.fromCharCode(byte);
  const expected = btoa(binary);

  return signatureHeader
    .split(" ")
    .map((part) => part.split(",")[1] ?? "")
    .some((candidate) => candidate && timingSafeEqual(candidate, expected));
}

const EVENT_MAP: Record<string, InboundEvent["deliveryStatus"]> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "unknown",
  "email.bounced": "hard_bounce",
  "email.complained": "complained",
  "email.failed": "rejected",
};

/* --------------------------------- Provider -------------------------------- */

export function createResendProvider(apiKey: string | null): CommunicationProvider {
  return {
    key: "resend",
    label: "Resend",
    isSandbox: false,
    capabilities: {
      supportsAttachments: false,
      supportsTags: true,
      supportsTemplates: false,
      supportsDeliveryWebhooks: true,
      supportsBounceWebhooks: true,
      supportsOpenTracking: true,
    },

    async send(message: SendMessage): Promise<SendResult> {
      if (!apiKey)
        throw new CommunicationError(
          "not_configured",
          "Für diesen Shop ist kein Resend-API-Schlüssel hinterlegt.",
          false,
        );
      if (!message.senderAddress)
        throw new CommunicationError(
          "invalid_sender",
          "Keine Absenderadresse hinterlegt.",
          false,
        );

      const raw = await call(apiKey, "/emails", {
        method: "POST",
        idempotencyKey: message.idempotencyKey,
        body: {
          from: message.senderName
            ? `${message.senderName} <${message.senderAddress}>`
            : message.senderAddress,
          to: [message.to],
          reply_to: message.replyTo ?? undefined,
          subject: message.subject,
          html: message.html,
          text: message.text,
          tags: Object.entries(message.tags ?? {}).map(([name, value]) => ({
            name: name.slice(0, 60).replace(/[^A-Za-z0-9_-]/g, "_"),
            value: String(value).slice(0, 60).replace(/[^A-Za-z0-9_-]/g, "_"),
          })),
        },
      });

      return {
        providerMessageId: (raw["id"] as string) ?? null,
        status: "accepted",
        raw: { id: raw["id"] ?? null },
      };
    },

    async parseWebhook(input) {
      if (!input.secret) return { verified: false, events: [] };
      const verified = await verifySvixSignature({
        body: input.body,
        headers: input.headers,
        secret: input.secret,
      });
      if (!verified) return { verified: false, events: [] };

      const payload = JSON.parse(input.body) as Json;
      const type = String(payload["type"] ?? "");
      const mapped = EVENT_MAP[type];
      if (!mapped) return { verified: true, events: [] };

      const data = (payload["data"] ?? {}) as Json;
      const to = data["to"];
      const recipient = Array.isArray(to) ? String(to[0] ?? "") : String(to ?? "");
      const emailId = (data["email_id"] as string) ?? (data["id"] as string) ?? null;
      return {
        verified: true,
        events: [
          {
            providerEventId: `${emailId ?? "resend"}:${type}:${String(payload["created_at"] ?? "")}`,
            providerMessageId: emailId,
            eventType: type,
            deliveryStatus: mapped,
            recipient: recipient || null,
            occurredAt: String(payload["created_at"] ?? new Date().toISOString()),
            payload: payload as Json,
          },
        ],
      };
    },
  };
}

/** Unkonfigurierte Registry-Instanz: Versand schlägt ehrlich fehl. */
export const resendProvider = createResendProvider(null);
