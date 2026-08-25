/**
 * THE single pricing engine. Pure function over a loaded snapshot so it can be
 * unit-tested without a database and reused by admin, preview, and later cart /
 * checkout / storefront. Never import this into a component — it is reached only
 * through server functions.
 *
 * All money is integer minor units.
 */
import type {
  AppliedPriceRule,
  AppliedPromotion,
  ExplanationStep,
  PriceRow,
  PriceRuleStage,
  PricingContext,
  PricingResult,
  PricingSnapshot,
  PromotionCondition,
  PromotionRow,
} from "./pricing-types";

const STAGE_ORDER: PriceRuleStage[] = [
  "variant_override",
  "customer_group",
  "quantity_tier",
  "sale",
  "base",
];

const STAGE_LABEL: Record<PriceRuleStage, string> = {
  variant_override: "Varianten-Sonderpreis",
  customer_group: "Kundengruppenpreis",
  quantity_tier: "Mengenstaffel",
  sale: "Aktionspreis",
  base: "Normalpreis",
};

const KNOWN_PRICE_CONDITIONS = new Set<string>([]);

function inWindow(now: number, from: string | null, to: string | null) {
  if (from && Date.parse(from) > now) return false;
  if (to && Date.parse(to) <= now) return false;
  return true;
}

function stageOf(row: PriceRow): PriceRuleStage {
  if (row.type === "override") return "variant_override";
  if (row.type === "customer_group") return "customer_group";
  if (row.type === "tier") return "quantity_tier";
  if (row.type === "sale") return "sale";
  return "base";
}

/** Unknown extra conditions on a price row are treated as "not applicable". */
function priceConditionsPass(row: PriceRow) {
  const keys = Object.keys(row.conditions ?? {});
  return keys.every((k) => KNOWN_PRICE_CONDITIONS.has(k));
}

type Candidate = { row: PriceRow; stage: PriceRuleStage };

function pickBest(candidates: Candidate[]): Candidate {
  // Cheapest valid price wins inside a stage; deterministic tie-breaks after that.
  return [...candidates].sort((a, b) => {
    if (a.row.amount_minor !== b.row.amount_minor) return a.row.amount_minor - b.row.amount_minor;
    if (a.row.priority !== b.row.priority) return b.row.priority - a.row.priority;
    const at = Date.parse(a.row.updated_at || "") || 0;
    const bt = Date.parse(b.row.updated_at || "") || 0;
    if (at !== bt) return bt - at;
    return a.row.id.localeCompare(b.row.id);
  })[0]!;
}

function conditionPasses(
  condition: PromotionCondition,
  ctx: PricingContext,
  snapshot: PricingSnapshot,
  subtotal: number,
  now: number,
): boolean {
  const c = condition as {
    kind: string;
    ids?: string[];
    value?: number;
    from?: string | null;
    to?: string | null;
  };
  switch (c.kind) {
    case "product":
      return (c.ids ?? []).includes(ctx.productId);
    case "variant":
      return !!ctx.variantId && (c.ids ?? []).includes(ctx.variantId);
    case "category":
      return (c.ids ?? []).some((id) => snapshot.productCategoryIds.includes(id));
    case "collection":
      return (c.ids ?? []).some((id) => snapshot.productCollectionIds.includes(id));
    case "minimum_quantity":
      return ctx.quantity >= (c.value ?? 0);
    case "minimum_subtotal":
      return subtotal >= (c.value ?? 0);
    case "customer_group":
      return !!ctx.customerGroupId && (c.ids ?? []).includes(ctx.customerGroupId);
    case "date_range":
      return inWindow(now, c.from ?? null, c.to ?? null);
    default:
      // Unknown condition kinds are conservative: promotion does not apply.
      return false;
  }
}

