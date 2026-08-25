import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listProviderConfigsFn, upsertProviderConfigFn } from "@/lib/commerce/payments/payment.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/zahlungen")({
  head: () => ({
    meta: [
      { title: "Zahlungsanbieter – Commerce OS" },
      {
        name: "description",
        content:
          "Zahlungsanbieter je Shop aktivieren, Test- und Live-Umgebung trennen und Prioritäten für den Checkout festlegen.",
      },
      { property: "og:title", content: "Zahlungsanbieter – Commerce OS" },
      { property: "og:description", content: "Stripe und Test-Anbieter je Shop konfigurieren." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentSettingsPage,
});

function PaymentSettingsPage() {
  const { organizationId, shopId, can } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<"stripe" | "mock">("stripe");
  const [displayName, setDisplayName] = useState("Stripe");
  const [environment, setEnvironment] = useState<"test" | "live">("test");
  const [priority, setPriority] = useState("10");

  const list = useServerFn(listProviderConfigsFn);
  const upsert = useServerFn(upsertProviderConfigFn);

  const configs = useQuery({
    queryKey: ["payment-providers", organizationId, shopId],
    enabled: !!organizationId && !!shopId && can("payment_settings.read"),
    queryFn: () => list({ data: { organizationId, shopId } }),
  });

  const save = useMutation({
    mutationFn: (input: {
      provider: "stripe" | "mock";
      displayName: string;
      environment: "test" | "live";
      status: "active" | "inactive";
      priority: number;
    }) => upsert({ data: { organizationId, shopId, ...input } }),
    onSuccess: () => {
      toast.success("Zahlungsanbieter gespeichert.");
      queryClient.invalidateQueries({ queryKey: ["payment-providers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!can("payment_settings.read")) {
    return <p className="text-muted-foreground text-sm">Keine Berechtigung für Zahlungseinstellungen.</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Zahlungsanbieter</h1>
        <p className="text-muted-foreground text-sm">
          Stripe-Schlüssel liegen ausschließlich als Backend-Secret vor und sind hier nie sichtbar.
        </p>
      </header>

      <section className="grid gap-3 rounded-lg border p-4 sm:grid-cols-5">
        <div className="grid gap-1">
          <Label className="text-xs">Anbieter</Label>
          <Select
            value={provider}
            onValueChange={(v) => {
              setProvider(v as "stripe" | "mock");
              setDisplayName(v === "stripe" ? "Stripe" : "Test-Anbieter");
              if (v === "mock") setEnvironment("test");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stripe">Stripe</SelectItem>
              <SelectItem value="mock">Test-Anbieter</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Anzeigename</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Umgebung</Label>
          <Select value={environment} onValueChange={(v) => setEnvironment(v as "test" | "live")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="test">Test</SelectItem>
              <SelectItem value="live" disabled={provider === "mock"}>
                Live
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Priorität</Label>
          <Input value={priority} onChange={(e) => setPriority(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button
            disabled={!can("payment_settings.manage") || save.isPending}
            onClick={() =>
              save.mutate({
                provider,
                displayName,
                environment,
                status: "active",
                priority: Number(priority) || 100,
              })
            }
          >
            Aktivieren
          </Button>
        </div>
      </section>

      {configs.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : !configs.data?.length ? (
        <p className="text-muted-foreground text-sm">Noch kein Anbieter für diesen Shop aktiv.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Anbieter</th>
                <th className="p-3 font-medium">Umgebung</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Priorität</th>
                <th className="p-3 font-medium">Secret</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {configs.data.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-3">{c.displayName}</td>
                  <td className="p-3">
                    <Badge variant={c.environment === "live" ? "default" : "outline"}>{c.environment}</Badge>
                  </td>
                  <td className="p-3">{c.status === "active" ? "Aktiv" : "Inaktiv"}</td>
                  <td className="p-3">{c.priority}</td>
                  <td className="text-muted-foreground p-3">{c.secretRef ?? "—"}</td>
                  <td className="p-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!can("payment_settings.manage")}
                      onClick={() =>
                        save.mutate({
                          provider: c.provider as "stripe" | "mock",
                          displayName: c.displayName,
                          environment: c.environment,
                          status: c.status === "active" ? "inactive" : "active",
                          priority: c.priority,
                        })
                      }
                    >
                      {c.status === "active" ? "Deaktivieren" : "Aktivieren"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
