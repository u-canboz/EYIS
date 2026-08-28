import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  createCartFn,
  getCartFn,
  addCartItemFn,
  updateCartItemFn,
  removeCartItemFn,
  clearCartFn,
  applyPromotionCodeFn,
  removePromotionCodeFn,
} from "@/lib/commerce/cart.functions";
import {
  startCheckoutFn,
  getCheckoutFn,
  setCheckoutEmailFn,
  setCheckoutAddressFn,
  listShippingMethodsFn,
  setShippingOptionFn,
  validateCheckoutFn,
  cancelCheckoutFn,
} from "@/lib/commerce/checkout.functions";
import {
  createPaymentSessionFn,
  getPaymentStatusFn,
  mockConfirmPaymentFn,
} from "@/lib/commerce/payments/payment.functions";
import { listSellableVariants } from "@/lib/commerce/carts-admin.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { formatMoney } from "@/lib/commerce/money";
import type { CartView, CheckoutView, ShippingMethodView } from "@/lib/commerce/cart-types";
import type { PaymentStatusView } from "@/lib/commerce/payments/payment-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel } from "@/components/shell/DetailLayout";

export const Route = createFileRoute("/_authenticated/app/system/storefront-test")({
  head: () => ({
    meta: [
      { title: "Test-Storefront – EYIS" },
      {
        name: "description",
        content:
          "Interne Test-Storefront: Warenkorb anlegen, Positionen ändern, Aktionscodes prüfen und den Checkout bis zur validierten Sitzung durchspielen.",
      },
      { property: "og:title", content: "Test-Storefront – EYIS" },
      { property: "og:description", content: "Cart- und Checkout-Engine end-to-end testen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StorefrontTest,
});

const EMPTY_ADDRESS = {
  firstName: "Maria",
  lastName: "Musterfrau",
  street: "Hauptstraße 1",
  postalCode: "10115",
  city: "Berlin",
  countryCode: "DE",
};

function StorefrontTest() {
  const { organizationId, shopId } = useActiveWorkspace();
  const [cart, setCart] = useState<CartView | null>(null);
  const [token, setToken] = useState<string>("");
  const [checkout, setCheckout] = useState<CheckoutView | null>(null);
  const [methods, setMethods] = useState<ShippingMethodView[]>([]);
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("kundin@example.com");
  const [address, setAddress] = useState({ ...EMPTY_ADDRESS });
  const [paymentSessionId, setPaymentSessionId] = useState<string>("");
  const [payment, setPayment] = useState<PaymentStatusView | null>(null);

  const startPayment = useServerFn(createPaymentSessionFn);
  const paymentStatusFn = useServerFn(getPaymentStatusFn);
  const mockConfirm = useServerFn(mockConfirmPaymentFn);

  const variantsFn = useServerFn(listSellableVariants);
  const create = useServerFn(createCartFn);
  const get = useServerFn(getCartFn);
  const add = useServerFn(addCartItemFn);
  const update = useServerFn(updateCartItemFn);
  const removeItem = useServerFn(removeCartItemFn);
  const clear = useServerFn(clearCartFn);
  const applyCode = useServerFn(applyPromotionCodeFn);
  const removeCode = useServerFn(removePromotionCodeFn);
  const start = useServerFn(startCheckoutFn);
  const refreshCheckout = useServerFn(getCheckoutFn);
  const setEmailFn = useServerFn(setCheckoutEmailFn);
  const setAddressFn = useServerFn(setCheckoutAddressFn);
  const listMethods = useServerFn(listShippingMethodsFn);
  const chooseMethod = useServerFn(setShippingOptionFn);
  const validate = useServerFn(validateCheckoutFn);
  const cancel = useServerFn(cancelCheckoutFn);

  const variants = useQuery({
    queryKey: ["sellable-variants", organizationId, shopId],
    enabled: !!organizationId && !!shopId,
    queryFn: () => variantsFn({ data: { organizationId, shopId } }),
  });

  const fail = (e: Error) => toast.error(e.message);

  const run = <T,>(promise: Promise<T>, onOk: (value: T) => void) =>
    promise.then(onOk).catch((e: Error) => fail(e));

  const newCart = useMutation({
    mutationFn: () => create({ data: { organizationId, shopId } }),
    onSuccess: (r) => {
      setToken(r.token);
      setCart(r.cart);
      setCheckout(null);
      toast.success("Warenkorb angelegt.");
    },
    onError: fail,
  });

  const auth = () => ({ cartId: cart!.id, token });

  const reloadCart = () => run(get({ data: auth() }), setCart);

  const reloadCheckout = (sessionId: string) =>
    run(refreshCheckout({ data: { sessionId, token } }), (v) => {
      setCheckout(v);
      setCart(v.cart);
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Test-Storefront"
        description="Interne Oberfläche zum Prüfen von Cart- und Checkout-Engine. Gast-Warenkorb per Token, keine Zahlung."
      />

      {!cart ? (
        <Button className="h-11 w-full sm:w-auto" onClick={() => newCart.mutate()} disabled={newCart.isPending}>
          Neuen Gast-Warenkorb starten
        </Button>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <Panel title="Produkte hinzufügen">
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {(variants.data ?? []).map((v) => (
                  <div
                    key={v.variantId}
                    className="flex flex-wrap items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 break-words">
                      {v.productName} ·{" "}
                      <span className="text-muted-foreground">{v.variantTitle}</span>
                    </span>
                    <Button
                      className="min-h-11"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        run(
                          add({ data: { ...auth(), variantId: v.variantId, quantity: 1 } }),
                          setCart,
                        )
                      }
                    >
                      + In den Warenkorb
                    </Button>
                  </div>
                ))}
                {!variants.data?.length && (
                  <p className="text-muted-foreground text-sm">
                    Keine aktiven Varianten in diesem Shop.
                  </p>
                )}
              </div>
            </Panel>

            <Panel title="Warenkorb" actions={<Badge variant="secondary">{cart.status}</Badge>}>
              {!cart.items.length ? (
                <p className="text-muted-foreground text-sm">Leer.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {cart.items.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-3">
                      <span className="min-w-0 break-words">
                        {i.title} · <span className="text-muted-foreground">{i.variantTitle}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Input
                          className="min-h-11 w-16"
                          defaultValue={i.quantity}
                          onBlur={(e) =>
                            run(
                              update({
                                data: { ...auth(), itemId: i.id, quantity: Number(e.target.value) },
                              }),
                              setCart,
                            )
                          }
                        />
                        <span className="w-24 text-right tabular-nums">
                          {formatMoney(i.lineTotalMinor, cart.currencyCode)}
                        </span>
                        <Button
                          className="size-9"
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            run(removeItem({ data: { ...auth(), itemId: i.id } }), setCart)
                          }
                        >
                          ×
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <Separator className="my-4" />

              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  className="h-11"
                  placeholder="Aktionscode"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <Button
                  className="h-11 w-full sm:w-auto"
                  variant="outline"
                  onClick={() =>
                    run(applyCode({ data: { ...auth(), code } }), (v) => {
                      setCart(v);
                      setCode("");
                    })
                  }
                >
                  Anwenden
                </Button>
                <Button className="h-11 w-full sm:w-auto" variant="ghost" onClick={() => run(clear({ data: auth() }), setCart)}>
                  Leeren
                </Button>
              </div>
              {cart.promotionCodes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {cart.promotionCodes.map((c) => (
                    <Badge
                      key={c}
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => run(removeCode({ data: { ...auth(), code: c } }), setCart)}
                    >
                      {c} ×
                    </Badge>
                  ))}
                </div>
              )}
              {cart.rejectedCodes.map((r) => (
                <p key={r.code} className="text-destructive mt-2 break-words text-xs">
                  {r.code}: {r.reason}
                </p>
              ))}
              {cart.warnings.map((w) => (
                <p key={w} className="text-muted-foreground mt-2 break-words text-xs">
                  {w}
                </p>
              ))}
            </Panel>

            {checkout && (
              <Panel title="Checkout" actions={<Badge>{checkout.status}</Badge>} bodyClassName="space-y-3 p-4">
                <p className="text-muted-foreground text-xs">
                  Gültig bis {new Date(checkout.expiresAt).toLocaleTimeString("de-DE")}
                </p>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-1">
                    <Label>E-Mail</Label>
                    <div className="flex gap-2">
                      <Input className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} />
                      <Button
                        className="h-11 shrink-0"
                        variant="outline"
                        onClick={() =>
                          run(
                            setEmailFn({ data: { sessionId: checkout.id, token, email } }),
                            setCheckout,
                          )
                        }
                      >
                        OK
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  {(
                    [
                      "firstName",
                      "lastName",
                      "street",
                      "postalCode",
                      "city",
                      "countryCode",
                    ] as const
                  ).map((k) => (
                    <div key={k} className="grid gap-1">
                      <Label className="text-xs">{k}</Label>
                      <Input
                        className="h-11"
                        value={address[k]}
                        onChange={(e) => setAddress({ ...address, [k]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
                <Button
                  className="h-11 w-full sm:w-auto"
                  variant="outline"
                  onClick={() =>
                    run(
                      setAddressFn({
                        data: {
                          sessionId: checkout.id,
                          token,
                          type: "shipping",
                          address,
                          billingSameAsShipping: true,
                        },
                      }),
                      setCheckout,
                    )
                  }
                >
                  Lieferadresse speichern
                </Button>

                <div className="space-y-2">
                  <Button
                    className="h-11 w-full sm:w-auto"
                    variant="outline"
                    onClick={() =>
                      run(listMethods({ data: { sessionId: checkout.id, token } }), (m) =>
                        setMethods(m),
                      )
                    }
                  >
                    Versandarten laden
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    {methods.map((m) => (
                      <Button
                        key={m.id}
                        className="min-h-11"
                        size="sm"
                        variant={checkout.shippingMethod?.id === m.id ? "default" : "outline"}
                        onClick={() =>
                          run(
                            chooseMethod({
                              data: { sessionId: checkout.id, token, shippingMethodId: m.id },
                            }),
                            setCheckout,
                          )
                        }
                      >
                        {m.name} · {formatMoney(m.amountMinor, m.currencyCode)}
                      </Button>
                    ))}
                  </div>
                </div>

                {checkout.issues.length > 0 && (
                  <ul className="text-muted-foreground list-inside list-disc text-xs">
                    {checkout.issues.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    className="h-11 w-full sm:w-auto"
                    disabled={!checkout.ready}
                    onClick={() =>
                      run(validate({ data: { sessionId: checkout.id, token } }), setCheckout)
                    }
                  >
                    Checkout validieren
                  </Button>
                  <Button className="h-11 w-full sm:w-auto" variant="ghost" onClick={() => reloadCheckout(checkout.id)}>
                    Aktualisieren
                  </Button>
                  <Button
                    className="h-11 w-full sm:w-auto"
                    variant="ghost"
                    onClick={() =>
                      run(cancel({ data: { sessionId: checkout.id, token } }), (r) => {
                        setCart(r.cart);
                        setCheckout(null);
                        toast.success(`${r.released} Reservierung(en) freigegeben.`);
                      })
                    }
                  >
                    Checkout abbrechen
                  </Button>
                </div>

                {checkout.status === "validated" || checkout.status === "awaiting_payment" ? (
                  <div className="space-y-2 border-t pt-3">
                    <h3 className="text-sm font-medium">Zahlung</h3>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Button
                        className="h-11 w-full sm:w-auto"
                        onClick={() =>
                          run(
                            startPayment({
                              data: {
                                sessionId: checkout.id,
                                token,
                                provider: null,
                                returnUrl: `${window.location.origin}${window.location.pathname}`,
                              },
                            }),
                            (r) => {
                              setPaymentSessionId(r.paymentSessionId);
                              setPayment(null);
                              if (r.redirectUrl && r.provider !== "mock") {
                                window.location.href = r.redirectUrl;
                              } else {
                                toast.success("Zahlung gestartet (Test-Anbieter).");
                              }
                            },
                          )
                        }
                      >
                        Zahlung starten
                      </Button>
                      {paymentSessionId && (
                        <>
                          <Button
                            className="h-11 w-full sm:w-auto"
                            variant="outline"
                            onClick={() =>
                              run(mockConfirm({ data: { paymentSessionId, token } }), (r) =>
                                toast.success(`Bestellung ${r.order_number} erstellt.`),
                              )
                            }
                          >
                            Testzahlung bestätigen
                          </Button>
                          <Button
                            className="h-11 w-full sm:w-auto"
                            variant="ghost"
                            onClick={() =>
                              run(
                                paymentStatusFn({ data: { paymentSessionId, token } }),
                                setPayment,
                              )
                            }
                          >
                            Zahlungsstatus prüfen
                          </Button>
                        </>
                      )}
                    </div>
                    {payment && (
                      <p className="text-muted-foreground break-words text-xs">
                        Status: {payment.status}
                        {payment.order &&
                          ` · Bestellung ${payment.order.orderNumber} über ${formatMoney(
                            payment.order.totalMinor,
                            payment.order.currencyCode,
                          )}`}
                      </p>
                    )}
                  </div>
                ) : null}
              </Panel>
            )}
          </div>

          <Panel title="Summen" bodyClassName="space-y-4 p-4" className="lg:sticky lg:top-20">
            <dl className="space-y-1 text-sm">
              <Row
                label="Zwischensumme"
                value={formatMoney(cart.totals.subtotalMinor, cart.currencyCode)}
              />
              <Row
                label="Rabatt"
                value={`−${formatMoney(cart.totals.discountMinor, cart.currencyCode)}`}
              />
              <Row
                label="Versand"
                value={formatMoney(cart.totals.shippingMinor, cart.currencyCode)}
              />
              <Row label="Netto" value={formatMoney(cart.tax.netTotalMinor, cart.currencyCode)} />
              {cart.tax.breakdown.map((b) => (
                <Row
                  key={`${b.rateBasisPoints}-${b.reasonCode}`}
                  label={b.label}
                  value={formatMoney(b.taxMinor, cart.currencyCode)}
                />
              ))}
              <Row
                label="Steuer gesamt"
                value={formatMoney(cart.tax.taxMinor, cart.currencyCode)}
              />
              <Separator className="my-2" />
              <Row
                label="Gesamt"
                value={formatMoney(cart.totals.totalMinor, cart.currencyCode)}
                strong
              />
            </dl>
            <p className="text-muted-foreground text-xs">
              Snapshot v{cart.snapshotVersion} · Engine {cart.pricingEngineVersion} · Steuer{" "}
              {cart.tax.engineVersion} ({cart.tax.calculationMode === "gross" ? "Brutto" : "Netto"})
              {cart.tax.reverseCharge ? " · Reverse Charge" : ""}
            </p>
            {cart.appliedPromotions.map((p) => (
              <p key={p.promotionId} className="text-xs">
                {p.name}: −{formatMoney(p.discountMinor, cart.currencyCode)}
              </p>
            ))}
            {cart.pendingPromotions.map((p) => (
              <p key={p.promotionId} className="text-muted-foreground text-xs">
                {p.name}: {p.note}
              </p>
            ))}

            <Separator />
            <div className="space-y-2">
              <Button
                className="h-11 w-full"
                disabled={!cart.items.length || cart.status !== "active"}
                onClick={() =>
                  run(start({ data: { ...auth(), email } }), (v) => {
                    setCheckout(v);
                    setCart(v.cart);
                    toast.success("Checkout gestartet, Bestand reserviert.");
                  })
                }
              >
                Checkout starten
              </Button>
              <Button variant="ghost" className="h-11 w-full" onClick={reloadCart}>
                Warenkorb neu laden
              </Button>
              <Button variant="ghost" className="h-11 w-full" onClick={() => newCart.mutate()}>
                Neuen Warenkorb
              </Button>
            </div>
            <p className="text-muted-foreground break-words text-[10px]">
              Cart {cart.id} · Token {token.slice(0, 12)}…
            </p>
          </Panel>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${strong ? "font-semibold" : ""}`}>
      <dt className="min-w-0 text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
