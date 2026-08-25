/**
 * THE cart-level pricing engine. Pure function, no database, unit-testable.
 *
 * Line-level prices come from the single pricing engine (pricing-engine.ts).
 * This module only handles what needs the whole cart: promotions across lines,
 * deterministic discount distribution, shipping and tax composition.
 *
 * All money is integer minor units.
 */
import type {
  AppliedPromotion,
  PromotionCondition,
  PromotionRow,
} from "./pricing-types";
import {
  PRICING_ENGINE_VERSION,
  type CartCalculation,
  type CartEngineInput,
  type CartEngineLine,
  type CartLineResult,
} from "./cart-types";

function inWindow(now: number, from: string | null, to: string | null) {
  if (from && Date.parse(from) > now) return false;
  if (to && Date.parse(to) <= now) return false;
  return true;
}

/** Deterministic order: most expensive unit first, then variant, then line id. */
function sortLines(lines: CartEngineLine[]) {
  return [...lines].sort((a, b) => {
    if (a.unitResolvedMinor !== b.unitResolvedMinor) return b.unitResolvedMinor - a.unitResolvedMinor;
    if (a.variantId !== b.variantId) return a.variantId.localeCompare(b.variantId);
    return a.id.localeCompare(b.id);
  });
}

type Cond = {
  kind: string;
  ids?: string[];
  value?: number;
  from?: string | null;
  to?: string | null;
  buy?: number;
  get?: number;
};

function lineMatchesScope(line: CartEngineLine, conds: Cond[]) {
  const scoped = conds.filter((c) =>
    ["product", "variant", "category", "collection"].includes(c.kind),
  );
  if (!scoped.length) return true;
  return scoped.some((c) => {
    switch (c.kind) {
      case "product":
        return (c.ids ?? []).includes(line.productId);
      case "variant":
        return (c.ids ?? []).includes(line.variantId);
      case "category":
        return (c.ids ?? []).some((id) => line.categoryIds.includes(id));
      case "collection":
        return (c.ids ?? []).some((id) => line.collectionIds.includes(id));
      default:
        return false;
    }
  });
}

function cartConditionPasses(
  c: Cond,
  input: CartEngineInput,
  qualifyingSubtotal: number,
  qualifyingQuantity: number,
  now: number,
): boolean {
  switch (c.kind) {
    case "product":
    case "variant":
    case "category":
    case "collection":
      return qualifyingQuantity > 0;
    case "minimum_quantity":
      return qualifyingQuantity >= (c.value ?? 0);
    case "minimum_subtotal":
      return qualifyingSubtotal >= (c.value ?? 0);
    case "customer_group":
      return !!input.customerGroupId && (c.ids ?? []).includes(input.customerGroupId);
    case "date_range":
      return inWindow(now, c.from ?? null, c.to ?? null);
    case "buy_x_get_y":
      return true;
    default:
      // Unknown condition kinds are conservative: the promotion does not apply.
      return false;
  }
}

function buyGetConfig(promo: PromotionRow): { buy: number; get: number } | null {
  const fromAction = (promo.actions as Cond[]).find((a) => a.kind === "buy_x_get_y");
  const fromCond = (promo.conditions as unknown as Cond[]).find((c) => c.kind === "buy_x_get_y");
  const src = fromAction ?? fromCond;
  const buy = Math.floor(Number(src?.buy ?? 0));
  const get = Math.floor(Number(src?.get ?? 0));
  if (buy > 0 && get > 0) return { buy, get };
  return null;
}

/**
 * Distributes a cart-level discount over the qualifying lines, proportionally
 * to their running totals. Rounding remainders are assigned to the first line
 * in the deterministic sort order — never to a random database row order.
 */
function distribute(
  amount: number,
  lines: { id: string; running: number }[],
): Map<string, number> {
  const out = new Map<string, number>();
  const total = lines.reduce((s, l) => s + l.running, 0);
  if (amount <= 0 || total <= 0) return out;
  let assigned = 0;
  for (const line of lines) {
    const share = Math.min(line.running, Math.floor((amount * line.running) / total));
    out.set(line.id, share);
    assigned += share;
  }
  let remainder = amount - assigned;
  for (const line of lines) {
    if (remainder <= 0) break;
    const current = out.get(line.id) ?? 0;
    const room = line.running - current;
    const add = Math.min(room, remainder);
    out.set(line.id, current + add);
    remainder -= add;
  }
  return out;
}

