import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listStoreKeysFn, listStoreLogsFn } from "@/lib/commerce/store/store.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/app/entwickler/protokoll")({
  head: () => ({
    meta: [
      { title: "Store-API-Protokoll – Commerce OS" },
      {
        name: "description",
        content:
          "Anfragen der öffentlichen Store API nachvollziehen: Route, Status, Dauer und Fehlercode – ohne personenbezogene Daten.",
      },
      { property: "og:title", content: "Store-API-Protokoll – Commerce OS" },
      {
        property: "og:description",
        content: "Privacy-sicheres Protokoll aller Storefront-Anfragen mit Request-ID-Korrelation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StoreApiLogs,
});

function StoreApiLogs() {
  const { organizationId, shopId } = useActiveWorkspace();
  const enabled = !!organizationId && !!shopId;
  const [keyId, setKeyId] = useState<string | null>(null);
  const [onlyErrors, setOnlyErrors] = useState(false);

  const fetchKeys = useServerFn(listStoreKeysFn);
  const fetchLogs = useServerFn(listStoreLogsFn);

  const keys = useQuery({
    queryKey: ["store-keys", organizationId, shopId],
    enabled,
    queryFn: () => fetchKeys({ data: { organizationId, shopId } }),
  });

  const logs = useQuery({
    queryKey: ["store-logs", organizationId, shopId, keyId, onlyErrors],
    enabled,
    refetchInterval: 15000,
    queryFn: () => fetchLogs({ data: { organizationId, shopId, keyId, onlyErrors } }),
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link to="/app/entwickler" className="text-sm text-muted-foreground hover:underline">
          ← Entwickler
        </Link>
        <h1 className="font-display text-2xl font-semibold">Store-API-Protokoll</h1>
        <p className="text-sm text-muted-foreground">
          Jede Anfrage erhält eine Request-ID. IP-Adressen werden nur als täglich neu gesalzener Hash
          gespeichert und nie angezeigt.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={keyId ?? ""}
          onChange={(e) => setKeyId(e.target.value || null)}
        >
          <option value="">Alle Keys</option>
          {(keys.data ?? []).map((k) => (
            <option key={k.id} value={k.id}>
              {k.name} ({k.environment})
            </option>
          ))}
        </select>
        <Button variant={onlyErrors ? "default" : "outline"} size="sm" onClick={() => setOnlyErrors((v) => !v)}>
          Nur Fehler
        </Button>
      </div>

      {logs.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (logs.data ?? []).length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Noch keine Anfragen protokolliert.
        </p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {(logs.data ?? []).map((log) => (
                <div key={log.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <Badge variant={log.statusCode >= 400 ? "destructive" : "secondary"}>
                    {log.statusCode}
                  </Badge>
                  <span className="font-mono text-xs">{log.method}</span>
                  <span className="flex-1 truncate font-mono text-xs">{log.route}</span>
                  <span className="text-xs text-muted-foreground">{log.durationMs} ms</span>
                  {log.errorCode ? (
                    <span className="text-xs text-destructive">{log.errorCode}</span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString("de-DE")}
                  </span>
                  <code className="w-full text-[10px] text-muted-foreground">{log.requestId}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
