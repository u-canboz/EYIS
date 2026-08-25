import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  createStoreKeyFn,
  listStoreKeysFn,
  updateStoreKeyFn,
} from "@/lib/commerce/store/store.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/app/entwickler/")({
  head: () => ({
    meta: [
      { title: "Entwickler – Storefront-Keys – Commerce OS" },
      {
        name: "description",
        content:
          "Publishable Keys für externe Storefronts verwalten, Origins freigeben und Keys widerrufen.",
      },
      { property: "og:title", content: "Entwickler – Storefront-Keys – Commerce OS" },
      {
        property: "og:description",
        content: "Publishable Keys, erlaubte Origins und Widerruf für die öffentliche Store API.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeveloperKeys,
});

function DeveloperKeys() {
  const { organizationId, shopId } = useActiveWorkspace();
  const qc = useQueryClient();
  const enabled = !!organizationId && !!shopId;

  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"test" | "live">("test");
  const [origins, setOrigins] = useState("");
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const fetchKeys = useServerFn(listStoreKeysFn);
  const createKey = useServerFn(createStoreKeyFn);
  const updateKey = useServerFn(updateStoreKeyFn);

  const keys = useQuery({
    queryKey: ["store-keys", organizationId, shopId],
    enabled,
    queryFn: () => fetchKeys({ data: { organizationId, shopId } }),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["store-keys"] });

  const create = useMutation({
    mutationFn: () =>
      createKey({
        data: {
          organizationId,
          shopId,
          name: name.trim(),
          environment,
          allowedOrigins: origins
            .split(/[\n,]/)
            .map((o) => o.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: (result) => {
      setFreshKey(result.key);
      setName("");
      setOrigins("");
      toast.success("Key erstellt. Er wird genau einmal angezeigt.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (keyId: string) => updateKey({ data: { organizationId, keyId, status: "revoked" } }),
    onSuccess: () => {
      toast.success("Key widerrufen.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">Entwickler</h1>
        <p className="text-sm text-muted-foreground">
          Publishable Keys identifizieren einen Shop gegenüber der Store API. Sie sind{" "}
          <strong>kein Geheimnis</strong> und dürfen im Browser-Bundle stehen. Jeder sensible Zugriff
          braucht zusätzlich einen echten Zugriffsnachweis (Cart-Token, Kunden-Session oder
          Guest-Token).
        </p>
        <Link to="/app/entwickler/protokoll" className="text-sm text-primary hover:underline">
          Anfrage-Protokoll ansehen →
        </Link>
      </header>

      {freshKey ? (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-base">Neuer Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <code className="block break-all rounded-md bg-muted p-3 font-mono text-sm">{freshKey}</code>
            <p className="text-xs text-muted-foreground">
              Für Storefronts als <code>VITE_COMMERCE_PUBLISHABLE_KEY</code> hinterlegen. Wird nach dem
              Verlassen der Seite nicht erneut angezeigt.
            </p>
            <Button variant="secondary" size="sm" onClick={() => setFreshKey(null)}>
              Verstanden
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {keys.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (keys.data ?? []).length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Noch kein Key vorhanden.
            </p>
          ) : (
            (keys.data ?? []).map((key) => (
              <Card key={key.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{key.name}</span>
                      <Badge variant={key.environment === "live" ? "default" : "secondary"}>
                        {key.environment}
                      </Badge>
                      {key.status !== "active" ? <Badge variant="destructive">widerrufen</Badge> : null}
                    </div>
                    <code className="font-mono text-xs text-muted-foreground">{key.prefix}…</code>
                    <p className="text-xs text-muted-foreground">
                      Origins: {key.allowedOrigins.length ? key.allowedOrigins.join(", ") : "keine"} ·
                      zuletzt genutzt:{" "}
                      {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString("de-DE") : "nie"}
                    </p>
                  </div>
                  {key.status === "active" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => revoke.mutate(key.id)}
                      disabled={revoke.isPending}
                    >
                      Widerrufen
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Key erstellen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Web-Storefront"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-env">Umgebung</Label>
              <select
                id="key-env"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as "test" | "live")}
              >
                <option value="test">Test</option>
                <option value="live">Live</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-origins">Erlaubte Origins</Label>
              <textarea
                id="key-origins"
                className="min-h-24 w-full rounded-md border bg-background p-3 text-sm"
                value={origins}
                onChange={(e) => setOrigins(e.target.value)}
                placeholder={"https://shop.example.com\nhttps://www.example.com"}
              />
              <p className="text-xs text-muted-foreground">
                Origin-Prüfung ist Zusatzschutz, kein Ersatz für Authentifizierung.
              </p>
            </div>
            <Button
              className="w-full"
              onClick={() => create.mutate()}
              disabled={!name.trim() || create.isPending}
            >
              Key erstellen
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
