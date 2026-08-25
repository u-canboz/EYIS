/**
 * Thin React binding. The provider holds the client instance and nothing else —
 * all behaviour (tokens, retries, error mapping, cart persistence) lives in the
 * SDK core.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createCommerceClient, type CommerceClient } from "../client";
import type { CommerceClientConfig } from "../config";

const CommerceContext = createContext<CommerceClient | null>(null);

export function CommerceProvider({
  client,
  config,
  children,
}: {
  client?: CommerceClient;
  config?: CommerceClientConfig;
  children: ReactNode;
}) {
  const value = useMemo(() => {
    if (client) return client;
    if (!config) throw new Error("CommerceProvider braucht entweder `client` oder `config`.");
    return createCommerceClient(config);
  }, [client, config]);

  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>;
}

export function useCommerce(): CommerceClient {
  const client = useContext(CommerceContext);
  if (!client)
    throw new Error("useCommerce muss innerhalb von <CommerceProvider> verwendet werden.");
  return client;
}
