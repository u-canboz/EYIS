/**
 * First Owner Claim (Phase 21): Der Owner fügt den einmaligen Claim-Code aus
 * dem Bootstrap ein (Formular, niemals URL), registriert sich bzw. ist bereits
 * angemeldet, und übernimmt die Instanz. Der Claim läuft atomar serverseitig.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Building2, Store, ShieldCheck } from "lucide-react";
import { claimInstallationOwner } from "@/lib/commerce/system/installation.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/setup/")({
  head: () => ({
    meta: [
      { title: "Installation übernehmen – EYIS" },
      { name: "description", content: "First Owner Claim: diese EYIS-Instanz mit dem einmaligen Installations-Claim übernehmen." },
      { property: "og:title", content: "Installation übernehmen – EYIS" },
      { property: "og:description", content: "Sicherer First-Owner-Claim für eine Dedicated-Instanz." },
    ],
  }),
  component: OwnerClaimPage,
});

function OwnerClaimPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const claimFn = useServerFn(claimInstallationOwner);

  const [step, setStep] = useState<"code" | "workspace">("code");
  const [claimCode, setClaimCode] = useState("");
  const [orgName, setOrgName] = useState("");
  const [shopName, setShopName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/public/install/claim-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ claimCode }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setError(body.error ?? "Claim-Code ungültig.");
        return;
      }
      setClaimCode("");
      setStep("workspace");
    } finally {
      setBusy(false);
    }
  }

  async function submitClaim(e: React.FormEvent) {
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
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Installation übernehmen</h1>
          <p className="text-sm text-muted-foreground">
            Diese EYIS-Instanz hat noch keinen Owner. Der erste Zugriff ist nur mit dem
            einmaligen Installations-Claim aus dem Bootstrap möglich.
          </p>
        </div>
      </div>

      {step === "code" ? (
        <form onSubmit={submitCode} className="flex flex-col gap-4 rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4 text-primary" />
            Schritt 1: Installations-Claim eingeben
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="claim-code">Claim-Code</Label>
            <Input
              id="claim-code"
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value)}
              placeholder="cos_claim_…"
              autoComplete="off"
              required
            />
            <p className="text-xs text-muted-foreground">
              Der Code wurde einmalig bei <code>commerce:bootstrap</code> ausgegeben und ist{" "}
              72 Stunden gültig.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy || claimCode.trim().length < 10}>
            Code prüfen
          </Button>
        </form>
      ) : (
        <form onSubmit={submitClaim} className="flex flex-col gap-4 rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Building2 className="h-4 w-4 text-primary" />
            Schritt 2: Organisation und Shop festlegen
          </div>
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
                placeholder="Hauptshop"
                required
                minLength={2}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>
            Instanz als Owner übernehmen
          </Button>
          <p className="text-xs text-muted-foreground">
            Die Übernahme ist atomar und nur einmal möglich. Dein Benutzerkonto wird Owner der
            Organisation.
          </p>
        </form>
      )}
    </div>
  );
}
