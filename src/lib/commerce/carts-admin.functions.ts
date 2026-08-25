/** Admin API: read-only insight into carts and checkout sessions. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CartStatus } from "./cart-types";

type Base = { organizationId: string; shopId: string };

export type CartListRow = {
  id: string;
  status: string;
  currencyCode: string;
  email: string | null;
  itemCount: number;
  totalMinor: number;
  updatedAt: string;
  expiresAt: string;
  hasOpenCheckout: boolean;
};

export const listCarts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Base & { status?: CartStatus | null; search?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("./core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "carts.read");

    const sel = (s: string): string => s;
    let query = context.supabase
      .from("carts")
      .select(sel("id, status, currency_code, customer_email, updated_at, expires_at"))
      .eq("organization_id", data.organizationId)
      .eq("shop_id", data.shopId)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (data.status) query = query.eq("status", data.status);
    if (data.search) query = query.ilike("customer_email", `%${data.search}%`);

    const { data: carts, error } = await query.returns<
      {
        id: string;
        status: string;
        currency_code: string;
        customer_email: string | null;
        updated_at: string;
        expires_at: string;
      }[]
    >();
    if (error) throw new Error(error.message);
    const ids = (carts ?? []).map((c) => c.id);
    if (!ids.length) return [] as CartListRow[];

    const [{ data: items }, { data: snapshots }, { data: sessions }] = await Promise.all([
      context.supabase.from("cart_items").select("cart_id, quantity").in("cart_id", ids),
      context.supabase
        .from("cart_price_snapshots")
        .select("cart_id, version, total_minor")
        .in("cart_id", ids)
        .order("version", { ascending: true }),
      context.supabase
        .from("checkout_sessions")
        .select("cart_id, status")
        .in("cart_id", ids)
        .in("status", ["open", "validated", "awaiting_payment"]),
    ]);

    const counts = new Map<string, number>();
    for (const it of (items ?? []) as { cart_id: string; quantity: number }[]) {
      counts.set(it.cart_id, (counts.get(it.cart_id) ?? 0) + it.quantity);
    }
    const totals = new Map<string, number>();
    for (const s of (snapshots ?? []) as { cart_id: string; total_minor: number }[]) {
      totals.set(s.cart_id, Number(s.total_minor));
    }
    const open = new Set(((sessions ?? []) as { cart_id: string }[]).map((s) => s.cart_id));

    return (carts ?? []).map((c) => ({
      id: c.id,
      status: c.status,
      currencyCode: c.currency_code,
      email: c.customer_email,
      itemCount: counts.get(c.id) ?? 0,
      totalMinor: totals.get(c.id) ?? 0,
      updatedAt: c.updated_at,
      expiresAt: c.expires_at,
      hasOpenCheckout: open.has(c.id),
    })) as CartListRow[];
  });

export const getCartDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; cartId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("./core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "carts.read");

    const { data: cart, error } = await context.supabase
      .from("carts")
      .select("*")
      .eq("id", data.cartId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cart) throw new Error("Warenkorb nicht gefunden.");

    const [{ data: items }, { data: snapshots }, { data: sessions }, { data: codes }] =
      await Promise.all([
        context.supabase.from("cart_items").select("*").eq("cart_id", data.cartId),
        context.supabase
          .from("cart_price_snapshots")
          .select(
            "id, version, subtotal_minor, discount_minor, shipping_minor, tax_minor, total_minor, pricing_engine_version, created_at",
          )
          .eq("cart_id", data.cartId)
          .order("version", { ascending: false }),
        context.supabase
          .from("checkout_sessions")
          .select("id, status, email, expires_at, created_at, shipping_option_id")
          .eq("cart_id", data.cartId)
          .order("created_at", { ascending: false }),
        context.supabase
          .from("cart_promotion_codes")
          .select("code_snapshot")
          .eq("cart_id", data.cartId),
      ]);

    return {
      cart,
      items: items ?? [],
      snapshots: snapshots ?? [],
      sessions: sessions ?? [],
      codes: ((codes ?? []) as { code_snapshot: string }[]).map((c) => c.code_snapshot),
    };
  });

/** Housekeeping: expire due checkout sessions and release their reservations. */
export const expireCheckoutSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("./core.server");
    await assertPermission(
      context.supabase,
      context.userId,
      data.organizationId,
      "checkout.manage",
    );
    const checkout = await import("./checkout.server");
    return await checkout.expireDueSessions(data.organizationId);
  });

/** Storefront test data: sellable variants of a shop with their resolved price. */
export const listSellableVariants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Base) => data)
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("./core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "products.read");

    const sel = (s: string): string => s;
    const { data: rows, error } = await context.supabase
      .from("product_variants")
      .select(sel("id, title, sku, status, product_id, products!inner(id, name, shop_id, status)"))
      .eq("organization_id", data.organizationId)
      .eq("status", "active")
      .eq("products.shop_id", data.shopId)
      .eq("products.status", "active")
      .limit(200)
      .returns<
        {
          id: string;
          title: string;
          sku: string | null;
          product_id: string;
          products: { id: string; name: string } | null;
        }[]
      >();
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      variantId: r.id,
      variantTitle: r.title,
      sku: r.sku,
      productId: r.product_id,
      productName: r.products?.name ?? "",
    }));
  });
