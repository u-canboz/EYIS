import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWorkspace } from "@/lib/commerce/workspace.functions";
import { listTeam } from "@/lib/commerce/team.functions";
import { useWorkspaceStore } from "@/lib/commerce/useWorkspaceStore";
import { roleLabel } from "@/lib/commerce/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "Übersicht – Commerce OS" },
      { name: "description", content: "Kennzahlen zu Organisation, Shops und Team." },
      { property: "og:title", content: "Übersicht – Commerce OS" },
      { property: "og:description", content: "Kennzahlen zu Organisation, Shops und Team." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { orgId } = useWorkspaceStore();
  const fetchWorkspace = useServerFn(getWorkspace);
  const fetchTeam = useServerFn(listTeam);

  const workspace = useQuery({ queryKey: ["workspace"], queryFn: () => fetchWorkspace() });
  const team = useQuery({
    queryKey: ["team", orgId],
    queryFn: () => fetchTeam({ data: { organizationId: orgId } }),
    enabled: !!orgId,
  });

  const org = workspace.data?.organizations.find((o) => o.id === orgId);
  const shops = (workspace.data?.shops ?? []).filter((s) => s.organization_id === orgId);

  if (workspace.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Phase 0 · Fundament</p>
        <h1 className="mt-1 text-3xl font-semibold">{org?.name ?? "Organisation"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Mandanten, Shops und Rollen sind eingerichtet. Alle Änderungen werden revisionssicher
          protokolliert.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Shops" value={shops.length} />
        <Stat label="Mitglieder" value={team.data?.members.length ?? 0} />
        <Stat
          label="Offene Einladungen"
          value={team.data?.invitations.filter((i) => i.status === "pending").length ?? 0}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shops</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {shops.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  /{s.slug} · {s.currency} · {s.locale}
                </p>
              </div>
              <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
            </div>
          ))}
          <Link to="/app/shops" className="inline-block text-sm text-primary underline">
            Shops verwalten
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deine Berechtigungen</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">Rolle: {roleLabel(org?.role ?? "")}</p>
          <div className="flex flex-wrap gap-1.5">
            {(org?.permissions ?? []).map((p) => (
              <Badge key={p} variant="outline" className="font-normal">
                {p}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
