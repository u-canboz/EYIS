import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCommerce } from "@/lib/store-sdk/react/provider";
import type { StoreCheckout, StoreShippingOption } from "@/lib/store-sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/store/checkout")({
  head: () => ({
    meta: [
      { title: "Kasse – Referenz-Storefront" },
      {
        name: "description",
        content: "Adresse, Versandart und Zahlung – vollständig über die öffentliche Store API.",
      },
      { property: "og:title", content: "Kasse – Referenz-Storefront" },
      { property: "og:description", content: "Checkout-Ablauf der Referenz-Storefront." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StoreCheckoutPage,
});

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: currency || "EUR" }).format(minor / 100);

const EMPTY_ADDRESS = {
  firstName: "",
  lastName: "",
  street: "",
  postalCode: "",
  city: "",
  countryCode: "DE",
};

function StoreCheckoutPage() {
  const client = useCommerce();
  const navigate = useNavigate();
  const [session, setSession] = useState<StoreCheckout | null>(null);
  const [options, setOptions] = useState<StoreShippingOption[]>([]);
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState({ ...EMPTY_ADDRESS });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    client.checkout
      .start(null)
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [client]);

  if (error)
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button asChild variant="outline">
          <Link to="/store/warenkorb">Zurück zum Warenkorb</Link>
        </Button>
      </div>
    );
  if (!session) return <Skeleton className="h-72 w-full" />;

  const submitAddress = async () => {
    setBusy(true);
    try {
      await client.checkout.setEmail(session.id, email);
      const updated = await client.checkout.setAddress(session.id, {
        type: "shipping",
        address,
        billingSameAsShipping: true,
      });
      setSession(updated);
      setOptions(await client.checkout.shippingOptions(session.id));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pay = async (shippingMethodId: string) => {
    setBusy(true);
    try {
      await client.checkout.setShippingOption(session.id, shippingMethodId);
      const validated = await client.checkout.validate(session.id);
      setSession(validated);
      const payment = await client.checkout.createPaymentSession(session.id, {
        returnUrl: `${window.location.origin}/store/bestaetigung`,
        cancelUrl: `${window.location.origin}/store/checkout`,
      });
      if (payment.redirectUrl) {
        window.sessionStorage.setItem("commerce.paymentSessionId", payment.id);
        window.location.href = payment.redirectUrl;
        return;
      }
      void navigate({ to: "/store/bestaetigung", search: { session: payment.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">Kasse</h1>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Kontakt & Lieferadresse</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {(
            [
              ["firstName", "Vorname"],
              ["lastName", "Nachname"],
              ["street", "Straße und Nr."],
              ["postalCode", "PLZ"],
              ["city", "Ort"],
              ["countryCode", "Land (ISO)"],
            ] as const
          ).map(([field, label]) => (
            <div key={field}>
              <Label htmlFor={field}>{label}</Label>
              <Input
                id={field}
                value={address[field]}
                onChange={(e) => setAddress((a) => ({ ...a, [field]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <Button onClick={submitAddress} disabled={busy || !email}>
          Weiter zum Versand
        </Button>
      </section>

      {options.length > 0 ? (
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-medium">Versandart & Zahlung</h2>
          {options.map((option) => (
            <div key={option.id} className="flex items-center justify-between gap-3 border-b py-2 last:border-0">
              <div>
                <p className="text-sm font-medium">{option.name}</p>
                <p className="text-xs text-muted-foreground">
                  {money(option.amountMinor, option.currencyCode)}
                </p>
              </div>
              <Button size="sm" disabled={busy} onClick={() => pay(option.id)}>
                Auswählen & bezahlen
              </Button>
            </div>
          ))}
        </section>
      ) : null}

      <dl className="space-y-1 rounded-lg border p-4 text-sm">
        <div className="flex justify-between font-medium">
          <dt>Gesamt</dt>
          <dd>{money(session.totals.totalMinor, session.currencyCode)}</dd>
        </div>
      </dl>
    </div>
  );
}
