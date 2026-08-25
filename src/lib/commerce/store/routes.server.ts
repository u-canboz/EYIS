/**
 * Route table of the public Store API (v1).
 *
 * Every handler receives a fully verified context. Cart, checkout, payment,
 * order and return routes always demand a real access proof on top of the
 * publishable key.
 */
import { z } from "zod";
import { badRequest, forbidden, notFound, type RouteDef, type StoreCtx } from "./gateway.server";
import { getProduct, listCategories, listCollections, listProducts, searchProducts } from "./catalog-public.server";
import { mapCart, mapCheckout, mapOrder } from "./mappers.server";
import { getAdmin, generateToken, hashToken } from "../core.server";
import type { StoreConfig } from "@/lib/store-sdk/types";
import { STORE_API_VERSION } from "@/lib/store-sdk/types";

const addressSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  company: z.string().max(120).nullish(),
  street: z.string().min(1).max(160),
  street2: z.string().max(160).nullish(),
  postalCode: z.string().min(1).max(16),
  city: z.string().min(1).max(80),
  state: z.string().max(80).nullish(),
  countryCode: z.string().length(2),
  phone: z.string().max(40).nullish(),
});

const intPage = (ctx: StoreCtx, key: string, fallback: number, max: number) => {
  const raw = Number(ctx.query.get(key) ?? fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(Math.max(Math.floor(raw), 1), max);
};

async function cartView(ctx: StoreCtx, cartId: string) {
  const { cart } = await ctx.requireCart(cartId);
  const cartApi = await import("../cart.server");
  return mapCart(await cartApi.buildCartView(cart));
}

/** Checkout sessions are authorised by the cart token of their own cart. */
async function assertCheckoutOwnership(ctx: StoreCtx, sessionId: string) {
  const checkout = await import("../checkout.server");
  const session = await checkout.loadSession(sessionId).catch(() => null);
  if (!session) throw notFound("Checkout nicht gefunden.");
  if (session.shop_id !== ctx.key.shopId) throw forbidden("Checkout gehört nicht zu diesem Shop.");
  await ctx.requireCart(session.cart_id);
  return session;
}

export const storeRoutes: RouteDef[] = [
  {
    method: "GET",
    path: "/config",
    profile: "catalog_read",
    handler: async (ctx): Promise<StoreConfig> => {
      const admin = await getAdmin();
      const { data } = await admin
        .from("shops")
        .select("name, slug, locale, currency")
        .eq("id", ctx.key.shopId)
        .maybeSingle();
      const shop = (data ?? {}) as Record<string, unknown>;
      const { data: tax } = await admin
        .from("tax_settings")
        .select("calculation_mode")
        .eq("shop_id", ctx.key.shopId)
        .maybeSingle();
      const { data: methods } = await admin
        .from("shipping_methods")
        .select("countries")
        .eq("shop_id", ctx.key.shopId)
        .eq("status", "active");
      const countries = [
        ...new Set(((methods ?? []) as { countries: string[] | null }[]).flatMap((m) => m.countries ?? [])),
      ].sort();
      return {
        shop: {
          name: String(shop["name"] ?? ""),
          handle: String(shop["slug"] ?? ""),
          locale: String(shop["locale"] ?? "de-DE"),
          currencyCode: String(shop["currency"] ?? "EUR"),
        },
        countries,
        taxDisplayMode:
          ((tax as { calculation_mode?: string } | null)?.calculation_mode ?? "gross") === "net" ? "net" : "gross",
        features: {
          search: true,
          promotions: true,
          guestCheckout: true,
          customerAccounts: true,
          returns: true,
        },
        apiVersion: STORE_API_VERSION,
        environment: ctx.key.environment,
      };
    },
  },
  {
    method: "GET",
    path: "/products",
    profile: "catalog_read",
    handler: (ctx) =>
      listProducts({
        organizationId: ctx.key.organizationId,
        shopId: ctx.key.shopId,
        page: intPage(ctx, "page", 1, 500),
        pageSize: intPage(ctx, "pageSize", 24, 60),
        categoryHandle: ctx.query.get("category"),
        collectionHandle: ctx.query.get("collection"),
        sort: ctx.query.get("sort"),
      }),
  },
  {
    method: "GET",
    path: "/products/:handle",
    profile: "catalog_read",
    handler: (ctx) =>
      getProduct({
        organizationId: ctx.key.organizationId,
        shopId: ctx.key.shopId,
        handleOrId: ctx.params["handle"] ?? "",
      }),
  },
  {
    method: "GET",
    path: "/search",
    profile: "search",
    handler: (ctx) =>
      searchProducts({
        organizationId: ctx.key.organizationId,
        shopId: ctx.key.shopId,
        term: ctx.query.get("q") ?? "",
        limit: intPage(ctx, "limit", 12, 40),
      }),
  },
  { method: "GET", path: "/categories", profile: "catalog_read", handler: (ctx) => listCategories(ctx.key.shopId) },
  { method: "GET", path: "/collections", profile: "catalog_read", handler: (ctx) => listCollections(ctx.key.shopId) },

  // ---------------------------------------------------------------- cart
  {
    method: "POST",
    path: "/cart",
    profile: "cart_write",
    schema: z.object({ locale: z.string().max(10).optional(), regionCode: z.string().length(2).nullish() }),
    handler: async (ctx) => {
      const body = (ctx.body ?? {}) as { locale?: string; regionCode?: string | null };
      const { createCartFn } = await import("../cart.functions");
      const created = (await createCartFn({
        data: {
          organizationId: ctx.key.organizationId,
          shopId: ctx.key.shopId,
          locale: body.locale ?? "de-DE",
          regionCode: body.regionCode ?? null,
        },
      })) as { cart: unknown; token: string; cartId?: string };
      const cartApi = await import("../cart.server");
      const raw = created as unknown as Record<string, unknown>;
      const token = String(raw["token"] ?? "");
      const cartId = String(raw["cartId"] ?? (raw["cart"] as { id?: string } | undefined)?.id ?? "");
      const cart = await cartApi.loadCartAuthorized(cartId, token);
      return { cart: mapCart(await cartApi.buildCartView(cart)), cartToken: token };
    },
  },
  {
    method: "GET",
    path: "/cart/:cartId",
    profile: "catalog_read",
    handler: (ctx) => cartView(ctx, ctx.params["cartId"] ?? ""),
  },
  {
    method: "POST",
    path: "/cart/:cartId/items",
    profile: "cart_write",
    schema: z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(999) }),
    handler: async (ctx) => {
      const cartId = ctx.params["cartId"] ?? "";
      const { token } = await ctx.requireCart(cartId);
      const body = ctx.body as { variantId: string; quantity: number };
      const { addCartItemFn } = await import("../cart.functions");
      return mapCart(
        (await addCartItemFn({ data: { cartId, token, ...body } })) as never,
      );
    },
  },
  {
    method: "PATCH",
    path: "/cart/:cartId/items/:itemId",
    profile: "cart_write",
    schema: z.object({ quantity: z.number().int().min(0).max(999) }),
    handler: async (ctx) => {
      const cartId = ctx.params["cartId"] ?? "";
      const { token } = await ctx.requireCart(cartId);
      const { quantity } = ctx.body as { quantity: number };
      const cart = await import("../cart.functions");
      const itemId = ctx.params["itemId"] ?? "";
      const result =
        quantity === 0
          ? await cart.removeCartItemFn({ data: { cartId, token, itemId } })
          : await cart.updateCartItemFn({ data: { cartId, token, itemId, quantity } });
      return mapCart(result as never);
    },
  },
  {
    method: "DELETE",
    path: "/cart/:cartId/items/:itemId",
    profile: "cart_write",
    handler: async (ctx) => {
      const cartId = ctx.params["cartId"] ?? "";
      const { token } = await ctx.requireCart(cartId);
      const { removeCartItemFn } = await import("../cart.functions");
      return mapCart(
        (await removeCartItemFn({ data: { cartId, token, itemId: ctx.params["itemId"] ?? "" } })) as never,
      );
    },
  },
  {
    method: "POST",
    path: "/cart/:cartId/promotions",
    profile: "cart_write",
    schema: z.object({ code: z.string().min(1).max(64) }),
    handler: async (ctx) => {
      const cartId = ctx.params["cartId"] ?? "";
      const { token } = await ctx.requireCart(cartId);
      const { applyPromotionCodeFn } = await import("../cart.functions");
      return mapCart(
        (await applyPromotionCodeFn({ data: { cartId, token, code: (ctx.body as { code: string }).code } })) as never,
      );
    },
  },
  {
    method: "DELETE",
    path: "/cart/:cartId/promotions/:code",
    profile: "cart_write",
    handler: async (ctx) => {
      const cartId = ctx.params["cartId"] ?? "";
      const { token } = await ctx.requireCart(cartId);
      const { removePromotionCodeFn } = await import("../cart.functions");
      return mapCart(
        (await removePromotionCodeFn({ data: { cartId, token, code: ctx.params["code"] ?? "" } })) as never,
      );
    },
  },

  // ------------------------------------------------------------ checkout
  {
    method: "POST",
    path: "/checkout",
    profile: "checkout",
    schema: z.object({ cartId: z.string().uuid(), email: z.string().email().max(200).nullish() }),
    handler: async (ctx) => {
      const body = ctx.body as { cartId: string; email?: string | null };
      const { token } = await ctx.requireCart(body.cartId);
      const { startCheckoutFn } = await import("../checkout.functions");
      return mapCheckout(
        (await startCheckoutFn({ data: { cartId: body.cartId, token, email: body.email ?? null } })) as never,
      );
    },
  },
  {
    method: "GET",
    path: "/checkout/:sessionId",
    profile: "checkout",
    handler: async (ctx) => {
      const sessionId = ctx.params["sessionId"] ?? "";
      const session = await assertCheckoutOwnership(ctx, sessionId);
      const { getCheckoutFn } = await import("../checkout.functions");
      const token = ctx.requireCartToken();
      void session;
      return mapCheckout((await getCheckoutFn({ data: { sessionId, token } })) as never);
    },
  },
  {
    method: "POST",
    path: "/checkout/:sessionId/email",
    profile: "checkout",
    schema: z.object({ email: z.string().email().max(200) }),
    handler: async (ctx) => {
      const sessionId = ctx.params["sessionId"] ?? "";
      await assertCheckoutOwnership(ctx, sessionId);
      const { setCheckoutEmailFn } = await import("../checkout.functions");
      return mapCheckout(
        (await setCheckoutEmailFn({
          data: { sessionId, token: ctx.requireCartToken(), email: (ctx.body as { email: string }).email },
        })) as never,
      );
    },
  },
  {
    method: "POST",
    path: "/checkout/:sessionId/address",
    profile: "checkout",
    schema: z.object({
      type: z.enum(["shipping", "billing"]),
      address: addressSchema,
      billingSameAsShipping: z.boolean().optional(),
    }),
    handler: async (ctx) => {
      const sessionId = ctx.params["sessionId"] ?? "";
      await assertCheckoutOwnership(ctx, sessionId);
      const { setCheckoutAddressFn } = await import("../checkout.functions");
      return mapCheckout(
        (await setCheckoutAddressFn({
          data: { sessionId, token: ctx.requireCartToken(), ...(ctx.body as object) },
        } as never)) as never,
      );
    },
  },
  {
    method: "GET",
    path: "/checkout/:sessionId/shipping-options",
    profile: "checkout",
    handler: async (ctx) => {
      const sessionId = ctx.params["sessionId"] ?? "";
      await assertCheckoutOwnership(ctx, sessionId);
      const { listShippingMethodsFn } = await import("../checkout.functions");
      const methods = (await listShippingMethodsFn({
        data: { sessionId, token: ctx.requireCartToken() },
      })) as { id: string; name: string; description: string | null; amountMinor: number; currencyCode: string }[];
      return methods.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        amountMinor: m.amountMinor,
        currencyCode: m.currencyCode,
      }));
    },
  },
  {
    method: "POST",
    path: "/checkout/:sessionId/shipping-option",
    profile: "checkout",
    schema: z.object({ shippingMethodId: z.string().uuid() }),
    handler: async (ctx) => {
      const sessionId = ctx.params["sessionId"] ?? "";
      await assertCheckoutOwnership(ctx, sessionId);
      const { setShippingOptionFn } = await import("../checkout.functions");
      return mapCheckout(
        (await setShippingOptionFn({
          data: {
            sessionId,
            token: ctx.requireCartToken(),
            shippingMethodId: (ctx.body as { shippingMethodId: string }).shippingMethodId,
          },
        })) as never,
      );
    },
  },
  {
    method: "POST",
    path: "/checkout/:sessionId/validate",
    profile: "checkout",
    handler: async (ctx) => {
      const sessionId = ctx.params["sessionId"] ?? "";
      await assertCheckoutOwnership(ctx, sessionId);
      const { validateCheckoutFn } = await import("../checkout.functions");
      return mapCheckout(
        (await validateCheckoutFn({ data: { sessionId, token: ctx.requireCartToken() } })) as never,
      );
    },
  },
  {
    method: "POST",
    path: "/checkout/:sessionId/payment-session",
    profile: "payment_session",
    schema: z.object({
      returnUrl: z.string().url().max(500),
      cancelUrl: z.string().url().max(500).nullish(),
      provider: z.string().max(40).nullish(),
    }),
    handler: async (ctx) => {
      const sessionId = ctx.params["sessionId"] ?? "";
      await assertCheckoutOwnership(ctx, sessionId);
      // Extra bucket per checkout session, so one session cannot be hammered.
      await ctx.limit("payment_session", sessionId);
      const body = ctx.body as { returnUrl: string; cancelUrl?: string | null; provider?: string | null };
      const { createPaymentSessionFn } = await import("../payments/payment.functions");
      const result = (await createPaymentSessionFn({
        data: {
          sessionId,
          token: ctx.requireCartToken(),
          returnUrl: body.returnUrl,
          cancelUrl: body.cancelUrl ?? body.returnUrl,
          provider: body.provider ?? null,
        },
      })) as Record<string, unknown>;
      return {
        id: String(result["paymentSessionId"] ?? result["id"] ?? ""),
        type: result["redirectUrl"] ? "redirect" : "embedded",
        status: String(result["status"] ?? "created"),
        redirectUrl: (result["redirectUrl"] as string | null) ?? null,
        amountMinor: Number(result["amountMinor"] ?? 0),
        currencyCode: String(result["currencyCode"] ?? ""),
      };
    },
  },
  {
    method: "GET",
    path: "/payments/:paymentSessionId/status",
    profile: "checkout",
    handler: async (ctx) => {
      const token = ctx.requireCartToken();
      const paymentSessionId = ctx.params["paymentSessionId"] ?? "";
      const { getPaymentStatusFn } = await import("../payments/payment.functions");
      const status = (await getPaymentStatusFn({ data: { paymentSessionId, token } }).catch(() => {
        throw forbidden("Zahlungsstatus nicht zugänglich.");
      })) as {
        status: string;
        order: { id: string } | null;
      };
      let confirmationToken: string | null = null;
      let confirmationExpiresAt: string | null = null;
      if (status.status === "paid" && status.order) {
        const minted = await mintConfirmationToken(ctx, status.order.id);
        confirmationToken = minted.token;
        confirmationExpiresAt = minted.expiresAt;
      }
      return { status: status.status, confirmationToken, confirmationExpiresAt };
    },
  },
  {
    method: "GET",
    path: "/orders/confirmation/:confirmationToken",
    profile: "guest_lookup",
    handler: async (ctx) => {
      const raw = ctx.params["confirmationToken"] ?? "";
      const admin = await getAdmin();
      const { data } = await admin
        .from("store_confirmation_tokens")
        .select("id, order_id, shop_id, organization_id, expires_at, used_at")
        .eq("token_hash", await hashToken(raw))
        .maybeSingle();
      const row = data as Record<string, unknown> | null;
      if (!row) throw notFound("Bestätigungslink ist ungültig.");
      if (row["shop_id"] !== ctx.key.shopId || row["organization_id"] !== ctx.key.organizationId)
        throw forbidden("Bestätigungslink gehört nicht zu diesem Shop.");
      if (Date.parse(row["expires_at"] as string) < Date.now()) throw forbidden("Bestätigungslink ist abgelaufen.");
      // Single use: the token dies with the first successful read.
      await admin
        .from("store_confirmation_tokens")
        .update({ used_at: new Date().toISOString() } as never)
        .eq("id", row["id"] as string)
        .is("used_at", null);
      if (row["used_at"]) throw forbidden("Bestätigungslink wurde bereits verwendet.");
      const { loadPortalOrder } = await import("../portal/portal.server");
      return mapOrder(await loadPortalOrder(row["order_id"] as string));
    },
  },

  // ------------------------------------------------------- guest access
  {
    method: "POST",
    path: "/orders/guest-access",
    profile: "guest_lookup",
    schema: z.object({ orderNumber: z.string().min(3).max(40), email: z.string().email().max(200) }),
    handler: async (ctx) => {
      const body = ctx.body as { orderNumber: string; email: string };
      await ctx.limit("guest_lookup", body.email.toLowerCase());
      const { requestGuestAccessFn } = await import("../portal/portal.functions");
      await requestGuestAccessFn({
        data: { orderNumber: body.orderNumber, email: body.email },
      } as never).catch(() => null);
      // Always the same answer — order existence is never revealed.
      return { requested: true };
    },
  },
  {
    method: "GET",
    path: "/orders/guest",
    profile: "guest_lookup",
    handler: async (ctx) => {
      const { orderId } = await ctx.requireGuestOrder();
      const { loadPortalOrder } = await import("../portal/portal.server");
      return mapOrder(await loadPortalOrder(orderId));
    },
  },
  {
    method: "POST",
    path: "/returns",
    profile: "return_create",
    schema: z.object({
      items: z
        .array(z.object({ orderItemId: z.string().uuid(), quantity: z.number().int().min(1).max(999) }))
        .min(1)
        .max(50),
      reason: z.string().min(1).max(40),
      note: z.string().max(1000).nullish(),
      idempotencyKey: z.string().min(8).max(100),
    }),
    handler: async (ctx) => {
      const { orderId } = await ctx.requireGuestOrder();
      await ctx.limit("return_create", orderId);
      const body = ctx.body as {
        items: { orderItemId: string; quantity: number }[];
        reason: string;
        note?: string | null;
        idempotencyKey: string;
      };
      const admin = await getAdmin();
      const { data: order } = await admin
        .from("orders")
        .select("id, organization_id, shop_id")
        .eq("id", orderId)
        .maybeSingle();
      const o = order as Record<string, unknown> | null;
      if (!o || o["shop_id"] !== ctx.key.shopId) throw forbidden("Bestellung gehört nicht zu diesem Shop.");
      const { requestReturn } = await import("../returns/return.server");
      const created = (await requestReturn({
        organizationId: o["organization_id"] as string,
        shopId: o["shop_id"] as string,
        orderId,
        items: body.items,
        reason: body.reason,
        note: body.note ?? null,
        idempotencyKey: body.idempotencyKey,
      } as never)) as Record<string, unknown>;
      return {
        id: String(created["id"] ?? ""),
        returnNumber: String(created["returnNumber"] ?? created["return_number"] ?? ""),
        status: String(created["status"] ?? "requested"),
      };
    },
  },

  // ---------------------------------------------------------- customer
  {
    method: "GET",
    path: "/customer/me",
    profile: "customer_auth",
    handler: async (ctx) => {
      const me = await ctx.requireCustomer();
      if (!me.customerId) throw notFound("Für diesen Shop existiert kein Kundenkonto.");
      const admin = await getAdmin();
      const { data } = await admin
        .from("customers")
        .select("id, email, first_name, last_name, kind")
        .eq("id", me.customerId)
        .maybeSingle();
      const c = (data ?? {}) as Record<string, unknown>;
      return {
        id: String(c["id"] ?? ""),
        email: String(c["email"] ?? me.email ?? ""),
        firstName: (c["first_name"] as string | null) ?? null,
        lastName: (c["last_name"] as string | null) ?? null,
        kind: (c["kind"] as "b2c" | "b2b") ?? "b2c",
      };
    },
  },
  {
    method: "GET",
    path: "/customer/orders",
    profile: "customer_auth",
    handler: async (ctx) => {
      const me = await ctx.requireCustomer();
      const { listPortalOrders } = await import("../portal/portal.server");
      const orders = await listPortalOrders(me.userId);
      const admin = await getAdmin();
      const { data } = await admin.from("orders").select("id").eq("shop_id", ctx.key.shopId);
      const shopOrderIds = new Set(((data ?? []) as { id: string }[]).map((o) => o.id));
      const { mapOrderSummary } = await import("./mappers.server");
      return orders.filter((o) => shopOrderIds.has(o.id)).map(mapOrderSummary);
    },
  },
  {
    method: "GET",
    path: "/customer/orders/:orderId",
    profile: "customer_auth",
    handler: async (ctx) => {
      const me = await ctx.requireCustomer();
      const orderId = ctx.params["orderId"] ?? "";
      const { ownedOrderIds, loadPortalOrder } = await import("../portal/portal.server");
      const owned = await ownedOrderIds(me.userId);
      if (!owned.orderIds.includes(orderId)) throw forbidden("Bestellung gehört nicht zu diesem Konto.");
      const order = await loadPortalOrder(orderId);
      if (order.shopId !== ctx.key.shopId) throw forbidden("Bestellung gehört nicht zu diesem Shop.");
      return mapOrder(order);
    },
  },
];

async function mintConfirmationToken(ctx: StoreCtx, orderId: string) {
  const admin = await getAdmin();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { error } = await admin.from("store_confirmation_tokens").insert({
    organization_id: ctx.key.organizationId,
    shop_id: ctx.key.shopId,
    order_id: orderId,
    token_hash: await hashToken(token),
    expires_at: expiresAt,
  } as never);
  if (error) throw badRequest("Bestätigungslink konnte nicht erstellt werden.");
  return { token, expiresAt };
}