export function calculateCart(input: CartEngineInput): CartCalculation {
  const now = Date.parse(input.now);
  const currency = input.currencyCode.toUpperCase();
  const ordered = sortLines(input.lines);
  const codes = (input.promotionCodes ?? []).map((c) => c.trim().toUpperCase()).filter(Boolean);

  const running = new Map<string, number>();
  const discountByLine = new Map<string, number>();
  const promosByLine = new Map<string, AppliedPromotion[]>();
  for (const line of ordered) {
    running.set(line.id, line.unitResolvedMinor * line.quantity);
    discountByLine.set(line.id, 0);
    promosByLine.set(line.id, []);
  }

  const subtotal = ordered.reduce((s, l) => s + l.unitResolvedMinor * l.quantity, 0);

  // ---- promotion selection -------------------------------------------------
  const rejectedCodes: { code: string; reason: string }[] = [];
  const pendingPromotions: AppliedPromotion[] = [];
  const matchedCodes = new Set<string>();

  type Candidate = { promo: PromotionRow; lines: CartEngineLine[] };
  const candidates: Candidate[] = [];

  for (const promo of input.promotions) {
    if (promo.organization_id !== input.organizationId || promo.shop_id !== input.shopId) continue;
    if (promo.status !== "active") continue;
    if (promo.currency_code && promo.currency_code.toUpperCase() !== currency) continue;
    if (!inWindow(now, promo.starts_at, promo.ends_at)) continue;
    if (promo.code) {
      if (!codes.includes(promo.code.toUpperCase())) continue;
      matchedCodes.add(promo.code.toUpperCase());
    }

    const conds = (Array.isArray(promo.conditions) ? promo.conditions : []) as unknown as Cond[];
    const qualifying = ordered.filter((l) => lineMatchesScope(l, conds));
    const qualifyingSubtotal = qualifying.reduce((s, l) => s + l.unitResolvedMinor * l.quantity, 0);
    const qualifyingQuantity = qualifying.reduce((s, l) => s + l.quantity, 0);

    const ok = (conds as PromotionCondition[] as unknown as Cond[]).every((c) =>
      cartConditionPasses(c, input, qualifyingSubtotal, qualifyingQuantity, now),
    );
    if (!ok || !qualifying.length) {
      if (promo.code) rejectedCodes.push({ code: promo.code, reason: "Bedingungen nicht erfüllt" });
      continue;
    }

    candidates.push({ promo, lines: qualifying });
  }

  for (const code of codes) {
    if (!matchedCodes.has(code) && !rejectedCodes.some((r) => r.code.toUpperCase() === code)) {
      rejectedCodes.push({ code, reason: "Code unbekannt, abgelaufen oder inaktiv" });
    }
  }

  function previewDiscount(c: Candidate) {
    return computeDiscount(c, (id) => running.get(id) ?? 0);
  }

  function computeDiscount(c: Candidate, current: (lineId: string) => number) {
    const promo = c.promo;
    const qualSum = c.lines.reduce((s, l) => s + current(l.id), 0);
    switch (promo.type) {
      case "percentage":
        return Math.min(qualSum, Math.round((qualSum * promo.value) / 10000));
      case "fixed_amount":
        return Math.min(qualSum, Math.max(0, promo.value));
      case "fixed_price":
        return c.lines.reduce((s, l) => {
          const target = Math.max(0, promo.value) * l.quantity;
          return s + Math.max(0, current(l.id) - target);
        }, 0);
      case "buy_x_get_y": {
        const cfg = buyGetConfig(promo);
        if (!cfg) return 0;
        // Deterministic: cheapest qualifying units are the free ones.
        const units: number[] = [];
        for (const l of [...c.lines].sort((a, b) => {
          if (a.unitResolvedMinor !== b.unitResolvedMinor) return a.unitResolvedMinor - b.unitResolvedMinor;
          if (a.variantId !== b.variantId) return a.variantId.localeCompare(b.variantId);
          return a.id.localeCompare(b.id);
        })) {
          const unit = l.quantity > 0 ? Math.round(current(l.id) / l.quantity) : 0;
          for (let i = 0; i < l.quantity; i += 1) units.push(unit);
        }
        const groups = Math.floor(units.length / (cfg.buy + cfg.get));
        const freeUnits = groups * cfg.get;
        return units.slice(0, freeUnits).reduce((s, u) => s + u, 0);
      }
      default:
        return 0;
    }
  }

  const ranked = [...candidates].sort((a, b) => {
    if (a.promo.priority !== b.promo.priority) return b.promo.priority - a.promo.priority;
    const da = previewDiscount(a);
    const db = previewDiscount(b);
    if (da !== db) return db - da;
    return a.promo.id.localeCompare(b.promo.id);
  });

  const appliedPromotions: AppliedPromotion[] = [];
  let freeShipping = false;
  let totalDiscount = 0;
  let appliedCount = 0;

  for (const candidate of ranked) {
    const promo = candidate.promo;
    if (!promo.stackable && appliedCount > 0) continue;

    if (promo.usageLimitPerCustomer) {
      pendingPromotions.push({
        promotionId: promo.id,
        name: promo.name,
        code: promo.code,
        type: promo.type,
        stackable: promo.stackable,
        priority: promo.priority,
        discountMinor: 0,
        pending: "requires_orders",
        note: "Nutzungslimits pro Kunde werden erst mit Kunden und Bestellungen durchgesetzt.",
      });
    }

    if (promo.type === "free_shipping") {
      freeShipping = true;
      appliedPromotions.push({
        promotionId: promo.id,
        name: promo.name,
        code: promo.code,
        type: promo.type,
        stackable: promo.stackable,
        priority: promo.priority,
        discountMinor: 0,
      });
      appliedCount += 1;
      if (!promo.stackable) break;
      continue;
    }

    const discount = computeDiscount(candidate, (id) => running.get(id) ?? 0);
    if (discount <= 0) continue;

    const spread = distribute(
      discount,
      candidate.lines.map((l) => ({ id: l.id, running: running.get(l.id) ?? 0 })),
    );

    const entry: AppliedPromotion = {
      promotionId: promo.id,
      name: promo.name,
      code: promo.code,
      type: promo.type,
      stackable: promo.stackable,
      priority: promo.priority,
      discountMinor: discount,
      ...(promo.type === "buy_x_get_y"
        ? {
            note:
              "Buy X Get Y wird als Rabatt auf die günstigsten qualifizierten Einheiten gerechnet; " +
              "endgültige Verrechnung erst mit Bestellungen.",
          }
        : {}),
    };

    for (const [lineId, amount] of spread) {
      running.set(lineId, Math.max(0, (running.get(lineId) ?? 0) - amount));
      discountByLine.set(lineId, (discountByLine.get(lineId) ?? 0) + amount);
      if (amount > 0) {
        promosByLine.get(lineId)?.push({ ...entry, discountMinor: amount });
      }
    }

    totalDiscount += discount;
    appliedPromotions.push(entry);
    appliedCount += 1;
    if (!promo.stackable) break;
  }

  // ---- shipping -------------------------------------------------------------
  const netSubtotal = Math.max(0, subtotal - totalDiscount);
  let shipping = input.shipping ? Math.max(0, input.shipping.amountMinor) : 0;
  if (input.shipping?.freeAboveMinor != null && netSubtotal >= input.shipping.freeAboveMinor) {
    shipping = 0;
  }
  if (freeShipping) shipping = 0;

  const lines: CartLineResult[] = ordered.map((l) => {
    const lineSubtotal = l.unitResolvedMinor * l.quantity;
    const lineDiscount = discountByLine.get(l.id) ?? 0;
    return {
      lineId: l.id,
      variantId: l.variantId,
      quantity: l.quantity,
      unitBaseMinor: l.unitBaseMinor,
      unitResolvedMinor: l.unitResolvedMinor,
      lineSubtotalMinor: lineSubtotal,
      lineDiscountMinor: lineDiscount,
      lineTotalMinor: Math.max(0, lineSubtotal - lineDiscount),
      appliedPriceRules: l.appliedPriceRules,
      appliedPromotions: promosByLine.get(l.id) ?? [],
    };
  });

  const tax = Math.max(0, input.taxMinor || 0);
  // Gross shops: prices already contain tax, so it is reported but not added again.
  const total = Math.max(0, netSubtotal + shipping + (input.taxIncluded ? 0 : tax));

  return {
    currencyCode: currency,
    pricingEngineVersion: PRICING_ENGINE_VERSION,
    totals: {
      subtotalMinor: subtotal,
      discountMinor: totalDiscount,
      shippingMinor: shipping,
      taxMinor: tax,
      totalMinor: total,
    },
    lines,
    appliedPromotions,
    pendingPromotions,
    rejectedCodes,
    freeShipping,
  };
}
