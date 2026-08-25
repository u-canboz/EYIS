/**
 * Outgoing webhooks with SSRF and DNS-rebinding hardening.
 *
 * Runtime note: the edge runtime has no socket-level connect hook, so the
 * target IP cannot be pinned to the socket. Instead every single request —
 * including every retry — resolves the hostname over DNS-over-HTTPS
 * immediately before sending and rejects the call when ANY returned address
 * is private, loopback, link-local or a cloud metadata endpoint. Redirects are
 * disabled outright, so a 3xx can never move the request to a new host.
 */
import { getAdmin } from "../core.server";

const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 8 * 1024;

export class WebhookError extends Error {
  code: string;
  retryable: boolean;
  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

function ipv4Blocked(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255))
    return true;
  const [a, b] = parts as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true; // this-network, private, loopback
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function ipv6Blocked(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd")) return true; // link-local, ULA
  if (v.startsWith("ff")) return true; // multicast
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
  if (mapped) return ipv4Blocked(mapped[1]!);
  return false;
}

export function ipBlocked(ip: string): boolean {
  return ip.includes(":") ? ipv6Blocked(ip) : ipv4Blocked(ip);
}

async function resolveHost(hostname: string): Promise<string[]> {
  const query = async (type: "A" | "AAAA") => {
    const res = await fetch(`${DOH_ENDPOINT}?name=${encodeURIComponent(hostname)}&type=${type}`, {
      headers: { accept: "application/dns-json" },
      redirect: "manual",
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { Answer?: { type: number; data: string }[] };
    return (body.Answer ?? [])
      .filter((a) => a.type === 1 || a.type === 28)
      .map((a) => a.data.trim());
  };
  const [a, aaaa] = await Promise.all([query("A"), query("AAAA")]);
  return [...a, ...aaaa];
}

/** Resolves and validates. Throws on any blocked or unresolvable target. */
export async function assertSafeTarget(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new WebhookError("invalid_configuration", "Die Webhook-Adresse ist keine gültige URL.");
  }
  if (url.protocol !== "https:")
    throw new WebhookError("invalid_configuration", "Webhooks sind nur über HTTPS erlaubt.");
  if (url.username || url.password)
    throw new WebhookError("invalid_configuration", "Zugangsdaten in der URL sind nicht erlaubt.");

  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  )
    throw new WebhookError("invalid_configuration", "Interne Hostnamen sind nicht erlaubt.");

  const literal = host.replace(/^\[|\]$/g, "");
  if (/^[\d.]+$/.test(literal) || literal.includes(":")) {
    if (ipBlocked(literal))
      throw new WebhookError("invalid_configuration", "Diese IP-Adresse ist nicht erlaubt.");
    return url;
  }

  const addresses = await resolveHost(host);
  if (!addresses.length)
    throw new WebhookError("invalid_configuration", "Der Hostname konnte nicht aufgelöst werden.");
  for (const ip of addresses) {
    if (ipBlocked(ip))
      throw new WebhookError(
        "invalid_configuration",
        "Die Adresse zeigt auf ein internes Netz und wurde blockiert.",
      );
  }
  return url;
}

async function sign(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type WebhookPayload = {
  event: string;
  id: string;
  created_at: string;
  shop_id: string;
  data: Record<string, unknown>;
};

/** One attempt. Validation runs fresh on every call, so retries re-check DNS. */
export async function sendWebhook(input: {
  endpointId: string;
  organizationId: string;
  payload: WebhookPayload;
}) {
  const admin = await getAdmin();
  const { data } = await admin
    .from("outgoing_webhook_endpoints")
    .select("*")
    .eq("id", input.endpointId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  const endpoint = data as Record<string, unknown> | null;
  if (!endpoint) throw new WebhookError("entity_not_found", "Webhook-Ziel nicht gefunden.");
  if (endpoint["status"] !== "active")
    throw new WebhookError("invalid_configuration", "Das Webhook-Ziel ist nicht aktiv.");

  const url = await assertSafeTarget(endpoint["url"] as string);
  const body = JSON.stringify(input.payload);
  const secretRef = (endpoint["secret_reference"] as string | null) ?? null;
  const secret = secretRef ? (process.env[secretRef] ?? null) : null;

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "CommerceOS-Automation/1",
    "x-commerce-event": input.payload.event,
    "x-commerce-delivery": input.payload.id,
  };
  if (secret) headers["x-commerce-signature"] = `sha256=${await sign(secret, body)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let status = 0;
  let snippet = "";
  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers,
      body,
      redirect: "manual",
      signal: controller.signal,
    });
    status = res.status;
    if (status >= 300 && status < 400) {
      throw new WebhookError(
        "invalid_configuration",
        "Das Ziel antwortet mit einer Weiterleitung. Weiterleitungen werden aus Sicherheitsgründen nicht gefolgt.",
      );
    }
    const text = await res.text();
    snippet = text.slice(0, MAX_RESPONSE_BYTES);
    if (status >= 500)
      throw new WebhookError("temporary_unavailable", `Ziel antwortete mit ${status}.`, true);
    if (status === 429)
      throw new WebhookError("rate_limited", "Ziel meldet zu viele Anfragen.", true);
    if (status >= 400)
      throw new WebhookError("invalid_configuration", `Ziel antwortete mit ${status}.`);
    return { status, response: snippet };
  } catch (error) {
    if (error instanceof WebhookError) {
      await admin
        .from("outgoing_webhook_endpoints")
        .update({
          last_status_code: status || null,
          last_error: error.message,
          last_called_at: new Date().toISOString(),
        } as never)
        .eq("id", input.endpointId);
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    await admin
      .from("outgoing_webhook_endpoints")
      .update({ last_error: message, last_called_at: new Date().toISOString() } as never)
      .eq("id", input.endpointId);
    throw new WebhookError("provider_timeout", message, true);
  } finally {
    clearTimeout(timer);
    if (status && status < 300) {
      await admin
        .from("outgoing_webhook_endpoints")
        .update({
          last_status_code: status,
          last_error: null,
          last_called_at: new Date().toISOString(),
        } as never)
        .eq("id", input.endpointId);
    }
  }
}