function promotionDiscount(promo: PromotionRow, unitAmount: number, quantity: number) {
  const subtotal = unitAmount * quantity;
  switch (promo.type) {
    case "percentage":
      return Math.min(subtotal, Math.round((subtotal * promo.value) / 10000));
    case "fixed_amount":
      return Math.min(subtotal, Math.max(0, promo.value));
    case "fixed_price":
      return Math.max(0, subtotal - Math.max(0, promo.value) * quantity);
    default:
      return 0;
  }
}

export function resolvePricing(snapshot: PricingSnapshot, ctx: PricingContext): PricingResult {
  const now = Date.parse(ctx.now);
  const quantity = Math.max(1, Math.floor(ctx.quantity || 1));
  const currency = ctx.currencyCode.toUpperCase();
  const explanation: ExplanationStep[] = [];
  const rejected: { priceId: string; reason: string }[] = [];

  // ---- 1. Collect valid price rows -------------------------------------
  const valid: Candidate[] = [];
  for (const row of snapshot.prices) {
    if (row.shop_id !== snapshot.shopId || row.organization_id !== snapshot.organizationId) {
      rejected.push({ priceId: row.id, reason: "Fremder Shop oder fremde Organisation" });
      continue;
    }
    if (row.status !== "active") {
      rejected.push({ priceId: row.id, reason: "Nicht aktiv" });
      continue;
    }
    if (row.currency_code.toUpperCase() !== currency) {
      rejected.push({ priceId: row.id, reason: "Andere Währung" });
      continue;
    }
    if (!inWindow(now, row.starts_at, row.ends_at)) {
      rejected.push({ priceId: row.id, reason: "Außerhalb des Zeitraums" });
      continue;
    }
    if (row.min_quantity !== null && quantity < row.min_quantity) {
      rejected.push({ priceId: row.id, reason: "Menge zu gering" });
      continue;
    }
    if (row.max_quantity !== null && quantity > row.max_quantity) {
      rejected.push({ priceId: row.id, reason: "Menge zu hoch" });
      continue;
    }
    if (row.customer_group_id && row.customer_group_id !== ctx.customerGroupId) {
      rejected.push({ priceId: row.id, reason: "Andere Kundengruppe" });
      continue;
    }
    if (!priceConditionsPass(row)) {
      rejected.push({ priceId: row.id, reason: "Bedingung nicht unterstützt" });
      continue;
    }
    valid.push({ row, stage: stageOf(row) });
  }

  // Variant-scoped rows win over product-scoped ones when any exist.
  const scoped = valid.some((c) => c.row.scope === "variant")
    ? valid.filter((c) => c.row.scope === "variant")
    : valid;

  // ---- 2. Base amount ---------------------------------------------------
  const baseCandidates = scoped.filter((c) => c.stage === "base");
  const baseAmount = baseCandidates.length ? pickBest(baseCandidates).row.amount_minor : 0;

  // ---- 3. Highest business stage present, cheapest valid price inside it -
  const appliedPriceRules: AppliedPriceRule[] = [];
  let resolvedUnitAmount = baseAmount;
  let winner: Candidate | undefined;
  for (const stage of STAGE_ORDER) {
    const inStage = scoped.filter((c) => c.stage === stage);
    if (inStage.length) {
      winner = pickBest(inStage);
      break;
    }
  }
  if (winner) {
    resolvedUnitAmount = winner.row.amount_minor;
    appliedPriceRules.push({
      priceId: winner.row.id,
      stage: winner.stage,
      type: winner.row.type,
      scope: winner.row.scope,
      amountMinor: winner.row.amount_minor,
      label: STAGE_LABEL[winner.stage],
    });
  }

  if (baseCandidates.length) {
    explanation.push({ label: "Normalpreis", amountMinor: baseAmount, source: "base" });
  }
  if (winner && winner.stage !== "base") {
    explanation.push({
      label: STAGE_LABEL[winner.stage],
      amountMinor: resolvedUnitAmount,
      deltaMinor: resolvedUnitAmount - baseAmount,
      source: winner.row.id,
    });
  }

  const subtotal = resolvedUnitAmount * quantity;
  if (quantity > 1) {
    explanation.push({
      label: `Zwischensumme (${quantity} ×)`,
      amountMinor: subtotal,
      source: "subtotal",
    });
  }

  // ---- 4. Promotions ----------------------------------------------------
  const codes = (ctx.promotionCodes ?? []).map((c) => c.trim().toUpperCase()).filter(Boolean);
  const applicable: PromotionRow[] = [];
  const pendingPromotions: AppliedPromotion[] = [];

  for (const promo of snapshot.promotions) {
    if (promo.shop_id !== snapshot.shopId || promo.organization_id !== snapshot.organizationId)
      continue;
    if (promo.status !== "active") continue;
    if (!inWindow(now, promo.starts_at, promo.ends_at)) continue;
    if (promo.code && !codes.includes(promo.code.toUpperCase())) continue;
    if (promo.currency_code && promo.currency_code.toUpperCase() !== currency) continue;
    const conds = Array.isArray(promo.conditions) ? promo.conditions : [];
    if (!conds.every((c) => conditionPasses(c, ctx, snapshot, subtotal, now))) continue;

    if (promo.type === "buy_x_get_y") {
      pendingPromotions.push({
        promotionId: promo.id,
        name: promo.name,
        code: promo.code,
        type: promo.type,
        stackable: promo.stackable,
        priority: promo.priority,
        discountMinor: 0,
        pending: "requires_cart",
        note: "Buy X Get Y wird erst mit dem Warenkorb positionsübergreifend angewendet.",
      });
      continue;
    }
    applicable.push(promo);
  }

  const ranked = [...applicable].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    const da = promotionDiscount(a, resolvedUnitAmount, quantity);
    const db = promotionDiscount(b, resolvedUnitAmount, quantity);
    if (da !== db) return db - da;
    return a.id.localeCompare(b.id);
  });

  const appliedPromotions: AppliedPromotion[] = [];
  let discounts = 0;
  let shippingDiscountEligible = false;
  let runningSubtotal = subtotal;

  for (let i = 0; i < ranked.length; i += 1) {
    const promo = ranked[i]!;
    if (!promo.stackable && i > 0) break; // a non-stackable never joins a stack
    if (promo.type === "free_shipping") {
      shippingDiscountEligible = true;
      appliedPromotions.push({
        promotionId: promo.id,
        name: promo.name,
        code: promo.code,
        type: promo.type,
        stackable: promo.stackable,
        priority: promo.priority,
        discountMinor: 0,
      });
      explanation.push({
        label: `Gratisversand: ${promo.name}`,
        amountMinor: runningSubtotal,
        source: promo.id,
      });
      if (!promo.stackable) break;
      continue;
    }

    const unitNow = quantity > 0 ? runningSubtotal / quantity : 0;
    const discount = promotionDiscount(promo, unitNow, quantity);
    if (discount <= 0) continue;
    runningSubtotal = Math.max(0, runningSubtotal - discount);
    discounts += discount;
    appliedPromotions.push({
      promotionId: promo.id,
      name: promo.name,
      code: promo.code,
      type: promo.type,
      stackable: promo.stackable,
      priority: promo.priority,
      discountMinor: discount,
    });
    explanation.push({
      label: promo.code ? `Aktion ${promo.code}` : `Aktion: ${promo.name}`,
      amountMinor: runningSubtotal,
      deltaMinor: -discount,
      source: promo.id,
    });
    if (!promo.stackable) break;
  }

  const total = Math.max(0, runningSubtotal);
  explanation.push({ label: "Endpreis", amountMinor: total, source: "total" });

  return {
    currencyCode: currency,
    quantity,
    baseAmount,
    resolvedUnitAmount,
    subtotal,
    discounts,
    total,
    ...(baseAmount > resolvedUnitAmount ? { compareAtAmount: baseAmount } : {}),
    appliedPriceRules,
    rejectedPriceRules: rejected,
    appliedPromotions,
    pendingPromotions,
    shippingDiscountEligible,
    explanation,
  };
}
