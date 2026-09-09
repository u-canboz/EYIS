/**
 * Demo-Backend für den Zustand "Shop noch nicht verbunden".
 *
 * Es ist eine `fetch`-Implementierung, die exakt die Store-API-v1-Antworten
 * nachbildet. Dadurch nutzt die Storefront in jedem Fall denselben Codepfad
 * (SDK → HTTP → Envelope) und muss beim Anschluss an das echte EYIS nur die
 * beiden Umgebungswerte bekommen.
 */
import type {
  StoreCart,
  StoreCartItem,
  StoreCheckout,
  StoreProduct,
  StoreProductSummary,
} from "@/lib/store-sdk";

type Json = Record<string, unknown>;

const CURRENCY = "EUR";

function variant(id: string, title: string, price: number, options: { key: string; value: string }[] = []) {
  return {
    id,
    title,
    sku: id.toUpperCase(),
    options,
    price: {
      currencyCode: CURRENCY,
      unitAmountMinor: price,
      compareAtAmountMinor: null,
      taxIncluded: true,
    },
    availability: "in_stock" as const,
    availableQuantity: 24,
  };
}

const PRODUCTS: StoreProduct[] = [
  {
    id: "p1",
    handle: "leinenhemd-natur",
    title: "Leinenhemd Natur",
    subtitle: "Gewaschenes Leinen, weicher Griff",
    image: null,
    price: { currencyCode: CURRENCY, unitAmountMinor: 8900, compareAtAmountMinor: null, taxIncluded: true },
    availability: "in_stock",
    description:
      "Ein ruhiges Hemd aus gewaschenem Leinen. Gerade geschnitten, mit weichem Kragen und Perlmuttknöpfen.",
    vendor: "Beispielmarke",
    productType: "Oberteile",
    images: [],
    options: [{ key: "size", name: "Größe", values: ["S", "M", "L"] }],
    variants: [
      variant("p1-s", "S", 8900, [{ key: "size", value: "S" }]),
      variant("p1-m", "M", 8900, [{ key: "size", value: "M" }]),
      variant("p1-l", "L", 8900, [{ key: "size", value: "L" }]),
    ],
    categories: [{ id: "c1", handle: "kleidung", name: "Kleidung" }],
    collections: [{ id: "k1", handle: "neuheiten", name: "Neuheiten" }],
    seo: { title: null, description: null },
  },
  {
    id: "p2",
    handle: "keramikvase-sand",
    title: "Keramikvase Sand",
    subtitle: "Handgedreht, matte Glasur",
    image: null,
    price: { currencyCode: CURRENCY, unitAmountMinor: 5400, compareAtAmountMinor: 6900, taxIncluded: true },
    availability: "low_stock",
    description: "Handgedrehte Vase mit matter Glasur. Jedes Stück ist ein Unikat.",
    vendor: "Beispielmarke",
    productType: "Wohnen",
    images: [],
    options: [],
    variants: [variant("p2-1", "Standard", 5400)],
    categories: [{ id: "c2", handle: "wohnen", name: "Wohnen" }],
    collections: [{ id: "k1", handle: "neuheiten", name: "Neuheiten" }],
    seo: { title: null, description: null },
  },
  {
    id: "p3",
    handle: "wolldecke-grau",
    title: "Wolldecke Grau",
    subtitle: "Merinowolle, 130 × 180 cm",
    image: null,
    price: { currencyCode: CURRENCY, unitAmountMinor: 12900, compareAtAmountMinor: null, taxIncluded: true },
    availability: "in_stock",
    description: "Weiche Decke aus Merinowolle mit schmalem Kettelrand.",
    vendor: "Beispielmarke",
    productType: "Wohnen",
    images: [],
    options: [],
    variants: [variant("p3-1", "Standard", 12900)],
    categories: [{ id: "c2", handle: "wohnen", name: "Wohnen" }],
    collections: [{ id: "k2", handle: "bestseller", name: "Bestseller" }],
    seo: { title: null, description: null },
  },
  {
    id: "p4",
    handle: "espressotassen-set",
    title: "Espressotassen, 2er-Set",
    subtitle: "Steingut, spülmaschinenfest",
    image: null,
    price: { currencyCode: CURRENCY, unitAmountMinor: 3200, compareAtAmountMinor: null, taxIncluded: true },
    availability: "in_stock",
    description: "Zwei kleine Tassen aus Steingut mit dünnem Rand.",
    vendor: "Beispielmarke",
    productType: "Küche",
    images: [],
    options: [],
    variants: [variant("p4-1", "Standard", 3200)],
    categories: [{ id: "c3", handle: "kueche", name: "Küche" }],
    collections: [{ id: "k2", handle: "bestseller", name: "Bestseller" }],
    seo: { title: null, description: null },
  },
  {
    id: "p5",
    handle: "notizbuch-a5",
    title: "Notizbuch A5",
    subtitle: "Fadenbindung, 192 Seiten",
    image: null,
    price: { currencyCode: CURRENCY, unitAmountMinor: 1800, compareAtAmountMinor: null, taxIncluded: true },
    availability: "in_stock",
    description: "Schlichtes Notizbuch mit Fadenbindung und cremefarbenem Papier.",
    vendor: "Beispielmarke",
    productType: "Papier",
    images: [],
    options: [],
    variants: [variant("p5-1", "Standard", 1800)],
    categories: [{ id: "c4", handle: "papier", name: "Papier" }],
    collections: [{ id: "k1", handle: "neuheiten", name: "Neuheiten" }],
    seo: { title: null, description: null },
  },
  {
    id: "p6",
    handle: "kerzenhalter-messing",
    title: "Kerzenhalter Messing",
    subtitle: "Gebürstet, für Stabkerzen",
    image: null,
    price: { currencyCode: CURRENCY, unitAmountMinor: 4600, compareAtAmountMinor: null, taxIncluded: true },
    availability: "backorder",
    description: "Gebürsteter Kerzenhalter aus massivem Messing.",
    vendor: "Beispielmarke",
    productType: "Wohnen",
    images: [],
    options: [],
    variants: [variant("p6-1", "Standard", 4600)],
    categories: [{ id: "c2", handle: "wohnen", name: "Wohnen" }],
    collections: [{ id: "k2", handle: "bestseller", name: "Bestseller" }],
    seo: { title: null, description: null },
  },
];

