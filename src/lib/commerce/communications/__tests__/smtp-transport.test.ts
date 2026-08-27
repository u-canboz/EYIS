/**
 * Transporttests für den SMTP-Adapter. Es wird ein Fake-Server benutzt — es
 * geht ausschließlich um TLS-Modus, Socket-Optionen und Fehlerverhalten.
 */
import { describe, expect, it } from "vitest";
import {
  createSmtpProvider,
  resolveTlsMode,
  verifySmtpConnection,
  type SmtpConnect,
  type SmtpSocket,
} from "../providers/smtp.server";

type ServerOptions = {
  offerStartTls?: boolean;
  authOk?: boolean;
  supportsStartTlsUpgrade?: boolean;
  stall?: boolean;
};

type Recorder = {
  calls: { address: { hostname: string; port: number }; secureTransport: string }[];
  written: string[];
  upgraded: number;
};

function fakeConnect(options: ServerOptions = {}): { connect: SmtpConnect; rec: Recorder } {
  const {
    offerStartTls = true,
    authOk = true,
    supportsStartTlsUpgrade = true,
    stall = false,
  } = options;
  const rec: Recorder = { calls: [], written: [], upgraded: 0 };

  const makeSocket = (greet: boolean): SmtpSocket => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let push: ((chunk: Uint8Array) => void) | null = null;
    const queue: Uint8Array[] = [];
    const emit = (line: string) => {
      const bytes = encoder.encode(`${line}\r\n`);
      if (push) push(bytes);
      else queue.push(bytes);
    };
    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        push = (chunk) => controller.enqueue(chunk);
        for (const chunk of queue.splice(0)) controller.enqueue(chunk);
        if (greet && !stall) emit("220 smtp.example.de ESMTP bereit");
      },
    });
    const writable = new WritableStream<Uint8Array>({
      write(chunk) {
        const text = decoder.decode(chunk);
        rec.written.push(text);
        const command = text.split("\r\n")[0] ?? "";
        if (/^EHLO/i.test(command)) {
          emit("250-smtp.example.de");
          if (offerStartTls && greet) emit("250-STARTTLS");
          emit("250 AUTH LOGIN PLAIN");
        } else if (/^STARTTLS/i.test(command)) {
          emit("220 Bereit für TLS");
        } else if (/^AUTH LOGIN/i.test(command)) {
          emit("334 VXNlcm5hbWU6");
        } else if (/^AUTH PLAIN/i.test(command)) {
          emit(authOk ? "235 Anmeldung erfolgreich" : "535 Anmeldung fehlgeschlagen");
        } else if (/^MAIL FROM/i.test(command) || /^RCPT TO/i.test(command)) {
          emit("250 OK");
        } else if (/^DATA/i.test(command)) {
          emit("354 Ende mit .");
        } else if (command === ".") {
          emit("250 OK: angenommen");
        } else if (/^QUIT/i.test(command)) {
          emit("221 Tschüss");
        } else {
          // Base64-Antwort auf AUTH LOGIN (Benutzername oder Passwort)
          emit(
            rec.written.filter((w) => /^AUTH LOGIN/i.test(w)).length &&
              rec.written.filter((w) => !/^[A-Z]/.test(w)).length >= 2
              ? authOk
                ? "235 Anmeldung erfolgreich"
                : "535 Anmeldung fehlgeschlagen"
              : "334 UGFzc3dvcmQ6",
          );
        }
      },
    });
    const socket: SmtpSocket = { readable, writable, close: () => {} };
    if (supportsStartTlsUpgrade)
      socket.startTls = () => {
        rec.upgraded += 1;
        return makeSocket(false);
      };
    return socket;
  };

  const connect: SmtpConnect = (address, opts) => {
    rec.calls.push({ address, secureTransport: opts.secureTransport });
    return makeSocket(true);
  };
  return { connect, rec };
}

const baseConfig = {
  host: "smtp.example.de",
  username: "shop@example.de",
  password: "geheim",
  senderAddress: "shop@example.de",
  timeoutMs: 2_000,
};

