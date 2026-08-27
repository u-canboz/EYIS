import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listProviderConfigsFn,
  upsertProviderConfigFn,
} from "@/lib/commerce/payments/payment.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel } from "@/components/shell/DetailLayout";
import { RecordCard, RecordCardList } from "@/components/data/RecordCard";
import { TableScroll } from "@/components/data/TableScroll";
import { EmptyState, ListSkeleton, PermissionState } from "@/components/data/States";

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
    return <PermissionState what="Zahlungseinstellungen" />;
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Zahlungsanbieter"
        description="Stripe-Schlüssel liegen ausschließlich als Backend-Secret vor und sind hier nie sichtbar."
      />

      <Panel title="Anbieter hinzufügen" bodyClassName="grid gap-3 sm:grid-cols-5">
        <div className="grid gap-1.5">
          <Label className="text-xs">Anbieter</Label>
          <Select
            value={provider}
            onValueChange={(v) => {
              setProvider(v as "stripe" | "mock");
              setDisplayName(v === "stripe" ? "Stripe" : "Test-Anbieter");
              if (v === "mock") setEnvironment("test");
            }}
          >
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stripe">Stripe</SelectItem>
              <SelectItem value="mock">Test-Anbieter</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Anzeigename</Label>
          <Input className="h-11" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Umgebung</Label>
          <Select value={environment} onValueChange={(v) => setEnvironment(v as "test" | "live")}>
            <SelectTrigger className="h-11">
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
        <div className="grid gap-1.5">
          <Label className="text-xs">Priorität</Label>
          <Input className="h-11" value={priority} onChange={(e) => setPriority(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button
            className="h-11 w-full"
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
      </Panel>

      {configs.isLoading ? (
        <ListSkeleton />
      ) : !configs.data?.length ? (
        <EmptyState
          title="Noch kein Anbieter aktiv"
          description="Für diesen Shop wurde noch kein Zahlungsanbieter aktiviert."
        />
      ) : (
        <>
          <RecordCardList>
            {configs.data.map((c) => (
              <RecordCard
                key={c.id}
                title={c.displayName}
                subtitle={`Priorität ${c.priority}`}
                badges={
                  <>
                    <Badge variant={c.environment === "live" ? "default" : "outline"}>
                      {c.environment}
                    </Badge>
                    <Badge variant="secondary">{c.status === "active" ? "Aktiv" : "Inaktiv"}</Badge>
                  </>
                }
                fields={[{ label: "Secret", value: c.secretRef ?? "—" }]}
                actions={
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-11"
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
                }
              />
            ))}
          </RecordCardList>

          <TableScroll desktopOnly>
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
                  <tr key={c.id} className="border-t hover:bg-muted/40">
                    <td className="p-3">{c.displayName}</td>
                    <td className="p-3">
                      <Badge variant={c.environment === "live" ? "default" : "outline"}>
                        {c.environment}
                      </Badge>
                    </td>
                    <td className="p-3">{c.status === "active" ? "Aktiv" : "Inaktiv"}</td>
                    <td className="p-3 tabular-nums">{c.priority}</td>
                    <td className="p-3 text-muted-foreground">{c.secretRef ?? "—"}</td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9"
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
          </TableScroll>
        </>
      )}
    </div>
  );
}
