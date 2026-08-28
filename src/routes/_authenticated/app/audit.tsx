import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAuditLog } from "@/lib/commerce/workspace.functions";
import { useWorkspaceStore } from "@/lib/commerce/useWorkspaceStore";
import { ACTION_LABELS } from "@/lib/commerce/roles";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel } from "@/components/shell/DetailLayout";
import { EmptyState, ListSkeleton } from "@/components/data/States";

export const Route = createFileRoute("/_authenticated/app/audit")({
  head: () => ({
    meta: [
      { title: "Audit-Log – EYIS" },
      {
        name: "description",
        content: "Revisionssicheres, unveränderliches Protokoll aller Änderungen der Organisation.",
      },
      { property: "og:title", content: "Audit-Log – EYIS" },
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
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Audit-Log"
        description="Nur Einfügen – Einträge können weder geändert noch gelöscht werden, auch nicht serverseitig."
      />

      {log.isLoading ? (
        <ListSkeleton />
      ) : (log.data ?? []).length === 0 ? (
        <EmptyState title="Noch keine Ereignisse" description="Sobald Änderungen an der Organisation vorgenommen werden, erscheinen sie hier." />
      ) : (
        <Panel bodyClassName="p-0">
          <div className="min-w-0 divide-y divide-border">
            {(log.data ?? []).map((entry) => (
              <div key={entry.id} className="grid min-w-0 grid-cols-1 gap-2 p-4 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center sm:gap-3">
                <Badge variant="outline" className="w-fit font-normal">
                  {entry.entity_type}
                </Badge>
                <span className="min-w-0 truncate text-sm font-medium">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </span>
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {entry.actor_email ?? entry.actor_id ?? "System"}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground sm:ml-auto">
                  {new Date(entry.created_at).toLocaleString("de-DE")}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
