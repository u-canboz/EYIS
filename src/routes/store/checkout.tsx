import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useCommerce } from "@/lib/store-sdk/react/provider";
import type { StoreCheckout, StorePaymentMethod, StoreShippingOption } from "@/lib/store-sdk";
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

const EMPTY_ADDRESS = {
  firstName: "",
  lastName: "",
  street: "",
  postalCode: "",
  city: "",
  countryCode: "DE",
};

function StepHeading({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
        {step}
      </span>
      <h2 className="min-w-0 font-medium text-pretty">{title}</h2>
    </div>
  );
}

function StoreCheckoutPage() {
  const client = useCommerce();
  const navigate = useNavigate();
  const [session, setSession] = useState<StoreCheckout | null>(null);
  const [options, setOptions] = useState<StoreShippingOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<StorePaymentMethod[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState({ ...EMPTY_ADDRESS });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    client.checkout
      .start(null)
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [client]);

  if (error)
    return (
      <StoreContainer className="py-8 sm:py-12">
        <StoreHeading title="Kasse" />
        <div className="mt-6">
          <StoreNotice
            tone="error"
            title="Die Kasse konnte nicht geladen werden"
            description={error}
            action={
              <Button asChild variant="outline" className="mt-2 h-11">
                <Link to="/store/warenkorb">Zurück zum Warenkorb</Link>
              </Button>
            }
          />
        </div>
      </StoreContainer>
    );

  if (loading || !session)
    return (
      <StoreContainer className="py-8 sm:py-12">
        <StoreHeading title="Kasse" />
        <div className="mt-7 space-y-4">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </StoreContainer>
    );

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
      // Discover active payment methods — the storefront never hardcodes them.
      const methods = await client.paymentMethods();
      setPaymentMethods(methods);
      setPaymentMethodId((current) => current ?? methods[0]?.id ?? null);
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
      const method = paymentMethods.find((m) => m.id === paymentMethodId);
      const payment = await client.checkout.createPaymentSession(session.id, {
        returnUrl: `${window.location.origin}/store/bestaetigung`,
        cancelUrl: `${window.location.origin}/store/checkout`,
        provider: method?.provider ?? null,
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
    <StoreContainer className="py-6 sm:py-10">
      <Link
        to="/store/warenkorb"
        className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 shrink-0" aria-hidden />
        Warenkorb
      </Link>

      <StoreHeading className="mt-4" title="Kasse" />

      <div className="mt-7 space-y-5">
        <section className="min-w-0 space-y-4 rounded-2xl border border-border p-5">
          <StepHeading step={1} title="E-Mail & Adresse" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 sm:col-span-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                className="mt-1.5 h-11"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
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
              <div key={field} className="min-w-0">
                <Label htmlFor={field}>{label}</Label>
                <Input
                  id={field}
                  className="mt-1.5 h-11"
                  value={address[field]}
                  onChange={(e) => setAddress((a) => ({ ...a, [field]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <Button className="h-12 w-full text-base" onClick={submitAddress} disabled={busy || !email}>
            Weiter zum Versand
          </Button>
        </section>

        {options.length > 0 ? (
          <section className="min-w-0 space-y-4 rounded-2xl border border-border p-5">
            <StepHeading step={2} title="Versandart, Prüfung & Zahlung" />
            {paymentMethods.length > 0 ? (
              <fieldset className="min-w-0">
                <legend className="text-sm font-medium">Zahlungsart</legend>
                <div className="mt-2 grid gap-2">
                  {paymentMethods.map((method) => (
                    <label
                      key={method.id}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm has-checked:border-primary has-checked:bg-accent/40"
                    >
                      <input
                        type="radio"
                        name="payment-method"
                        className="size-4 accent-primary"
                        checked={paymentMethodId === method.id}
                        onChange={() => setPaymentMethodId(method.id)}
                      />
                      <span className="min-w-0 flex-1 text-pretty">{method.name}</span>
                      {method.environment === "test" ? (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          Testmodus
                        </span>
                      ) : null}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <p className="text-sm text-muted-foreground">
                Derzeit ist keine Zahlungsart aktiv. Bitte den Shopbetreiber kontaktieren.
              </p>
            )}
            <ul className="divide-y divide-border">
              {options.map((option) => (
                <li
                  key={option.id}
                  className="flex min-w-0 flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-pretty">{option.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatPrice(option.amountMinor, option.currencyCode)}
                    </p>
                  </div>
                  <Button
                    className="h-11 shrink-0"
                    disabled={busy || paymentMethods.length === 0 || !paymentMethodId}
                    onClick={() => pay(option.id)}
                  >
                    Auswählen & bezahlen
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <dl className="rounded-2xl border border-border p-5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="font-medium">Gesamt</dt>
            <dd className="text-base font-semibold tabular-nums">
              {formatPrice(session.totals.totalMinor, session.currencyCode)}
            </dd>
          </div>
        </dl>
      </div>
    </StoreContainer>
  );
}
