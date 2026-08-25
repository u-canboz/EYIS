/**
 * Convenience hooks over the SDK core. They add caching only — no parallel
 * state store, no business logic.
 */
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { useCommerce } from "./provider";
import type {
  StoreCart,
  StoreCategory,
  StoreCollection,
  StoreConfig,
  StoreCustomer,
  StoreList,
  StoreOrder,
  StoreOrderSummary,
  StoreProduct,
  StoreProductSummary,
} from "../types";

type QueryExtra<T> = Omit<UseQueryOptions<T, Error, T, readonly unknown[]>, "queryKey" | "queryFn">;

export const commerceKeys = {
  config: ["commerce", "config"] as const,
  products: (params: unknown) => ["commerce", "products", params] as const,
  product: (handle: string) => ["commerce", "product", handle] as const,
  search: (term: string) => ["commerce", "search", term] as const,
  categories: ["commerce", "categories"] as const,
  collections: ["commerce", "collections"] as const,
  cart: ["commerce", "cart"] as const,
  customer: ["commerce", "customer"] as const,
  customerOrders: ["commerce", "customer", "orders"] as const,
  customerOrder: (id: string) => ["commerce", "customer", "order", id] as const,
};

export function useStoreConfig(extra?: QueryExtra<StoreConfig>) {
  const client = useCommerce();
  return useQuery({ queryKey: commerceKeys.config, queryFn: () => client.config(), ...extra });
}

export function useProducts(
  params?: { page?: number; pageSize?: number; category?: string | null; collection?: string | null; sort?: string | null },
  extra?: QueryExtra<StoreList<StoreProductSummary>>,
) {
  const client = useCommerce();
  return useQuery({
    queryKey: commerceKeys.products(params ?? {}),
    queryFn: () => client.catalog.products(params),
    ...extra,
  });
}

export function useProduct(handle: string, extra?: QueryExtra<StoreProduct>) {
  const client = useCommerce();
  return useQuery({
    queryKey: commerceKeys.product(handle),
    queryFn: () => client.catalog.product(handle),
    enabled: Boolean(handle),
    ...extra,
  });
}

export function useSearch(term: string, extra?: QueryExtra<StoreList<StoreProductSummary>>) {
  const client = useCommerce();
  return useQuery({
    queryKey: commerceKeys.search(term),
    queryFn: () => client.catalog.search(term),
    enabled: term.trim().length > 1,
    ...extra,
  });
}

export function useCategories(extra?: QueryExtra<StoreCategory[]>) {
  const client = useCommerce();
  return useQuery({ queryKey: commerceKeys.categories, queryFn: () => client.catalog.categories(), ...extra });
}

export function useCollections(extra?: QueryExtra<StoreCollection[]>) {
  const client = useCommerce();
  return useQuery({ queryKey: commerceKeys.collections, queryFn: () => client.catalog.collections(), ...extra });
}

export function useCart() {
  const client = useCommerce();
  const queryClient = useQueryClient();
  const query = useQuery<StoreCart | null>({
    queryKey: commerceKeys.cart,
    queryFn: async () => (client.cart.handle() ? client.cart.get() : null),
  });

  const set = (cart: StoreCart) => queryClient.setQueryData(commerceKeys.cart, cart);

  const addItem = useMutation({
    mutationFn: async (input: { variantId: string; quantity: number }) => {
      await client.cart.ensure();
      return client.cart.addItem(input);
    },
    onSuccess: set,
  });
  const updateItem = useMutation({
    mutationFn: (input: { itemId: string; quantity: number }) =>
      client.cart.updateItem(input.itemId, input.quantity),
    onSuccess: set,
  });
  const removeItem = useMutation({
    mutationFn: (itemId: string) => client.cart.removeItem(itemId),
    onSuccess: set,
  });
  const applyPromotion = useMutation({
    mutationFn: (code: string) => client.cart.applyPromotion(code),
    onSuccess: set,
  });
  const removePromotion = useMutation({
    mutationFn: (code: string) => client.cart.removePromotion(code),
    onSuccess: set,
  });

  return { ...query, addItem, updateItem, removeItem, applyPromotion, removePromotion };
}

export function useCheckout(sessionId: string | null) {
  const client = useCommerce();
  return useQuery<StoreCheckoutResult | null>({
    queryKey: ["commerce", "checkout", sessionId],
    queryFn: async () => (sessionId ? client.checkout.get(sessionId) : null),
    enabled: Boolean(sessionId),
  });
}
type StoreCheckoutResult = Awaited<ReturnType<CommerceCheckoutGet>>;
type CommerceCheckoutGet = ReturnType<typeof useCommerce>["checkout"]["get"];

export function useCustomer(extra?: QueryExtra<StoreCustomer | null>) {
  const client = useCommerce();
  return useQuery<StoreCustomer | null>({
    queryKey: commerceKeys.customer,
    queryFn: async () => (client.customer.isAuthenticated() ? client.customer.me() : null),
    ...extra,
  });
}

export function useCustomerOrders(extra?: QueryExtra<StoreOrderSummary[]>) {
  const client = useCommerce();
  return useQuery({
    queryKey: commerceKeys.customerOrders,
    queryFn: () => client.customer.orders(),
    enabled: client.customer.isAuthenticated(),
    ...extra,
  });
}

export function useCustomerOrder(orderId: string, extra?: QueryExtra<StoreOrder>) {
  const client = useCommerce();
  return useQuery({
    queryKey: commerceKeys.customerOrder(orderId),
    queryFn: () => client.customer.order(orderId),
    enabled: Boolean(orderId) && client.customer.isAuthenticated(),
    ...extra,
  });
}
