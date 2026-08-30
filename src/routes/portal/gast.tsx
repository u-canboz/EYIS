import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  createGuestReturnFn,
  getGuestDocumentUrlFn,
  getGuestEligibilityFn,
  getGuestOrderFn,
  requestGuestAccessFn,
} from "@/lib/commerce/portal/portal.functions";
import { PortalOrderView } from "@/eyis/portal/PortalOrderView";
import { PortalCard, PortalHeading, PortalPage } from "@/eyis/portal/PortalChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/portal/gast")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Bestellung als Gast ansehen" },
      {
        name: "description",
        content:
          "Bestellnummer und E-Mail eingeben, um Bestellung, Sendung, Belege und Retoure zu öffnen.",
      },
      { property: "og:title", content: "Bestellung als Gast ansehen" },
      {
        property: "og:description",
        content: "Gastzugang zu deiner Bestellung – ohne Kundenkonto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuestLookupPage,
});

function GuestLookupPage() {
  const queryClient = useQueryClient();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const requestAccess = useServerFn(requestGuestAccessFn);
  const fetchOrder = useServerFn(getGuestOrderFn);
  const fetchEligibility = useServerFn(getGuestEligibilityFn);
  const documentUrl = useServerFn(getGuestDocumentUrlFn);
  const createReturn = useServerFn(createGuestReturnFn);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("token");
    if (fromUrl) setToken(fromUrl);
  }, []);

  const order = useQuery({
    queryKey: ["guest-order", token],
    enabled: !!token,
    queryFn: () => fetchOrder({ data: { token: token! } }),
  });
  const eligibility = useQuery({
    queryKey: ["guest-eligibility", token],
    enabled: !!token,
    queryFn: () => fetchEligibility({ data: { token: token! } }),
  });

  const lookup = async () => {
    setPending(true);
    try {
      const res = await requestAccess({ data: { orderNumber, email } });
      if (!res.token) {
        toast.error("Zu diesen Angaben konnten wir keine Bestellung finden.");
        return;
      }
      setToken(res.token);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <PortalPage back={{ to: "/portal", label: "Zum Kundenkonto" }}>
      {!token ? (
        <>
          <PortalHeading
            title="Bestellung als Gast öffnen"
            description="Gib Bestellnummer und die E-Mail-Adresse der Bestellung ein. Der Zugang gilt für zwei Stunden und nur für diese eine Bestellung."
          />
          <PortalCard>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void lookup();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="orderNumber">Bestellnummer</Label>
                <Input
                  id="orderNumber"
                  className="h-11"
                  placeholder="ORD-0001"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-Mail-Adresse</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className="h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="h-11 w-full sm:w-auto"
                disabled={pending || !orderNumber.trim() || !email.trim()}
              >
                Bestellung öffnen
              </Button>
            </form>
          </PortalCard>
        </>
      ) : order.isLoading || !order.data ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <PortalOrderView
          order={order.data}
          eligibility={eligibility.data ?? null}
          onDocument={(kind, documentId) =>
            documentUrl({ data: { token: token!, documentId, kind } })
          }
          onCreateReturn={async (input) => {
            await createReturn({ data: { token: token!, ...input } });
            await queryClient.invalidateQueries({ queryKey: ["guest-order", token] });
            await queryClient.invalidateQueries({ queryKey: ["guest-eligibility", token] });
          }}
        />
      )}
    </PortalPage>
  );
}