const CATEGORIES = [
  { id: "c1", handle: "kleidung", name: "Kleidung", description: null, parentId: null, position: 1 },
  { id: "c2", handle: "wohnen", name: "Wohnen", description: null, parentId: null, position: 2 },
  { id: "c3", handle: "kueche", name: "Küche", description: null, parentId: null, position: 3 },
  { id: "c4", handle: "papier", name: "Papier", description: null, parentId: null, position: 4 },
];

const COLLECTIONS = [
  { id: "k1", handle: "neuheiten", name: "Neuheiten", description: "Zuletzt aufgenommen" },
  { id: "k2", handle: "bestseller", name: "Bestseller", description: "Oft gekauft" },
];

function summary(p: StoreProduct): StoreProductSummary {
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    subtitle: p.subtitle,
    image: p.image,
    price: p.price,
    availability: p.availability,
  };
}

type DemoState = {
  cart: StoreCart | null;
  cartToken: string | null;
  checkout: StoreCheckout | null;
  shippingMinor: number;
  paid: boolean;
};

const state: DemoState = { cart: null, cartToken: null, checkout: null, shippingMinor: 0, paid: false };

const SHIPPING_OPTIONS = [
  { id: "std", name: "Standardversand", description: "2–4 Werktage", amountMinor: 490, currencyCode: CURRENCY },
  { id: "exp", name: "Expressversand", description: "1 Werktag", amountMinor: 1290, currencyCode: CURRENCY },
];

function recalc(cart: StoreCart): StoreCart {
  const subtotal = cart.items.reduce((s, i) => s + i.lineSubtotalMinor, 0);
  const discount = cart.promotionCodes.includes("WILLKOMMEN10") ? Math.round(subtotal * 0.1) : 0;
  const shipping = state.shippingMinor;
  const gross = subtotal - discount + shipping;
  const tax = Math.round(gross - gross / 1.19);
  return {
    ...cart,
    totals: {
      subtotalMinor: subtotal,
      discountMinor: discount,
      shippingMinor: shipping,
      taxMinor: tax,
      totalMinor: gross,
    },
    tax: {
      calculationMode: "gross",
      netTotalMinor: gross - tax,
      taxMinor: tax,
      grossTotalMinor: gross,
      reverseCharge: false,
      breakdown: [{ rate: 19, label: "USt. 19 %", netMinor: gross - tax, taxMinor: tax }],
      pricesIncludeTax: true,
    },
  };
}

