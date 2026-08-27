/**
 * Generischer SMTP-Adapter für die bestehende Communication Engine. Server-only.
 *
 * Es gibt keine zweite Versand-Engine: Vorlage, Warteschlange, Zustellversuche,
 * Wiederholungen und Protokollierung laufen unverändert über
 * `communication.server.ts`. Dieser Adapter spricht ausschließlich das
 * SMTP-Protokoll.
 *
 * Sicherheit:
 * - Nur verschlüsselte Verbindungen. Implizites TLS (üblich Port 465) oder
 *   STARTTLS (üblich Port 587). Unverschlüsselter Klartextversand ist nicht
 *   wählbar.
 * - Zugangsdaten kommen aus dem verschlüsselten Tresor und erscheinen niemals
 *   in Fehlermeldungen, Protokollen oder Antworten.
 * - Die Rohsockets kommen aus der Laufzeit. Steht keine Socket-Schnittstelle
 *   zur Verfügung, meldet der Adapter das ehrlich als "provider_unavailable"
 *   statt still auf eine Sandbox auszuweichen.
 */
import {
  CommunicationError,
  type CommunicationProvider,
  type SendMessage,
  type SendResult,
} from "../provider";

/** Zentrale Modellierung der Transportsicherheit. */
export const SMTP_TLS_MODES = ["tls", "starttls"] as const;
export type SmtpEncryption = (typeof SMTP_TLS_MODES)[number];

/** Vom Runtime-SDK verlangte Socket-Option je Modus. */
const SECURE_TRANSPORT: Record<SmtpEncryption, "on" | "starttls"> = {
  tls: "on",
  starttls: "starttls",
};

/** Übliche Ports je Modus — nur als Vorgabe, nie als Zwang. */
export const DEFAULT_PORTS: Record<SmtpEncryption, number> = { tls: 465, starttls: 587 };

/**
 * Normalisiert eine Händlereingabe auf einen der beiden Modi. Unbekannte Werte
 * werden anhand des Ports entschieden (465 = implizites TLS, sonst STARTTLS).
 * Der Händler wählt "TLS" oder "STARTTLS" — `secureTransport` bleibt intern.
 */
export function resolveTlsMode(value: unknown, port?: number): SmtpEncryption {
  const raw = String(value ?? "").trim().toLowerCase();
  if ((SMTP_TLS_MODES as readonly string[]).includes(raw)) return raw as SmtpEncryption;
  if (raw === "ssl" || raw === "implicit" || raw === "on") return "tls";
  if (raw === "start_tls" || raw === "tls-start") return "starttls";
  return port === DEFAULT_PORTS.tls ? "tls" : "starttls";
}

export type SmtpConfig = {
  host: string;
  port: number;
  encryption: SmtpEncryption;
  username: string;
  password: string;
  /** Absender für den SMTP-Umschlag (MAIL FROM). */
  senderAddress?: string | null;
  timeoutMs?: number;
};

/** Minimale Socket-Abstraktion — deckungsgleich mit `cloudflare:sockets`. */
export type SmtpSocket = {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  startTls?: () => SmtpSocket;
  close: () => Promise<void> | void;
};

/** Signatur wie `cloudflare:sockets`: Adresse zuerst, Optionen als zweites Argument. */
export type SmtpConnect = (
  address: { hostname: string; port: number },
  options: {
    secureTransport: "on" | "starttls";
    allowHalfOpen: boolean;
  },
) => SmtpSocket;


const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Lädt die Socket-Schnittstelle der Laufzeit; wirft, wenn es keine gibt. */
async function runtimeConnect(): Promise<SmtpConnect> {
  try {
    // Der Spezifizierer bleibt zur Bauzeit unaufgelöst: Laufzeiten ohne
    // Rohsockets sollen hier scheitern, nicht der Build.
    const specifier = "cloudflare:sockets";
    const mod = (await import(/* @vite-ignore */ specifier)) as {
      connect?: SmtpConnect;
    };
    if (typeof mod.connect === "function") return mod.connect;
  } catch {
    /* Laufzeit ohne Rohsockets */
  }
  throw new CommunicationError(
    "provider_unavailable",
    "Diese Laufzeit stellt keine SMTP-Verbindung bereit. Bitte einen HTTP-basierten E-Mail-Anbieter verwenden.",
    false,
  );
}

function classify(code: number, text: string): CommunicationError {
  if (code === 421 || code === 450 || code === 451 || code === 452)
    return new CommunicationError("provider_unavailable", `SMTP-Server nicht bereit (${code}).`);
  if (code === 454 || code === 535 || code === 530)
    return new CommunicationError("not_configured", "SMTP-Anmeldung abgelehnt.", false);
  if (code === 550 || code === 553)
    return new CommunicationError("invalid_recipient", "Empfänger abgelehnt.", false);
  if (code === 552)
    return new CommunicationError("rejected", "Nachricht zu groß oder abgelehnt.", false);
  if (code === 421 || code === 471)
    return new CommunicationError("rate_limited", "Sendelimit erreicht.");
  return new CommunicationError("rejected", `SMTP-Fehler ${code}: ${text.slice(0, 120)}`, false);
}

