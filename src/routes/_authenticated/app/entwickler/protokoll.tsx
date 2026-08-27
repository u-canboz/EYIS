import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listStoreKeysFn, listStoreLogsFn } from "@/lib/commerce/store/store.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shell/PageHeader";
import { FilterBar } from "@/components/data/FilterBar";
import { RecordCard, RecordCardList } from "@/components/data/RecordCard";
import { TableScroll } from "@/components/data/TableScroll";
import { EmptyState, ListSkeleton } from "@/components/data/States";

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

  const activeFilters = (keyId ? 1 : 0) + (onlyErrors ? 1 : 0);

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        eyebrow={
          <Link to="/app/entwickler" className="inline-flex min-h-11 items-center gap-1.5 hover:text-foreground hover:underline">
            ← Entwickler
          </Link>
        }
        title="Store-API-Protokoll"
        description="Jede Anfrage erhält eine Request-ID. IP-Adressen werden nur als täglich neu gesalzener Hash gespeichert und nie angezeigt."
      />

      <FilterBar
        activeCount={activeFilters}
        onReset={() => {
          setKeyId(null);
          setOnlyErrors(false);
        }}
        filters={
          <>
            <Select value={keyId ?? "all"} onValueChange={(v) => setKeyId(v === "all" ? null : v)}>
              <SelectTrigger aria-label="Alle Keys" className="h-11 w-full md:w-56">
                <SelectValue placeholder="Alle Keys" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Keys</SelectItem>
                {(keys.data ?? []).map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.name} ({k.environment})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={onlyErrors ? "default" : "outline"}
              className="h-11 w-full md:w-auto"
              onClick={() => setOnlyErrors((v) => !v)}
            >
              Nur Fehler
            </Button>
          </>
        }
      />

      {logs.isLoading ? (
        <ListSkeleton />
      ) : (logs.data ?? []).length === 0 ? (
        <EmptyState title="Noch keine Anfragen protokolliert" description="Sobald eine Storefront die Store API nutzt, erscheinen hier die Anfragen." />
      ) : (
        <>
          <RecordCardList>
            {(logs.data ?? []).map((log) => (
              <RecordCard
                key={log.id}
                title={<span className="font-mono text-sm">{log.method} {log.route}</span>}
                subtitle={new Date(log.createdAt).toLocaleString("de-DE")}
                trailing={`${log.durationMs} ms`}
                badges={
                  <>
                    <Badge variant={log.statusCode >= 400 ? "destructive" : "secondary"}>
                      {log.statusCode}
                    </Badge>
                    {log.errorCode ? (
                      <Badge variant="outline" className="text-destructive">
                        {log.errorCode}
                      </Badge>
                    ) : null}
                  </>
                }
                fields={[{ label: "Request-ID", value: log.requestId }]}
              />
            ))}
          </RecordCardList>

          <TableScroll desktopOnly>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Methode</th>
                  <th className="p-3 font-medium">Route</th>
                  <th className="p-3 font-medium">Dauer</th>
                  <th className="p-3 font-medium">Fehler</th>
                  <th className="p-3 font-medium">Zeitpunkt</th>
                  <th className="p-3 font-medium">Request-ID</th>
                </tr>
              </thead>
              <tbody>
                {(logs.data ?? []).map((log) => (
                  <tr key={log.id} className="border-t hover:bg-muted/40">
                    <td className="p-3">
                      <Badge variant={log.statusCode >= 400 ? "destructive" : "secondary"}>
                        {log.statusCode}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono text-xs">{log.method}</td>
                    <td className="max-w-[20rem] truncate p-3 font-mono text-xs">{log.route}</td>
                    <td className="p-3 tabular-nums">{log.durationMs} ms</td>
                    <td className="p-3 text-xs text-destructive">{log.errorCode ?? "—"}</td>
                    <td className="p-3 whitespace-nowrap tabular-nums text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("de-DE")}
                    </td>
                    <td className="max-w-[10rem] truncate p-3 font-mono text-[10px] text-muted-foreground">
                      {log.requestId}
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
