import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { resolvePrice } from "@/lib/commerce/pricing.functions";
import { listCustomerGroups } from "@/lib/commerce/customer-groups.functions";
import { listProducts, getProduct } from "@/lib/commerce/products.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { formatMoney, PRICE_TYPE_LABELS, PROMOTION_TYPE_LABELS } from "@/lib/commerce/money";
import type { PricingResult } from "@/lib/commerce/pricing-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/preise/testen")({
  head: () => ({
    meta: [
      { title: "Preis testen – Commerce OS" },
      {
        name: "description",
        content:
          "Simuliere den finalen Preis für Produkt, Menge, Kundengruppe und Gutscheincode – mit vollständiger Erklärung.",
      },
      { property: "og:title", content: "Preis testen – Commerce OS" },
      {
        property: "og:description",
        content: "Nachvollziehbare Preisberechnung mit allen angewendeten Regeln.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PricingPreviewPage,
});

function PricingPreviewPage() {
  const { organizationId, shopId, shops } = useActiveWorkspace();
  const currency = shops[0]?.currency ?? "EUR";

  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("all");
  const [quantity, setQuantity] = useState("1");
  const [groupId, setGroupId] = useState("none");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<PricingResult | null>(null);

  const fetchProducts = useServerFn(listProducts);
  const fetchProduct = useServerFn(getProduct);
  const fetchGroups = useServerFn(listCustomerGroups);
  const runResolve = useServerFn(resolvePrice);

  const enabled = Boolean(organizationId && shopId);

  const productsQuery = useQuery({
    queryKey: ["products-simple", organizationId, shopId],
    enabled,
    queryFn: () => fetchProducts({ data: { organizationId, shopId } }),
  });

  const groupsQuery = useQuery({
    queryKey: ["customer-groups", organizationId, shopId],
    enabled,
    queryFn: () => fetchGroups({ data: { organizationId, shopId } }),
  });

  const productQuery = useQuery({
    queryKey: ["product-detail", organizationId, productId],
    enabled: Boolean(organizationId && productId),
    queryFn: () => fetchProduct({ data: { productId } }),
  });

  useEffect(() => {
    setVariantId("all");
    setResult(null);
  }, [productId]);

  const resolveMutation = useMutation({
    mutationFn: () =>
      runResolve({
        data: {
          organizationId,
          shopId,
          productId,
          variantId: variantId === "all" ? null : variantId,
          quantity: Math.max(1, Number(quantity) || 1),
          currencyCode: currency,
          customerGroupId: groupId === "none" ? null : groupId,
          promotionCodes: code.trim() ? [code.trim()] : [],
        },
      }),
    onSuccess: (data) => setResult(data),
    onError: (error: Error) => toast.error(error.message),
  });

  const variants = productQuery.data?.variants ?? [];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-semibold">Preis testen</h1>
        <p className="text-sm text-muted-foreground">
          Dieselbe Engine, die später Warenkorb und Checkout nutzen – inklusive Begründung jeder
          Regel.
        </p>
      </header>

      <section className="rounded-lg border bg-card p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Produkt</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Produkt wählen" />
              </SelectTrigger>
              <SelectContent>
                {(productsQuery.data?.items ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Variante</Label>
            <Select value={variantId} onValueChange={setVariantId} disabled={!variants.length}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Ohne Variante</SelectItem>
                {variants.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Menge</Label>
            <Input
              className="mt-2"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div>
            <Label>Kundengruppe</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine</SelectItem>
                {(groupsQuery.data?.groups ?? []).map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Gutscheincode</Label>
            <Input
              className="mt-2"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="optional"
            />
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              disabled={!productId || resolveMutation.isPending}
              onClick={() => resolveMutation.mutate()}
            >
              Preis berechnen
            </Button>
          </div>
        </div>
      </section>

      {result && (
        <section className="grid gap-6 lg:grid-cols-[2fr_3fr]">
          <div className="rounded-lg border bg-card p-6">
            <p className="font-medium">Ergebnis</p>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Normalpreis" value={formatMoney(result.baseAmount, result.currencyCode)} />
              <Row
                label="Aufgelöster Stückpreis"
                value={formatMoney(result.resolvedUnitAmount, result.currencyCode)}
              />
              <Row
                label={`Zwischensumme (${result.quantity} ×)`}
                value={formatMoney(result.subtotal, result.currencyCode)}
              />
              <Row
                label="Rabatte"
                value={`− ${formatMoney(result.discounts, result.currencyCode)}`}
              />
              <div className="flex items-center justify-between border-t pt-3">
                <dt className="font-medium">Endpreis</dt>
                <dd className="font-display text-xl font-semibold">
                  {formatMoney(result.total, result.currencyCode)}
                </dd>
              </div>
            </dl>
            {result.shippingDiscountEligible && (
              <Badge className="mt-4" variant="secondary">
                Gratisversand berechtigt
              </Badge>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-lg border bg-card p-6">
              <p className="font-medium">Erklärung</p>
              <ol className="mt-4 space-y-2 text-sm">
                {result.explanation.map((step, i) => (
                  <li key={i} className="flex items-center justify-between border-b pb-2">
                    <span>
                      {step.label}
                      <span className="ml-2 text-xs text-muted-foreground">{step.source}</span>
                    </span>
                    <span className="tabular-nums">
                      {step.deltaMinor !== undefined && step.deltaMinor !== 0
                        ? `${step.deltaMinor < 0 ? "−" : "+"} ${formatMoney(Math.abs(step.deltaMinor), result.currencyCode)}`
                        : formatMoney(step.amountMinor, result.currencyCode)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <p className="font-medium">Angewendete Regeln</p>
              <div className="mt-4 space-y-2 text-sm">
                {result.appliedPriceRules.map((rule) => (
                  <div key={rule.priceId} className="flex items-center justify-between">
                    <span>
                      {rule.label}
                      <Badge variant="secondary" className="ml-2">
                        {PRICE_TYPE_LABELS[rule.type] ?? rule.type}
                      </Badge>
                    </span>
                    <span>{formatMoney(rule.amountMinor, result.currencyCode)}</span>
                  </div>
                ))}
                {result.appliedPromotions.map((promo) => (
                  <div key={promo.promotionId} className="flex items-center justify-between">
                    <span>
                      {promo.name}
                      <Badge variant="secondary" className="ml-2">
                        {PROMOTION_TYPE_LABELS[promo.type] ?? promo.type}
                      </Badge>
                    </span>
                    <span>− {formatMoney(promo.discountMinor, result.currencyCode)}</span>
                  </div>
                ))}
              </div>

              {result.pendingPromotions.length > 0 && (
                <div className="mt-4 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Vorbereitet, noch nicht anwendbar</p>
                  {result.pendingPromotions.map((promo) => (
                    <p key={promo.promotionId} className="mt-1">
                      {promo.name} – benötigt Warenkorb bzw. Bestellungen (Phase 3+).
                    </p>
                  ))}
                </div>
              )}

              {result.rejectedPriceRules.length > 0 && (
                <details className="mt-4 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">
                    Nicht angewendete Preisregeln ({result.rejectedPriceRules.length})
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {result.rejectedPriceRules.map((r) => (
                      <li key={r.priceId}>{r.reason}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
