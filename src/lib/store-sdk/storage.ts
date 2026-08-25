/**
 * Storage adapters. The core never touches `window` at import time; browser
 * APIs are only read lazily inside the adapter methods.
 */

export type TokenStorage = {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
};

export type CartHandle = { cartId: string; cartToken: string };

export type CartStorage = {
  read(): CartHandle | null;
  write(handle: CartHandle): void;
  clear(): void;
};

export function createMemoryStorage(): TokenStorage {
  const map = new Map<string, string>();
  return {
    get: (k) => map.get(k) ?? null,
    set: (k, v) => void map.set(k, v),
    remove: (k) => void map.delete(k),
  };
}

/** localStorage when available, in-memory otherwise (SSR, private mode). */
export function createBrowserStorage(prefix = "commerce."): TokenStorage {
  const fallback = createMemoryStorage();
  const ls = () => {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      return window.localStorage;
    } catch {
      return null;
    }
  };
  return {
    get(key) {
      const store = ls();
      if (!store) return fallback.get(key);
      try {
        return store.getItem(prefix + key);
      } catch {
        return fallback.get(key);
      }
    },
    set(key, value) {
      const store = ls();
      if (!store) return fallback.set(key, value);
      try {
        store.setItem(prefix + key, value);
      } catch {
        fallback.set(key, value);
      }
    },
    remove(key) {
      const store = ls();
      if (!store) return fallback.remove(key);
      try {
        store.removeItem(prefix + key);
      } catch {
        fallback.remove(key);
      }
    },
  };
}

export function createCartStorage(tokens: TokenStorage): CartStorage {
  return {
    read() {
      const cartId = tokens.get("cartId");
      const cartToken = tokens.get("cartToken");
      if (!cartId || !cartToken) return null;
      return { cartId, cartToken };
    },
    write(handle) {
      tokens.set("cartId", handle.cartId);
      tokens.set("cartToken", handle.cartToken);
    },
    clear() {
      tokens.remove("cartId");
      tokens.remove("cartToken");
    },
  };
}

export const STORAGE_KEYS = {
  customerSession: "customerSession",
  guestToken: "guestToken",
} as const;
