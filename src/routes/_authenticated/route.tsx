import { createFileRoute, Outlet, useNavigate, useRouterState, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspace } from "@/lib/commerce/workspace.functions";
import { roleLabel } from "@/lib/commerce/roles";
import { AppShell } from "@/components/shell/AppShell";
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
  const isDemoOrg =
    !!activeOrg &&
    (activeOrg.slug.startsWith("commerce-os-demo") || activeOrg.slug.startsWith("qa-fixture-"));

  return (
    <AppShell
      pathname={pathname}
      organizations={data?.organizations ?? []}
      activeOrgId={activeOrg?.id ?? ""}
      onOrgChange={setOrgId}
      roleLabel={activeOrg ? roleLabel(activeOrg.role) : undefined}
      email={data?.email}
      isLoading={isLoading || !data}
      isDemo={isDemoOrg}
      onSignOut={async () => {
        await supabase.auth.signOut();
        navigate({ to: "/auth" });
      }}
    >
      <Outlet />
    </AppShell>
  );
}

