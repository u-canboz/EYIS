/**
 * SMTP-Sockets für Node-Laufzeiten (Entwicklungsserver, Node-Deployments).
 *
 * Reine Transportschicht: sie bildet `node:net`/`node:tls` auf dieselbe
 * Socket-Abstraktion ab, die der Adapter von `cloudflare:sockets` erwartet.
 * Keine Protokoll-, Anmelde- oder Nachrichtenlogik.
 */
import type { SmtpConnect, SmtpSocket } from "./smtp.server";

type NodeSocket = {
  on: (event: string, handler: (arg?: unknown) => void) => unknown;
  removeAllListeners: (event?: string) => unknown;
  write: (chunk: Uint8Array, cb: (error?: Error | null) => void) => unknown;
  end: () => unknown;
  destroy: () => unknown;
};

function toWeb(socket: NodeSocket, upgrade: () => SmtpSocket): SmtpSocket {
  return {
    readable: new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        const finish = () => {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {
            /* bereits geschlossen */
          }
        };
        socket.on("data", (chunk) => {
          if (!closed) controller.enqueue(new Uint8Array(chunk as Uint8Array));
        });
        socket.on("end", finish);
        socket.on("close", finish);
        socket.on("error", (error) => {
          if (closed) return;
          closed = true;
          controller.error(error);
        });
      },
    }),
    writable: new WritableStream<Uint8Array>({
      write(chunk) {
        return new Promise<void>((resolve, reject) => {
          socket.write(chunk, (error) => (error ? reject(error) : resolve()));
        });
      },
    }),
    startTls: upgrade,
    close() {
      try {
        socket.end();
      } catch {
        /* egal */
      }
    },
  };
}

/** Lädt die Node-Socket-Schnittstelle; wirft, wenn keine vorhanden ist. */
export async function nodeSmtpConnect(): Promise<SmtpConnect> {
  const net = await import("node:net");
  const tls = await import("node:tls");

  return (address, options) => {
    const hostname = address.hostname;
    if (options.secureTransport === "on") {
      const secure = tls.connect({
        host: hostname,
        port: address.port,
        servername: hostname,
      }) as unknown as NodeSocket;
      return toWeb(secure, () => {
        throw new Error("Verbindung ist bereits TLS-verschlüsselt.");
      });
    }

    const plain = net.connect({ host: hostname, port: address.port }) as unknown as NodeSocket;
    return toWeb(plain, () => {
      plain.removeAllListeners("data");
      plain.removeAllListeners("end");
      plain.removeAllListeners("close");
      plain.removeAllListeners("error");
      const secure = tls.connect({
        socket: plain as never,
        servername: hostname,
      }) as unknown as NodeSocket;
      return toWeb(secure, () => {
        throw new Error("Verbindung ist bereits TLS-verschlüsselt.");
      });
    });
  };
}
