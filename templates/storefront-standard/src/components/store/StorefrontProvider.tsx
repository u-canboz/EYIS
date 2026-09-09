import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CommerceProvider } from "@/lib/store-sdk/react/provider";
import type { CommerceClient } from "@/lib/store-sdk";
import {
  getDemoClient,
  resolveStorefrontClient,
  type StorefrontConnection,
} from "@/lib/storefront/client";

const ConnectionContext = createContext<StorefrontConnection>({ status: "demo" });

export function useStorefrontConnection(): StorefrontConnection {
  return useContext(ConnectionContext);
}

/**
 * Bindet die Storefront an die Store API der eigenen Installation.
 *
 * Solange die Verbindung nicht aufgelöst ist, werden bewusst KEINE
 * Beispieldaten gerendert — Katalog, Warenkorb, Checkout, Konto und Retouren
 * sprechen ausschließlich mit der Engine. Beispieldaten greifen nur, wenn gar
 * keine Installation erreichbar ist.
 */
export function StorefrontProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<CommerceClient | null>(null);
  const [connection, setConnection] = useState<StorefrontConnection | null>(null);

  useEffect(() => {
    let active = true;
    void resolveStorefrontClient()
      .then((resolved) => {
        if (!active) return;
        setClient(resolved.client);
        setConnection(resolved.connection);
      })
      .catch(() => {
        if (!active) return;
        setClient(getDemoClient());
        setConnection({ status: "demo" });
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<StorefrontConnection>(
    () => connection ?? { status: "demo" },
    [connection],
  );

  if (!client) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-5 py-16">
        <p className="text-sm text-muted-foreground">Shop wird geladen …</p>
      </div>
    );
  }

  return (
    <ConnectionContext.Provider value={value}>
      <CommerceProvider client={client}>{children}</CommerceProvider>
    </ConnectionContext.Provider>
  );
}
