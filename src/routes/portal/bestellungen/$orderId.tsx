import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createPortalReturnFn,
  getPortalDocumentUrlFn,
  getPortalEligibilityFn,
  getPortalOrderFn,
} from "@/lib/commerce/portal/portal.functions";
import { PortalOrderView } from "@/eyis/portal/PortalOrderView";
import { PortalCard, PortalPage } from "@/eyis/portal/PortalChrome";
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
    <PortalPage back={{ to: "/portal", label: "Zu meinen Bestellungen" }}>
      <PortalCard title="Bestellung konnte nicht geladen werden">
        <p className="text-sm text-pretty text-muted-foreground">{(error as Error).message}</p>
      </PortalCard>
    </PortalPage>
  ),
  notFoundComponent: () => (
    <PortalPage back={{ to: "/portal", label: "Zu meinen Bestellungen" }}>
      <PortalCard title="Bestellung nicht gefunden">
        <p className="text-sm text-muted-foreground">
          Diese Bestellung gehört nicht zu deinem Konto oder existiert nicht mehr.
        </p>
      </PortalCard>
    </PortalPage>
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
    <PortalPage back={{ to: "/portal", label: "Zu meinen Bestellungen" }}>
      {order.isLoading || !order.data ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
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
    </PortalPage>
  );
}
