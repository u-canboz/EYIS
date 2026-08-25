import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="space-y-6">
      <header>
        <Link to="/app/automationen" className="text-sm text-muted-foreground hover:underline">
          ← Automationen
        </Link>
        <h1 className="font-display text-2xl font-semibold">Webhook-Ziele</h1>
        <p className="text-sm text-muted-foreground">
          Nur öffentlich erreichbare HTTPS-Adressen sind erlaubt. Jede Anfrage wird signiert;
          interne Netzwerkadressen und Weiterleitungen werden blockiert.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {endpoints.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (endpoints.data ?? []).length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Noch kein Webhook-Ziel hinterlegt.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {(endpoints.data ?? []).map((ep) => (
                <li key={ep.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{ep.name}</p>
                      <Badge variant={ep.status === "active" ? "secondary" : "outline"}>
                        {ep.status === "active" ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{ep.url}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(ep.id)}>
                    Entfernen
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Neues Ziel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="wh-name">Name</Label>
              <Input id="wh-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-url">HTTPS-Adresse</Label>
              <Input
                id="wh-url"
                placeholder="https://example.com/hooks/commerce"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-secret">Signaturschlüssel (Name des Secrets)</Label>
              <Input
                id="wh-secret"
                placeholder="z. B. PARTNER_WEBHOOK_SECRET"
                value={secretReference}
                onChange={(e) => setSecretReference(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={!name.trim() || !url.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              Ziel speichern
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
