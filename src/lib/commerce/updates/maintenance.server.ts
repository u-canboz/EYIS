import { getAdmin } from "../core.server";
import { resolveDeploymentMode } from "../environment";

/** A Dedicated update lock applies to every shop of its own organization. */
export async function isStoreMaintenance(
  organizationId: string,
  _shopId: string,
): Promise<boolean> {
  if (resolveDeploymentMode() !== "dedicated") return false;
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("commerce_installation")
    .select("maintenance_state")
    .eq("singleton", true)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return true;
  const state = (data as { maintenance_state?: string } | null)?.maintenance_state;
  return state === "updating" || state === "manual";
}
