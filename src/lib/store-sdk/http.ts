/**
 * Transport core. All request/response semantics live here — the React layer
 * on top adds no behaviour of its own.
 */
import type { ResolvedConfig } from "./config";
import { CommerceError, networkError } from "./errors";
import { STORAGE_KEYS } from "./storage";
import type { StoreErrorCode } from "./types";

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | null | undefined>;
  body?: unknown;
  /** Attach the persisted cart token. */
  cartToken?: string | null;
  /** Attach the persisted customer session token. */
  auth?: boolean;
  /** Attach the persisted scoped guest token. */
  guest?: boolean;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

const RETRY_DELAYS_MS = [200, 600];

function buildUrl(baseUrl: string, path: string, query?: RequestOptions["query"]) {
  const base = baseUrl.replace(/\/+$/, "");
  const url = new URL(base + (path.startsWith("/") ? path : `/${path}`), "http://sdk.local");
  const absolute = /^https?:\/\//i.test(base);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === null || v === undefined || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  return absolute ? url.toString() : url.pathname + (url.search || "");
}

export function randomId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createTransport(config: ResolvedConfig) {
  async function once<T>(options: RequestOptions): Promise<T> {
    const method = options.method ?? "GET";
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Commerce-Key": config.publishableKey,
    };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.cartToken) headers["X-Cart-Token"] = options.cartToken;
    if (options.auth) {
      const session = config.storage.get(STORAGE_KEYS.customerSession);
      if (session) headers["Authorization"] = `Bearer ${session}`;
    }
    if (options.guest) {
      const guest = config.storage.get(STORAGE_KEYS.guestToken);
      if (guest) headers["X-Guest-Token"] = guest;
    }
    if (method !== "GET") headers["Idempotency-Key"] = options.idempotencyKey ?? randomId();

    let response: Response;
    try {
      response = await config.fetch(buildUrl(config.baseUrl, options.path, options.query), {
        method,
        headers,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
        ...(options.signal ? { signal: options.signal } : {}),
      });

    } catch (error) {
      throw networkError(error instanceof Error ? error.message : "Netzwerkfehler.");
    }

    const requestId = response.headers.get("x-request-id");
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const envelope = (payload ?? {}) as {
      data?: unknown;
      error?: { code?: string; message?: string; fieldErrors?: Record<string, string> };
      requestId?: string;
    };

    if (!response.ok || envelope.error) {
      const code = (envelope.error?.code ?? "INTERNAL_ERROR") as StoreErrorCode;
      const error = new CommerceError({
        code,
        message: envelope.error?.message ?? `Anfrage fehlgeschlagen (${response.status}).`,
        status: response.status,
        ...(envelope.error?.fieldErrors ? { fieldErrors: envelope.error.fieldErrors } : {}),
        requestId: requestId ?? envelope.requestId ?? null,
      });
      handleAuthLifecycle(error);
      throw error;
    }

    return envelope.data as T;
  }

  /** Expired proofs are cleared locally; nothing is silently recreated. */
  function handleAuthLifecycle(error: CommerceError) {
    if (error.code === "CART_EXPIRED") config.cartStorage.clear();
    if (error.code === "CUSTOMER_SESSION_EXPIRED") config.storage.remove(STORAGE_KEYS.customerSession);
  }

  return async function request<T>(options: RequestOptions): Promise<T> {
    const method = options.method ?? "GET";
    // Non-GET calls carry an Idempotency-Key, so replaying them is safe.
    const idempotencyKey = method === "GET" ? undefined : (options.idempotencyKey ?? randomId());
    let attempt = 0;
    for (;;) {
      try {
        return await once<T>(
          idempotencyKey ? { ...options, idempotencyKey } : options,
        );
      } catch (error) {
        const retryable = error instanceof CommerceError && error.retryable;
        if (!retryable || attempt >= Math.min(config.maxRetries, RETRY_DELAYS_MS.length)) throw error;
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt] ?? 600));
        attempt += 1;
      }
    }
  };
}

export type Transport = ReturnType<typeof createTransport>;
