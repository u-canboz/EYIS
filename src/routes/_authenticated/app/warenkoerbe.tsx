import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listCarts,
  getCartDetail,
  expireCheckoutSessions,
} from "@/lib/commerce/carts-admin.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { formatMoney } from "@/lib/commerce/money";
import type { CartStatus } from "@/lib/commerce/cart-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/warenkoerbe")({
  head: () => ({
    meta: [
      { title: "Warenkörbe & Checkouts – Commerce OS" },
      {
        name: "description",
        content:
          "Aktive, abgebrochene und abgelaufene Warenkörbe, ihre unveränderbaren Preis-Snapshots und laufende Checkout-Sitzungen.",
      },
      { property: "og:title", content: "Warenkörbe & Checkouts – Commerce OS" },
      { property: "og:description", content: "Warenkorb- und Checkout-Zustände im Überblick." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CartsPage,
});

const STATUS_LABEL: Record<string, string> = {
  active: "Aktiv",
  checkout: "Im Checkout",
  completed: "Abgeschlossen",
  abandoned: "Abgebrochen",
  expired: "Abgelaufen",
};

function CartsPage() {
  const queryClient = useQueryClient();
  const { organizationId, shopId, can } = useActiveWorkspace();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [openCart, setOpenCart] = useState<string | null>(null);

  const list = useServerFn(listCarts);
  const detail = useServerFn(getCartDetail);
  const expire = useServerFn(expireCheckoutSessions);

  const carts = useQuery({
    queryKey: ["carts", organizationId, shopId, status, search],
    enabled: !!organizationId && !!shopId,
    queryFn: () =>
      list({
        data: {
          organizationId,
          shopId,
          status: status === "all" ? null : (status as CartStatus),
          search: search || null,
        },
      }),
  });

  const cartDetail = useQuery({
    queryKey: ["cart-detail", openCart],
    enabled: !!openCart,
    queryFn: () => detail({ data: { organizationId, cartId: openCart! } }),
  });

  const expireMutation = useMutation({
    mutationFn: () => expire({ data: { organizationId } }),
    onSuccess: (r) => {
      toast.success(`${r.expired_sessions} Sitzung(en) abgelaufen, Reservierungen freigegeben.`);
      queryClient.invalidateQueries({ queryKey: ["carts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Warenkörbe & Checkouts</h1>
          <p className="text-muted-foreground text-sm">
            Jeder Warenkorb hat unveränderbare, versionierte Preis-Snapshots inklusive
            Engine-Version.
          </p>
        </div>
        {can("checkout.manage") && (
          <Button
            variant="outline"
            onClick={() => expireMutation.mutate()}
            disabled={expireMutation.isPending}
          >
            Abgelaufene Sitzungen aufräumen
          </Button>
        )}
      </header>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="E-Mail suchen"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {carts.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !carts.data?.length ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          Noch keine Warenkörbe. Über die Test-Storefront kannst du einen anlegen.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Warenkorb</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">E-Mail</th>
                <th className="p-3 font-medium">Positionen</th>
                <th className="p-3 font-medium">Summe</th>
                <th className="p-3 font-medium">Aktualisiert</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {carts.data.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-3 font-mono text-xs">{c.id.slice(0, 8)}…</td>
                  <td className="p-3">
                    <Badge variant={c.status === "active" ? "default" : "secondary"}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </Badge>
                    {c.hasOpenCheckout && (
                      <Badge variant="outline" className="ml-2">
                        Checkout offen
                      </Badge>
                    )}
                  </td>
                  <td className="p-3">{c.email ?? "—"}</td>
                  <td className="p-3">{c.itemCount}</td>
                  <td className="p-3">{formatMoney(c.totalMinor, c.currencyCode)}</td>
                  <td className="text-muted-foreground p-3 text-xs">
                    {new Date(c.updatedAt).toLocaleString("de-DE")}
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => setOpenCart(c.id)}>
                      Details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!openCart} onOpenChange={(open) => !open && setOpenCart(null)}>
        <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Warenkorb-Details</DialogTitle>
          </DialogHeader>
          {cartDetail.isLoading ? (
            <Skeleton className="h-60 w-full" />
          ) : cartDetail.data ? (
            <div className="space-y-6 text-sm">
              <section>
                <h3 className="mb-2 font-medium">Positionen</h3>
                <ul className="space-y-1">
                  {(cartDetail.data.items as Record<string, unknown>[]).map((i) => (
                    <li key={i["id"] as string} className="flex justify-between">
                      <span>
                        {i["title_snapshot"] as string} · {i["variant_title_snapshot"] as string}
                      </span>
                      <span className="text-muted-foreground">× {i["quantity"] as number}</span>
                    </li>
                  ))}
                  {!(cartDetail.data.items as unknown[]).length && (
                    <li className="text-muted-foreground">Keine Positionen.</li>
                  )}
                </ul>
              </section>

              <section>
                <h3 className="mb-2 font-medium">Preis-Snapshots (unveränderbar)</h3>
                <div className="overflow-x-auto rounded border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="p-2">Version</th>
                        <th className="p-2">Zwischensumme</th>
                        <th className="p-2">Rabatt</th>
                        <th className="p-2">Versand</th>
                        <th className="p-2">Steuer</th>
                        <th className="p-2">Gesamt</th>
                        <th className="p-2">Engine</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cartDetail.data.snapshots as Record<string, unknown>[]).map((s) => (
                        <tr key={s["id"] as string} className="border-t">
                          <td className="p-2">v{s["version"] as number}</td>
                          <td className="p-2">{formatMoney(Number(s["subtotal_minor"]))}</td>
                          <td className="p-2">−{formatMoney(Number(s["discount_minor"]))}</td>
                          <td className="p-2">{formatMoney(Number(s["shipping_minor"]))}</td>
                          <td className="p-2">{formatMoney(Number(s["tax_minor"]))}</td>
                          <td className="p-2 font-medium">
                            {formatMoney(Number(s["total_minor"]))}
                          </td>
                          <td className="text-muted-foreground p-2">
                            {s["pricing_engine_version"] as string}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h3 className="mb-2 font-medium">Checkout-Sitzungen</h3>
                <ul className="space-y-1">
                  {(cartDetail.data.sessions as Record<string, unknown>[]).map((s) => (
                    <li key={s["id"] as string} className="flex justify-between">
                      <span className="font-mono text-xs">{(s["id"] as string).slice(0, 8)}…</span>
                      <span>
                        {s["status"] as string} · gültig bis{" "}
                        {new Date(s["expires_at"] as string).toLocaleString("de-DE")}
                      </span>
                    </li>
                  ))}
                  {!(cartDetail.data.sessions as unknown[]).length && (
                    <li className="text-muted-foreground">Keine Sitzungen.</li>
                  )}
                </ul>
              </section>

              {cartDetail.data.codes.length > 0 && (
                <section>
                  <h3 className="mb-2 font-medium">Aktionscodes</h3>
                  <div className="flex gap-2">
                    {cartDetail.data.codes.map((c) => (
                      <Badge key={c} variant="outline">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