describe("SMTP TLS-Modi", () => {
  it("normalisiert Modi zentral und leitet unbekannte Werte aus dem Port ab", () => {
    expect(resolveTlsMode("STARTTLS", 587)).toBe("starttls");
    expect(resolveTlsMode("tls", 465)).toBe("tls");
    expect(resolveTlsMode("ssl", 465)).toBe("tls");
    expect(resolveTlsMode(undefined, 465)).toBe("tls");
    expect(resolveTlsMode("quatsch", 587)).toBe("starttls");
  });

  it("STARTTLS auf Port 587 initialisiert den Socket mit secureTransport 'starttls' und rüstet auf", async () => {
    const { connect, rec } = fakeConnect();
    const info = await verifySmtpConnection(
      { ...baseConfig, port: 587, encryption: "starttls" },
      connect,
    );
    expect(rec.calls[0]?.secureTransport).toBe("starttls");
    expect(rec.calls[0]?.address).toEqual({ hostname: "smtp.example.de", port: 587 });
    expect(rec.upgraded).toBe(1);
    expect(rec.written.filter((w) => /^EHLO/i.test(w))).toHaveLength(2);
    expect(info.encryption).toBe("starttls");
  });

  it("TLS auf Port 465 verbindet direkt verschlüsselt und ruft kein startTls auf", async () => {
    const { connect, rec } = fakeConnect();
    const info = await verifySmtpConnection({ ...baseConfig, port: 465, encryption: "tls" }, connect);
    expect(rec.calls[0]?.secureTransport).toBe("on");
    expect(rec.upgraded).toBe(0);
    expect(rec.written.some((w) => /^STARTTLS/i.test(w))).toBe(false);
    expect(info.encryption).toBe("tls");
  });

  it("falscher Modus wird anhand des Ports korrigiert statt zu scheitern", async () => {
    const { connect, rec } = fakeConnect();
    const info = await verifySmtpConnection(
      { ...baseConfig, port: 465, encryption: "unbekannt" as never },
      connect,
    );
    expect(rec.calls[0]?.secureTransport).toBe("on");
    expect(info.encryption).toBe("tls");
  });

  it("bricht ab, wenn der Server kein STARTTLS anbietet — niemals unverschlüsselt anmelden", async () => {
    const { connect, rec } = fakeConnect({ offerStartTls: false });
    await expect(
      verifySmtpConnection({ ...baseConfig, port: 587, encryption: "starttls" }, connect),
    ).rejects.toMatchObject({ code: "not_configured" });
    expect(rec.written.some((w) => /^AUTH/i.test(w))).toBe(false);
  });

  it("meldet fehlende STARTTLS-Unterstützung der Laufzeit klar zurück", async () => {
    const { connect } = fakeConnect({ supportsStartTlsUpgrade: false });
    await expect(
      verifySmtpConnection({ ...baseConfig, port: 587, encryption: "starttls" }, connect),
    ).rejects.toMatchObject({ code: "provider_unavailable" });
  });

  it("meldet Anmeldefehler ohne Zugangsdaten preiszugeben", async () => {
    const { connect } = fakeConnect({ authOk: false });
    await expect(
      verifySmtpConnection({ ...baseConfig, port: 465, encryption: "tls" }, connect),
    ).rejects.toMatchObject({ code: "not_configured" });
  });

  it("läuft bei stummem Server in eine Zeitüberschreitung", async () => {
    const { connect } = fakeConnect({ stall: true });
    await expect(
      verifySmtpConnection({ ...baseConfig, port: 587, encryption: "starttls", timeoutMs: 50 }, connect),
    ).rejects.toMatchObject({ code: "provider_unavailable" });
  });

  it("versendet eine Nachricht über den regulären Provider-Weg", async () => {
    const { connect, rec } = fakeConnect();
    const provider = createSmtpProvider({ ...baseConfig, port: 587, encryption: "starttls" }, connect);
    const result = await provider.send({
      to: "kundin@example.com",
      senderName: "Mein Shop",
      senderAddress: "shop@example.de",
      replyTo: null,
      subject: "Test",
      html: "<p>Hallo</p>",
      text: "Hallo",
      tags: {},
      idempotencyKey: "smtp-transport-1",
    });
    expect(result.status).toBe("accepted");
    expect(rec.calls[0]?.secureTransport).toBe("starttls");
    expect(JSON.stringify(result)).not.toContain("geheim");
  });

  it("schlägt ohne hinterlegte Zugangsdaten ehrlich fehl", async () => {
    const provider = createSmtpProvider(null);
    await expect(
      provider.send({
        to: "kundin@example.com",
        senderName: null,
        senderAddress: null,
        replyTo: null,
        subject: "Test",
        html: "<p>x</p>",
        text: "x",
        tags: {},
        idempotencyKey: "smtp-transport-2",
      }),
    ).rejects.toMatchObject({ code: "not_configured" });
  });
});
