/**
 * Allowlist mappers: every public field is listed explicitly.
 * Nothing is "deleted" from an internal object — internal shapes never leak
 * because only the fields below are ever copied.
 */
import type {
  StoreAvailability,
  StoreCart,
  StoreCheckout,
  StoreOrder,
  StoreOrderSummary,
  StoreTotals,
} from "@/lib/store-sdk/types";
import type { CartView, CheckoutView } from "../cart-types";
import type { PortalOrderDetail, PortalOrderSummary } from "../portal/portal.server";

export function mapTotals(t: {
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
}): StoreTotals {
  return {
    subtotalMinor: t.subtotalMinor,
    discountMinor: t.discountMinor,
    shippingMinor: t.shippingMinor,
    taxMinor: t.taxMinor,
    totalMinor: t.totalMinor,
  };
}

export function availabilityFrom(available: number, lowThreshold = 5): StoreAvailability {
  if (available <= 0) return "out_of_stock";
  if (available <= lowThreshold) return "low_stock";
  return "in_stock";
}

export function mapCart(view: CartView): StoreCart {
  return {
    id: view.id,
    currencyCode: view.currencyCode,
    email: view.email,
    items: view.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      variantId: i.variantId,
      title: i.title,
      variantTitle: i.variantTitle,
      sku: i.sku,
      image: i.image,
      quantity: i.quantity,
      unitAmountMinor: i.unitResolvedMinor,
      lineSubtotalMinor: i.lineSubtotalMinor,
      lineDiscountMinor: i.lineDiscountMinor,
      lineTotalMinor: i.lineTotalMinor,
    })),
    promotionCodes: view.promotionCodes,
    rejectedCodes: view.rejectedCodes.map((r) => ({ code: r.code, reason: r.reason })),
    totals: mapTotals(view.totals),
    tax: {
      calculationMode: view.tax.calculationMode,
      netTotalMinor: view.tax.netTotalMinor,
      taxMinor: view.tax.taxMinor,
      grossTotalMinor: view.tax.grossTotalMinor,
      reverseCharge: view.tax.reverseCharge,
      breakdown: view.tax.breakdown.map((b) => ({
        rate: b.rateBasisPoints / 100,
        label: b.label,
        netMinor: b.netMinor,
        taxMinor: b.taxMinor,
      })),
      pricesIncludeTax: view.tax.calculationMode === "gross",
    },
    warnings: view.warnings,
    expiresAt: view.expiresAt,
  };
}

export function mapCheckout(view: CheckoutView): StoreCheckout {
  const address = (a: CheckoutView["shippingAddress"]) =>
    a
      ? {
          firstName: a.firstName,
          lastName: a.lastName,
          company: a.company ?? null,
          street: a.street,
          street2: a.street2 ?? null,
          postalCode: a.postalCode,
          city: a.city,
          state: a.state ?? null,
          countryCode: a.countryCode,
          phone: a.phone ?? null,
        }
      : null;
  return {
    id: view.id,
    status: view.status,
    email: view.email,
    expiresAt: view.expiresAt,
    shippingAddress: address(view.shippingAddress),
    billingAddress: address(view.billingAddress),
    billingSameAsShipping: view.billingSameAsShipping,
    shippingOption: view.shippingMethod
      ? {
          id: view.shippingMethod.id,
          name: view.shippingMethod.name,
          description: view.shippingMethod.description,
          amountMinor: view.shippingMethod.amountMinor,
          currencyCode: view.shippingMethod.currencyCode,
        }
      : null,
    totals: mapTotals(view.totals),
    currencyCode: view.currencyCode,
    ready: view.ready,
    issues: view.issues,
    cart: mapCart(view.cart),
  };
}

export function mapOrderSummary(o: PortalOrderSummary): StoreOrderSummary {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    placedAt: o.placedAt,
    totalMinor: o.totalMinor,
    currencyCode: o.currencyCode,
    paymentStatus: o.paymentStatus,
    fulfillmentStatus: o.fulfillmentStatus,
    itemCount: o.itemCount,
  };
}

export function mapOrder(o: PortalOrderDetail): StoreOrder {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    placedAt: o.placedAt,
    currencyCode: o.currencyCode,
    totalMinor: o.totalMinor,
    subtotalMinor: o.subtotalMinor,
    shippingMinor: o.shippingMinor,
    taxMinor: o.taxMinor,
    discountMinor: o.discountMinor,
    paymentStatus: o.paymentStatus,
    fulfillmentStatus: o.fulfillmentStatus,
    items: o.items.map((i) => ({
      title: i.title,
      variantTitle: i.variantTitle,
      sku: i.sku,
      quantity: i.quantity,
      lineTotalMinor: i.lineTotalMinor,
    })),
    addresses: o.addresses.map((a) => ({ type: a.type, address: a.address })),
    documents: o.documents.map((d) => ({
      id: d.id,
      kind: d.kind,
      number: d.number,
      issuedAt: d.issuedAt,
    })),
    tracking: o.tracking.map((t) => ({
      carrier: t.carrier,
      trackingNumber: t.trackingNumber,
      trackingUrl: t.trackingUrl,
      status: t.status,
      shippedAt: t.shippedAt,
      deliveredAt: t.deliveredAt,
      events: t.events.map((e) => ({
        code: e.code,
        description: e.description,
        occurredAt: e.occurredAt,
      })),
    })),
    returns: o.returns.map((r) => ({
      id: r.id,
      returnNumber: r.returnNumber,
      status: r.status,
      requestedAt: r.requestedAt,
    })),
  };
}
