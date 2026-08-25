import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getPortalOrdersFn, linkMyOrdersFn } from "@/lib/commerce/portal/portal.functions";
import { formatMoney } from "@/lib/commerce/money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/portal/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mein Konto – Bestellungen und Retouren" },
      {
        name: "description",
        content:
          "Bestellungen einsehen, Sendungen verfolgen, Rechnungen laden und Retouren anmelden.",
      },
      { property: "og:title", content: "Mein Konto – Bestellungen und Retouren" },
      {
        property: "og:description",
        content: "Dein Kundenportal für Bestellungen, Belege und Rücksendungen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalHome,
});

function PortalHome() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const fetchOrders = useServerFn(getPortalOrdersFn);
  const linkOrders = useServerFn(linkMyOrdersFn);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (signedIn) void linkOrders();
  }, [signedIn, linkOrders]);

  const orders = useQuery({
    queryKey: ["portal-orders"],
    enabled: signedIn === true,
    queryFn: () => fetchOrders(),
  });

  if (signedIn === null) return <Skeleton className="m-6 h-64" />;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold">Mein Konto</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bestellungen, Sendungsverfolgung, Rechnungen und Retouren an einem Ort.
        </p>
      </header>

      {!signedIn ? (
        <div className="space-y-4 rounded-xl border p-6">
          <p className="text-sm">
            Melde dich an, um alle deine Bestellungen zu sehen – oder rufe eine einzelne Bestellung
            als Gast auf.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate({ to: "/auth" })}>Anmelden</Button>
            <Button variant="outline" asChild>
              <Link to="/portal/gast">Als Gast fortfahren</Link>
            </Button>
          </div>
        </div>
      ) : orders.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !orders.data?.length ? (
        <div className="space-y-4 rounded-xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Wir haben zu diesem Konto noch keine Bestellungen gefunden.
          </p>
          <Button variant="outline" asChild>
            <Link to="/portal/gast">Bestellung mit Bestellnummer suchen</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.data.map((o) => (
            <li key={o.id}>
              <Link
                to="/portal/bestellungen/$orderId"
                params={{ orderId: o.id }}
                className="flex items-center justify-between rounded-xl border p-4 transition hover:bg-muted/40"
              >
                <div>
                  <p className="font-medium">{o.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.placedAt).toLocaleDateString("de-DE")} · {o.itemCount} Artikel
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{o.fulfillmentStatus}</Badge>
                  <span className="font-medium">{formatMoney(o.totalMinor, o.currencyCode)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
