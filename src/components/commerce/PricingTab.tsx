import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listProductPricing, savePrice, deletePrice, resolvePrice } from "@/lib/commerce/pricing.functions";
import { listCustomerGroups } from "@/lib/commerce/customer-groups.functions";
import { formatMoney, minorToInput, parseMoneyToMinor, PRICE_TYPE_LABELS } from "@/lib/commerce/money";
import type { PricingResult, PriceType } from "@/lib/commerce/pricing-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  productId: string;
  organizationId: string;
  shopId: string;
  currency: string;
  canEdit: boolean;
};

const TYPES: PriceType[] = ["base", "sale", "tier", "customer_group", "override"];

export function PricingTab({ productId, organizationId, shopId, currency, canEdit }: Props) {
  const queryClient = useQueryClient();
  const fetchPricing = useServerFn(listProductPricing);
  const fetchGroups = useServerFn(listCustomerGroups);
  const runSave = useServerFn(savePrice);
  const runDelete = useServerFn(deletePrice);
  const runResolve = useServerFn(resolvePrice);

  const [type, setType] = useState<PriceType>("base");
  const [variantId, setVariantId] = useState("product");
  const [amount, setAmount] = useState("");
  const [minQuantity, setMinQuantity] = useState("");
  const [maxQuantity, setMaxQuantity] = useState("");
  const [groupId, setGroupId] = useState("none");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PricingResult | null>(null);
  const [previewQty, setPreviewQty] = useState("1");

  const pricingQuery = useQuery({
    queryKey: ["product-pricing", organizationId, shopId, productId],
    enabled: Boolean(organizationId && shopId),
    queryFn: () => fetchPricing({ data: { organizationId, shopId, productId } }),
  });

  const groupsQuery = useQuery({
    queryKey: ["customer-groups", organizationId, shopId],
    enabled: Boolean(organizationId && shopId),
    queryFn: () => fetchGroups({ data: { organizationId, shopId } }),
  });

  const groupNames = new Map((groupsQuery.data?.groups ?? []).map((g) => [g.id, g.name]));
  const variants = pricingQuery.data?.variants ?? [];

  const reset = () => {
    setEditingId(null);
    setType("base");
    setVariantId("product");
    setAmount("");
    setMinQuantity("");
    setMaxQuantity("");
    setGroupId("none");
    setStartsAt("");
    setEndsAt("");
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const minor = parseMoneyToMinor(amount, currency);
      if (minor === null || minor < 0) throw new Error("Bitte gib einen gültigen Betrag an.");
      if (type === "customer_group" && groupId === "none")
        throw new Error("Ein Kundengruppenpreis braucht eine Kundengruppe.");
      if (type === "tier" && !minQuantity.trim())
        throw new Error("Eine Mengenstaffel braucht eine Mindestmenge.");
      return runSave({
        data: {
          organizationId,
          shopId,
          price: {
            ...(editingId ? { id: editingId } : {}),
            productId: variantId === "product" ? productId : null,
            variantId: variantId === "product" ? null : variantId,
            type,
            currencyCode: currency,
            amountMinor: minor,
            minQuantity: minQuantity ? Number(minQuantity) : null,
            maxQuantity: maxQuantity ? Number(maxQuantity) : null,
            customerGroupId: groupId === "none" ? null : groupId,
            startsAt: startsAt ? new Date(startsAt).toISOString() : null,
            endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          },
        },
      });
    },
    onSuccess: () => {
      toast.success("Preis gespeichert.");
      reset();
      queryClient.invalidateQueries({ queryKey: ["product-pricing"] });
      queryClient.invalidateQueries({ queryKey: ["price-overview"] });
      setPreview(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (priceId: string) => runDelete({ data: { organizationId, priceId } }),
    onSuccess: () => {
      toast.success("Preis gelöscht.");
      queryClient.invalidateQueries({ queryKey: ["product-pricing"] });
      queryClient.invalidateQueries({ queryKey: ["price-overview"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const previewMutation = useMutation({
    mutationFn: () =>
      runResolve({
        data: {
          organizationId,
          shopId,
          productId,
          variantId: variantId === "product" ? null : variantId,
          quantity: Math.max(1, Number(previewQty) || 1),
          currencyCode: currency,
        },
      }),
    onSuccess: setPreview,
    onError: (error: Error) => toast.error(error.message),
  });

  const prices = pricingQuery.data?.prices ?? [];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card p-6">
        <p className="font-medium">Preiszeilen</p>
        {pricingQuery.isLoading ? (
          <Skeleton className="mt-4 h-28 w-full" />
        ) : prices.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Noch kein Preis hinterlegt. Lege zuerst einen Normalpreis an.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2">Art</th>
                  <th className="py-2">Gilt für</th>
                  <th className="py-2">Menge</th>
                  <th className="py-2">Gruppe</th>
                  <th className="py-2">Zeitraum</th>
                  <th className="py-2 text-right">Betrag</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {prices.map((price) => (
                  <tr key={price.id} className="border-b">
                    <td className="py-2">
                      <Badge variant="secondary">{PRICE_TYPE_LABELS[price.type] ?? price.type}</Badge>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {price.variant_id
                        ? (variants.find((v) => v.id === price.variant_id)?.title ?? "Variante")
                        : "Ganzes Produkt"}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {price.min_quantity ? `ab ${price.min_quantity}` : "—"}
                      {price.max_quantity ? ` bis ${price.max_quantity}` : ""}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {price.customer_group_id
                        ? (groupNames.get(price.customer_group_id) ?? "Gruppe")
                        : "—"}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {price.starts_at || price.ends_at
                        ? `${price.starts_at ? new Date(price.starts_at).toLocaleDateString("de-DE") : "…"} – ${
                            price.ends_at ? new Date(price.ends_at).toLocaleDateString("de-DE") : "…"
                          }`
                        : "dauerhaft"}
                    </td>
                    <td className="py-2 text-right font-medium">
                      {formatMoney(price.amount_minor, price.currency_code)}
                    </td>
                    <td className="py-2 text-right">
                      {canEdit && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingId(price.id);
                              setType(price.type as PriceType);
                              setVariantId(price.variant_id ?? "product");
                              setAmount(minorToInput(price.amount_minor, price.currency_code));
                              setMinQuantity(price.min_quantity ? String(price.min_quantity) : "");
                              setMaxQuantity(price.max_quantity ? String(price.max_quantity) : "");
                              setGroupId(price.customer_group_id ?? "none");
                              setStartsAt(price.starts_at ? price.starts_at.slice(0, 16) : "");
                              setEndsAt(price.ends_at ? price.ends_at.slice(0, 16) : "");
                            }}
                          >
                            Bearbeiten
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(price.id)}
                          >
                            Löschen
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canEdit && (
        <section className="rounded-lg border bg-card p-6">
          <p className="font-medium">{editingId ? "Preis bearbeiten" : "Preis hinzufügen"}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>Art</Label>
              <Select value={type} onValueChange={(v) => setType(v as PriceType)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {PRICE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gilt für</Label>
              <Select value={variantId} onValueChange={setVariantId} disabled={Boolean(editingId)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Ganzes Produkt</SelectItem>
                  {variants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Betrag ({currency})</Label>
              <Input
                className="mt-2"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="29,90"
              />
            </div>
            {type === "customer_group" && (
              <div>
                <Label>Kundengruppe</Label>
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Bitte wählen</SelectItem>
                    {(groupsQuery.data?.groups ?? []).map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {type === "tier" && (
              <>
                <div>
                  <Label>Ab Menge</Label>
                  <Input
                    className="mt-2"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Bis Menge (optional)</Label>
                  <Input
                    className="mt-2"
                    value={maxQuantity}
                    onChange={(e) => setMaxQuantity(e.target.value)}
                  />
                </div>
              </>
            )}
            {type === "sale" && (
              <>
                <div>
                  <Label>Start</Label>
                  <Input
                    className="mt-2"
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Ende</Label>
                  <Input
                    className="mt-2"
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          <div className="mt-6 flex gap-3">
            <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              Speichern
            </Button>
            {editingId && (
              <Button variant="ghost" onClick={reset}>
                Abbrechen
              </Button>
            )}
          </div>
        </section>
      )}

      <section className="rounded-lg border bg-card p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="font-medium">Live-Vorschau</p>
            <p className="text-sm text-muted-foreground">
              Zeigt den Preis, den Kundinnen und Kunden aktuell sehen würden.
            </p>
          </div>
          <div className="ml-auto w-[120px]">
            <Label>Menge</Label>
            <Input
              className="mt-2"
              type="number"
              min={1}
              value={previewQty}
              onChange={(e) => setPreviewQty(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => previewMutation.mutate()}>
            Berechnen
          </Button>
        </div>

        {preview && (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="text-sm">
              <p className="font-display text-2xl font-semibold">
                {formatMoney(preview.total, preview.currencyCode)}
              </p>
              {preview.compareAtAmount && preview.compareAtAmount > preview.resolvedUnitAmount && (
                <p className="text-muted-foreground line-through">
                  {formatMoney(preview.compareAtAmount, preview.currencyCode)}
                </p>
              )}
              <p className="mt-2 text-muted-foreground">
                Stückpreis {formatMoney(preview.resolvedUnitAmount, preview.currencyCode)} ·{" "}
                {preview.quantity} Stück
              </p>
            </div>
            <ol className="space-y-1 text-sm">
              {preview.explanation.map((step, i) => (
                <li key={i} className="flex justify-between border-b pb-1">
                  <span>{step.label}</span>
                  <span className="tabular-nums">
                    {step.deltaMinor !== undefined && step.deltaMinor !== 0
                      ? `${step.deltaMinor < 0 ? "−" : "+"} ${formatMoney(Math.abs(step.deltaMinor), preview.currencyCode)}`
                      : formatMoney(step.amountMinor, preview.currencyCode)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}
