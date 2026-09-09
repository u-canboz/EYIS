import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCommerce } from "@/lib/store-sdk/react/provider";
import type { StoreAddress, StoreCheckout, StoreShippingOption } from "@/lib/store-sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState, Skeleton } from "@/components/store/StateBlocks";
import { formatMoney } from "@/lib/storefront/money";
import { errorMessage } from "@/lib/storefront/errors";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout/")({
  head: () => ({
    meta: [
      { title: "Kasse | Hauptshop" },
      { name: "description", content: "Bestellung abschließen: Adresse, Versand und Zahlung." },
      { property: "og:title", content: "Kasse | Hauptshop" },
      { property: "og:description", content: "Bestellung abschließen: Adresse, Versand und Zahlung." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

const EMPTY_ADDRESS: StoreAddress = {
  firstName: "",
  lastName: "",
  company: "",
  street: "",
  street2: "",
  postalCode: "",
  city: "",
  countryCode: "DE",
  phone: "",
};

const SESSION_KEY = "storefront_checkout_session";

function CheckoutPage() {

  const client = useCommerce();
  const [session, setSession] = useState<StoreCheckout | null>(null);
  const [startError, setStartError] = useState<unknown>(null);
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState<StoreAddress>(EMPTY_ADDRESS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    // Die Kassensitzung wird gemerkt: ein zweiter start()-Aufruf scheitert,
    // sobald der Warenkorb bereits im Kassenstatus ist. start() prüft den
    // Warenkorb außerdem synchron und wirft ohne aktiven Warenkorb.
    void (async () => {
      const stored =
        typeof window === "undefined" ? null : sessionStorage.getItem(SESSION_KEY);
      const apply = (next: StoreCheckout) => {
        if (!active) return;
        sessionStorage.setItem(SESSION_KEY, next.id);
        setSession(next);
        setEmail(next.email ?? "");
        if (next.shippingAddress) setAddress(next.shippingAddress);
      };
      if (stored) {
        try {
          const existing = await client.checkout.get(stored);
          if (existing.status === "open" || existing.status === "validated" || existing.status === "awaiting_payment") {
            apply(existing);
            return;
          }
        } catch {
          sessionStorage.removeItem(SESSION_KEY);
        }
      }
      try {
        apply(await client.checkout.start(null));
      } catch (error) {
        if (active) setStartError(error);
      }
    })();
    return () => {
      active = false;
    };
  }, [client]);



  const shippingOptions = useQuery<StoreShippingOption[]>({
    queryKey: ["checkout", "shipping-options", session?.id],
    queryFn: () => client.checkout.shippingOptions(session!.id),
    enabled: Boolean(session?.shippingAddress),
  });

  const pay = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("Keine Checkout-Sitzung.");
      const validated = await client.checkout.validate(session.id);
      setSession(validated);
      const payment = await client.checkout.createPaymentSession(session.id, {
        returnUrl: `${window.location.origin}/checkout/bestaetigung`,
      });
      return payment;
    },
    onSuccess: (payment) => {
      if (payment.redirectUrl) {
        window.location.href = payment.redirectUrl;
        return;
      }
      toast.error("Der Zahlungsanbieter hat keine Weiterleitung geliefert.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (startError) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24">
        <ErrorState error={startError} />
        <div className="mt-6 text-center">
          <Link to="/warenkorb" className="text-sm underline underline-offset-4">
            Zurück zum Warenkorb
          </Link>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-5 py-16">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const currency = session.currencyCode;

  const saveEmail = async () => {
    setBusy(true);
    try {
      setSession(await client.checkout.setEmail(session.id, email));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const saveAddress = async () => {
    setBusy(true);
    try {
      const next = await client.checkout.setAddress(session.id, {
        type: "shipping",
        address: address as unknown as Record<string, unknown>,
        billingSameAsShipping: true,
      });
      setSession(next);
      shippingOptions.refetch();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const chooseShipping = async (id: string) => {
    setBusy(true);
    try {
      setSession(await client.checkout.setShippingOption(session.id, id));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <h1 className="text-3xl sm:text-4xl">Kasse</h1>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-10">
          <section>
            <h2 className="text-lg">1. Kontakt</h2>
            <div className="mt-4 grid gap-3 sm:max-w-md">
              <Label htmlFor="email">E-Mail für die Bestellbestätigung</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={saveEmail}
                placeholder="name@example.com"
              />
            </div>
          </section>

          <section>
            <h2 className="text-lg">2. Lieferadresse</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Vorname" value={address.firstName} onChange={(v) => setAddress({ ...address, firstName: v })} />
              <Field label="Nachname" value={address.lastName} onChange={(v) => setAddress({ ...address, lastName: v })} />
              <Field label="Straße und Nummer" value={address.street} onChange={(v) => setAddress({ ...address, street: v })} className="sm:col-span-2" />
              <Field label="Postleitzahl" value={address.postalCode} onChange={(v) => setAddress({ ...address, postalCode: v })} />
              <Field label="Ort" value={address.city} onChange={(v) => setAddress({ ...address, city: v })} />
              <Field label="Land (Code)" value={address.countryCode} onChange={(v) => setAddress({ ...address, countryCode: v.toUpperCase() })} />
              <Field label="Telefon (optional)" value={address.phone ?? ""} onChange={(v) => setAddress({ ...address, phone: v })} />
            </div>
            <Button variant="outline" className="mt-4" disabled={busy} onClick={saveAddress}>
              Adresse übernehmen
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Die Rechnungsadresse entspricht der Lieferadresse.
            </p>
          </section>

          <section>
            <h2 className="text-lg">3. Versandart</h2>
            {!session.shippingAddress ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Bitte zuerst die Lieferadresse übernehmen.
              </p>
            ) : shippingOptions.isPending ? (
              <Skeleton className="mt-4 h-20 w-full" />
            ) : shippingOptions.isError ? (
              <ErrorState error={shippingOptions.error} onRetry={() => shippingOptions.refetch()} />
            ) : (
              <div className="mt-4 grid gap-3">
                {shippingOptions.data?.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={busy}
                    onClick={() => chooseShipping(option.id)}
                    className={cn(
                      "flex items-center justify-between border p-4 text-left transition-colors",
                      session.shippingOption?.id === option.id
                        ? "border-foreground"
                        : "border-border hover:bg-secondary",
                    )}
                  >
                    <span>
                      <span className="block text-sm">{option.name}</span>
                      {option.description ? (
                        <span className="block text-xs text-muted-foreground">{option.description}</span>
                      ) : null}
                    </span>
                    <span className="text-sm tabular-nums">
                      {formatMoney(option.amountMinor, option.currencyCode)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg">4. Prüfung und Zahlung</h2>
            {session.issues.length > 0 ? (
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {session.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Alles vollständig.</p>
            )}
            <Button
              size="lg"
              className="mt-6"
              disabled={!session.ready || pay.isPending || busy}
              onClick={() => pay.mutate()}
            >
              {pay.isPending ? "Weiterleitung…" : "Kostenpflichtig bestellen"}
            </Button>
          </section>
        </div>

        <aside className="h-fit border border-border p-6">
          <h2 className="text-lg">Bestellung</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {session.cart.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4">
                <span>
                  {item.quantity} × {item.title}
                  <span className="block text-xs text-muted-foreground">{item.variantTitle}</span>
                </span>
                <span className="tabular-nums">{formatMoney(item.lineTotalMinor, currency)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt>Zwischensumme</dt>
              <dd className="tabular-nums">{formatMoney(session.totals.subtotalMinor, currency)}</dd>
            </div>
            {session.totals.discountMinor > 0 ? (
              <div className="flex justify-between">
                <dt>Rabatt</dt>
                <dd className="tabular-nums">− {formatMoney(session.totals.discountMinor, currency)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt>Versand</dt>
              <dd className="tabular-nums">{formatMoney(session.totals.shippingMinor, currency)}</dd>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <dt>enthaltene Steuer</dt>
              <dd className="tabular-nums">{formatMoney(session.totals.taxMinor, currency)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-3 text-base">
              <dt>Gesamt</dt>
              <dd className="tabular-nums">{formatMoney(session.totals.totalMinor, currency)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
