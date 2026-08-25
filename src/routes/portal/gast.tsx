import { createFileRoute, Link } from "@tanstack/react-router";
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
import { PortalOrderView } from "@/components/portal/PortalOrderView";
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
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link to="/portal" className="text-xs text-muted-foreground hover:underline">
        ← Zum Kundenportal
      </Link>

      {!token ? (
        <div className="mt-6 space-y-5 rounded-xl border p-6">
          <div>
            <h1 className="font-display text-2xl font-semibold">Bestellung als Gast öffnen</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gib Bestellnummer und die E-Mail-Adresse der Bestellung ein. Der Zugang gilt für zwei
              Stunden und nur für diese eine Bestellung.
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="orderNumber">Bestellnummer</Label>
              <Input
                id="orderNumber"
                placeholder="ORD-0001"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button onClick={lookup} disabled={pending || !orderNumber.trim() || !email.trim()}>
              Bestellung öffnen
            </Button>
          </div>
        </div>
      ) : order.isLoading || !order.data ? (
        <Skeleton className="mt-6 h-96 w-full" />
      ) : (
        <div className="mt-6">
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
        </div>
      )}
    </main>
  );
}
