import {
  createFileRoute,
  Outlet,
  useNavigate,
  Link,
  useRouterState,
  redirect,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspace } from "@/lib/commerce/workspace.functions";
import { roleLabel } from "@/lib/commerce/roles";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspaceStore } from "@/lib/commerce/useWorkspaceStore";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/app", label: "Übersicht" },
  { to: "/app/produkte", label: "Produkte" },
  { to: "/app/kategorien", label: "Kategorien" },
  { to: "/app/preise", label: "Preise" },
  { to: "/app/lager", label: "Lager" },
  { to: "/app/marketing/promotions", label: "Promotions" },
  { to: "/app/versand", label: "Versand" },
  { to: "/app/versand/versandarten", label: "Versandarten" },
  { to: "/app/steuern", label: "Steuern" },
  { to: "/app/warenkoerbe", label: "Warenkörbe" },
  { to: "/app/bestellungen", label: "Bestellungen" },
  { to: "/app/dokumente", label: "Dokumente" },
  { to: "/app/zahlungen", label: "Zahlungen" },
  { to: "/app/system/storefront-test", label: "Test-Storefront" },
  { to: "/app/medien", label: "Medien" },
  { to: "/app/team", label: "Team" },
  { to: "/app/shops", label: "Shops" },
  { to: "/app/audit", label: "Audit-Log" },
] as const;

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { orgId, setOrgId } = useWorkspaceStore();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/auth" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const fetchWorkspace = useServerFn(getWorkspace);
  const { data, isLoading } = useQuery({
    queryKey: ["workspace"],
    queryFn: () => fetchWorkspace(),
  });

  useEffect(() => {
    if (data?.organizations.length && !data.organizations.some((o) => o.id === orgId)) {
      setOrgId(data.organizations[0]!.id);
    }
  }, [data, orgId, setOrgId]);

  const activeOrg = data?.organizations.find((o) => o.id === orgId) ?? data?.organizations[0];

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar p-6 text-sidebar-foreground md:flex">
        <Link to="/" className="font-display text-lg font-semibold">
          Commerce OS
        </Link>

        <div className="mt-8">
          <p className="text-[11px] uppercase tracking-widest text-sidebar-foreground/50">
            Organisation
          </p>
          {isLoading || !data ? (
            <Skeleton className="mt-2 h-9 w-full" />
          ) : (
            <Select value={activeOrg?.id ?? ""} onValueChange={setOrgId}>
              <SelectTrigger className="mt-2 border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.organizations.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {activeOrg && (
            <p className="mt-2 text-xs text-sidebar-foreground/60">
              Deine Rolle: {roleLabel(activeOrg.role)}
            </p>
          )}
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active =
              item.to === "/app" ? pathname === "/app" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2 border-t border-sidebar-border pt-4">
          <p className="truncate text-xs text-sidebar-foreground/60">{data?.email}</p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
          >
            Abmelden
          </Button>
        </div>
      </aside>

      <main className="flex-1 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex gap-2 md:hidden">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} className="rounded-md border px-3 py-1.5 text-xs">
                {item.label}
              </Link>
            ))}
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
