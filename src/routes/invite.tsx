import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getInvitation, acceptInvitation } from "@/lib/commerce/team.functions";
import { roleLabel } from "@/lib/commerce/roles";
import { EyisLogo } from "@/components/brand/EyisLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/invite")({
  head: () => ({
    meta: [
      { title: "Einladung annehmen – EYIS" },
      {
        name: "description",
        content: "Nimm deine Einladung in eine EYIS-Organisation an.",
      },
      { property: "og:title", content: "Einladung annehmen – EYIS" },
      {
        property: "og:description",
        content: "Nimm deine Einladung in eine EYIS-Organisation an.",
      },
    ],
  }),
  component: InvitePage,
});

type Details = Awaited<ReturnType<typeof getInvitation>>;

function InvitePage() {
  const navigate = useNavigate();
  const load = useServerFn(getInvitation);
  const accept = useServerFn(acceptInvitation);
  const [token, setToken] = useState<string | null>(null);
  const [details, setDetails] = useState<Details | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        navigate({
          to: "/auth",
          search: { next: `/invite?token=${t ?? ""}` } as never,
        });
        return;
      }
      if (!t) {
        setLoading(false);
        return;
      }
      try {
        setDetails(await load({ data: { token: t } }));
      } catch (e) {
        toast.error((e as Error).message);
      }
      setLoading(false);
    });
  }, [load, navigate]);

  async function onAccept() {
    if (!token) return;
    setBusy(true);
    try {
      await accept({ data: { token } });
      toast.success("Einladung angenommen.");
      navigate({ to: "/app" });
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <Card className="w-full max-w-md">
        <CardHeader className="items-start gap-3">
          <EyisLogo variant="wordmark" width={96} />
          <CardTitle>Einladung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <Skeleton className="h-24 w-full" />}
          {!loading && !token && (
            <p className="text-sm text-muted-foreground">Kein Einladungstoken angegeben.</p>
          )}
          {!loading && details && !details.valid && (
            <p className="text-sm text-destructive">{details.reason}</p>
          )}
          {!loading && details?.valid && (
            <>
              <p className="text-sm">
                Du wurdest zu <strong>{details.organizationName}</strong> eingeladen – Rolle{" "}
                <strong>{roleLabel(details.role)}</strong>.
              </p>
              {details.matchesUser ? (
                <Button onClick={onAccept} disabled={busy} className="w-full">
                  Einladung annehmen
                </Button>
              ) : (
                <p className="text-sm text-destructive">
                  Diese Einladung gilt für {details.email}. Du bist als {details.userEmail}{" "}
                  angemeldet.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
