/**
 * Zero-Friction Owner Setup (Dedicated V3).
 *
 * Der vorbereitete Administrator meldet sich normal an. Sobald seine E-Mail
 * bestätigt und identisch mit dem hinterlegten Pending Owner ist, übernimmt er
 * die Installation ohne Claim-Code. Der Claim-Code bleibt ausschließlich als
 * Recovery-Weg unter /app/setup/recovery erhalten.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, LifeBuoy, MailCheck, ShieldCheck, Store } from "lucide-react";
import {
  autoClaimInstallationOwner,
  getOwnerSetupState,
} from "@/lib/commerce/system/installation.functions";
import { supabase } from "@/integrations/supabase/client";
import { EyisLogo } from "@/components/brand/EyisLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/setup/")({
  head: () => ({
    meta: [
      { title: "EYIS einrichten – Administrator-Konto" },
      {
        name: "description",
        content:
          "Erste Einrichtung einer EYIS Dedicated Installation: vorbereitetes Administrator-Konto bestätigen und Organisation anlegen.",
      },
      { property: "og:title", content: "EYIS einrichten – Administrator-Konto" },
      { property: "og:description", content: "Geführte Erstübernahme einer EYIS-Instanz." },
    ],
  }),
  component: OwnerSetupPage,
});

function OwnerSetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const stateFn = useServerFn(getOwnerSetupState);
  const claimFn = useServerFn(autoClaimInstallationOwner);

  const { data: state, isLoading, refetch } = useQuery({
    queryKey: ["owner-setup-state"],
    queryFn: () => stateFn(),
  });

  const [orgName, setOrgName] = useState("");
  const [shopName, setShopName] = useState("Hauptshop");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await claimFn({ data: { organizationName: orgName, shopName } });
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
      navigate({ to: "/app/system/einrichtung" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Übernahme fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 py-10">
      <EyisLogo variant="full" width={240} className="max-w-[70vw]" />
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">EYIS einrichten</h1>
          <p className="text-sm text-muted-foreground">
            Diese Instanz hat noch keinen Owner. Nur das vorbereitete Administrator-Konto kann
            die Installation übernehmen.
          </p>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Zustand wird geprüft…</p>}

      {state && state.claimState === "CLAIMED" && (
        <div className="rounded-xl border bg-card p-5 text-sm">
          Diese Instanz wurde bereits übernommen.{" "}
          <Link to="/app" className="text-primary underline">
            Zum Backoffice
          </Link>
        </div>
      )}

      {state && state.claimState === "RECOVERY_REQUIRED" && (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <LifeBuoy className="h-4 w-4 text-primary" />
            Kein vorbereiteter Administrator hinterlegt
          </div>
          <p className="text-sm text-muted-foreground">
            Für diese Installation wurde beim Bootstrap keine Administrator-E-Mail festgelegt.
            Die Übernahme läuft deshalb über den einmaligen Recovery-Code.
          </p>
          <Button asChild size="sm" variant="outline" className="self-start">
            <Link to="/app/setup/recovery">Recovery-Übernahme öffnen</Link>
          </Button>
        </div>
      )}

      {state && state.claimState === "AWAITING_OWNER_REGISTRATION" && !state.matchesPendingOwner && (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <p className="text-sm">
            Angemeldet als <strong>{state.email ?? "unbekannt"}</strong>. Dieses Konto ist nicht
            als Administrator dieser Installation vorbereitet
            {state.pendingOwnerEmailMasked ? ` (erwartet: ${state.pendingOwnerEmailMasked})` : ""}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
            >
              Mit anderem Konto anmelden
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/app/setup/recovery">Recovery-Übernahme</Link>
            </Button>
          </div>
        </div>
      )}

      {state &&
        state.claimState === "AWAITING_OWNER_REGISTRATION" &&
        state.matchesPendingOwner &&
        !state.emailVerified && (
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MailCheck className="h-4 w-4 text-primary" />
              E-Mail-Adresse noch nicht bestätigt
            </div>
            <p className="text-sm text-muted-foreground">
              Bitte den Bestätigungslink in der E-Mail an {state.email} öffnen. Ohne bestätigten
              Besitz der Adresse ist die automatische Übernahme aus Sicherheitsgründen gesperrt.
            </p>
            <Button size="sm" variant="outline" className="self-start" onClick={() => refetch()}>
              Erneut prüfen
            </Button>
          </div>
        )}

      {state && state.canAutoClaim && (
        <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Building2 className="h-4 w-4 text-primary" />
            Organisation und Hauptshop festlegen
          </div>
          <p className="text-sm text-muted-foreground">
            Angemeldet und bestätigt als <strong>{state.email}</strong>. Nach dem Speichern
            gehört diese Instanz deinem Konto.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-name">Organisation</Label>
            <Input
              id="org-name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Musterhandel GmbH"
              required
              minLength={2}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="shop-name">Hauptshop</Label>
            <div className="relative">
              <Store className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="shop-name"
                className="pl-9"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                required
                minLength={2}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>
            Einrichtung abschließen
          </Button>
          <p className="text-xs text-muted-foreground">
            Die Übernahme ist atomar und nur einmal möglich.
          </p>
        </form>
      )}
    </div>
  );
}
