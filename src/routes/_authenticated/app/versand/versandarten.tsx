import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listShippingMethodsAdmin,
  saveShippingMethod,
  deleteShippingMethod,
} from "@/lib/commerce/shipping.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { formatMoney, minorToInput, parseMoneyToMinor } from "@/lib/commerce/money";
import type { ShippingMethodView } from "@/lib/commerce/cart-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/versand")({
  head: () => ({
    meta: [
      { title: "Versandarten – Commerce OS" },
      {
        name: "description",
        content: "Versandarten je Shop pflegen: Festpreis oder gratis, Länder, Mindestbestellwert und Gratis-ab-Grenze.",
      },
      { property: "og:title", content: "Versandarten – Commerce OS" },
      { property: "og:description", content: "Versandoptionen für den Checkout verwalten." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShippingPage,
});

type Draft = {
  id: string | null;
  name: string;
  code: string;
  description: string;
  pricingType: "fixed" | "free";
  amount: string;
  countries: string;
  freeAbove: string;
  minSubtotal: string;
  position: string;
  status: "active" | "inactive" | "archived";
};

const EMPTY: Draft = {
  id: null,
  name: "",
  code: "",
  description: "",
  pricingType: "fixed",
  amount: "4,90",
  countries: "DE, AT, CH",
  freeAbove: "",
  minSubtotal: "",
  position: "0",
  status: "active",
};

function ShippingPage() {
  const queryClient = useQueryClient();
  const { organizationId, shopId, shopCurrency, can } = useActiveWorkspace();
  const currency = shopCurrency ?? "EUR";
  const [draft, setDraft] = useState<Draft | null>(null);

  const list = useServerFn(listShippingMethodsAdmin);
  const save = useServerFn(saveShippingMethod);
  const remove = useServerFn(deleteShippingMethod);

  const methods = useQuery({
    queryKey: ["shipping-methods", organizationId, shopId],
    enabled: !!organizationId && !!shopId,
    queryFn: () => list({ data: { organizationId: organizationId!, shopId: shopId! } }),
  });

  const saveMutation = useMutation({
    mutationFn: (d: Draft) =>
      save({
        data: {
          organizationId: organizationId!,
          shopId: shopId!,
          id: d.id,
          name: d.name,
          code: d.code,
          description: d.description || null,
          pricingType: d.pricingType,
          amountMinor: parseMoneyToMinor(d.amount || "0", currency) ?? 0,
          currencyCode: currency,
          countries: d.countries.split(",").map((c) => c.trim()).filter(Boolean),
          freeAboveMinor: d.freeAbove ? parseMoneyToMinor(d.freeAbove, currency) : null,
          minSubtotalMinor: d.minSubtotal ? parseMoneyToMinor(d.minSubtotal, currency) : null,
          position: Number(d.position) || 0,
          status: d.status,
        },
      }),
    onSuccess: () => {
      toast.success("Versandart gespeichert.");
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["shipping-methods"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { organizationId: organizationId!, id } }),
    onSuccess: () => {
      toast.success("Versandart archiviert.");
      queryClient.invalidateQueries({ queryKey: ["shipping-methods"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toDraft = (m: ShippingMethodView): Draft => ({
    id: m.id,
    name: m.name,
    code: m.code,
    description: m.description ?? "",
    pricingType: m.pricingType,
    amount: minorToInput(m.amountMinor, m.currencyCode),
    countries: m.countries.join(", "),
    freeAbove: m.freeAboveMinor === null ? "" : minorToInput(m.freeAboveMinor, m.currencyCode),
    minSubtotal: m.minSubtotalMinor === null ? "" : minorToInput(m.minSubtotalMinor, m.currencyCode),
    position: String(m.position),
    status: m.status as Draft["status"],
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Versandarten</h1>
          <p className="text-muted-foreground text-sm">
            Versandoptionen, die im Checkout zur Auswahl stehen. Beträge in {currency}.
          </p>
        </div>
        {can("shipping_methods.manage") && (
          <Button onClick={() => setDraft({ ...EMPTY })}>Versandart anlegen</Button>
        )}
      </header>

      {methods.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !methods.data?.length ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Noch keine Versandarten. Ohne Versandart kann kein Checkout validiert werden.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Code</th>
                <th className="p-3 font-medium">Preis</th>
                <th className="p-3 font-medium">Gratis ab</th>
                <th className="p-3 font-medium">Länder</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {methods.data.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="p-3 font-medium">{m.name}</td>
                  <td className="text-muted-foreground p-3 font-mono text-xs">{m.code}</td>
                  <td className="p-3">
                    {m.pricingType === "free" ? "Gratis" : formatMoney(m.amountMinor, m.currencyCode)}
                  </td>
                  <td className="p-3">
                    {m.freeAboveMinor === null ? "—" : formatMoney(m.freeAboveMinor, m.currencyCode)}
                  </td>
                  <td className="p-3">{m.countries.length ? m.countries.join(", ") : "Alle"}</td>
                  <td className="p-3">
                    <Badge variant={m.status === "active" ? "default" : "secondary"}>{m.status}</Badge>
                  </td>
                  <td className="p-3 text-right">
                    {can("shipping_methods.manage") && (
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setDraft(toDraft(m))}>
                          Bearbeiten
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => removeMutation.mutate(m.id)}>
                          Archivieren
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

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Versandart bearbeiten" : "Versandart anlegen"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Code</Label>
                  <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Art</Label>
                  <Select
                    value={draft.pricingType}
                    onValueChange={(v) => setDraft({ ...draft, pricingType: v as "fixed" | "free" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Festpreis</SelectItem>
                      <SelectItem value="free">Gratis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Preis</Label>
                  <Input
                    value={draft.amount}
                    disabled={draft.pricingType === "free"}
                    onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Gratis ab (optional)</Label>
                  <Input
                    value={draft.freeAbove}
                    onChange={(e) => setDraft({ ...draft, freeAbove: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Mindestbestellwert</Label>
                  <Input
                    value={draft.minSubtotal}
                    onChange={(e) => setDraft({ ...draft, minSubtotal: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Position</Label>
                  <Input value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Länder (ISO-2, leer = alle)</Label>
                <Input value={draft.countries} onChange={(e) => setDraft({ ...draft, countries: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Beschreibung</Label>
                <Input
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
              <Button onClick={() => saveMutation.mutate(draft)} disabled={saveMutation.isPending}>
                Speichern
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
