import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import {
  listWebhookEndpointsFn,
  saveWebhookEndpointFn,
  deleteWebhookEndpointFn,
} from "@/lib/commerce/automation/automation.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shell/PageHeader";
import { DetailLayout, Panel } from "@/components/shell/DetailLayout";
import { EmptyState } from "@/components/data/States";

export const Route = createFileRoute("/_authenticated/app/automationen/webhooks")({
  head: () => ({
    meta: [
      { title: "Webhook-Ziele – Commerce OS" },
      {
        name: "description",
        content:
          "Eigene HTTPS-Adressen hinterlegen, an die Automationen signierte Ereignisdaten senden dürfen.",
      },
      { property: "og:title", content: "Webhook-Ziele – Commerce OS" },
      {
        property: "og:description",
        content: "Sichere Übergabe von Ereignisdaten an eigene Systeme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WebhookEndpoints,
});

function WebhookEndpoints() {
  const { organizationId, shopId } = useActiveWorkspace();
  const qc = useQueryClient();
  const enabled = !!organizationId && !!shopId;

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secretReference, setSecretReference] = useState("");

  const fetchEndpoints = useServerFn(listWebhookEndpointsFn);
  const saveEndpoint = useServerFn(saveWebhookEndpointFn);
  const removeEndpoint = useServerFn(deleteWebhookEndpointFn);

  const endpoints = useQuery({
    queryKey: ["webhook-endpoints", organizationId, shopId],
    enabled,
    queryFn: () => fetchEndpoints({ data: { organizationId, shopId } }),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["webhook-endpoints"] });

  const saveMutation = useMutation({
    mutationFn: () =>
      saveEndpoint({
        data: {
          organizationId,
          shopId,
          name,
          url,
          secretReference: secretReference || null,
          status: "active",
        },
      }),
    onSuccess: () => {
      toast.success("Webhook-Ziel gespeichert.");
      setName("");
      setUrl("");
      setSecretReference("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (endpointId: string) => removeEndpoint({ data: { organizationId, endpointId } }),
    onSuccess: () => {
      toast.success("Webhook-Ziel entfernt.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        eyebrow={
          <Link
            to="/app/automationen"
            className="inline-flex min-h-11 items-center gap-1.5 hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
            Automationen
          </Link>
        }
        title="Webhook-Ziele"
        description="Nur öffentlich erreichbare HTTPS-Adressen sind erlaubt. Jede Anfrage wird signiert; interne Netzwerkadressen und Weiterleitungen werden blockiert."
      />

      <DetailLayout
        main={
          <Panel title="Ziele">
            {endpoints.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (endpoints.data ?? []).length === 0 ? (
              <EmptyState title="Noch kein Webhook-Ziel hinterlegt" />
            ) : (
              <ul className="min-w-0 divide-y divide-border">
                {(endpoints.data ?? []).map((ep) => (
                  <li
                    key={ep.id}
                    className="grid min-w-0 grid-cols-1 gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-medium">{ep.name}</p>
                        <Badge variant={ep.status === "active" ? "secondary" : "outline"}>
                          {ep.status === "active" ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </div>
                      <p className="min-w-0 truncate text-sm text-muted-foreground">{ep.url}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => deleteMutation.mutate(ep.id)}
                    >
                      Entfernen
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        }
        aside={
          <Panel title="Neues Ziel" bodyClassName="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="wh-name">Name</Label>
              <Input
                id="wh-name"
                className="h-11"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-url">HTTPS-Adresse</Label>
              <Input
                id="wh-url"
                className="h-11"
                placeholder="https://example.com/hooks/commerce"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-secret">Signaturschlüssel (Name des Secrets)</Label>
              <Input
                id="wh-secret"
                className="h-11"
                placeholder="z. B. PARTNER_WEBHOOK_SECRET"
                value={secretReference}
                onChange={(e) => setSecretReference(e.target.value)}
              />
            </div>
            <Button
              className="h-11 w-full"
              disabled={!name.trim() || !url.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              Ziel speichern
            </Button>
          </Panel>
        }
      />
    </div>
  );
}
