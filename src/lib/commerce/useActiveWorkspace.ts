import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWorkspace } from "./workspace.functions";
import { useWorkspaceStore } from "./useWorkspaceStore";

/** Active organization, its shops and the permissions of the signed-in user. */
export function useActiveWorkspace() {
  const fetchWorkspace = useServerFn(getWorkspace);
  const { orgId } = useWorkspaceStore();
  const query = useQuery({ queryKey: ["workspace"], queryFn: () => fetchWorkspace() });

  const org = query.data?.organizations.find((o) => o.id === orgId) ?? query.data?.organizations[0];
  const shops = (query.data?.shops ?? []).filter((s) => s.organization_id === org?.id);
  const permissions = org?.permissions ?? [];

  return {
    isLoading: query.isLoading,
    organizationId: org?.id ?? "",
    organization: org,
    shops,
    shopId: shops[0]?.id ?? "",
    can: (permission: string) => permissions.includes(permission),
  };
}
