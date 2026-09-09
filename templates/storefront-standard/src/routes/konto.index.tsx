import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCommerce } from "@/lib/store-sdk/react/provider";
import { commerceKeys, useCustomer, useCustomerOrders } from "@/lib/store-sdk/react/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, Skeleton } from "@/components/store/StateBlocks";
import { formatDate, formatMoney } from "@/lib/storefront/money";
import { errorMessage } from "@/lib/storefront/errors";

export const Route = createFileRoute("/konto/")({
  head: () => ({
    meta: [
      { title: "Kundenkonto | Hauptshop" },
      { name: "description", content: "Bestellungen ansehen, Rechnungen laden und Konto verwalten." },
      { property: "og:title", content: "Kundenkonto | Hauptshop" },
      { property: "og:description", content: "Bestellungen ansehen und Konto verwalten." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const customer = useCustomer();

  if (customer.isPending) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-5 py-24">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!customer.data) return <AuthPanel />;

  return <AccountOverview name={customer.data.firstName ?? customer.data.email} />;
}

function AuthPanel() {
  const client = useCommerce();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        await client.customer.login({ email, password });
      } else {
        const result = await client.customer.register({ email, password, firstName, lastName });
        if (!result.sessionActive) {
          toast.success("Bitte bestätige zuerst deine E-Mail-Adresse.");
        }
      }
      await queryClient.invalidateQueries({ queryKey: commerceKeys.customer });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-5 py-24">
      <h1 className="text-3xl">{mode === "login" ? "Anmelden" : "Konto anlegen"}</h1>
      <form className="mt-8 grid gap-4" onSubmit={submit}>
        {mode === "register" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="firstName">Vorname</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Nachname</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="login-email">E-Mail</Label>
          <Input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="login-password">Passwort</Label>
          <Input
            id="login-password"
            type="password"
            required
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" size="lg" disabled={busy}>
          {mode === "login" ? "Anmelden" : "Konto anlegen"}
        </Button>
      </form>

      <div className="mt-6 space-y-2 text-sm text-muted-foreground">
        <button
          type="button"
          className="underline underline-offset-4"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Noch kein Konto? Jetzt anlegen" : "Ich habe bereits ein Konto"}
        </button>
        <br />
        <button
          type="button"
          className="underline underline-offset-4"
          onClick={async () => {
            if (!email) {
              toast.error("Bitte zuerst die E-Mail-Adresse eintragen.");
              return;
            }
            try {
              await client.customer.requestPasswordReset(email);

              toast.success("Wenn ein Konto existiert, ist die E-Mail unterwegs.");
            } catch (error) {
              toast.error(errorMessage(error));
            }
          }}
        >
          Passwort vergessen
        </button>
        <br />
        <Link to="/bestellung/gast" className="underline underline-offset-4">
          Bestellung ohne Konto ansehen
        </Link>
      </div>
    </div>
  );
}

function AccountOverview({ name }: { name: string }) {
  const client = useCommerce();
  const queryClient = useQueryClient();
  const orders = useCustomerOrders();

  return (
    <div className="mx-auto max-w-4xl px-5 py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl">Hallo {name}</h1>
        <Button
          variant="outline"
          onClick={async () => {
            client.customer.logout();
            await queryClient.invalidateQueries({ queryKey: ["commerce", "customer"] });
          }}
        >
          Abmelden
        </Button>
      </div>

      <h2 className="mt-12 text-lg">Bestellungen</h2>
      {orders.isPending ? (
        <Skeleton className="mt-4 h-32 w-full" />
      ) : orders.isError ? (
        <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
      ) : !orders.data || orders.data.length === 0 ? (
        <EmptyState title="Noch keine Bestellungen" hint="Deine Bestellungen erscheinen hier." />
      ) : (
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {orders.data.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <Link
                  to="/konto/bestellung/$id"
                  params={{ id: order.id }}
                  className="underline underline-offset-4"
                >
                  Bestellung {order.orderNumber}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {formatDate(order.placedAt)} · {order.itemCount} Artikel · {order.fulfillmentStatus}
                </p>
              </div>
              <span className="text-sm tabular-nums">
                {formatMoney(order.totalMinor, order.currencyCode)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
