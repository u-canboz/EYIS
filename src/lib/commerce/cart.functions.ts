/**
 * Storefront cart API. Deliberately unauthenticated: guests are authorised by
 * cart id + raw anonymous token inside every handler. There is no anonymous
 * database access — all reads/writes go through checked server helpers.
 */
import { createServerFn } from "@tanstack/react-start";
import type { CartView } from "./cart-types";

type Auth = { cartId: string; token: string };

export const createCartFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      organizationId: string;
      shopId: string;
      locale?: string;
      regionCode?: string | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { getAdmin } = await import("./core.server");
    const admin = await getAdmin();
    const { data: shop } = await admin
      .from("shops")
      .select("id, currency, organization_id, status")
      .eq("id", data.shopId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    const s = shop as { currency: string; status: string } | null;
    if (!s || s.status !== "active") throw new Error("Shop nicht verfügbar.");

    const cartApi = await import("./cart.server");
    const created = await cartApi.createCart({
      organizationId: data.organizationId,
      shopId: data.shopId,
      currencyCode: s.currency,
      locale: data.locale ?? "de",
      regionCode: data.regionCode ?? null,
    });
    const cart = await cartApi.loadCartAuthorized(created.cartId, created.token);
    const view = await cartApi.buildCartView(cart);
    return { cartId: created.cartId, token: created.token, cart: view };
  });

export const getCartFn = createServerFn({ method: "POST" })
  .inputValidator((data: Auth) => data)
  .handler(async ({ data }) => {
    const cartApi = await import("./cart.server");
    const cart = await cartApi.loadCartAuthorized(data.cartId, data.token);
    return (await cartApi.buildCartView(cart)) as CartView;
  });

