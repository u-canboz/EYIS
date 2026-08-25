import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCommerce } from "@/lib/store-sdk/react/provider";
import { useCustomer, useCustomerOrders, commerceKeys } from "@/lib/store-sdk/react/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/store/konto")({
  head: () => ({
    meta: [
      { title: "Kundenkonto – Referenz-Storefront" },
      {
        name: "description",
        content: "Anmeldung und Bestellübersicht über den Store-Auth-Wrapper der öffentlichen API.",
      },
      { property: "og:title", content: "Kundenkonto – Referenz-Storefront" },
      { property: "og:description", content: "Bestellungen und Kontodaten der Referenz-Storefront." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StoreAccountPage,
});

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: currency || "EUR" }).format(minor / 100);

function StoreAccountPage() {
  const client = useCommerce();
  const queryClient = useQueryClient();
  const customer = useCustomer();
  const orders = useCustomerOrders();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["commerce", "customer"] });

  if (!customer.data) {
    return (
      <div className="mx-auto max-w-sm space-y-4">
        <h1 className="font-display text-2xl font-semibold">Anmelden</h1>
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            try {
              await client.customer.login({ email, password });
              await refresh();
              toast.success("Angemeldet.");
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div>
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            Anmelden
          </Button>
        </form>
        <Button
          variant="ghost"
          className="w-full"
          disabled={!email || busy}
          onClick={async () => {
            await client.customer.requestPasswordReset(email);
            toast.success("Falls ein Konto existiert, wurde eine E-Mail versendet.");
          }}
        >
          Passwort vergessen
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Meine Bestellungen</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            client.customer.logout();
            queryClient.setQueryData(commerceKeys.customer, null);
            await refresh();
          }}
        >
          Abmelden
        </Button>
      </div>

      {(orders.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Bestellungen.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {(orders.data ?? []).map((order) => (
            <li key={order.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-medium">{order.orderNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(order.placedAt).toLocaleDateString("de-DE")} · {order.paymentStatus}
                </p>
              </div>
              <span>{money(order.totalMinor, order.currencyCode)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
