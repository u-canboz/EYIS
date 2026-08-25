/* Storefront flow helpers — identical call sequence to the storefront server
   functions (cart.functions / checkout.functions / payment.functions). */
import * as cartApi from "@/lib/commerce/cart.server";
import * as checkout from "@/lib/commerce/checkout.server";
import * as payments from "@/lib/commerce/payments/payment.server";
import { admin } from "./lib";

export async function createCart(orgId: string, shopId: string) {
  const { data: shop } = await admin.from("shops").select("currency, status").eq("id", shopId).maybeSingle();
  if (!shop || shop.status !== "active") throw new Error("Shop nicht verfügbar.");
  return await cartApi.createCart({ organizationId: orgId, shopId, currencyCode: shop.currency as string });
}

export async function addItem(cartId: string, token: string, variantId: string, quantity: number) {
  const cart = await cartApi.loadCartAuthorized(cartId, token);
  cartApi.assertMutable(cart);
  const snap = await cartApi.loadVariantSnapshot(cart.organization_id, cart.shop_id, variantId);
  const { data: existing } = await admin
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cart.id)
    .eq("variant_id", variantId)
    .maybeSingle();
  const target = Number(existing?.quantity ?? 0) + quantity;
  await cartApi.assertAvailable(cart.organization_id, cart.shop_id, variantId, target, snap.title);
  if (existing) {
    await admin.from("cart_items").update({ quantity: target }).eq("id", existing.id);
  } else {
    const { error } = await admin.from("cart_items").insert({
      organization_id: cart.organization_id,
      shop_id: cart.shop_id,
      cart_id: cart.id,
      product_id: snap.productId,
      variant_id: snap.variantId,
      quantity: target,
      title_snapshot: snap.title,
      variant_title_snapshot: snap.variantTitle,
      sku_snapshot: snap.sku,
      image_snapshot: snap.image,
    });
    if (error) throw new Error(error.message);
  }
  await cartApi.touchCart(cart.id);
  return await cartApi.buildCartView(cart);
}

export const ADDRESS = {
  firstName: "Qa",
  lastName: "Tester",
  street: "Teststraße 1",
  postalCode: "10115",
  city: "Berlin",
  countryCode: "DE",
};

/** Cart -> checkout -> address -> shipping -> validated snapshot. */
export async function toValidatedCheckout(args: {
  orgId: string;
  shopId: string;
  variantId: string;
  shippingId: string;
  quantity?: number;
  email?: string;
}) {
  const { cartId, token } = await createCart(args.orgId, args.shopId);
  await addItem(cartId, token, args.variantId, args.quantity ?? 1);
  let cart = await cartApi.loadCartAuthorized(cartId, token);
  const started = await checkout.startCheckout(cart, args.email ?? "qa-buyer@commerce-qa.test");
  const sessionId = started.checkout_session_id;
  let session = await checkout.loadSession(sessionId);
  await checkout.saveAddress(session, "shipping", ADDRESS);
  await admin
    .from("checkout_sessions")
    .update({ shipping_option_id: args.shippingId, billing_same_as_shipping: true, status: "open", validated_at: null })
    .eq("id", sessionId);
  session = await checkout.loadSession(sessionId);
  cart = await cartApi.loadCartAuthorized(cartId, token);
  const view = await checkout.buildCheckoutView(session, cart);
  if (!view.ready) throw new Error(`Checkout unvollständig: ${view.issues.join(" ")}`);
  const written = await checkout.writeCheckoutSnapshot(session, cart, view);
  return { cartId, token, sessionId, reservations: started.reservations, view, written };
}

export async function startPayment(sessionId: string, token: string) {
  const { session } = await checkout.loadSessionAuthorized(sessionId, token);
  return await payments.createPaymentSession({
    organizationId: session.organization_id,
    shopId: session.shop_id,
    checkoutSessionId: session.id,
    email: session.email,
    provider: "mock",
    returnUrl: "http://localhost:8080/app/system/storefront-test",
    cancelUrl: "http://localhost:8080/app/system/storefront-test",
  });
}

/** Mirrors mockConfirmPaymentFn: server-verified provider confirmation. */
export async function confirmMockPayment(paymentSessionId: string, overrides?: { amountMinor?: number; currencyCode?: string }) {
  const ps = await payments.loadPaymentSession(paymentSessionId);
  if (ps.provider !== "mock") throw new Error("Nur für den Test-Anbieter verfügbar.");
  if (ps.environment === "live") throw new Error("Im Live-Betrieb nicht zulässig.");
  return await payments.finalizeFromPayment({
    organizationId: ps.organization_id,
    paymentSessionId: ps.id,
    providerPaymentId: `mock_pi_${ps.id}`,
    amountMinor: overrides?.amountMinor ?? Number(ps.amount_minor),
    currencyCode: overrides?.currencyCode ?? ps.currency_code,
  });
}

export { cartApi, checkout, payments };