function emptyCart(): StoreCart {
  return recalc({
    id: "demo-cart",
    currencyCode: CURRENCY,
    email: null,
    items: [],
    promotionCodes: [],
    rejectedCodes: [],
    totals: { subtotalMinor: 0, discountMinor: 0, shippingMinor: 0, taxMinor: 0, totalMinor: 0 },
    tax: {
      calculationMode: "gross",
      netTotalMinor: 0,
      taxMinor: 0,
      grossTotalMinor: 0,
      reverseCharge: false,
      breakdown: [],
      pricesIncludeTax: true,
    },
    warnings: [],
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
}

function findVariant(variantId: string) {
  for (const p of PRODUCTS) {
    const v = p.variants.find((x) => x.id === variantId);
    if (v) return { product: p, variant: v };
  }
  return null;
}

function itemFrom(variantId: string, quantity: number): StoreCartItem | null {
  const found = findVariant(variantId);
  if (!found) return null;
  const unit = found.variant.price?.unitAmountMinor ?? 0;
  return {
    id: `item-${variantId}`,
    productId: found.product.id,
    variantId,
    title: found.product.title,
    variantTitle: found.variant.title,
    sku: found.variant.sku,
    image: null,
    quantity,
    unitAmountMinor: unit,
    lineSubtotalMinor: unit * quantity,
    lineDiscountMinor: 0,
    lineTotalMinor: unit * quantity,
  };
}

function checkoutFrom(patch: Partial<StoreCheckout> = {}): StoreCheckout {
  const cart = recalc(state.cart ?? emptyCart());
  state.cart = cart;
  const base: StoreCheckout = state.checkout ?? {
    id: "demo-checkout",
    status: "open",
    email: null,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    shippingAddress: null,
    billingAddress: null,
    billingSameAsShipping: true,
    shippingOption: null,
    totals: cart.totals,
    currencyCode: CURRENCY,
    ready: false,
    issues: [],
    cart,
  };
  const next: StoreCheckout = { ...base, ...patch, cart, totals: cart.totals };
  const issues: string[] = [];
  if (!next.email) issues.push("E-Mail-Adresse fehlt.");
  if (!next.shippingAddress) issues.push("Lieferadresse fehlt.");
  if (!next.shippingOption) issues.push("Versandart fehlt.");
  if (cart.items.length === 0) issues.push("Der Warenkorb ist leer.");
  next.issues = issues;
  next.ready = issues.length === 0;
  state.checkout = next;
  return next;
}

const ok = (data: unknown) =>
  new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "content-type": "application/json", "x-request-id": "demo" },
  });

const fail = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "content-type": "application/json", "x-request-id": "demo" },
  });

export const DEMO_BASE_URL = "https://demo.local/api/public/store/v1";

