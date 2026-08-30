import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, PackageSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPortalOrdersFn, linkMyOrdersFn } from "@/lib/commerce/portal/portal.functions";
import { formatMoney } from "@/lib/commerce/money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PortalCard, PortalHeading, PortalPage } from "@/eyis/portal/PortalChrome";

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

  return (
    <PortalPage>
      <PortalHeading
        title="Mein Konto"
        description="Bestellungen, Sendungsverfolgung, Rechnungen und Retouren an einem Ort."
      />

      {signedIn === null ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : !signedIn ? (
        <PortalCard
          title="Bestellung ansehen"
          description="Melde dich an, um alle deine Bestellungen zu sehen – oder öffne eine einzelne Bestellung als Gast."
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="h-11 sm:flex-1" onClick={() => navigate({ to: "/auth" })}>
              Anmelden
            </Button>
            <Button variant="outline" className="h-11 sm:flex-1" asChild>
              <Link to="/portal/gast">Als Gast fortfahren</Link>
            </Button>
          </div>
        </PortalCard>
      ) : orders.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : orders.error ? (
        <PortalCard title="Bestellungen konnten nicht geladen werden">
          <p className="text-sm text-pretty text-muted-foreground">
            {(orders.error as Error).message}
          </p>
          <Button variant="outline" className="mt-3 h-11" onClick={() => void orders.refetch()}>
            Erneut versuchen
          </Button>
        </PortalCard>
      ) : !orders.data?.length ? (
        <PortalCard>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <PackageSearch className="size-6 text-muted-foreground" aria-hidden />
            <p className="font-medium text-pretty">Noch keine Bestellungen gefunden</p>
            <p className="max-w-prose text-sm text-pretty text-muted-foreground">
              Sobald eine Bestellung zu diesem Konto gehört, erscheint sie hier.
            </p>
            <Button variant="outline" className="h-11" asChild>
              <Link to="/portal/gast">Bestellung mit Bestellnummer suchen</Link>
            </Button>
          </div>
        </PortalCard>
      ) : (
        <ul className="space-y-3">
          {orders.data.map((o) => (
            <li key={o.id}>
              <Link
                to="/portal/bestellungen/$orderId"
                params={{ orderId: o.id }}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border/70 bg-background p-5 transition-colors hover:border-primary/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{o.orderNumber}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(o.placedAt).toLocaleDateString("de-DE")} · {o.itemCount} Artikel
                  </p>
                  <Badge variant="secondary" className="mt-2">
                    {o.fulfillmentStatus}
                  </Badge>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-medium tabular-nums">
                    {formatMoney(o.totalMinor, o.currencyCode)}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PortalPage>
  );
}
