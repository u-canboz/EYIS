/**
 * Client configuration for the Commerce Store SDK.
 *
 * The publishable key is NOT a secret. It identifies shop and environment so
 * the API knows which tenant a request belongs to. Every sensitive access
 * additionally requires a real access proof (cart token, customer session or
 * scoped guest token), which the SDK manages through `TokenStorage`.
 */
import type { CartStorage, TokenStorage } from "./storage";

export type CommerceClientConfig = {
  /** Base URL of the Store API, e.g. https://shop.example.com/api/public/store/v1 */
  baseUrl: string;
  /** Publishable key (pk_test_… / pk_live_…). Safe to ship in a client bundle. */
  publishableKey: string;
  /** Session/guest token persistence. Defaults to browser localStorage, memory on the server. */
  storage?: TokenStorage;
  /** Cart id + cart token persistence. Defaults to the same adapter as `storage`. */
  cartStorage?: CartStorage;
  /** Custom fetch (tests, SSR, instrumentation). */
  fetch?: typeof fetch;
  locale?: string;
  /** Retries for retryable failures (network, 5xx, 429). Default 2. */
  maxRetries?: number;
};

export type ResolvedConfig = Required<Omit<CommerceClientConfig, "storage" | "cartStorage">> & {
  storage: TokenStorage;
  cartStorage: CartStorage;
};

export const STORE_SDK_VERSION = "1.0.0";