/** fetch-kompatible Demo-Implementierung der Store API v1. */
export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input.toString());
  const path = url.pathname.replace("/api/public/store/v1", "");
  const method = (init?.method ?? "GET").toUpperCase();
  const body = (init?.body ? JSON.parse(String(init.body)) : {}) as Json;
  await new Promise((r) => setTimeout(r, 180));

  if (path === "/config")
    return ok({
      shop: { name: "Hauptshop", handle: "mustershop", locale: "de-DE", currencyCode: CURRENCY },
      countries: ["DE", "AT", "CH"],
      taxDisplayMode: "gross",
      features: { search: true, promotions: true, guestCheckout: true, customerAccounts: true, returns: true },
      apiVersion: "v1",
      environment: "test",
    });

  if (path === "/payment-methods")
    return ok([{ id: "demo", provider: "demo", name: "Testzahlung", environment: "test", testOnly: true }]);

  if (path === "/products") {
    const category = url.searchParams.get("category");
    const collection = url.searchParams.get("collection");
    const sort = url.searchParams.get("sort");
    const page = Number(url.searchParams.get("page") ?? 1);
    const pageSize = Number(url.searchParams.get("pageSize") ?? 24);
    let list = PRODUCTS.filter(
      (p) =>
        (!category || p.categories.some((c) => c.handle === category)) &&
        (!collection || p.collections.some((c) => c.handle === collection)),
    );
    if (sort === "price_asc")
      list = [...list].sort((a, b) => (a.price?.unitAmountMinor ?? 0) - (b.price?.unitAmountMinor ?? 0));
    if (sort === "price_desc")
      list = [...list].sort((a, b) => (b.price?.unitAmountMinor ?? 0) - (a.price?.unitAmountMinor ?? 0));
    if (sort === "title_asc") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    const start = (page - 1) * pageSize;
    const slice = list.slice(start, start + pageSize);
    return ok({
      data: slice.map(summary),
      pagination: { page, pageSize, total: list.length, hasMore: start + pageSize < list.length },
    });
  }

  if (path.startsWith("/products/")) {
    const handle = decodeURIComponent(path.slice("/products/".length));
    const product = PRODUCTS.find((p) => p.handle === handle);
    return product ? ok(product) : fail(404, "NOT_FOUND", "Produkt nicht gefunden.");
  }

  if (path === "/search") {
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const hits = PRODUCTS.filter(
      (p) => p.title.toLowerCase().includes(q) || (p.subtitle ?? "").toLowerCase().includes(q),
    );
    return ok({
      data: hits.map(summary),
      pagination: { page: 1, pageSize: hits.length, total: hits.length, hasMore: false },
    });
  }

  if (path === "/categories") return ok(CATEGORIES);
  if (path === "/collections") return ok(COLLECTIONS);

  if (path === "/cart" && method === "POST") {
    state.cart = emptyCart();
    state.cartToken = "demo-token";
    return ok({ cart: state.cart, cartToken: state.cartToken });
  }

  if (path.startsWith("/cart/")) {
    if (!state.cart) return fail(409, "CART_EXPIRED", "Es existiert kein aktiver Warenkorb.");
    const rest = path.slice("/cart/".length).split("/").slice(1);
    if (rest.length === 0) return ok(recalc(state.cart));

    if (rest[0] === "items" && method === "POST") {
      const variantId = String(body["variantId"]);
      const quantity = Number(body["quantity"] ?? 1);
      const existing = state.cart.items.find((i) => i.variantId === variantId);
      if (existing) {
        existing.quantity += quantity;
        existing.lineSubtotalMinor = existing.unitAmountMinor * existing.quantity;
        existing.lineTotalMinor = existing.lineSubtotalMinor;
      } else {
        const item = itemFrom(variantId, quantity);
        if (!item) return fail(404, "NOT_FOUND", "Variante nicht gefunden.");
        state.cart.items.push(item);
      }
      state.cart = recalc(state.cart);
      return ok(state.cart);
    }

    if (rest[0] === "items" && rest[1]) {
      const item = state.cart.items.find((i) => i.id === rest[1]);
      if (!item) return fail(404, "NOT_FOUND", "Position nicht gefunden.");
      if (method === "PATCH") {
        item.quantity = Number(body["quantity"] ?? 1);
        item.lineSubtotalMinor = item.unitAmountMinor * item.quantity;
        item.lineTotalMinor = item.lineSubtotalMinor;
      }
      if (method === "DELETE") state.cart.items = state.cart.items.filter((i) => i.id !== rest[1]);
      state.cart = recalc(state.cart);
      return ok(state.cart);
    }

    if (rest[0] === "promotions" && method === "POST") {
      const code = String(body["code"] ?? "").toUpperCase();
      if (code !== "WILLKOMMEN10")
        return fail(422, "VALIDATION_ERROR", "Dieser Gutscheincode ist nicht gültig.");
      if (!state.cart.promotionCodes.includes(code)) state.cart.promotionCodes.push(code);
      state.cart = recalc(state.cart);
      return ok(state.cart);
    }

    if (rest[0] === "promotions" && rest[1]) {
      const code = decodeURIComponent(rest[1]);
      state.cart.promotionCodes = state.cart.promotionCodes.filter((c) => c !== code);
      state.cart = recalc(state.cart);
      return ok(state.cart);
    }
  }

  if (path === "/checkout" && method === "POST") {
    state.checkout = null;
    state.shippingMinor = 0;
    state.paid = false;
    return ok(checkoutFrom({ email: (body["email"] as string | null) ?? null }));
  }

  if (path.startsWith("/checkout/")) {
    const rest = path.slice("/checkout/".length).split("/").slice(1);
    if (rest.length === 0) return ok(checkoutFrom());
    if (rest[0] === "email") return ok(checkoutFrom({ email: String(body["email"] ?? "") }));
    if (rest[0] === "address") {
      const address = body["address"] as StoreCheckout["shippingAddress"];
      const type = String(body["type"] ?? "shipping");
      const same = Boolean(body["billingSameAsShipping"] ?? true);
      return ok(
        checkoutFrom(
          type === "shipping"
            ? { shippingAddress: address, billingSameAsShipping: same, billingAddress: same ? address : null }
            : { billingAddress: address, billingSameAsShipping: false },
        ),
      );
    }
    if (rest[0] === "shipping-options") return ok(SHIPPING_OPTIONS);
    if (rest[0] === "shipping-option") {
      const option = SHIPPING_OPTIONS.find((o) => o.id === String(body["shippingMethodId"]));
      if (!option) return fail(422, "VALIDATION_ERROR", "Versandart nicht verfügbar.");
      state.shippingMinor = option.amountMinor;
      return ok(checkoutFrom({ shippingOption: option }));
    }
    if (rest[0] === "validate") {
      const next = checkoutFrom();
      if (!next.ready) return fail(422, "VALIDATION_ERROR", next.issues.join(" "));
      return ok(checkoutFrom({ status: "validated" }));
    }
    if (rest[0] === "payment-session") {
      const next = checkoutFrom({ status: "awaiting_payment" });
      state.paid = true;
      const returnUrl = String(body["returnUrl"] ?? "/");
      return ok({
        id: "demo-payment",
        type: "redirect",
        status: "pending",
        redirectUrl: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}token=demo-confirmation`,
        amountMinor: next.totals.totalMinor,
        currencyCode: CURRENCY,
      });
    }
  }

  if (path.startsWith("/payments/"))
    return ok({
      status: state.paid ? "paid" : "pending",
      confirmationToken: state.paid ? "demo-confirmation" : null,
      confirmationExpiresAt: new Date(Date.now() + 600_000).toISOString(),
    });

  if (path.startsWith("/orders/confirmation/")) {
    const cart = recalc(state.cart ?? emptyCart());
    const order = demoOrder(cart);
    state.cart = null;
    state.checkout = null;
    state.paid = false;
    state.shippingMinor = 0;
    return ok(order);
  }

  if (path === "/orders/guest-access" && method === "POST") return ok({ requested: true });
  if (path === "/orders/guest") return ok(demoOrder(recalc(emptyCartWithDemoItems())));
  if (path.startsWith("/orders/guest/documents/")) return ok({ url: null });

  if (path === "/returns/eligibility")
    return ok({
      eligible: true,
      reason: null,
      items: [{ orderItemId: "oi1", title: "Leinenhemd Natur", returnableQuantity: 1 }],
    });

  if (path === "/returns" && method === "POST")
    return ok({
      id: "r1",
      returnNumber: "RET-1001",
      status: "requested",
      requestedAt: new Date().toISOString(),
    });

  if (path === "/customer/auth/login")
    return ok({
      token: "demo-session",
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      customer: { id: "cu1", email: String(body["email"] ?? "kunde@example.com"), firstName: "Alex", lastName: "Muster", kind: "b2c" },
    });

  if (path === "/customer/auth/register")
    return ok({
      token: "demo-session",
      confirmationRequired: false,
      customer: { id: "cu1", email: String(body["email"] ?? "kunde@example.com"), firstName: null, lastName: null, kind: "b2c" },
    });

  if (path === "/customer/auth/password-reset") return ok({ requested: true });

  if (path === "/customer/me")
    return ok({ id: "cu1", email: "kunde@example.com", firstName: "Alex", lastName: "Muster", kind: "b2c" });

  if (path === "/customer/orders")
    return ok([
      {
        id: "o1",
        orderNumber: "10024",
        placedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
        totalMinor: 9390,
        currencyCode: CURRENCY,
        paymentStatus: "paid",
        fulfillmentStatus: "shipped",
        itemCount: 2,
      },
    ]);

  if (path.startsWith("/customer/orders/") && path.includes("/documents/")) return ok({ url: null });
  if (path.startsWith("/customer/orders/")) return ok(demoOrder(recalc(emptyCartWithDemoItems())));

  return fail(404, "NOT_FOUND", "Endpunkt im Demo-Modus nicht vorhanden.");
}

function emptyCartWithDemoItems(): StoreCart {
  const cart = emptyCart();
  const item = itemFrom("p1-m", 1);
  if (item) cart.items.push(item);
  return cart;
}

function demoOrder(cart: StoreCart) {
  return {
    id: "o1",
    orderNumber: "10024",
    placedAt: new Date().toISOString(),
    currencyCode: CURRENCY,
    totalMinor: cart.totals.totalMinor,
    subtotalMinor: cart.totals.subtotalMinor,
    shippingMinor: cart.totals.shippingMinor,
    taxMinor: cart.totals.taxMinor,
    discountMinor: cart.totals.discountMinor,
    paymentStatus: "paid",
    fulfillmentStatus: "processing",
    items: cart.items.map((i) => ({
      title: i.title,
      variantTitle: i.variantTitle,
      sku: i.sku,
      quantity: i.quantity,
      lineTotalMinor: i.lineTotalMinor,
    })),
    addresses: [],
    documents: [{ id: "d1", kind: "invoice" as const, number: "RE-10024", issuedAt: new Date().toISOString() }],
    tracking: [],
    returns: [],
  };
}
