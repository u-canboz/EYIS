/**
 * Commerce Store SDK — framework neutral core.
 *
 * The only integration surface for external storefronts. It talks exclusively
 * to the public Store API; it never imports Supabase, never touches internal
 * commerce modules and never reads `window` at import time.
 */
import type { CommerceClientConfig, ResolvedConfig } from "./config";
import { CommerceError } from "./errors";
import { createTransport, randomId, type Transport } from "./http";
import {
  createBrowserStorage,
  createCartStorage,
  STORAGE_KEYS,
  type CartHandle,
} from "./storage";
import type {
  StoreCart,
  StoreCartCreated,
  StoreCategory,
  StoreCheckout,
  StoreCollection,
  StoreConfig,
  StoreCustomer,
  StoreList,
  StoreOrder,
  StoreOrderSummary,
  StorePaymentSession,
  StorePaymentStatus,
  StoreProduct,
  StoreProductSummary,
  StoreShippingOption,
  StoreReturn,
  StoreReturnEligibility,
} from "./types";

export type CommerceClient = ReturnType<typeof createCommerceClient>;

function resolveConfig(input: CommerceClientConfig): ResolvedConfig {
  const storage = input.storage ?? createBrowserStorage();
  return {
    baseUrl: input.baseUrl,
    publishableKey: input.publishableKey,
    storage,
    cartStorage: input.cartStorage ?? createCartStorage(storage),
    fetch: input.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args)),
    locale: input.locale ?? "de-DE",
    maxRetries: input.maxRetries ?? 2,
  };
}

