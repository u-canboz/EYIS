import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCommerce } from "@/lib/store-sdk/react/provider";
import { useCustomer, useCustomerOrders, commerceKeys } from "@/lib/store-sdk/react/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  StoreContainer,
  StoreHeading,
  StoreNotice,
  formatPrice,
} from "@/components/storefront/StoreChrome";

export const Route = createFileRoute("/store/konto")({
  head: () => ({
    meta: [
      { title: "Kundenkonto – Referenz-Storefront" },
      {
        name: "description",
        content: "Anmeldung und Bestellübersicht über den Store-Auth-Wrapper der öffentlichen API.",
      },
      { property: "og:title", content: "Kundenkonto – Referenz-Storefront" },
      {
        property: "og:description",
        content: "Bestellungen und Kontodaten der Referenz-Storefront.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StoreAccountPage,
});

function StoreAccountPage() {
  const client = useCommerce();
  const queryClient = useQueryClient();
  const customer = useCustomer();
  const orders = useCustomerOrders();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["commerce", "customer"] });

  if (customer.isLoading)
    return (
      <StoreContainer className="py-8 sm:py-12">
        <StoreHeading title="Konto" />
        <div className="mt-7 space-y-3">
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </StoreContainer>
    );

  if (!customer.data) {
    return (
      <StoreContainer className="py-8 sm:py-12">
        <StoreHeading eyebrow="Konto" title="Anmelden" />
        <form
          className="mt-7 min-w-0 space-y-4"
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
          <div className="min-w-0">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              className="mt-1.5 h-11"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="min-w-0">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              type="password"
              className="mt-1.5 h-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
            Anmelden
          </Button>
        </form>
        <Button
          variant="ghost"
          className="mt-2 h-11 w-full"
          disabled={!email || busy}
          onClick={async () => {
            await client.customer.requestPasswordReset(email);
            toast.success("Falls ein Konto existiert, wurde eine E-Mail versendet.");
          }}
        >
          Passwort vergessen
        </Button>
      </StoreContainer>
    );
  }

  return (
    <StoreContainer className="py-8 sm:py-12">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <StoreHeading title="Meine Bestellungen" />
        <Button
          variant="outline"
          className="h-11 shrink-0"
          onClick={async () => {
            client.customer.logout();
            queryClient.setQueryData(commerceKeys.customer, null);
            await refresh();
          }}
        >
          Abmelden
        </Button>
      </div>

      {orders.isLoading ? (
        <div className="mt-7 space-y-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : orders.error ? (
        <div className="mt-7">
          <StoreNotice
            tone="error"
            title="Bestellungen konnten nicht geladen werden"
            description={(orders.error as Error).message}
          />
        </div>
      ) : (orders.data ?? []).length === 0 ? (
        <div className="mt-7">
          <StoreNotice
            title="Noch keine Bestellungen"
            description="Sobald du eine Bestellung aufgibst, erscheint sie hier."
            action={
              <Button asChild className="mt-2 h-11">
                <Link to="/store">Zur Kollektion</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="mt-7 min-w-0 divide-y divide-border rounded-2xl border border-border">
          {(orders.data ?? []).map((order) => (
            <li
              key={order.id}
              className="flex min-w-0 items-center justify-between gap-3 p-4 text-sm"
            >
              <div className="min-w-0">
                <p className="min-w-0 font-medium break-words">{order.orderNumber}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(order.placedAt).toLocaleDateString("de-DE")} · {order.paymentStatus}
                </p>
              </div>
              <span className="shrink-0 tabular-nums">
                {formatPrice(order.totalMinor, order.currencyCode)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </StoreContainer>
  );
}
