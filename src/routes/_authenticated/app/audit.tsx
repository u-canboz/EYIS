import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAuditLog } from "@/lib/commerce/workspace.functions";
import { useWorkspaceStore } from "@/lib/commerce/useWorkspaceStore";
import { ACTION_LABELS } from "@/lib/commerce/roles";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/audit")({
  head: () => ({
    meta: [
      { title: "Audit-Log – Commerce OS" },
      {
        name: "description",
        content: "Revisionssicheres, unveränderliches Protokoll aller Änderungen der Organisation.",
      },
      { property: "og:title", content: "Audit-Log – Commerce OS" },
      {
        property: "og:description",
        content: "Revisionssicheres, unveränderliches Protokoll aller Änderungen der Organisation.",
      },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const { orgId } = useWorkspaceStore();
  const fetchLog = useServerFn(listAuditLog);
  const log = useQuery({
    queryKey: ["audit", orgId],
    queryFn: () => fetchLog({ data: { organizationId: orgId } }),
    enabled: !!orgId,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Audit-Log</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nur Einfügen – Einträge können weder geändert noch gelöscht werden, auch nicht
          serverseitig.
        </p>
      </header>

      {log.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {(log.data ?? []).length === 0 && (
              <p className="p-6 text-sm text-muted-foreground">Noch keine Ereignisse.</p>
            )}
            {(log.data ?? []).map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center gap-3 p-4">
                <Badge variant="outline" className="font-normal">
                  {entry.entity_type}
                </Badge>
                <span className="text-sm font-medium">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </span>
                <span className="text-xs text-muted-foreground">
                  {entry.actor_email ?? entry.actor_id ?? "System"}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(entry.created_at).toLocaleString("de-DE")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