export function createCommerceClient(input: CommerceClientConfig) {
  if (!input.baseUrl) throw new Error("createCommerceClient: baseUrl fehlt.");
  if (!input.publishableKey) throw new Error("createCommerceClient: publishableKey fehlt.");
  const config = resolveConfig(input);
  const request: Transport = createTransport(config);

  const requireCart = (): CartHandle => {
    const handle = config.cartStorage.read();
    if (!handle)
      throw new CommerceError({
        code: "CART_EXPIRED",
        message: "Es existiert kein aktiver Warenkorb.",
        status: 409,
      });
    return handle;
  };

  const cart = {
    /** Locally known cart handle (id + token), without a network call. */
    handle: () => config.cartStorage.read(),
    clear: () => config.cartStorage.clear(),

    async create(options?: { regionCode?: string | null }): Promise<StoreCart> {
      const created = await request<StoreCartCreated>({
        method: "POST",
        path: "/cart",
        body: { locale: config.locale, regionCode: options?.regionCode ?? null },
      });
      config.cartStorage.write({ cartId: created.cart.id, cartToken: created.cartToken });
      return created.cart;
    },

    /** Returns the current cart, creating one only when explicitly allowed. */
    async ensure(): Promise<StoreCart> {
      const handle = config.cartStorage.read();
      if (!handle) return cart.create();
      try {
        return await cart.get();
      } catch (error) {
        if (error instanceof CommerceError && (error.code === "CART_EXPIRED" || error.status === 403)) {
          config.cartStorage.clear();
          return cart.create();
        }
        throw error;
      }
    },

    async get(): Promise<StoreCart> {
      const handle = requireCart();
      return request<StoreCart>({ path: `/cart/${handle.cartId}`, cartToken: handle.cartToken });
    },

    async addItem(input: { variantId: string; quantity: number }): Promise<StoreCart> {
      const handle = requireCart();
      return request<StoreCart>({
        method: "POST",
        path: `/cart/${handle.cartId}/items`,
        cartToken: handle.cartToken,
        body: input,
      });
    },

    async updateItem(itemId: string, quantity: number): Promise<StoreCart> {
      const handle = requireCart();
      return request<StoreCart>({
        method: "PATCH",
        path: `/cart/${handle.cartId}/items/${itemId}`,
        cartToken: handle.cartToken,
        body: { quantity },
      });
    },

    async removeItem(itemId: string): Promise<StoreCart> {
      const handle = requireCart();
      return request<StoreCart>({
        method: "DELETE",
        path: `/cart/${handle.cartId}/items/${itemId}`,
        cartToken: handle.cartToken,
      });
    },

    async applyPromotion(code: string): Promise<StoreCart> {
      const handle = requireCart();
      return request<StoreCart>({
        method: "POST",
        path: `/cart/${handle.cartId}/promotions`,
        cartToken: handle.cartToken,
        body: { code },
      });
    },

    async removePromotion(code: string): Promise<StoreCart> {
      const handle = requireCart();
      return request<StoreCart>({
        method: "DELETE",
        path: `/cart/${handle.cartId}/promotions/${encodeURIComponent(code)}`,
        cartToken: handle.cartToken,
      });
    },
  };

  const withCartToken = <T>(path: string, init: Omit<Parameters<Transport>[0], "path" | "cartToken">) =>
    request<T>({ ...init, path, cartToken: requireCart().cartToken });

  const checkout = {
    start: (email?: string | null) =>
      withCartToken<StoreCheckout>("/checkout", {
        method: "POST",
        body: { cartId: requireCart().cartId, email: email ?? null },
      }),
    get: (sessionId: string) => withCartToken<StoreCheckout>(`/checkout/${sessionId}`, {}),
    setEmail: (sessionId: string, email: string) =>
      withCartToken<StoreCheckout>(`/checkout/${sessionId}/email`, { method: "POST", body: { email } }),
    setAddress: (
      sessionId: string,
      input: { type: "shipping" | "billing"; address: Record<string, unknown>; billingSameAsShipping?: boolean },
    ) => withCartToken<StoreCheckout>(`/checkout/${sessionId}/address`, { method: "POST", body: input }),
    shippingOptions: (sessionId: string) =>
      withCartToken<StoreShippingOption[]>(`/checkout/${sessionId}/shipping-options`, {}),
    setShippingOption: (sessionId: string, shippingMethodId: string) =>
      withCartToken<StoreCheckout>(`/checkout/${sessionId}/shipping-option`, {
        method: "POST",
        body: { shippingMethodId },
      }),
    validate: (sessionId: string) =>
      withCartToken<StoreCheckout>(`/checkout/${sessionId}/validate`, { method: "POST", body: {} }),
    createPaymentSession: (
      sessionId: string,
      input: { returnUrl: string; cancelUrl?: string | null; provider?: string | null },
    ) =>
      withCartToken<StorePaymentSession>(`/checkout/${sessionId}/payment-session`, {
        method: "POST",
        body: input,
      }),
  };

  const payments = {
    status: (paymentSessionId: string) =>
      withCartToken<StorePaymentStatus>(`/payments/${paymentSessionId}/status`, {}),
  };

  const orders = {
    /**
     * Redeems a confirmation token. It is short lived, scoped to one order of
     * one shop, single use and revocable — never persisted by the SDK and never
     * turned into a shareable order URL.
     */
    async redeemConfirmation(token: string): Promise<StoreOrder> {
      const order = await request<StoreOrder>({ path: `/orders/confirmation/${encodeURIComponent(token)}` });
      // The cart behind a completed order is done; drop the local handle.
      config.cartStorage.clear();
      return order;
    },
    requestGuestAccess: (input: { orderNumber: string; email: string }) =>
      request<{ requested: true }>({ method: "POST", path: "/orders/guest-access", body: input }),
    /** Stores the scoped guest token from the emailed link. */
    useGuestToken(token: string) {
      config.storage.set(STORAGE_KEYS.guestToken, token);
    },
    clearGuestToken() {
      config.storage.remove(STORAGE_KEYS.guestToken);
    },
    guestOrder: () => request<StoreOrder>({ path: "/orders/guest", guest: true }),
    guestDocumentUrl: (documentId: string) =>
      request<{ url: string | null }>({ path: `/orders/guest/documents/${documentId}`, guest: true }),
  };

  const returns = {
    guestEligibility: () => request<StoreReturnEligibility>({ path: "/returns/eligibility", guest: true }),
    create: (input: {
      items: { orderItemId: string; quantity: number }[];
      reason: string;
      note?: string | null;
      idempotencyKey?: string;
    }) => {
      const idempotencyKey = input.idempotencyKey ?? randomId();
      return request<StoreReturn>({
        method: "POST",
        path: "/returns",
        guest: true,
        idempotencyKey,
        body: { ...input, idempotencyKey },
      });
    },
  };

  const customer = {
    /**
     * Store auth wrapper: credentials are exchanged server-side for an opaque
     * store session token. Storefronts never see an auth provider client.
     */
    async login(input: { email: string; password: string }): Promise<{ customer: StoreCustomer }> {
      const result = await request<{ token: string; expiresAt: string; customer: StoreCustomer }>({
        method: "POST",
        path: "/customer/auth/login",
        body: input,
      });
      config.storage.set(STORAGE_KEYS.customerSession, result.token);
      return { customer: result.customer };
    },
    async register(input: {
      email: string;
      password: string;
      firstName?: string | null;
      lastName?: string | null;
    }): Promise<{ customer: StoreCustomer | null; sessionActive: boolean }> {
      const result = await request<{
        token: string | null;
        customer: StoreCustomer | null;
        confirmationRequired: boolean;
      }>({ method: "POST", path: "/customer/auth/register", body: input });
      if (result.token) config.storage.set(STORAGE_KEYS.customerSession, result.token);
      return { customer: result.customer, sessionActive: Boolean(result.token) };
    },
    requestPasswordReset: (email: string) =>
      request<{ requested: true }>({ method: "POST", path: "/customer/auth/password-reset", body: { email } }),
    logout() {
      config.storage.remove(STORAGE_KEYS.customerSession);
    },
    isAuthenticated: () => Boolean(config.storage.get(STORAGE_KEYS.customerSession)),
    me: () => request<StoreCustomer>({ path: "/customer/me", auth: true }),
    orders: () => request<StoreOrderSummary[]>({ path: "/customer/orders", auth: true }),
    order: (orderId: string) => request<StoreOrder>({ path: `/customer/orders/${orderId}`, auth: true }),
    documentUrl: (orderId: string, documentId: string) =>
      request<{ url: string | null }>({
        path: `/customer/orders/${orderId}/documents/${documentId}`,
        auth: true,
      }),
  };

  const catalog = {
    products: (params?: {
      page?: number;
      pageSize?: number;
      category?: string | null;
      collection?: string | null;
      sort?: string | null;
    }) =>
      request<StoreList<StoreProductSummary>>({
        path: "/products",
        query: {
          page: params?.page ?? 1,
          pageSize: params?.pageSize ?? 24,
          category: params?.category ?? null,
          collection: params?.collection ?? null,
          sort: params?.sort ?? null,
        },
      }),
    product: (handle: string) => request<StoreProduct>({ path: `/products/${encodeURIComponent(handle)}` }),
    search: (term: string, limit = 12) =>
      request<StoreList<StoreProductSummary>>({ path: "/search", query: { q: term, limit } }),
    categories: () => request<StoreCategory[]>({ path: "/categories" }),
    collections: () => request<StoreCollection[]>({ path: "/collections" }),
  };

  return {
    config: () => request<StoreConfig>({ path: "/config" }),
    catalog,
    cart,
    checkout,
    payments,
    orders,
    returns,
    customer,
    /** Escape hatch for endpoints not yet wrapped. Same error model. */
    raw: request,
  };
}
