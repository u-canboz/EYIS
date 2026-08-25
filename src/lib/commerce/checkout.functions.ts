/**
 * Storefront checkout API. Guest-authorised by cart id + raw anonymous token.
 * Inventory reservation and cart locking happen atomically in the database.
 */
import { createServerFn } from "@tanstack/react-start";
import type { AddressInput, CheckoutView, ShippingMethodView } from "./cart-types";

type Auth = { cartId: string; token: string };
type SessionAuth = { sessionId: string; token: string };

export const startCheckoutFn = createServerFn({ method: "POST" })
  .inputValidator((data: Auth & { email?: string | null }) => data)
  .handler(async ({ data }) => {
    const cartApi = await import("./cart.server");
    const checkout = await import("./checkout.server");
    const cart = await cartApi.loadCartAuthorized(data.cartId, data.token);
    cartApi.assertMutable(cart);
    const started = await checkout.startCheckout(cart, data.email ?? null);
    const session = await checkout.loadSession(started.checkout_session_id);
    const fresh = await cartApi.loadCartAuthorized(data.cartId, data.token);
    await cartApi.cartEvent(cart, "checkout.started", {
      checkout_session_id: session.id,
      reservations: started.reservations,
    });
    return (await checkout.buildCheckoutView(session, fresh)) as CheckoutView;
  });

export const getCheckoutFn = createServerFn({ method: "POST" })
  .inputValidator((data: SessionAuth) => data)
  .handler(async ({ data }) => {
    const checkout = await import("./checkout.server");
    await checkout.expireDueSessions(null);
    const { session, cart } = await checkout.loadSessionAuthorized(data.sessionId, data.token);
    return (await checkout.buildCheckoutView(session, cart)) as CheckoutView;
  });

export const setCheckoutEmailFn = createServerFn({ method: "POST" })
  .inputValidator((data: SessionAuth & { email: string }) => data)
  .handler(async ({ data }) => {
    const checkout = await import("./checkout.server");
    const { getAdmin } = await import("./core.server");
    const { session, cart } = await checkout.loadSessionAuthorized(data.sessionId, data.token);
    const email = data.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Bitte eine gültige E-Mail-Adresse angeben.");
    const admin = await getAdmin();
    await admin.from("checkout_sessions").update({ email }).eq("id", session.id);
    await admin.from("carts").update({ customer_email: email }).eq("id", cart.id);
    const fresh = await checkout.loadSession(session.id);
    return (await checkout.buildCheckoutView(fresh, { ...cart, customer_email: email })) as CheckoutView;
  });

export const setCheckoutAddressFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: SessionAuth & { type: "shipping" | "billing"; address: AddressInput; billingSameAsShipping?: boolean }) =>
      data,
  )
  .handler(async ({ data }) => {
    const checkout = await import("./checkout.server");
    const { getAdmin } = await import("./core.server");
    const { session, cart } = await checkout.loadSessionAuthorized(data.sessionId, data.token);
    if (!["open", "validated"].includes(session.status))
      throw new Error(`Sitzung ist nicht mehr änderbar (${session.status}).`);
    await checkout.saveAddress(session, data.type, data.address);
    const admin = await getAdmin();
    if (data.billingSameAsShipping !== undefined) {
      await admin
        .from("checkout_sessions")
        .update({ billing_same_as_shipping: data.billingSameAsShipping })
        .eq("id", session.id);
    }
    await admin.from("checkout_sessions").update({ status: "open", validated_at: null }).eq("id", session.id);
    const fresh = await checkout.loadSession(session.id);
    return (await checkout.buildCheckoutView(fresh, cart)) as CheckoutView;
  });

export const listShippingMethodsFn = createServerFn({ method: "POST" })
  .inputValidator((data: SessionAuth) => data)
  .handler(async ({ data }) => {
    const checkout = await import("./checkout.server");
    const cartApi = await import("./cart.server");
    const { session, cart } = await checkout.loadSessionAuthorized(data.sessionId, data.token);
    const view = await cartApi.buildCartView(cart, { persist: false });
    const country = (await checkout.buildCheckoutView(session, cart)).shippingAddress?.countryCode ?? null;
    return (await checkout.listShippingMethods(
      session.organization_id,
      session.shop_id,
      view.totals.subtotalMinor,
      country,
    )) as ShippingMethodView[];
  });

export const setShippingOptionFn = createServerFn({ method: "POST" })
  .inputValidator((data: SessionAuth & { shippingMethodId: string }) => data)
  .handler(async ({ data }) => {
    const checkout = await import("./checkout.server");
    const { getAdmin } = await import("./core.server");
    const { session, cart } = await checkout.loadSessionAuthorized(data.sessionId, data.token);
    const admin = await getAdmin();
    const { data: method } = await admin
      .from("shipping_methods")
      .select("id, shop_id, status")
      .eq("id", data.shippingMethodId)
      .eq("organization_id", session.organization_id)
      .maybeSingle();
    const m = method as { shop_id: string; status: string } | null;
    if (!m || m.shop_id !== session.shop_id || m.status !== "active")
      throw new Error("Versandart nicht verfügbar.");
    await admin
      .from("checkout_sessions")
      .update({ shipping_option_id: data.shippingMethodId, status: "open", validated_at: null })
      .eq("id", session.id);
    const fresh = await checkout.loadSession(session.id);
    return (await checkout.buildCheckoutView(fresh, cart)) as CheckoutView;
  });

/** Final validation: reprices, writes the immutable checkout snapshot, marks validated. */
export const validateCheckoutFn = createServerFn({ method: "POST" })
  .inputValidator((data: SessionAuth) => data)
  .handler(async ({ data }) => {
    const checkout = await import("./checkout.server");
    const cartApi = await import("./cart.server");
    await checkout.expireDueSessions(null);
    const { session, cart } = await checkout.loadSessionAuthorized(data.sessionId, data.token);
    const view = await checkout.buildCheckoutView(session, cart);
    if (!view.ready) throw new Error(`Checkout ist noch nicht vollständig: ${view.issues.join(" ")}`);

    const written = await checkout.writeCheckoutSnapshot(session, cart, view);
    await cartApi.cartEvent(cart, "checkout.validated", {
      checkout_session_id: session.id,
      version: written.version,
      total_minor: written.totals.totalMinor,
    });
    const fresh = await checkout.loadSession(session.id);
    return (await checkout.buildCheckoutView(fresh, cart)) as CheckoutView;
  });

export const cancelCheckoutFn = createServerFn({ method: "POST" })
  .inputValidator((data: SessionAuth) => data)
  .handler(async ({ data }) => {
    const checkout = await import("./checkout.server");
    const cartApi = await import("./cart.server");
    const { session, cart } = await checkout.loadSessionAuthorized(data.sessionId, data.token);
    const result = await checkout.cancelCheckout(session.organization_id, session.id, null, "cancelled");
    await cartApi.cartEvent(cart, "checkout.cancelled", {
      checkout_session_id: session.id,
      released: result.released,
    });
    const fresh = await cartApi.loadCartAuthorized(cart.id, data.token);
    return { released: result.released, cart: await cartApi.buildCartView(fresh) };
  });
