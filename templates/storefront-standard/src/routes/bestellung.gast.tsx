import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCommerce } from "@/lib/store-sdk/react/provider";
import { OrderDetail } from "@/components/store/OrderDetail";
import { ErrorState, Skeleton } from "@/components/store/StateBlocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/storefront/errors";

export const Route = createFileRoute("/bestellung/gast")({
  head: () => ({
    meta: [
      { title: "Bestellung ohne Konto | Hauptshop" },
      { name: "description", content: "Bestellstatus ohne Kundenkonto per E-Mail-Link ansehen." },
      { property: "og:title", content: "Bestellung ohne Konto | Hauptshop" },
      { property: "og:description", content: "Bestellstatus ohne Kundenkonto ansehen." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GuestOrderPage,
});

function GuestOrderPage() {
  const client = useCommerce();
  const [hasToken, setHasToken] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");
    if (!token) return;
    client.orders.useGuestToken(token);
    url.searchParams.delete("token");
    window.history.replaceState({}, "", url.pathname + (url.search || ""));
    setHasToken(true);
  }, [client]);

  const order = useQuery({
    queryKey: ["commerce", "guest-order", hasToken],
    queryFn: () => client.orders.guestOrder(),
    enabled: hasToken,
    retry: false,
  });

  if (hasToken) {
    if (order.isPending) {
      return (
        <div className="mx-auto max-w-3xl space-y-4 px-5 py-16">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-64 w-full" />
        </div>
      );
    }
    if (order.isError || !order.data) {
      return (
        <div className="mx-auto max-w-2xl px-5 py-24">
          <ErrorState error={order.error} onRetry={() => order.refetch()} />
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Der Link ist nur kurze Zeit gültig. Fordere unten einen neuen an.
          </p>
          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-sm underline underline-offset-4"
              onClick={() => {
                client.orders.clearGuestToken();
                setHasToken(false);
              }}
            >
              Neuen Link anfordern
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <OrderDetail
          order={order.data}
          onDocument={async (documentId) => {
            try {
              const { url } = await client.orders.guestDocumentUrl(documentId);
              if (url) window.open(url, "_blank", "noopener");
              else toast.error("Dieses Dokument ist noch nicht verfügbar.");
            } catch (error) {
              toast.error(errorMessage(error));
            }
          }}
        />
        <div className="mt-10">
          <Link to="/retouren" className="border border-border px-6 py-3 text-sm">
            Retoure anmelden
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 py-24">
      <h1 className="text-3xl">Bestellung ansehen</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Gib Bestellnummer und E-Mail-Adresse ein. Wir senden dir einen Link, der die Bestellung öffnet.
      </p>
      {sent ? (
        <p className="mt-8 border border-border p-6 text-sm">
          Wenn die Angaben zu einer Bestellung passen, ist die E-Mail unterwegs.
        </p>
      ) : (
        <form
          className="mt-8 grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            try {
              await client.orders.requestGuestAccess({ orderNumber, email });
              setSent(true);
            } catch (error) {
              toast.error(errorMessage(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="orderNumber">Bestellnummer</Label>
            <Input
              id="orderNumber"
              required
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="guest-email">E-Mail</Label>
            <Input
              id="guest-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" size="lg" disabled={busy}>
            Link senden
          </Button>
        </form>
      )}
      <p className="mt-6 text-sm text-muted-foreground">
        <Link to="/konto" className="underline underline-offset-4">
          Mit Kundenkonto anmelden
        </Link>
      </p>
    </div>
  );
}