class SmtpSession {
  private socket: SmtpSocket;
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private buffer = "";
  readonly capabilities = new Set<string>();

  constructor(socket: SmtpSocket, private readonly timeoutMs: number) {
    this.socket = socket;
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new CommunicationError(
                  "provider_unavailable",
                  "Zeitüberschreitung bei der SMTP-Verbindung.",
                ),
              ),
            this.timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Liest eine vollständige Antwort (mehrzeilig bis "NNN <text>"). */
  async readResponse(): Promise<{ code: number; text: string }> {
    for (;;) {
      const lines = this.buffer.split("\r\n");
      for (let i = 0; i < lines.length - 1; i += 1) {
        const line = lines[i]!;
        if (/^\d{3} /.test(line)) {
          const complete = lines.slice(0, i + 1);
          this.buffer = lines.slice(i + 1).join("\r\n");
          const text = complete.join("\n");
          return { code: Number(line.slice(0, 3)), text };
        }
      }
      const chunk = await this.withTimeout(this.reader.read());
      if (chunk.done)
        throw new CommunicationError(
          "provider_unavailable",
          "SMTP-Verbindung wurde unerwartet beendet.",
        );
      this.buffer += decoder.decode(chunk.value, { stream: true });
    }
  }

  async send(line: string): Promise<void> {
    await this.withTimeout(this.writer.write(encoder.encode(`${line}\r\n`)));
  }

  async command(line: string, expected: number[]): Promise<{ code: number; text: string }> {
    await this.send(line);
    const response = await this.readResponse();
    if (!expected.includes(response.code)) throw classify(response.code, response.text);
    return response;
  }

  async ehlo(host: string): Promise<void> {
    const response = await this.command(`EHLO ${host}`, [250]);
    this.capabilities.clear();
    for (const raw of response.text.split("\n").slice(1)) {
      const value = raw.slice(4).trim().toUpperCase();
      if (value) this.capabilities.add(value.split(" ")[0]!);
      if (value.startsWith("AUTH")) for (const m of value.split(/\s+/)) this.capabilities.add(m);
    }
  }

  /** Wechselt nach STARTTLS auf die verschlüsselte Verbindung. */
  async upgrade(): Promise<void> {
    await this.command("STARTTLS", [220]);
    if (typeof this.socket.startTls !== "function")
      throw new CommunicationError(
        "provider_unavailable",
        "Die Laufzeit unterstützt kein STARTTLS. Bitte Port 465 mit direktem TLS verwenden.",
        false,
      );
    this.reader.releaseLock();
    this.writer.releaseLock();
    this.socket = this.socket.startTls();
    this.reader = this.socket.readable.getReader();
    this.writer = this.socket.writable.getWriter();
    this.buffer = "";
  }

  async authenticate(username: string, password: string): Promise<void> {
    if (this.capabilities.has("LOGIN")) {
      await this.command("AUTH LOGIN", [334]);
      await this.command(base64(username), [334]);
      await this.command(base64(password), [235]);
      return;
    }
    await this.command(`AUTH PLAIN ${base64(`\0${username}\0${password}`)}`, [235]);
  }

  async quit(): Promise<void> {
    try {
      await this.command("QUIT", [221]);
    } catch {
      /* Verbindung schon zu */
    }
    try {
      await this.socket.close();
    } catch {
      /* egal */
    }
  }

  async abort(): Promise<void> {
    try {
      await this.socket.close();
    } catch {
      /* egal */
    }
  }
}

function base64(value: string): string {
  let binary = "";
  for (const byte of encoder.encode(value)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** RFC-2047-Kodierung für Kopfzeilen mit Umlauten. */
function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7E]*$/.test(value) ? value : `=?UTF-8?B?${base64(value)}?=`;
}

function wrap(value: string, width = 76): string {
  const out: string[] = [];
  for (let i = 0; i < value.length; i += width) out.push(value.slice(i, i + width));
  return out.join("\r\n");
}

function addressOf(value: string): string {
  const match = value.match(/<([^>]+)>/);
  // Zeilenumbrüche in Adressen sind Header-Injection: alles ab dem ersten
  // Steuerzeichen wird verworfen.
  // eslint-disable-next-line no-control-regex
  return (match?.[1] ?? value).split(/[\x00-\x1F]/)[0]!.trim();
}

