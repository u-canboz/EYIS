/**
 * Dedicated vs. Remote Konfigurationsauflösung.
 *
 * Dedicated (Standard, wenn das SDK im selben Projekt wie EYIS läuft):
 *   Same-Origin `/api/public/store/v1`, Publishable Key kommt aus der
 *   Runtime-Config der Installation. Keine ENV-Variable, keine Eingabe.
 *
 * Remote (nur bei ausdrücklicher Konfiguration):
 *   API-Basis-URL und Publishable Key müssen gesetzt sein.
 *
 * Beide Modi bleiben strikt getrennt — keine Vermischung.
 */

export const DEFAULT_STORE_API_PATH = "/api/public/store/v1";

export type StoreRuntimeConfig = {
  deploymentMode: "dedicated" | "shared";
  apiVersion: string;
  apiBaseUrl: string;
  publishableKey: string | null;
  shop: { handle: string; name: string; locale: string; currencyCode: string } | null;
  setupRequired: boolean;
};

export type ResolvedRuntime =
  | { status: "ready"; mode: "dedicated" | "remote"; baseUrl: string; publishableKey: string; locale: string }
  | { status: "setup_required" }
  | { status: "unavailable"; reason: string };

/** Lädt die Runtime-Config der eigenen Installation (Same-Origin). */
export async function fetchRuntimeConfig(
  origin = typeof window === "undefined" ? "" : window.location.origin,
  fetchImpl: typeof fetch = fetch,
): Promise<StoreRuntimeConfig | null> {
  try {
    const res = await fetchImpl(`${origin}${DEFAULT_STORE_API_PATH}/runtime-config`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: StoreRuntimeConfig };
    return body.data ?? null;
  } catch {
    return null;
  }
}

export type RemoteOverrides = {
  baseUrl?: string | undefined;
  publishableKey?: string | undefined;
};

/**
 * Auflösungsreihenfolge: Dedicated Runtime-Config zuerst; nur wenn die
 * Installation nicht dedicated ist, greifen die Remote-Overrides.
 */
export async function resolveRuntime(
  overrides: RemoteOverrides = {},
  origin = typeof window === "undefined" ? "" : window.location.origin,
  fetchImpl: typeof fetch = fetch,
): Promise<ResolvedRuntime> {
  const config = await fetchRuntimeConfig(origin, fetchImpl);

  if (config?.deploymentMode === "dedicated") {
    if (config.publishableKey && !config.setupRequired) {
      return {
        status: "ready",
        mode: "dedicated",
        baseUrl: `${origin}${config.apiBaseUrl || DEFAULT_STORE_API_PATH}`,
        publishableKey: config.publishableKey,
        locale: config.shop?.locale ?? "de-DE",
      };
    }
    return { status: "setup_required" };
  }

  const key = overrides.publishableKey?.trim();
  if (key) {
    return {
      status: "ready",
      mode: "remote",
      baseUrl: (overrides.baseUrl?.trim() || `${origin}${DEFAULT_STORE_API_PATH}`).replace(/\/$/, ""),
      publishableKey: key,
      locale: "de-DE",
    };
  }

  return {
    status: "unavailable",
    reason: "Kein Dedicated-Shop und kein Remote-Publishable-Key konfiguriert.",
  };
}
