import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listPromotions,
  savePromotion,
  setPromotionStatus,
  deletePromotion,
} from "@/lib/commerce/promotions.functions";
import { listCustomerGroups } from "@/lib/commerce/customer-groups.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { formatMoney, formatPercentBp, parseMoneyToMinor, PROMOTION_TYPE_LABELS } from "@/lib/commerce/money";
import type { PromotionCondition, PromotionType } from "@/lib/commerce/pricing-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/marketing/promotions")({
  head: () => ({
    meta: [
      { title: "Promotions & Gutscheine – Commerce OS" },
      {
        name: "description",
        content:
          "Rabatte, Gutscheincodes und Aktionen mit Bedingungen, Laufzeit und Priorität verwalten.",
      },
      { property: "og:title", content: "Promotions & Gutscheine – Commerce OS" },
      { property: "og:description", content: "Aktionen zentral steuern und kombinierbar halten." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PromotionsPage,
});

const TYPES: PromotionType[] = ["percentage", "fixed_amount", "fixed_price", "free_shipping", "buy_x_get_y"];

type FormState = {
  name: string;
  description: string;
  code: string;
  type: PromotionType;
  value: string;
  startsAt: string;
  endsAt: string;
  stackable: boolean;
  priority: string;
  usageLimit: string;
  usageLimitPerCustomer: string;
  minimumSubtotal: string;
  minimumQuantity: string;
  customerGroupId: string;
};

const EMPTY: FormState = {
  name: "",
  description: "",
  code: "",
  type: "percentage",
  value: "10",
  startsAt: "",
  endsAt: "",
  stackable: true,
  priority: "0",
  usageLimit: "",
  usageLimitPerCustomer: "",
  minimumSubtotal: "",
  minimumQuantity: "",
  customerGroupId: "none",
};

function PromotionsPage() {
  const queryClient = useQueryClient();
  const { organizationId, shopId, shops, can } = useActiveWorkspace();
  const currency = shops[0]?.currency ?? "EUR";
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchPromotions = useServerFn(listPromotions);
  const fetchGroups = useServerFn(listCustomerGroups);
  const runSave = useServerFn(savePromotion);
  const runStatus = useServerFn(setPromotionStatus);
  const runDelete = useServerFn(deletePromotion);

  const enabled = Boolean(organizationId && shopId);
  const promotionsQuery = useQuery({
    queryKey: ["promotions", organizationId, shopId],
    enabled,
    queryFn: () => fetchPromotions({ data: { organizationId, shopId } }),
  });
  const groupsQuery = useQuery({
    queryKey: ["customer-groups", organizationId, shopId],
    enabled,
    queryFn: () => fetchGroups({ data: { organizationId, shopId } }),
  });

  const canManage = can("promotions.manage");
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["promotions"] });

  const saveMutation = useMutation({
    mutationFn: () => {
      let value = 0;
      if (form.type === "percentage") {
        const pct = Number(form.value.replace(",", "."));
        if (!Number.isFinite(pct) || pct <= 0) throw new Error("Bitte gib einen gültigen Prozentwert an.");
        value = Math.round(pct * 100);
      } else if (form.type === "free_shipping") {
        value = 0;
      } else if (form.type === "buy_x_get_y") {
        const qty = Number(form.value);
        if (!Number.isInteger(qty) || qty <= 0) throw new Error("Bitte gib eine gültige Gratis-Menge an.");
        value = qty;
      } else {
        const minor = parseMoneyToMinor(form.value, currency);
        if (minor === null || minor <= 0) throw new Error("Bitte gib einen gültigen Betrag an.");
        value = minor;
      }

      const conditions: PromotionCondition[] = [];
      if (form.minimumSubtotal.trim()) {
        const minor = parseMoneyToMinor(form.minimumSubtotal, currency);
        if (minor === null || minor <= 0) throw new Error("Mindestbestellwert ist ungültig.");
        conditions.push({ kind: "minimum_subtotal", value: minor });
      }
      if (form.minimumQuantity.trim()) {
        const qty = Number(form.minimumQuantity);
        if (!Number.isInteger(qty) || qty <= 0) throw new Error("Mindestmenge ist ungültig.");
        conditions.push({ kind: "minimum_quantity", value: qty });
      }
      if (form.customerGroupId !== "none") {
        conditions.push({ kind: "customer_group", ids: [form.customerGroupId] });
      }

      return runSave({
        data: {
          organizationId,
          shopId,
          promotion: {
            ...(editingId ? { id: editingId } : {}),
            name: form.name,
            description: form.description || null,
            code: form.code || null,
            type: form.type,
            value,
            currencyCode: form.type === "fixed_amount" || form.type === "fixed_price" ? currency : null,
            startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
            endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
            usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
            usageLimitPerCustomer: form.usageLimitPerCustomer
              ? Number(form.usageLimitPerCustomer)
              : null,
            priority: Number(form.priority) || 0,
            stackable: form.stackable,
            conditions,
          },
        },
      });
    },
    onSuccess: () => {
      toast.success("Promotion gespeichert.");
      setForm(EMPTY);
      setEditingId(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { promotionId: string; status: "active" | "inactive" }) =>
      runStatus({ data: { organizationId, ...input } }),
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (promotionId: string) => runDelete({ data: { organizationId, promotionId } }),
    onSuccess: () => {
      toast.success("Promotion gelöscht.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const describeValue = (type: string, value: number) => {
    if (type === "percentage") return formatPercentBp(value);
    if (type === "free_shipping") return "Versandkosten";
    if (type === "buy_x_get_y") return `${value} gratis`;
    return formatMoney(value, currency);
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-semibold">Promotions & Gutscheine</h1>
        <p className="text-sm text-muted-foreground">
          Aktionen greifen nach der Preisauflösung. Buy X Get Y und Limits pro Kunde sind
          modelliert, aber erst mit Warenkorb und Bestellungen wirksam.
        </p>
      </header>

      <section className="rounded-lg border bg-card p-6">
        <p className="font-medium">Bestehende Aktionen</p>
        {promotionsQuery.isLoading ? (
          <Skeleton className="mt-4 h-32 w-full" />
        ) : (promotionsQuery.data?.promotions ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Noch keine Aktionen angelegt.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {promotionsQuery.data!.promotions.map((promo) => (
              <div
                key={promo.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {promo.name}
                    {promo.code && (
                      <span className="ml-2 rounded bg-muted px-2 py-0.5 font-mono text-xs">
                        {promo.code}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {PROMOTION_TYPE_LABELS[promo.type] ?? promo.type} ·{" "}
                    {describeValue(promo.type, promo.value)} · Priorität {promo.priority} ·{" "}
                    {promo.stackable ? "kombinierbar" : "exklusiv"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {(promo.type === "buy_x_get_y" || promo.usage_limit_per_customer) && (
                    <Badge variant="outline">Vorbereitet</Badge>
                  )}
                  <Badge variant={promo.status === "active" ? "default" : "secondary"}>
                    {promo.status === "active" ? "aktiv" : promo.status}
                  </Badge>
                  {canManage && (
                    <>
                      <Switch
                        checked={promo.status === "active"}
                        onCheckedChange={(checked) =>
                          statusMutation.mutate({
                            promotionId: promo.id,
                            status: checked ? "active" : "inactive",
                          })
                        }
                        aria-label="Aktion aktivieren"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(promo.id)}
                      >
                        Löschen
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {canManage && (
        <section className="rounded-lg border bg-card p-6">
          <p className="font-medium">{editingId ? "Aktion bearbeiten" : "Neue Aktion"}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>Name</Label>
              <Input className="mt-2" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div>
              <Label>Gutscheincode (optional)</Label>
              <Input
                className="mt-2"
                value={form.code}
                onChange={(e) => set("code", e.target.value)}
                placeholder="ohne Code = automatisch"
              />
            </div>
            <div>
              <Label>Art</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v as PromotionType)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {PROMOTION_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.type !== "free_shipping" && (
              <div>
                <Label>
                  {form.type === "percentage"
                    ? "Prozent"
                    : form.type === "buy_x_get_y"
                      ? "Gratis-Menge"
                      : "Betrag"}
                </Label>
                <Input className="mt-2" value={form.value} onChange={(e) => set("value", e.target.value)} />
              </div>
            )}
            <div>
              <Label>Start</Label>
              <Input
                className="mt-2"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => set("startsAt", e.target.value)}
              />
            </div>
            <div>
              <Label>Ende</Label>
              <Input
                className="mt-2"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => set("endsAt", e.target.value)}
              />
            </div>
            <div>
              <Label>Mindestbestellwert</Label>
              <Input
                className="mt-2"
                value={form.minimumSubtotal}
                onChange={(e) => set("minimumSubtotal", e.target.value)}
                placeholder="z. B. 50,00"
              />
            </div>
            <div>
              <Label>Mindestmenge</Label>
              <Input
                className="mt-2"
                value={form.minimumQuantity}
                onChange={(e) => set("minimumQuantity", e.target.value)}
              />
            </div>
            <div>
              <Label>Kundengruppe</Label>
              <Select value={form.customerGroupId} onValueChange={(v) => set("customerGroupId", v)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Alle</SelectItem>
                  {(groupsQuery.data?.groups ?? []).map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priorität</Label>
              <Input
                className="mt-2"
                value={form.priority}
                onChange={(e) => set("priority", e.target.value)}
              />
            </div>
            <div>
              <Label>Nutzungslimit gesamt</Label>
              <Input
                className="mt-2"
                value={form.usageLimit}
                onChange={(e) => set("usageLimit", e.target.value)}
              />
            </div>
            <div>
              <Label>Limit pro Kunde (vorbereitet)</Label>
              <Input
                className="mt-2"
                value={form.usageLimitPerCustomer}
                onChange={(e) => set("usageLimitPerCustomer", e.target.value)}
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <Label>Beschreibung</Label>
              <Textarea
                className="mt-2"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.stackable}
                onCheckedChange={(checked) => set("stackable", checked)}
                id="stackable"
              />
              <Label htmlFor="stackable">Mit anderen Aktionen kombinierbar</Label>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button disabled={!form.name.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              Speichern
            </Button>
            {editingId && (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY);
                }}
              >
                Abbrechen
              </Button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