export function buildMimeMessage(
  message: SendMessage,
  fallbackSender: string,
): { from: string; envelopeFrom: string; body: string } {
  const fromAddress = addressOf(message.senderAddress ?? fallbackSender);
  const from = message.senderName
    ? `${encodeHeader(message.senderName)} <${fromAddress}>`
    : fromAddress;
  const boundary = `co_${message.idempotencyKey.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}_b`;
  const headers = [
    `From: ${from}`,
    `To: ${addressOf(message.to)}`,
    ...(message.replyTo ? [`Reply-To: ${addressOf(message.replyTo)}`] : []),
    `Subject: ${encodeHeader(message.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${message.idempotencyKey}@${fromAddress.split("@")[1] ?? "localhost"}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const body = [
    headers.join("\r\n"),
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap(base64(message.text || " ")),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap(base64(message.html || "<p></p>")),
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return { from: fromAddress, envelopeFrom: fromAddress, body };
}

async function openSession(
  config: SmtpConfig,
  connect: SmtpConnect,
): Promise<SmtpSession> {
  const timeout = config.timeoutMs ?? 15_000;
  const mode = resolveTlsMode(config.encryption, config.port);
  let socket: SmtpSocket;
  try {
    // Adresse und Optionen sind getrennte Argumente. Nur so übernimmt die
    // Laufzeit `secureTransport` — sonst schlägt ein späteres STARTTLS mit
    // "secureTransport must be set to 'starttls'" fehl.
    socket = connect(
      { hostname: config.host, port: config.port },
      { secureTransport: SECURE_TRANSPORT[mode], allowHalfOpen: false },
    );
  } catch (error) {
    throw new CommunicationError(
      "provider_unavailable",
      `SMTP-Server ${config.host}:${config.port} nicht erreichbar: ${
        error instanceof Error ? error.message : "Verbindungsfehler"
      }`,
    );
  }
  const session = new SmtpSession(socket, timeout);
  const greeting = await session.readResponse();
  if (greeting.code !== 220) throw classify(greeting.code, greeting.text);
  const helo = config.senderAddress?.split("@")[1] ?? "commerce-os";
  await session.ehlo(helo);
  if (mode === "starttls") {
    if (!session.capabilities.has("STARTTLS")) {
      await session.abort();
      throw new CommunicationError(
        "not_configured",
        "Der Server bietet kein STARTTLS an. Unverschlüsselter Versand ist nicht zulässig.",
        false,
      );
    }
    await session.upgrade();
    await session.ehlo(helo);
  }
  await session.authenticate(config.username, config.password);
  return session;
}


/** Reiner Verbindungstest: TLS aufbauen, anmelden, sauber trennen. */
export async function verifySmtpConnection(
  config: SmtpConfig,
  connect?: SmtpConnect,
): Promise<{ host: string; port: number; encryption: SmtpEncryption; capabilities: string[] }> {
  const connector = connect ?? (await runtimeConnect());
  const session = await openSession(config, connector);
  const capabilities = [...session.capabilities];
  await session.quit();
  return {
    host: config.host,
    port: config.port,
    encryption: config.encryption,
    capabilities,
  };
}

export function createSmtpProvider(
  config: SmtpConfig | null,
  connect?: SmtpConnect,
): CommunicationProvider {
  return {
    key: "smtp",
    label: "Eigener SMTP-Server",
    isSandbox: false,
    capabilities: {
      supportsAttachments: true,
      supportsTags: false,
      supportsTemplates: false,
      supportsDeliveryWebhooks: false,
      supportsBounceWebhooks: false,
      supportsOpenTracking: false,
    },
    async send(message: SendMessage): Promise<SendResult> {
      if (!config)
        throw new CommunicationError(
          "not_configured",
          "Für diesen Shop ist kein SMTP-Server hinterlegt.",
          false,
        );
      const connector = connect ?? (await runtimeConnect());
      const session = await openSession(config, connector);
      try {
        const { from, body } = buildMimeMessage(
          message,
          config.senderAddress ?? config.username,
        );
        await session.command(`MAIL FROM:<${from}>`, [250]);
        await session.command(`RCPT TO:<${addressOf(message.to)}>`, [250, 251]);
        await session.command("DATA", [354]);
        await session.send(body.replace(/\r\n\./g, "\r\n.."));
        const accepted = await session.command(".", [250]);
        await session.quit();
        return {
          providerMessageId: message.idempotencyKey,
          status: "accepted",
          raw: { smtp: accepted.text.slice(0, 200) },
        };
      } catch (error) {
        await session.abort();
        throw error instanceof CommunicationError
          ? error
          : new CommunicationError(
              "unknown",
              error instanceof Error ? error.message : "SMTP-Versand fehlgeschlagen.",
            );
      }
    },
  };
}

/** Unkonfigurierter Adapter für die Registry. */
export const smtpProvider = createSmtpProvider(null);