export const addCartItemFn = createServerFn({ method: "POST" })
  .inputValidator((data: Auth & { variantId: string; quantity: number }) => data)
  .handler(async ({ data }) => {
    const cartApi = await import("./cart.server");
    const { getAdmin } = await import("./core.server");
    const admin = await getAdmin();
    const cart = await cartApi.loadCartAuthorized(data.cartId, data.token);
    cartApi.assertMutable(cart);

    const quantity = Math.floor(data.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0)
      throw new Error("Menge muss größer als 0 sein.");

    const snap = await cartApi.loadVariantSnapshot(
      cart.organization_id,
      cart.shop_id,
      data.variantId,
    );
    const { data: existing } = await admin
      .from("cart_items")
      .select("id, quantity")
      .eq("cart_id", cart.id)
      .eq("variant_id", data.variantId)
      .maybeSingle();
    const target = ((existing as { quantity: number } | null)?.quantity ?? 0) + quantity;
    await cartApi.assertAvailable(
      cart.organization_id,
      cart.shop_id,
      data.variantId,
      target,
      snap.title,
    );

    if (existing) {
      const { error } = await admin
        .from("cart_items")
        .update({ quantity: target })
        .eq("id", (existing as { id: string }).id);
      if (error) throw new Error(error.message);
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
    await cartApi.cartEvent(cart, "cart.item.added", {
      variant_id: data.variantId,
      quantity: target,
    });
    return (await cartApi.buildCartView(cart)) as CartView;
  });

export const updateCartItemFn = createServerFn({ method: "POST" })
  .inputValidator((data: Auth & { itemId: string; quantity: number }) => data)
  .handler(async ({ data }) => {
    const cartApi = await import("./cart.server");
    const { getAdmin } = await import("./core.server");
    const admin = await getAdmin();
    const cart = await cartApi.loadCartAuthorized(data.cartId, data.token);
    cartApi.assertMutable(cart);

    const { data: item } = await admin
      .from("cart_items")
      .select("id, variant_id, title_snapshot")
      .eq("id", data.itemId)
      .eq("cart_id", cart.id)
      .maybeSingle();
    if (!item) throw new Error("Position nicht gefunden.");
    const row = item as { id: string; variant_id: string; title_snapshot: string };

    const quantity = Math.floor(data.quantity);
    if (quantity <= 0) {
      await admin.from("cart_items").delete().eq("id", row.id);
      await cartApi.cartEvent(cart, "cart.item.removed", { variant_id: row.variant_id });
    } else {
      await cartApi.assertAvailable(
        cart.organization_id,
        cart.shop_id,
        row.variant_id,
        quantity,
        row.title_snapshot,
      );
      const { error } = await admin.from("cart_items").update({ quantity }).eq("id", row.id);
      if (error) throw new Error(error.message);
      await cartApi.cartEvent(cart, "cart.item.updated", { variant_id: row.variant_id, quantity });
    }
    await cartApi.touchCart(cart.id);
    return (await cartApi.buildCartView(cart)) as CartView;
  });

export const removeCartItemFn = createServerFn({ method: "POST" })
  .inputValidator((data: Auth & { itemId: string }) => data)
  .handler(async ({ data }) => {
    const cartApi = await import("./cart.server");
    const { getAdmin } = await import("./core.server");
    const admin = await getAdmin();
    const cart = await cartApi.loadCartAuthorized(data.cartId, data.token);
    cartApi.assertMutable(cart);
    await admin.from("cart_items").delete().eq("id", data.itemId).eq("cart_id", cart.id);
    await cartApi.touchCart(cart.id);
    await cartApi.cartEvent(cart, "cart.item.removed", { item_id: data.itemId });
    return (await cartApi.buildCartView(cart)) as CartView;
  });

export const clearCartFn = createServerFn({ method: "POST" })
  .inputValidator((data: Auth) => data)
  .handler(async ({ data }) => {
    const cartApi = await import("./cart.server");
    const { getAdmin } = await import("./core.server");
    const admin = await getAdmin();
    const cart = await cartApi.loadCartAuthorized(data.cartId, data.token);
    cartApi.assertMutable(cart);
    await admin.from("cart_items").delete().eq("cart_id", cart.id);
    await admin.from("cart_promotion_codes").delete().eq("cart_id", cart.id);
    await cartApi.cartEvent(cart, "cart.cleared", {});
    return (await cartApi.buildCartView(cart)) as CartView;
  });

export const applyPromotionCodeFn = createServerFn({ method: "POST" })
  .inputValidator((data: Auth & { code: string }) => data)
  .handler(async ({ data }) => {
    const cartApi = await import("./cart.server");
    const { getAdmin } = await import("./core.server");
    const admin = await getAdmin();
    const cart = await cartApi.loadCartAuthorized(data.cartId, data.token);
    cartApi.assertMutable(cart);

    const code = data.code.trim().toUpperCase();
    if (!code) throw new Error("Bitte einen Code eingeben.");
    const { data: promo } = await admin
      .from("promotions")
      .select("id, code, status")
      .eq("organization_id", cart.organization_id)
      .eq("shop_id", cart.shop_id)
      .ilike("code", code)
      .maybeSingle();

    await admin.from("cart_promotion_codes").upsert(
      {
        organization_id: cart.organization_id,
        shop_id: cart.shop_id,
        cart_id: cart.id,
        promotion_id: (promo as { id: string } | null)?.id ?? null,
        code_snapshot: code,
      } as never,
      { onConflict: "cart_id,code_snapshot" },
    );
    await cartApi.cartEvent(cart, "cart.promotion.applied", { code });
    return (await cartApi.buildCartView(cart)) as CartView;
  });

export const removePromotionCodeFn = createServerFn({ method: "POST" })
  .inputValidator((data: Auth & { code: string }) => data)
  .handler(async ({ data }) => {
    const cartApi = await import("./cart.server");
    const { getAdmin } = await import("./core.server");
    const admin = await getAdmin();
    const cart = await cartApi.loadCartAuthorized(data.cartId, data.token);
    cartApi.assertMutable(cart);
    await admin
      .from("cart_promotion_codes")
      .delete()
      .eq("cart_id", cart.id)
      .eq("code_snapshot", data.code.trim().toUpperCase());
    await cartApi.cartEvent(cart, "cart.promotion.removed", { code: data.code });
    return (await cartApi.buildCartView(cart)) as CartView;
  });

/** Merges a guest cart into a target cart. Quantities are summed, availability re-checked. */
export const mergeCartFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      sourceCartId: string;
      sourceToken: string;
      targetCartId: string;
      targetToken: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const cartApi = await import("./cart.server");
    const { getAdmin } = await import("./core.server");
    const admin = await getAdmin();
    const source = await cartApi.loadCartAuthorized(data.sourceCartId, data.sourceToken);
    const target = await cartApi.loadCartAuthorized(data.targetCartId, data.targetToken);
    cartApi.assertMutable(target);
    if (source.id === target.id) throw new Error("Quell- und Zielwarenkorb sind identisch.");
    if (source.organization_id !== target.organization_id || source.shop_id !== target.shop_id)
      throw new Error("Warenkörbe gehören zu unterschiedlichen Shops.");

    const sourceItems = await cartApi.loadItems(source.id);
    const targetItems = await cartApi.loadItems(target.id);
    const byVariant = new Map(targetItems.map((i) => [i.variant_id, i]));

    for (const item of sourceItems) {
      const existing = byVariant.get(item.variant_id);
      const quantity = (existing?.quantity ?? 0) + item.quantity;
      try {
        await cartApi.assertAvailable(
          target.organization_id,
          target.shop_id,
          item.variant_id,
          quantity,
          item.title_snapshot,
        );
      } catch {
        continue;
      }
      if (existing) {
        await admin.from("cart_items").update({ quantity }).eq("id", existing.id);
      } else {
        await admin.from("cart_items").insert({
          organization_id: target.organization_id,
          shop_id: target.shop_id,
          cart_id: target.id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity,
          title_snapshot: item.title_snapshot,
          variant_title_snapshot: item.variant_title_snapshot,
          sku_snapshot: item.sku_snapshot,
          image_snapshot: item.image_snapshot,
        });
      }
    }

    const codes = await cartApi.loadPromotionCodes(source.id);
    for (const code of codes) {
      await admin.from("cart_promotion_codes").upsert(
        {
          organization_id: target.organization_id,
          shop_id: target.shop_id,
          cart_id: target.id,
          code_snapshot: code,
        } as never,
        { onConflict: "cart_id,code_snapshot" },
      );
    }

    await admin.from("cart_items").delete().eq("cart_id", source.id);
    await admin
      .from("carts")
      .update({ status: "abandoned", abandoned_at: new Date().toISOString() })
      .eq("id", source.id);
    await cartApi.cartEvent(target, "cart.merged", { source_cart_id: source.id });
    return (await cartApi.buildCartView(target)) as CartView;
  });
