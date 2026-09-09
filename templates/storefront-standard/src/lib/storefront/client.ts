import { createCommerceClient, type CommerceClient } from "@/lib/store-sdk";
import { resolveRuntime } from "@/lib/store-sdk/runtime";
import { COMMERCE_API_URL, COMMERCE_PUBLISHABLE_KEY } from "./config";
import { DEMO_BASE_URL, demoFetch } from "./demo-backend";

let demoClient: CommerceClient | null = null;

/** Fallback-Client mit Beispieldaten, solange der Shop nicht eingerichtet ist. */
export function getDemoClient(): CommerceClient {
  if (!demoClient) {
    demoClient = createCommerceClient({
      baseUrl: DEMO_BASE_URL,
      publishableKey: "pk_demo",
      locale: "de-DE",
      fetch: demoFetch as typeof fetch,
    });
  }
  return demoClient;
}

export type StorefrontConnection =
  | { status: "demo" }
  | { status: "setup_required" }
  | { status: "connected"; mode: "dedicated" | "remote" };

/**
 * Löst die Verbindung zur Store API auf: zuerst die eigene Installation
 * (same-origin Runtime-Config), sonst optionale Remote-Overrides.
 */
export async function resolveStorefrontClient(): Promise<{
  client: CommerceClient;
  connection: StorefrontConnection;
}> {
  const runtime = await resolveRuntime({
    baseUrl: COMMERCE_API_URL || undefined,
    publishableKey: COMMERCE_PUBLISHABLE_KEY || undefined,
  });

  if (runtime.status === "ready") {
    return {
      client: createCommerceClient({
        baseUrl: runtime.baseUrl,
        publishableKey: runtime.publishableKey,
        locale: runtime.locale,
      }),
      connection: { status: "connected", mode: runtime.mode },
    };
  }

  return {
    client: getDemoClient(),
    connection: runtime.status === "setup_required" ? { status: "setup_required" } : { status: "demo" },
  };
}

/** Rückwärtskompatibler Zugriff für synchrone Aufrufer (Demo-Client). */
export function getCommerceClient(): CommerceClient {
  return getDemoClient();
}
