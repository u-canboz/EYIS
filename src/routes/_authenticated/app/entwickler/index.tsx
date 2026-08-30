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
import { PageHeader } from "@/eyis/shell/PageHeader";
import { Panel } from "@/eyis/shell/DetailLayout";
import { EmptyState, ListSkeleton } from "@/eyis/data/States";

export const Route = createFileRoute("/_authenticated/app/entwickler/")({
  head: () => ({
    meta: [
      { title: "Entwickler – Storefront-Keys – EYIS" },
      {
        name: "description",
        content:
          "Publishable Keys für externe Storefronts verwalten, Origins freigeben und Keys widerrufen.",
      },
      { property: "og:title", content: "Entwickler – Storefront-Keys – EYIS" },
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
    mutationFn: (keyId: string) =>
      updateKey({ data: { organizationId, keyId, status: "revoked" } }),
    onSuccess: () => {
      toast.success("Key widerrufen.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Entwickler"
        description={
          <>
            Publishable Keys identifizieren einen Shop gegenüber der Store API. Sie sind{" "}
            <strong>kein Geheimnis</strong> und dürfen im Browser-Bundle stehen. Jeder sensible
            Zugriff braucht zusätzlich einen echten Zugriffsnachweis (Cart-Token, Kunden-Session
            oder Guest-Token).
          </>
        }
        eyebrow={
          <>
            <Link to="/app/entwickler/api" className="min-h-11 items-center hover:text-foreground hover:underline">
              API-Referenz
            </Link>
            <Link to="/app/entwickler/protokoll" className="min-h-11 items-center hover:text-foreground hover:underline">
              Anfrage-Protokoll
            </Link>
          </>
        }
      />

      {freshKey ? (
        <Panel title="Neuer Key" className="border-primary">
          <div className="min-w-0 space-y-2">
            <code className="block min-w-0 break-all rounded-md bg-muted p-3 font-mono text-sm">
              {freshKey}
            </code>
            <p className="text-xs text-muted-foreground">
              Für Storefronts als <code>VITE_COMMERCE_PUBLISHABLE_KEY</code> hinterlegen. Wird nach
              dem Verlassen der Seite nicht erneut angezeigt.
            </p>
            <Button variant="secondary" size="sm" className="h-11" onClick={() => setFreshKey(null)}>
              Verstanden
            </Button>
          </div>
        </Panel>
      ) : null}

      <div className="grid min-w-0 gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-3 lg:col-span-2">
          {keys.isLoading ? (
            <ListSkeleton rows={3} />
          ) : (keys.data ?? []).length === 0 ? (
            <EmptyState title="Noch kein Key vorhanden" description="Erstelle rechts einen ersten Publishable Key für deine Storefront." />
          ) : (
            (keys.data ?? []).map((key) => (
              <Panel key={key.id}>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 truncate font-medium">{key.name}</span>
                      <Badge variant={key.environment === "live" ? "default" : "secondary"}>
                        {key.environment}
                      </Badge>
                      {key.status !== "active" ? (
                        <Badge variant="destructive">widerrufen</Badge>
                      ) : null}
                    </div>
                    <code className="block break-words font-mono text-xs text-muted-foreground">
                      {key.prefix}…
                    </code>
                    <p className="break-words text-xs text-muted-foreground">
                      Origins: {key.allowedOrigins.length ? key.allowedOrigins.join(", ") : "keine"}{" "}
                      · zuletzt genutzt:{" "}
                      {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString("de-DE") : "nie"}
                    </p>
                  </div>
                  {key.status === "active" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 shrink-0"
                      onClick={() => revoke.mutate(key.id)}
                      disabled={revoke.isPending}
                    >
                      Widerrufen
                    </Button>
                  ) : null}
                </div>
              </Panel>
            ))
          )}
        </div>

        <Panel title="Key erstellen">
          <div className="min-w-0 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                className="h-11"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Web-Storefront"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-env">Umgebung</Label>
              <select
                id="key-env"
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
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
              className="h-11 w-full"
              onClick={() => create.mutate()}
              disabled={!name.trim() || create.isPending}
            >
              Key erstellen
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
