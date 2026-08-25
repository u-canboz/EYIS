import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createPortalReturnFn,
  getPortalDocumentUrlFn,
  getPortalEligibilityFn,
  getPortalOrderFn,
} from "@/lib/commerce/portal/portal.functions";
import { PortalOrderView } from "@/components/portal/PortalOrderView";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/portal/bestellungen/$orderId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Bestelldetails – Mein Konto" },
      {
        name: "description",
        content: "Artikel, Sendungsverfolgung, Rechnungen und Rücksendung zu deiner Bestellung.",
      },
      { property: "og:title", content: "Bestelldetails – Mein Konto" },
      { property: "og:description", content: "Alle Informationen zu deiner Bestellung." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalOrderPage,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-3xl p-6">
      <p className="rounded-lg border p-6 text-sm text-destructive">{(error as Error).message}</p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl p-6 text-sm">Bestellung nicht gefunden.</main>
  ),
});

function PortalOrderPage() {
  const { orderId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchOrder = useServerFn(getPortalOrderFn);
  const fetchEligibility = useServerFn(getPortalEligibilityFn);
  const documentUrl = useServerFn(getPortalDocumentUrlFn);
  const createReturn = useServerFn(createPortalReturnFn);

  const order = useQuery({
    queryKey: ["portal-order", orderId],
    queryFn: () => fetchOrder({ data: { orderId } }),
  });
  const eligibility = useQuery({
    queryKey: ["portal-eligibility", orderId],
    queryFn: () => fetchEligibility({ data: { orderId } }),
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link to="/portal" className="text-xs text-muted-foreground hover:underline">
        ← Zurück zu meinen Bestellungen
      </Link>
      <div className="mt-4">
        {order.isLoading || !order.data ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <PortalOrderView
            order={order.data}
            eligibility={eligibility.data ?? null}
            onDocument={(kind, documentId) => documentUrl({ data: { orderId, documentId, kind } })}
            onCreateReturn={async (input) => {
              await createReturn({ data: { orderId, ...input } });
              await queryClient.invalidateQueries({ queryKey: ["portal-order", orderId] });
              await queryClient.invalidateQueries({ queryKey: ["portal-eligibility", orderId] });
            }}
          />
        )}
      </div>
    </main>
  );
}
